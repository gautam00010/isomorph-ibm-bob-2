# ISOMORPH — Deep Architecture
## Build Architecture for Hostile Technical Judging

**Version**: 1.0  
**Scope**: JavaScript/TypeScript only (per AGENTS.md — no premature multi-language abstraction)  
**Stack**: TypeScript backend (Node.js) + React frontend, both in one monorepo  
**Why TypeScript backend**: The target language is JS/TS. The parser, differ, and test runner all operate on JS/TS source. Using TypeScript as the implementation language eliminates a language-crossing impedance mismatch at the Tree-sitter API boundary and at the test execution boundary. The entire pipeline lives in one type system.

---

## Revision to Prior Architecture

Prior planning documents specified a Python backend. This document supersedes that choice for the following reason: AGENTS.md mandates "JavaScript/TypeScript first" and "no premature multi-language abstraction." Parsing, diffing, and executing JS/TS source in Python introduces unnecessary serialization and subprocess boundaries. A TypeScript backend collapses the stack to one language, one type system, one module graph, one CI configuration.

**Changed from prior docs:**
- Backend: TypeScript (Node.js + Fastify) instead of Python + FastAPI
- Test execution: Node.js `child_process` sandbox instead of Python subprocess
- All intermediate representations: TypeScript interfaces (shared with frontend via package)
- IBM Bob: called from TypeScript via `@ibm-cloud/watsonx-ai` SDK

**Unchanged from prior docs:**
- Tree-sitter for parsing (TypeScript binding: `tree-sitter` + `tree-sitter-javascript` + `tree-sitter-typescript`)
- Five-layer pipeline order (parse → diff → classify → AI → evidence → proof)
- All intermediate representation schemas
- All AGENTS.md constitutional rules
- Change Proof as the central output artifact

---

## Repository Structure

```
isomorph/
├── packages/
│   ├── shared/               # Shared TypeScript types (IR schemas)
│   │   └── src/
│   │       ├── types.ts      # All IR interfaces: CSTNode, DiffNode, RiskEntry, etc.
│   │       └── schemas.ts    # Zod schemas for runtime validation
│   ├── engine/               # Deterministic analysis (no Bob imports)
│   │   └── src/
│   │       ├── parser.ts     # Layer 1: Tree-sitter CST → CSTNode
│   │       ├── differ.ts     # Layer 2: CSTNode pair → StructuralDiff
│   │       ├── classifier.ts # Layer 3: StructuralDiff → RiskMap
│   │       └── index.ts
│   ├── bob/                  # AI reasoning (imports engine types, not engine logic)
│   │   └── src/
│   │       ├── orchestrator.ts
│   │       ├── prompts.ts    # All prompt templates, versioned
│   │       └── index.ts
│   ├── evidence/             # Test execution (imports engine types only)
│   │   └── src/
│   │       ├── runner.ts     # Sandboxed Node.js execution
│   │       └── index.ts
│   ├── proof/                # Change Proof assembly
│   │   └── src/
│   │       ├── assembler.ts
│   │       └── index.ts
│   └── api/                  # Fastify HTTP server (orchestrates, no logic)
│       └── src/
│           ├── routes.ts
│           ├── server.ts
│           └── index.ts
├── apps/
│   └── frontend/             # React + Vite + TypeScript
│       └── src/
│           ├── components/
│           │   ├── StructuralDiffViewer.tsx
│           │   ├── RiskPanel.tsx
│           │   ├── ChangeProofPanel.tsx
│           │   └── DemoInput.tsx
│           ├── lib/
│           │   ├── api.ts
│           │   └── useAnalysis.ts
│           └── App.tsx
├── demo/
│   ├── fixtures/
│   │   ├── before.ts         # Locked demo corpus (JS/TS)
│   │   └── after.ts          # Locked demo corpus (JS/TS)
│   └── cached/
│       └── bob-annotations.json  # Pre-fetched Bob responses
├── docker-compose.yml
└── turbo.json                # Turborepo build graph
```

**Package dependency graph** (enforced by turbo.json and tsconfig references):
```
shared ← engine ← classifier ← bob
shared ← engine ← evidence
shared ← engine ← proof
shared ← api (imports all packages)
shared ← frontend
```
No package imports from a downstream package. Cycles are build errors.

---

## Layer 1 — Parsing

### Responsibility
Transform a raw TypeScript/JavaScript source string into a canonical, content-hashed `CSTNode` tree.

### Technology
- `tree-sitter` Node.js binding
- `tree-sitter-javascript` grammar
- `tree-sitter-typescript` grammar (TypeScript variant)
- Language detection: file extension or explicit `language` parameter

