# ISOMORPH

### Structural Forensics for AI-Generated Code Changes

> **“See what actually changed.”**

[![Verification Suite](https://img.shields.io/badge/Verification-127%2F127%20Passed-24a148.svg?style=flat-square)]()
[![Deterministic Engine](https://img.shields.io/badge/Engine-Deterministic%20CST-0f62fe.svg?style=flat-square)]()
[![AI Reasoning](https://img.shields.io/badge/Reasoning-IBM%20Bob%202.0-78a9ff.svg?style=flat-square)]()
[![Artifact](https://img.shields.io/badge/Artifact-Change%20Proof%20v1.0-8a3ffc.svg?style=flat-square)]()
[![TypeScript](https://img.shields.io/badge/TypeScript-Strict%20Mode-3178c6.svg?style=flat-square)]()

---

## 1. The Problem

```
“An AI changed 842 lines. What ACTUALLY changed?”
```

AI coding assistants (Cursor, Copilot, autonomous coding agents) routinely submit commits touching hundreds of lines of code. When an agent is prompted to *"refactor for clarity"*, *"optimize performance"*, or *"modernize syntax"*, it produces sprawling diffs where extensive formatting changes, variable renames, and structural reorganizations drown out the actual logic mutations.

A human reviewer facing an 842-line diff experiences cognitive overload. Subtle behavioral bugs—an omitted boundary check, a modified arithmetic operator, or a deleted authorization guard—hide in plain sight amidst cosmetic churn. Reviewers are forced to choose between hours of tedious line-by-line inspection or rubber-stamping the commit, allowing regressions into production.

---

## 2. Why Textual Diff Review Breaks Down for AI-Generated Changes

Standard review workflows rely on line-based diff tools (`git diff`, GitHub PR viewer). These tools were designed for human commits and fail fundamentally on AI-generated changes:

1. **Syntax Ignorance**: `git diff` operates on sequences of characters and newline boundaries. Wrapping an outer block indents 50 lines, producing 100 lines of red/green diff churn despite zero change in Abstract Syntax Tree (AST) structure.
2. **Uniform Weighting**: Textual diffs assign the same visual weight to a whitespace change or variable rename as they do to deleting an authentication check or altering a discount calculation.
3. **No Control-Flow Awareness**: Reordering two independent helper functions creates massive diff blocks, while removing a critical guard clause in a return statement is represented as a single, easily overlooked line modification.
4. **Scale and Volume**: AI agents generate changes at a volume that human line-by-line reading cannot safely sustain.

---

## 3. The Isomorph Workflow

ISOMORPH transforms raw textual diff noise into an auditable evidence chain:

```
TEXTUAL DIFF NOISE
       ↓
DETERMINISTIC STRUCTURAL FORENSICS
       ↓
BEHAVIOR-SENSITIVE SIGNAL
       ↓
EVIDENCE
       ↓
CHANGE PROOF
```

1. **Ingest Diff**: Ingests before and after source versions (or git diffs).
2. **Parse CST**: Generates Concrete Syntax Trees using Tree-sitter.
3. **Isolate Signal**: Matches nodes across 3 passes; collapses cosmetic changes (renames, whitespace, comments); isolates true structural mutations.
4. **Classify Risk**: Rule-based heuristic classifier scores structural signals into risk levels (HIGH, MEDIUM, LOW, COSMETIC).
5. **Reason with IBM Bob**: IBM Bob 2.0 interprets structured IR (not raw source code) to explain consequences, assess business impact, and synthesize targeted unit test stubs.
6. **Execute Verification**: Executes test stubs in an isolated Node.js subprocess sandbox to observe real behavioral evidence (`FAIL` on regression; `PASS` when fixed).
7. **Assemble Change Proof**: Emits an immutable, content-hashed, reproducible Change Proof JSON artifact.

---

## 4. The Deterministic Structural Engine

The core deterministic engine ([`packages/engine`](./packages/engine)) operates independently of any AI model:

- **Tree-sitter Parser**: Parses full Concrete Syntax Trees for JavaScript and TypeScript.
- **3-Pass Structural Differ**:
  - *Pass 1 (CST Hash Matching)*: Computes canonical SHA-256 hashes for every syntax node and its subtree. Nodes with identical hashes are structurally equivalent and collapsed immediately.
  - *Pass 2 (Scope-Aware Identity)*: Matches declarations and functions across enclosing scopes even if positions shifted.
  - *Pass 3 (Levenshtein Edit Scripts)*: Computes minimal syntax-tree mutations for modified expressions.
- **Rule-Based Risk Classifier**:
  - Traverses diff nodes and evaluates deterministic mutation signals:
    - `control_flow_branch_removed`: Deletion of ternary, `if`, or guard branches.
    - `return_value_changed`: Alteration of expressions returning values.
    - `guard_clause_mutated`: Boundary condition changes.
    - `signature_mutated`: Parameter list or export interface modifications.
  - Classifies mutations into **HIGH**, **MEDIUM**, **LOW**, and **COSMETIC**.
  - **Invariant**: No LLM produces or modifies structural facts.

---

## 5. IBM Bob's Role: Contextual Reasoning on Structured IR

IBM Bob 2.0 is integrated as a structured reasoning layer, not an ungrounded chatbot:

```
┌────────────────────────────────────────────────────────────────────────┐
│                        TRUTH DELINEATION                               │
├────────────────────────────────────┬───────────────────────────────────┤
│  DETERMINISTIC ENGINE              │  IBM BOB 2.0                      │
│  Source 1: Tree-sitter CST Differ  │  Source 2: Contextual Reasoning   │
│  STATUS: DETERMINISTIC FACT        │  STATUS: FORENSIC INTERPRETATION  │
└────────────────────────────────────┴───────────────────────────────────┘
```

1. **Structured Input Boundary**: Bob receives only structured `RiskEntry` JSON objects and minimal node text. Bob is never fed raw, unparsed full-source file dumps.
2. **Technical Explanation**: Bob provides a clear technical explanation of the structural mutation and why it alters behavior.
3. **Business Impact Assessment**: Bob assesses potential business consequences (e.g. promotional $0-items calculating negative billing balances).
4. **Targeted Test Stub Synthesis**: Bob synthesizes targeted unit test stubs designed specifically to test the changed control-flow branch.
5. **Pre-Execution Syntax Validation**: Every generated test stub is validated via AST parse before entering the execution sandbox.
6. **Residual Uncertainty**: When Bob cannot determine callers outside module scope, it explicitly records uncertainty flags into the Change Proof.

---

## 6. Behavioral Verification (Subprocess Sandbox)

Claims of correctness or regression must be backed by executed evidence:

- **Subprocess Isolation**: Generated test stubs are executed in an isolated Node.js child process with a strict 5000ms timeout and restricted environment.
- **Verbatim Output Capture**: Captures exact exit codes, stdout, and stderr.
- **No Inferred Passes**: A test is marked `PASS` if and only if it executed and exited with status 0.
- **The Verification Loop (FAIL → FIX → PASS)**:
  - When executed against candidate code containing a regression, the test **FAILS** (e.g. `AssertionError: Expected 0 but got -4`).
  - When the 1-line guard is restored, re-running verification yields **PASS** (`BEHAVIOR PRESERVED`).

---

## 7. The Change Proof Artifact

The final output is the **Change Proof**: a versioned, reproducible, content-hashed JSON document:

```json
{
  "proofVersion": "1.0",
  "proofHash": "sha256:820a50e9e3c47d6133cb438b1d09f96b15fc7fded4e5416352eca2336892bffc",
  "generatedAt": "2026-09-26T21:45:00.000Z",
  "inputDigest": {
    "beforeHash": "sha256:d087bff29c3311888...",
    "afterHash": "sha256:b4e5b4fa22f33a580...",
    "language": "javascript"
  },
  "structuralSummary": {
    "totalDiffNodes": 302,
    "textualLinesChanged": 842
  },
  "riskSummary": {
    "high": 3,
    "medium": 0,
    "low": 58,
    "cosmetic": 241
  },
  "riskMap": [...],
  "aiAnnotations": [...],
  "evidenceRecord": {
    "ran": 2,
    "passed": 2,
    "failed": 0,
    "results": [...]
  },
  "uncertaintyFlags": [
    "Cannot determine whether upstream checkout callers validate prices before invoking calculateDiscount"
  ],
  "provenance": {
    "engineVersion": "0.1.0",
    "bobModel": "ibm-bob-2.0+cached",
    "runnerVersion": "0.1.0"
  }
}
```

- **Mathematical Reproducibility**: Canonical JSON key ordering ensures identical inputs always produce the identical SHA-256 `proofHash`.
- **Auditable**: Contains full provenance including engine version, Bob model, test outputs, and explicit uncertainties.

---

## 8. Current Supported Scope

- **Languages**: JavaScript (`.js`, `.jsx`, CommonJS, ES Modules) and TypeScript (`.ts`, `.tsx`).
- **Granularity**: Single-file comparisons (before vs. after source versions, or PR file diffs).
- **Execution Environment**: Node.js v18+ / v20+ runtime.
- **Fixtures**: Three locked canonical demo scenarios (`pricing/discount.js`, `pagination/bounds.js`, `security/auth.js`).

---

## 9. Technical Limitations & Honest Boundaries

In accordance with the Isomorph Engineering Constitution ([`AGENTS.md`](./AGENTS.md)), we maintain strict claim discipline:

1. **No Universal Semantic Equivalence**: CST hash matching proves structural identity, not general semantic equivalence. Proving arbitrary semantic equivalence across all programs is theoretically undecidable (Rice's Theorem). We never claim semantic equivalence.
2. **No Claim of Perfect Detection**: Heuristic risk rules isolate structural mutations in control flow, returns, boundaries, and arithmetic. Subtle runtime regressions without structural manifestations require broader dynamic testing.
3. **Subprocess Isolation Scope**: Test runner executes isolated unit stubs. Functions requiring external network or database connections will time out and surface in `uncertaintyFlags`.
4. **Single-File MVP Scope**: Cross-file caller graph analysis is currently surfaced as residual uncertainty when whole-repo context is incomplete.

---

## 10. Monorepo Structure

```
ISOMORPH/
├── packages/
│   ├── engine/       # Layer 1: Tree-sitter CST parser, 3-pass differ, risk classifier
│   ├── bob/          # Layer 2: IBM Bob orchestration, prompts, AST validator
│   ├── evidence/     # Layer 3: Isolated subprocess test runner
│   ├── proof/        # Layer 4: Change Proof assembler and canonical hasher
│   ├── core/         # Orchestrates Layers 1–4 into unified pipeline
│   └── api/          # Layer 5: Fastify HTTP API with Zod validation
├── frontend/         # Layer 6: IBM-inspired React/Vite forensics UI
├── demo/             # Locked canonical fixtures (before & after)
├── bin/              # CLI demo walkthrough runner
├── AGENTS.md         # Engineering Constitution and truth model rules
├── DEMO.md           # 3-minute video presentation script
├── ARCHITECTURE.md   # Detailed layer-by-layer system architecture
└── BENCHMARK_REPORT.md # Measured performance, compression, and hash determinism
```

---

## 11. Quickstart & Verification

### Prerequisites
- Node.js v18.0.0 or higher
- npm v9.0.0 or higher

### Installation & Build
```bash
# Install dependencies across all workspaces
npm install

# Build all monorepo packages and frontend
npm run build

# Verify full test suite (127 tests)
npm run test

# Run strict TypeScript typecheck (0 errors)
npm run typecheck
```

### Run the 3-Minute Golden Demo Walkthrough
```bash
# Execute CLI demo presentation flow
npm run demo
```

### Launch API & Web UI
```bash
# In terminal 1: Start Fastify API (port 3001)
npm run dev --workspace=@isomorph/api

# In terminal 2: Start Vite Frontend (port 5173)
npm run dev --workspace=isomorph-frontend
```

Open `http://localhost:5173` to explore the interactive forensics workspace and trigger the 3-minute presentation HUD (`[▶ 3-MIN GOLDEN DEMO]`).
