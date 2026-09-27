# ISOMORPH — System Architecture

### Structural Forensics for AI-Generated Code Changes
**Engine Version**: `0.1.0`  
**Core Language**: TypeScript / Node.js throughout  
**Constitutional Governance**: [`AGENTS.md`](./AGENTS.md)  

---

## 1. System Overview

ISOMORPH is a verification instrument that transforms raw code diffs into auditable, reproducible Change Proofs.

Standard diff tools compare text lines; ISOMORPH compares syntax trees. It replaces subjective, fatigue-prone human inspection of massive diffs with a strict multi-layer verification pipeline:

```
┌────────────────────────────────────────────────────────────────────────┐
│  LAYER 1: DETERMINISTIC ENGINE (@isomorph/engine)                      │
│  Tree-sitter CST Parser · 3-Pass Node Differ · Risk Classifier         │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ Structured IR (RiskMap + DiffNode)
┌───────────────────────────────────▼────────────────────────────────────┐
│  LAYER 2: AI REASONING (@isomorph/bob)                                 │
│  IBM Bob 2.0 · Technical Explanation · Test Stub Synthesis             │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ Synthesized Unit Test Stubs
┌───────────────────────────────────▼────────────────────────────────────┐
│  LAYER 3: BEHAVIORAL EVIDENCE (@isomorph/evidence)                     │
│  Subprocess Isolation Sandbox · 5000ms Timeout · Stdout/Stderr Capture │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ Executed EvidenceRecord
┌───────────────────────────────────▼────────────────────────────────────┐
│  LAYER 4: CHANGE PROOF ARTIFACT (@isomorph/proof)                      │
│  Canonical JSON Serializer · SHA-256 Digest · Auditable JSON Document  │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Constitutional Invariants & Truth Model

The system enforces strict architectural rules defined in [`AGENTS.md`](./AGENTS.md):

1. **Layer Order is Immutable**: `Engine` → `Bob` → `Evidence` → `Proof`. No layer may be skipped or reordered.
2. **Deterministic Primacy**: No AI layer may produce a fact that the deterministic engine can produce. Bob explains structural findings; it never produces them.
3. **Evidence Requires Execution**: "A test passed" means a test stub executed in an isolated subprocess and exited 0. No pass/fail claim may be made via inference or LLM assertion.
4. **Change Proof Assembled Last**: The Change Proof is assembled strictly from prior verified layer outputs. It is never speculatively pre-filled.
5. **Precise Language Enforcement**:
   - `structural equivalence` = Identical CST subtree hash.
   - `behavior-sensitive region` = Heuristic risk signal detected.
   - *Forbidden*: We never claim "semantic equivalence", "mathematically proven", "safe to merge", or "AI verified".

---

## 3. Package & Module Architecture

The repository is structured as a clean npm monorepo with 7 isolated workspaces:

```
packages/
├── engine/        # Layer 1: Parser, Tree Differ, Risk Classifier
├── bob/           # Layer 2: IBM Bob Orchestration & Test Synthesis
├── evidence/      # Layer 3: Subprocess Evidence Runner
├── proof/         # Layer 4: Change Proof Assembler & Hasher
├── core/          # Orchestrator combining Layers 1–4
└── api/           # Fastify HTTP API (POST /api/analyze, GET /health)
frontend/          # React/Vite Forensics Workspace UI
```

### Module Boundary Matrix

| Module | Allowed Imports | Forbidden Imports | Responsibilities |
| :--- | :--- | :--- | :--- |
| `@isomorph/engine` | Tree-sitter, crypto, Node.js stdlib | `bob/`, `evidence/`, `proof/`, `api/` | Deterministic parsing, CST diffing, risk classification. Zero AI dependencies. |
| `@isomorph/bob` | `@isomorph/engine` (types only) | `evidence/`, `proof/`, `api/` | IBM Bob prompts, structured IR mapping, test stub syntax validation. |
| `@isomorph/evidence` | `@isomorph/engine` (parser for validation) | `bob/`, `proof/`, `api/` | Subprocess sandboxing, timeout enforcement, test execution. |
| `@isomorph/proof` | `@isomorph/engine`, `@isomorph/bob`, `@isomorph/evidence` (types only) | `api/`, `frontend/` | Canonical JSON serialization, SHA-256 proof hash computation. |
| `@isomorph/core` | `engine`, `bob`, `evidence`, `proof` | `api/`, `frontend/` | End-to-end orchestration pipeline. |
| `@isomorph/api` | `@isomorph/core`, Fastify, Zod | `frontend/` | HTTP transport, request validation, error formatting. |

---

## 4. Layer Deep-Dive

### Layer 1: Deterministic Engine (`@isomorph/engine`)

- **Tree-sitter CST Parsing**: Parses source code into Concrete Syntax Trees preserving whitespace and comments.
- **Node Hash Computation**: Computes canonical SHA-256 hashes for every CST node and its subtree:
  $$\text{hash}(node) = \text{SHA256}(\text{node.type} \parallel \text{node.canonicalText} \parallel \sum \text{hash}(\text{children}))$$
- **3-Pass Structural Differ**:
  - *Pass 1 (Hash Matching)*: Matches identical subtrees. Identical nodes are marked unchanged or cosmetic.
  - *Pass 2 (Scope Matching)*: Matches function declarations and class methods by identifier within enclosing scopes.
  - *Pass 3 (Levenshtein Edit Script)*: Computes minimal syntax-tree mutations (insertions, deletions, replacements) for modified expressions.
- **Rule-Based Risk Classifier**:
  - Evaluates AST signals against deterministic heuristic rules:
    - `control_flow_branch_removed`: Ternary, `if`, or `switch` branch omitted.
    - `return_value_changed`: Expression returning from function altered.
    - `guard_clause_mutated`: Boundary validation mutated.
    - `signature_mutated`: Parameters or exports modified.
  - Assigns categorical risk: `HIGH` (behavior-sensitive logic mutation), `MEDIUM` (interface/signature mutation), `LOW` (local variable change), `COSMETIC` (whitespace, comment, formatting).

### Layer 2: AI Reasoning (`@isomorph/bob`)

- **Structured Input Boundary**: Bob receives `RiskEntry` JSON objects + minimal node text. Bob is never fed raw, full-source file blobs.
- **Orchestration & Prompts** ([`packages/bob/src/prompts.ts`](./packages/bob/src/prompts.ts)): Versioned, structured prompts returning typed JSON:
  - Technical explanation of the change.
  - Business impact assessment.
  - Targeted unit test stub synthesis.
  - Surfaced residual uncertainties.
- **Syntax Validation Pre-Gate**: Every generated test stub is parsed with `tree-sitter` before execution. If syntax errors exist, the stub is marked `SYNTAX_ERROR` and never sent to the runner.
- **Offline Demo Mode Resilience**: In `DEMO_MODE=true` (or when the API key is not configured), Bob responses for canonical fixtures are served from deterministic cached responses, ensuring 100% demo stability.

### Layer 3: Behavioral Evidence (`@isomorph/evidence`)

- **Subprocess Isolation Sandbox**: Test stubs are written to a temporary workspace and executed via a dedicated Node.js child process (`child_process.spawn`).
- **Enforced Constraints**:
  - Maximum execution timeout: 5000 ms (configurable).
  - Memory limit: 256 MB.
  - Environment isolation: No network access; environment variables sanitized.
  - Output truncation: Captured stdout/stderr capped at 2 KB.
- **Strict Verification Semantics**:
  - `PASS`: Process exited with status code `0`.
  - `FAIL`: Process threw an `AssertionError` or exited with non-zero code.
  - `ERROR`: Subprocess crashed or timed out.
  - `NOT_RUN`: Stub failed pre-execution syntax validation.

### Layer 4: Change Proof Assembler (`@isomorph/proof`)

- **Assembles ChangeProof v1.0**: Combines input digests, structural diff summaries, risk entries, Bob annotations, evidence records, and uncertainty flags into a self-describing audit document.
- **Canonical Serialization**: Uses a deterministic JSON stringifier that sorts object keys recursively and standardizes line endings.
- **Proof Hash**:
  $$\text{proofHash} = \text{SHA256}(\text{canonicalJsonStringify}(\text{ChangeProofWithoutHash}))$$
  Ensures identical inputs always produce the identical cryptographic digest.

### Layer 5: HTTP API (`@isomorph/api`)

- **Fastify Server**: High-throughput REST API with zero unnecessary middleware.
- **Zod Boundary Validation**: Validates all incoming payloads against `AnalyzeRequestSchema`.
- **Endpoints**:
  - `GET /health`: Liveness probe and service metadata.
  - `POST /api/analyze`: Ingests `beforeSource`, `afterSource`, and optional demo scenario; executes pipeline and returns full `ChangeProof`.
- **Clean Error Handling**: Never leaks stack traces; returns typed `ErrorResponse` objects with explicit status codes.

---

## 5. Security & Threat Model

1. **Host Protection**: Untrusted user code is parsed via Tree-sitter (static analysis), which does not execute code. Only Bob-synthesized test stubs that have passed AST syntax validation are ever executed, and only inside an isolated subprocess sandbox.
2. **Subprocess Isolation**: Subprocess execution runs with a strict 5-second timeout and no network connectivity.
3. **No Hardcoded Secrets**: Bob API keys and project IDs are read from environment variables (`BOB_API_KEY`, `BOB_PROJECT_ID`). The golden demo path operates completely offline via deterministic cached fixtures.

---

## 6. Technical Limitations & Honest Boundaries

- **Single-File MVP Scope**: Cross-file caller graph resolution across massive monorepos is future work; callers outside the submitted module are explicitly surfaced in `uncertaintyFlags`.
- **CST vs. Semantic Equivalence**: CST matching guarantees structural syntax-tree identity. It does not prove arbitrary semantic equivalence across programs (Rice's Theorem).
- **Supported Languages**: JavaScript and TypeScript. Additional language grammars (Python, Go, Rust) will follow the same Tree-sitter interface in future versions.