### Core Types (packages/shared/src/types.ts)
```typescript
interface SourceRange {
  startLine: number;   // 1-based
  startCol: number;
  endLine: number;
  endCol: number;
}

interface CSTNode {
  id: string;                    // stable path: "FunctionDeclaration[0]/BlockStatement[0]"
  type: string;                  // tree-sitter node type: "function_declaration", "if_statement", etc.
  signatureHash: string;         // SHA-256 of: type + children types + own text (normalized)
  subtreeHash: string;           // SHA-256 of full subtree (type + all descendant text)
  text: string;                  // node's own text (not children)
  range: SourceRange;
  children: CSTNode[];
  isNamed: boolean;              // tree-sitter named vs anonymous node
  fieldName?: string;            // tree-sitter field (e.g., "condition", "body", "left")
}
```

### Hash Design
Two hashes serve distinct purposes:

| Hash | Inputs | Purpose |
|---|---|---|
| `signatureHash` | `node.type + fieldName + normalized_own_text` | Node identity for matching. Stable across whitespace and comment changes. |
| `subtreeHash` | `node.type + all descendant normalized_text` | Full subtree equality. Two nodes with identical `subtreeHash` are structurally identical. |

**Normalization rules for hash inputs:**
1. Collapse all whitespace runs to single space
2. Strip line comments (`//`, `/* */`)
3. Preserve string literal content (do not normalize inside strings)
4. Preserve numeric literals exactly
5. Normalize template literals: collapse whitespace in tagged template strings

These rules are encoded as a single `normalizeText(raw: string): string` pure function with unit tests for every rule.

### Stability Contract
- `CSTNode` is deterministic: `parse(source, language)` always returns the same tree for the same source
- `signatureHash` is stable across cosmetic reformatting of the same logical node
- `subtreeHash` changes if any descendant's normalized text changes
- `id` is a stable path string, not a memory address

### What Tree-sitter Does Not Guarantee
- Grammar completeness for all TypeScript syntax (generics, decorators, complex conditional types can produce `ERROR` nodes)
- `ERROR` nodes are preserved in the tree and flagged as `type: "ERROR"` — they are not silently dropped
- Any node with `type: "ERROR"` causes its ancestor function/class to be classified `UNKNOWN` risk

### Parser API
```typescript
// packages/engine/src/parser.ts
export function parse(source: string, language: "javascript" | "typescript"): CSTNode;
export class ParseError extends Error { readonly source: string; readonly line: number; }
```

---

## Layer 2 — Structural Differencing

### Responsibility
Given two `CSTNode` trees (before/after), produce a `StructuralDiff` that classifies every node-level change. The algorithm is deterministic and purely structural — it has no knowledge of programming language semantics.

### Change Types
```typescript
type ChangeType =
  | "UNCHANGED"   // subtreeHash identical
  | "COSMETIC"    // only whitespace/comment diff, signatureHash identical
  | "MODIFIED"    // same node position, different subtreeHash
  | "INSERTED"    // node present in after, absent in before
  | "DELETED"     // node present in before, absent in after
  | "MOVED"       // subtreeHash present in both trees at different positions
  | "REWRITTEN"   // large subtree replaced — no matching subtree in other version
  | "UNKNOWN";    // contains ERROR nodes, cannot be classified
```

### Core Types
```typescript
interface DiffNode {
  nodeId: string;               // stable path (from CSTNode.id)
  changeType: ChangeType;
  beforeHash?: string;          // subtreeHash of before node (if existed)
  afterHash?: string;           // subtreeHash of after node (if existed)
  beforeRange?: SourceRange;
  afterRange?: SourceRange;
  nodeType: string;             // tree-sitter node type
  fieldName?: string;
  subChanges: DiffNode[];       // child-level diff (populated for MODIFIED nodes)
  movedFrom?: string;           // nodeId of source (for MOVED nodes)
  textBefore?: string;          // normalized text of before node (for MODIFIED/DELETED)
  textAfter?: string;           // normalized text of after node (for MODIFIED/INSERTED)
}

type StructuralDiff = DiffNode[];
```

### Algorithm: Top-Down Anchored Matching

The differ uses a three-pass algorithm:

**Pass 1 — Exact subtree matching**
Walk both trees top-down. For each pair of nodes at the same path position:
- If `subtreeHash` matches: mark `UNCHANGED`, prune subtree (no need to recurse)
- If `signatureHash` matches but `subtreeHash` differs: mark `MODIFIED`, recurse into children
- Otherwise: proceed to Pass 2

**Pass 2 — Hash-based move detection**
Build two sets: `beforeSubtreeHashes` and `afterSubtreeHashes`.
A node with `subtreeHash` present in both sets but at different `nodeId` paths is `MOVED`.
Move detection is limited to function-level and class-level nodes (not expression-level, to avoid combinatorial explosion).

**Pass 3 — Cosmetic classification**
For nodes classified `MODIFIED` by Pass 1: if the only textual differences are in whitespace tokens and comment tokens (determined by re-diffing with whitespace-stripped versions), reclassify as `COSMETIC`.

**Why this algorithm is defensible under hostile questioning:**
- It makes no semantic assumptions. It is purely structural.
- It is O(n log n) in tree size for Pass 1+3 and O(n²) worst-case for Pass 2 move detection (bounded by limiting move detection scope).
- It is deterministic: same inputs → same output, always.
- It is auditable: every `DiffNode` carries the hashes that produced the classification.

### Known Limitations
- Move detection limited to top-level declarations: function moves detected, expression-level moves not detected
- Large refactors (extract method, inline) produce `INSERTED` + `DELETED` pairs — heuristic detection is attempted but not guaranteed
- TypeScript type-only changes (interface fields, generic constraints) produce structural diffs that may not reflect runtime behavior changes — this is documented, not hidden

### Differ API
```typescript
// packages/engine/src/differ.ts
export function diff(before: CSTNode, after: CSTNode): StructuralDiff;
```

---

## Layer 3 — Change Classification

### Responsibility
For each `DiffNode` in the `StructuralDiff`, assign a `ClassificationEntry` with:
- A `RiskLevel` (HIGH / MEDIUM / LOW / COSMETIC / UNKNOWN)
- A set of named `RiskSignal`s (the evidence for the risk level)
- A human-readable label

This layer is **purely heuristic and rule-based**. It does not claim to detect all behavioral changes. It claims to detect the specific signal patterns listed below.

### Risk Signals (Exhaustive List)
```typescript
type RiskSignal =
  // Control flow
  | "control_flow_condition_changed"     // if/else/switch condition modified
  | "control_flow_branch_removed"        // entire if/else branch deleted
  | "loop_bound_changed"                 // for/while condition modified
  | "return_value_changed"               // return expression modified
  | "early_return_added"                 // new return before end of function
  | "early_return_removed"               // return removed from non-terminal position
  | "throw_removed"                      // throw statement deleted
  | "exception_catch_removed"            // catch clause deleted
  // Data flow
  | "assignment_target_changed"          // left-hand side of assignment changed
  | "assignment_value_changed"           // right-hand side changed in assignment
  | "variable_initialization_removed"    // let/const initializer removed
  // Interface
  | "parameter_added"                    // function gains a parameter
  | "parameter_removed"                  // function loses a parameter
  | "parameter_type_changed"             // TypeScript type annotation changed
  | "return_type_changed"                // TypeScript return type annotation changed
  | "export_added"                       // symbol becomes exported
  | "export_removed"                     // symbol stops being exported
  // Side effects
  | "async_removed"                      // async keyword removed from function
  | "await_removed"                      // await expression removed
  | "side_effect_call_changed"           // call to known side-effect function changed
  // Cosmetic
  | "whitespace_only"
  | "comment_only"
  | "rename_binding"                     // identifier renamed, no logic change
  // Meta
  | "contains_parse_error"               // subtree has ERROR nodes
  | "unknown";
```

### Risk Level Rules (Deterministic)
```
HIGH if any of:
  control_flow_condition_changed
  control_flow_branch_removed
  loop_bound_changed
  early_return_removed
  throw_removed
  exception_catch_removed
  return_value_changed (AND node is a function)
  async_removed

MEDIUM if any of:
  parameter_added OR parameter_removed
  parameter_type_changed
  return_type_changed
  export_added OR export_removed
  await_removed
  assignment_target_changed
  early_return_added

LOW if any of:
  assignment_value_changed
  variable_initialization_removed
  side_effect_call_changed
  return_value_changed (AND node is not a function — intermediate expr)
  rename_binding

COSMETIC if:
  whitespace_only OR comment_only (and no other signals)

UNKNOWN if:
  contains_parse_error
  OR (MODIFIED with no identifiable signal)
```

**UNKNOWN is a first-class output.** When a change cannot be classified, `UNKNOWN` is surfaced to the user — it is not silently dropped or promoted to LOW.

### Classification Is NOT Complete

This system **does not claim** to detect:
- Semantic equivalence (aliasing, commutativity, loop rewriting)
- Type-level behavioral changes (TypeScript narrowing bugs)
- Behavioral changes purely in dependency code (callee changes)
- Time-complexity changes
- Race conditions introduced by structural changes

These limitations are stated in the Change Proof's `uncertaintyFlags`.

### Classifier API
```typescript
// packages/engine/src/classifier.ts
export interface ClassificationEntry {
  nodeId: string;
  riskLevel: RiskLevel;
  signals: RiskSignal[];
  humanLabel: string;
  functionName?: string;    // enclosing function, if known
  className?: string;       // enclosing class, if known
}

export type RiskMap = ClassificationEntry[];

export function classify(diff: StructuralDiff, afterTree: CSTNode): RiskMap;
```

---

## Layer 4 — AI Reasoning (IBM Bob)

### Responsibility
Bob receives **structured evidence from Layers 1–3** and produces explanations, test stubs, and impact assessments. Bob never sees raw source files. Bob never classifies structural changes. Bob interprets what the deterministic layers found.

### Bob Receives (Per HIGH/MEDIUM Entry)
```typescript
interface BobInput {
  nodeId: string;
  nodeType: string;
  functionSignatureBefore?: string;   // extracted from CSTNode, not raw source
  functionSignatureAfter?: string;
  riskLevel: RiskLevel;
  signals: RiskSignal[];
  textBefore?: string;                // normalized text of changed node (not full file)
  textAfter?: string;
  enclosingContext: string;           // function name + class name (human-readable)
  changeType: ChangeType;
}
```

**Maximum context sent to Bob for any single annotation request:**
- `textBefore` + `textAfter` combined: ≤ 500 tokens
- If the changed region exceeds 500 tokens, truncate to the innermost changed subtree

### Bob Produces (Per Entry)
```typescript
interface AIAnnotation {
  nodeId: string;
  explanation: string;              // what changed and why it may matter
  businessImpact: string;           // which business behavior could be affected
  testStubs: string[];              // runnable TypeScript/Jest test stubs
  uncertainties: string[];          // explicit list of what Bob cannot determine
  evidenceReferences: string[];     // nodeIds this annotation is grounded in
  confidence: "high" | "medium" | "low";
  modelVersion: string;             // recorded for provenance
  promptVersion: string;            // version of the prompt template used
}
```

### Prompt Templates (packages/bob/src/prompts.ts)

Three versioned templates. All versioned with a `v1/` prefix in the template key.

**Template: `v1/explain`**
```
You are analyzing a specific code change detected by Isomorph's structural diff engine.

The following change was found in: {{enclosingContext}}
Change type: {{changeType}}
Risk signals (deterministic): {{signals}}

BEFORE (changed region only):
{{textBefore}}

AFTER (changed region only):
{{textAfter}}

Based solely on what is shown above:
1. What structurally changed? (one sentence)
2. Why might this matter to the system's behavior? (one sentence)
3. What business behavior could be affected? (one sentence)
4. What cannot be determined from this evidence alone? (list)

Do not speculate about code not shown. Do not claim behavior is preserved or broken unless the change shown directly implies it.
```

**Template: `v1/test_stub`**
```
A structural diff engine detected a {{riskLevel}} risk change in: {{enclosingContext}}
Signals: {{signals}}

BEFORE signature: {{functionSignatureBefore}}
AFTER signature: {{functionSignatureAfter}}

CHANGED region (after):
{{textAfter}}

Generate one focused Jest test that exercises the specific change indicated by the signals above.
The test must:
- Import only from the module under test (no invented imports)
- Target the exact behavior indicated by the risk signals
- Include an assertion that would FAIL if the change introduces a bug
- Be syntactically valid TypeScript/JavaScript

Return only the test code. No explanation.
```

**Template: `v1/impact`**
```
A structural diff detected interface-level changes in: {{enclosingContext}}
Changes:
{{signalList}}

Using your knowledge of this codebase, identify:
1. Which callers of the changed function may need to be updated
2. Which exported symbols changed and what downstream modules may be affected
3. Confidence level for each item (high/medium/low)

Ground every item in a specific file path or symbol name. Do not invent paths.
```

### Bob Validation Rules (enforced before AIAnnotation is accepted)
- `testStubs`: each stub is parsed with TypeScript AST parser — invalid stubs are discarded, not included
- `explanation`: length ≥ 20 characters and ≤ 500 characters — outside bounds → `explanation = null`, `uncertainties` includes "explanation generation failed"
- `evidenceReferences`: all listed `nodeIds` must exist in the `StructuralDiff` — invented references are stripped
- Bob returns are never passed directly to the UI — they go through a `validateAIAnnotation` function that enforces the schema

### Bob Failure Modes (all handled, none crash the pipeline)
| Failure | Handling |
|---|---|
| API timeout (> 8s) | AIAnnotation with `explanation: null`, uncertainty: "Bob API timeout" |
| API error (4xx/5xx) | AIAnnotation with `explanation: null`, uncertainty: "Bob API error: {status}" |
| Invalid JSON response | AIAnnotation with `explanation: null`, uncertainty: "Bob response parse failed" |
| Empty stubs | `testStubs: []`, no stub execution attempted |
| DEMO_MODE=true | Load from `demo/cached/bob-annotations.json`, label with "cached" flag |

---

## Layer 5 — Behavioral Verification

### Responsibility
Execute IBM Bob–generated test stubs against the **after** version of the source file and record observable results. This produces behavioral evidence — not behavioral proof.

### Execution Model
```
EvidenceRunner.run(stubs: string[], afterSource: string): Promise<EvidenceRecord>

1. For each stub:
   a. Validate syntax with TypeScript parser (discard if invalid, record as SYNTAX_ERROR)
   b. Write stub to temp file in isolated temp directory
   c. Write afterSource to temp file in same directory
   d. Execute: node --experimental-vm-modules vitest run <tempdir>
      with restrictions:
        - timeout: 5000ms
        - no network (NODE_OPTIONS=--no-network or use seccomp on Linux)
        - no filesystem writes outside tempdir
   e. Capture stdout, stderr, exit code
   f. Parse test result from output (PASS / FAIL / ERROR / TIMEOUT)
2. Assemble EvidenceRecord
```

### EvidenceRecord
```typescript
interface TestResult {
  stubId: string;              // deterministic hash of stub content
  status: "PASS" | "FAIL" | "ERROR" | "TIMEOUT" | "SYNTAX_ERROR" | "NOT_RUN";
  durationMs?: number;
  stdout?: string;             // verbatim (truncated at 2KB)
  stderr?: string;             // verbatim (truncated at 2KB)
  assertionMessage?: string;   // extracted from test output if FAIL
}

interface EvidenceRecord {
  totalStubs: number;
  ran: number;
  passed: number;
  failed: number;
  errored: number;
  notRun: number;
  results: TestResult[];
  executionTimestamp: string;   // ISO 8601
  runnerVersion: string;
}
```

### What Evidence Proves vs. What It Does Not Prove
| If a test PASSES | The specific invariant tested holds against the after source |
| If a test FAILS | The after source violates the specific invariant tested |
| If all tests PASS | The tested invariants hold — broader behavior is NOT claimed |
| If no stubs run | No behavioral evidence — surfaced as `uncertainty_flag` |

**"All tests passed" never appears in the UI.** The UI says: "N stubs ran, N passed, N failed."

### Security Constraints
- Test runner process has no access to secrets or environment variables from the host
- Temp directory is deleted after run regardless of outcome
- If a stub file exceeds 50KB, it is rejected (not executed) — labeled SYNTAX_ERROR with message "stub too large"
- Docker sandbox is used in production deployment; subprocess with timeout is the fallback for local dev

---

## Output Artifact — Change Proof

### Schema
```typescript
interface ChangeProof {
  // Identity
  proofVersion: "1.0";
  proofHash: string;                  // SHA-256 of canonical JSON of all fields below
  generatedAt: string;                // ISO 8601

  // Input provenance
  inputDigest: {
    beforeHash: string;               // SHA-256 of before source
    afterHash: string;                // SHA-256 of after source
    language: "javascript" | "typescript";
  };

  // Layer 1 summary
  parseSummary: {
    beforeNodeCount: number;
    afterNodeCount: number;
    parseErrorNodes: number;          // count of ERROR nodes in either tree
  };

  // Layer 2 summary
  structuralSummary: {
    totalDiffNodes: number;
    byChangeType: Record<ChangeType, number>;
    textualLinesChanged: number;      // from raw diff, for reference only
  };

  // Layer 3: full risk map
  riskMap: ClassificationEntry[];

  // Layer 3 summary
  riskSummary: {
    high: number;
    medium: number;
    low: number;
    cosmetic: number;
    unknown: number;
  };

  // Layer 4: AI annotations (null if Bob unavailable)
  aiAnnotations: AIAnnotation[] | null;
  aiAnnotationsCached: boolean;       // true if loaded from DEMO_MODE cache

  // Layer 5: behavioral evidence
  evidenceRecord: EvidenceRecord | null;  // null if no stubs ran

  // Affected symbols (derived from riskMap)
  affectedSymbols: {
    functions: string[];
    classes: string[];
    exports: string[];
  };

  // Unresolved uncertainty
  uncertaintyFlags: string[];         // explicit list of what this proof cannot determine

  // Provenance
  provenance: {
    engineVersion: string;
    bobModel: string | null;
    promptVersion: string | null;
    runnerVersion: string;
  };
}
```

### Proof Hash Construction
```typescript
function computeProofHash(proof: Omit<ChangeProof, "proofHash">): string {
  // Canonical JSON: keys sorted, no extra whitespace
  const canonical = JSON.stringify(proof, Object.keys(proof).sort());
  return "sha256:" + createHash("sha256").update(canonical).digest("hex");
}
```

The hash covers all fields except itself. Same inputs always produce the same hash.

### Traceability Guarantee
Every field in the Change Proof traces to a layer:
```
proofHash            → computed from all other fields
inputDigest          → Layer 1 (parser input)
parseSummary         → Layer 1 (parser output)
structuralSummary    → Layer 2 (differ output)
riskMap              → Layer 3 (classifier output)
aiAnnotations        → Layer 4 (Bob output, validated)
evidenceRecord       → Layer 5 (runner output)
affectedSymbols      → Layer 3 (derived, not inferred)
uncertaintyFlags     → aggregated from Layers 1–5
provenance           → engine metadata
```

No field is computed by inference or fabricated. Every field has a source.

---

## Risk Catalog

### 1. False Positive Risks

**FP-1: Large Refactor Appears as Many HIGH Risk Changes**
- *Cause*: A pure structural refactor (extract method, move to class) produces INSERTED + DELETED pairs, which the classifier sees as interface changes.
- *Mitigation*: Move detection for function-level nodes; REWRITTEN classification for large subtree replacements; explicit `uncertaintyFlag` when INSERTED+DELETED pair has matching subtree hashes in different positions.
- *Residual*: Accept this. Users see HIGH signals on refactors. This is conservative (fail-closed). Do not try to "prove" a refactor is safe — only note the structural observation.

**FP-2: TypeScript Type-Only Changes Trigger MEDIUM**
- *Cause*: Changing a `string` type annotation to `string | null` triggers `parameter_type_changed` (MEDIUM). At runtime (plain JS), this is irrelevant.
- *Mitigation*: Explicitly note in the risk entry: "Type annotation change — runtime behavioral impact depends on TypeScript strict null checks enforcement."
- *Residual*: Acceptable. MEDIUM is correct for type changes in strict TypeScript codebases.

**FP-3: Cosmetic Rename with Shadowing**
- *Cause*: `rename_binding` signal fires on all identifier renames. If the rename introduces variable shadowing, it is actually a behavioral change, but the classifier sees it as LOW.
- *Mitigation*: Scope-aware rename detection is not implemented in MVP. Document this limitation explicitly.
- *Residual*: Real risk. Addressed by Bob's impact assessment and uncertainty flags.

---

### 2. False Negative Risks

**FN-1: Behavioral Change Through Dependency**
- *Cause*: Function body is unchanged structurally. A called function has changed behavior. Isomorph analyzes single-file diffs — it cannot see callee changes.
- *Mitigation*: Bob's impact assessment notes which external functions are called. Uncertainty flag: "Callee behavior not analyzed in this scope."
- *Residual*: Inherent to single-file analysis. Explicitly scoped as a known limitation.

**FN-2: Semantic Equivalence of Structurally Different Code**
- *Cause*: `x + y` replaced with `y + x` produces a structural diff (MODIFIED) but is semantically equivalent for numbers. Isomorph classifies this as LOW (assignment_value_changed).
- *Mitigation*: Do not try to detect this. The conservative (fail-closed) approach is correct — flag the change and let human+Bob reason about equivalence.
- *Residual*: Acceptable.

**FN-3: Prototype Mutation and Dynamic Dispatch**
- *Cause*: JavaScript's dynamic dispatch means a structurally identical method call may invoke different code at runtime depending on prototype chain.
- *Mitigation*: Document this explicitly as a scope limitation.
- *Residual*: Inherent to dynamic languages. Not claimed to be solved.

---

### 3. Parser Limitations

**PL-1: Tree-sitter ERROR Nodes**
- Tree-sitter does not fail on invalid syntax — it produces ERROR nodes and continues.
- All ERROR nodes are preserved and propagate `UNKNOWN` classification to the enclosing declaration.
- Never silently drop ERROR nodes.

**PL-2: TypeScript Generics and Conditional Types**
- Complex TypeScript type-level constructs (conditional types, mapped types, infer) may produce shallow or unexpected CST node structures.
- These affect type-level diff accuracy. Runtime behavior is not affected by type erasure.
- Explicitly noted in `parseSummary.parseErrorNodes` if any ERROR nodes appeared.

**PL-3: Dynamic Import and Code Splitting**
- `import()` expressions are parsed as nodes but their dynamic targets are not resolved.
- No claim is made about dynamic import behavior changes.

**PL-4: JSX (React)**
- `tree-sitter-javascript` supports JSX. `tree-sitter-typescript` has a TSX variant.
- JSX is supported in the MVP. Complex JSX expressions (render props, HOC patterns) may produce verbose CST structures that inflate cosmetic change counts.
- Known limitation, not hidden.

---

### 4. Matching Limitations

**ML-1: Function Reorder Within Same Scope**
- Functions reordered within a module are detected as MOVED if their subtreeHash is preserved.
- If the function body changed AND its position changed, the differ produces MODIFIED at the new position and DELETED at the old, not MOVED. This is a false DELETED+MODIFIED.
- Mitigation: Bounded second-pass hash lookup. Cannot guarantee detection in all cases.

**ML-2: Inline Extract Patterns**
- If function A's body is split into A + B (extract method), the differ sees A as MODIFIED and B as INSERTED.
- No automatic detection of "this INSERTED function is extracted from the MODIFIED function."
- Mitigation: Bob's impact assessment can reason about this pattern. The structural signal is honest.

**ML-3: Large File Performance**
- The differ is O(n²) in the worst case for move detection pass.
- For files > 2,000 nodes: move detection is skipped, uncertainty flag added: "Move detection skipped for large file."
- Threshold is configurable.

---

### 5. LLM Hallucination Risks

**LH-1: Invented File Paths in Impact Assessment**
- Bob may invent plausible file paths that do not exist in the repository.
- Mitigation: Impact assessment references are validated against actual repository file list if available. Unverified paths are labeled "unverified path."

**LH-2: Incorrect Behavioral Claim**
- Bob may claim a function "will return null" when the structural change does not guarantee this.
- Mitigation: Explanation prompt explicitly scopes Bob to "based solely on what is shown above." Explanation is labeled "AI interpretation — verify before acting."
- Residual: Cannot eliminate. `confidence` field and `uncertainties` list are the mitigations.

**LH-3: Test Stub That Passes Trivially**
- Bob may generate a test stub that always passes regardless of the bug (e.g., tests the wrong function, or has a trivially true assertion).
- Mitigation: Stub is executed against the after source. A trivially passing stub does not produce negative evidence. The EvidenceRecord records PASS with the verbatim assertion — judges can evaluate stub quality.

**LH-4: Fabricated Citation**
- Bob may cite a specific line number or symbol that does not exist.
- Mitigation: `evidenceReferences` in AIAnnotation are validated against actual `nodeIds` in the StructuralDiff. Invented references are stripped.

---

### 6. Test Coverage Limitations

**TC-1: Stubs Test One Invariant**
- Each generated stub tests one specific behavioral property of the changed code.
- A passing stub does not prove overall behavioral correctness.
- UI language: "1 invariant verified" not "function verified."

**TC-2: External Dependencies Not Available**
- Test stubs run in an isolated sandbox. External npm packages are not available.
- If the changed function depends on external modules, stubs must mock them.
- Bob does not always generate correct mocks. If imports fail, result is ERROR (not PASS).
- Uncertainty flag: "External dependency {name} not available in sandbox."

**TC-3: Async/Await Behavior**
- Test stubs may not correctly handle Promise-returning functions.
- If `async_removed` signal is present and the stub does not await the result, the test may produce a false PASS.
- Mitigation: Prompt template explicitly states "if the function is async, await the result."

---

### 7. Security Risks

**SR-1: Malicious Stub Execution**
- Generated test stubs run in a subprocess. A malicious Bob response could inject code that accesses the host filesystem.
- Mitigation: Stubs are validated (AST parse) before execution. Execution uses a sandboxed Node.js process with filesystem restrictions.
- Do not run stubs in the same process as the API server.

**SR-2: Source Code Exfiltration Through Bob**
- Source code (even partial) is sent to the Bob API. For sensitive codebases, this is a confidentiality concern.
- Mitigation: Only the changed region (≤ 500 tokens) is sent, not the full file.
- Document this explicitly: Isomorph sends code excerpts to IBM Cloud. Users must consent.

**SR-3: ReDoS in Tree-sitter Parsing**
- Tree-sitter is not susceptible to ReDoS (it uses a deterministic PDA), but the normalization step (regex-based whitespace collapse) could be.
- Mitigation: `normalizeText` uses only simple string operations, not regex with backtracking.

**SR-4: Temp Directory Cleanup Failure**
- If the evidence runner crashes, temp files containing source code may persist.
- Mitigation: `finally` block unconditionally deletes temp directory. If deletion fails, log an error.

---

### 8. Performance Bottlenecks

**PB-1: Tree-sitter Parsing (Linear, Fast)**
- Tree-sitter parsing is O(n) in source length. Not a bottleneck for files < 10K lines.
- For files > 10K lines: add a hard size limit (configurable). Return a structured error, not a timeout.

**PB-2: Differ Pass 2 (Move Detection, Quadratic)**
- Move detection: O(n²) in number of named declaration nodes.
- Mitigation: Only compute move detection for named declarations (functions, classes, variables). Skip anonymous expressions.
- Hard limit: if named declaration count > 500, skip move detection, add uncertainty flag.

**PB-3: Bob API Latency (External, Unbounded)**
- Bob API calls are the only unbounded-latency operation in the pipeline.
- Mitigation: All Bob calls are async with an 8-second timeout. The pipeline returns structural results immediately; Bob annotations stream in when available.
- UI shows structural diff panel immediately (< 1 second), Bob panel shows a loading state.

**PB-4: Evidence Runner (Process Spawn Overhead)**
- Spawning a Node.js process takes ~200ms on most hardware.
- For the demo (1 stub): 200ms + execution time. Acceptable.
- For production use with many stubs: implement a worker pool. Not required for MVP.

---

## What to Demonstrate Live

Demonstrate these exact properties — not anything else:

1. **Structural signal vs. textual noise**: Show a 200+ line diff collapse to "3 structural changes, 25 cosmetic." Make the number visible.

2. **Risk classification with named signals**: Click a HIGH risk entry and show the specific `RiskSignal` names (`control_flow_branch_removed`, `return_value_changed`). The signals are not vague — they are named, specific, traceable to a CST node.

3. **Bob receiving structured input, not raw source**: If asked "what do you send to Bob?" — show the `BobInput` JSON structure. It contains ~100 words of context, not 500 lines of code. This is the architectural differentiator.

4. **Test stub execution with observable output**: Show the stub code (small, focused). Show it run. Show the FAIL with the assertion message. Show that the FAIL demonstrates a real behavioral regression.

5. **Change Proof hash**: Show the hash. Copy a different source, run again, show a different hash. Run the original again, show the same hash. This proves reproducibility live.

6. **Uncertainty flags**: Show that the Change Proof explicitly says "Callee behavior not analyzed in this scope" and "External dependency not available in sandbox." This demonstrates honesty.

---

## What to Never Claim Publicly

| Never Claim | Why |
|---|---|
| "Mathematically proven safe" | This is a heuristic structural analysis, not formal verification |
| "Semantically equivalent" | We do structural matching, not semantic analysis |
| "All behavioral changes detected" | False negatives exist (FN-1, FN-2, FN-3) |
| "AI verified the change" | Bob interprets; it does not verify |
| "Test passed means behavior is preserved" | One test covers one invariant |
| "X% faster code review" | This metric has not been measured |
| "Used by N teams" | No users yet; fabricating users is disqualifying |
| "No security vulnerabilities in the analyzed code" | We do not do security analysis |
| "Change is safe to merge" | Never. This is never our call. |
| "Grammar supports all TypeScript syntax" | Tree-sitter has known edge cases |

---

## Correctness Guarantee Table

| Claim | Guarantee Level | Source |
|---|---|---|
| Same source pair produces same StructuralDiff | **Guaranteed** | Deterministic algorithm, no external calls |
| Same StructuralDiff produces same RiskMap | **Guaranteed** | Rule-based classifier, no randomness |
| Same inputs produce same proofHash | **Guaranteed** | SHA-256 of canonical JSON |
| UNCHANGED nodes are structurally identical | **Guaranteed** | subtreeHash collision resistance (SHA-256) |
| MOVED nodes have identical subtrees at new positions | **Guaranteed** | Detected by subtreeHash match |
| HIGH risk signals indicate behavior-sensitive change | **Heuristic** | Signal rules; false positives possible |
| LOW/COSMETIC signals indicate low-risk change | **Heuristic** | False negatives possible (see FN-1 through FN-3) |
| Bob explanation is accurate | **Not guaranteed** | AI output, labeled as interpretation |
| Test stub tests the right invariant | **Not guaranteed** | Bob-generated, validated for syntax only |
| Test PASS means behavior preserved | **Not claimed** | One invariant only |
