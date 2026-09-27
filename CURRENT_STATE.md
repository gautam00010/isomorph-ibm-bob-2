# ISOMORPH — Current Repository State

**Inspection & Implementation Date**: 2026-09-26  
**Stack**: TypeScript / Node.js (v22.11.0, npm 10.9.0)  
**Primary Reference**: `AGENTS.md`, `DEEP_ARCHITECTURE.md`, `ARCHITECTURE.md`, `DEMO.md`

---

## Working

- **Layer 1: Tree-sitter CST Parsing (`packages/engine/src/parser.ts`)**
  - Concrete Syntax Tree (CST) generation for JavaScript via `tree-sitter` and `tree-sitter-javascript`.
  - Content hashing per node: `signatureHash` (node type, field name, normalized own text) and `subtreeHash` (recursive normalized descendant text hash).
  - Normalization engine (`packages/engine/src/hash.ts`): Whitespace collapsing, comment stripping, string literal preservation.
  - Node tracking, line/column range mapping (`SourceRange`), parse error detection (`hasParseError`).

- **Layer 2: Deterministic Structural Differ (`packages/engine/src/differ.ts`)**
  - Three-pass structural matching algorithm:
    - Pass 1: Exact subtree matching via `subtreeHash` (marks `UNCHANGED`, prunes subtree).
    - Pass 2: Declaration move detection via subtree hash matching across different path positions (marks `MOVE`).
    - Pass 3: Cosmetic difference detection (whitespace and comments stripped re-diff) marking `COSMETIC`.
  - Node classifications: `UNCHANGED`, `COSMETIC`, `UPDATE`, `INSERT`, `DELETE`, `MOVE`, `REWRITE`, `UNKNOWN`.
  - Produces structured `StructuralDiff` with diff tree and flat nodes list.

- **Layer 3: Deterministic Risk Classifier (`packages/engine/src/classifier.ts`)**
  - Rule-based risk assignment: `HIGH`, `MEDIUM`, `LOW`, `COSMETIC`, `UNKNOWN`.
  - 17 fine-grained risk signals across control flow, side effects/async, interface changes, data flow, and cosmetic edits.
  - Extracts enclosing function and class contexts.

- **Layer 4: AI Reasoning Module (`packages/bob`)**
  - Types (`src/types.ts`): Structured IR schemas for `BobInput`, `AIAnnotation`, `RawBobResponse`.
  - Prompts (`src/prompts.ts`): Versioned prompt templates (`v1/explain`, `v1/test_stub`, `v1/impact`). Enforces minimal context injection (no raw source dumps).
  - Validator (`src/validator.ts`): Validates and sanitizes Bob responses; validates node references against the structural diff; handles fallbacks without throwing.
  - Orchestrator (`src/orchestrator.ts`): Calls Bob API with timeout (8s), error isolation, and support for cached annotations via `demo/cached/`.
  - Full unit test coverage (`packages/bob/__tests__`): 6/6 tests passing.

- **Layer 5: Behavioral Evidence Runner (`packages/evidence`)**
  - Sandboxed Node.js test execution (`src/runner.ts`) in isolated temporary directories.
  - Enforces 5000ms process timeout, environment scrubbing (prevents secret exfiltration), and verbatim stdout/stderr capture (truncated at 2KB).
  - Produces `EvidenceRecord` conforming to `DEEP_ARCHITECTURE.md` (recording `PASS`, `FAIL`, `ERROR`, `TIMEOUT`, `SYNTAX_ERROR`).
  - Full unit test coverage (`packages/evidence/__tests__`): 4/4 tests passing.

- **Layer 6: Change Proof Assembler (`packages/proof`)**
  - Assembles `ChangeProof` artifact combining Layers 1–5 (`src/assembler.ts`).
  - Computes canonical SHA-256 `proofHash` with sorted keys and runtime jitter sanitization (`durationMs` and execution timestamp sanitized for hash computation so same inputs produce identical proof hash across machines).
  - Verification helper `verifyProofHash(proof)` guarantees proof integrity.
  - Full unit test coverage (`packages/proof/__tests__`): 4/4 tests passing.

- **End-to-End Pipeline & CLI (`packages/core`, `bin/demo.js`, `bin/isomorph.js`)**
  - `runIsomorph(before, after, options)` coordinates all 6 layers end-to-end.
  - CLI demo runner `npm run demo` executes the complete 90-second golden demo scenario in ~350ms and writes `change-proof.json`.
  - Automated integration tests (`packages/core/__tests__`): 2/2 tests passing (golden corpus analysis and proof hash reproducibility).

- **Golden Demo Corpus (`demo/`)**
  - `demo/before/discount.js`: 150-line production-grade discount engine with zero-price guard.
  - `demo/after/discount.js`: Refactored code with 25+ cosmetic changes + removed zero-price guard.
  - `demo/cached/bob-annotations.json`: Pre-cached, validated Bob explanation and regression test stub for zero-latency, reliable demo execution.

- **Automated Test Suite (All Workspaces)**
  - **10 test suites, 119 tests across all packages: 100% PASSING**.
  - `npm run build` and `npm run typecheck` across all 5 workspaces: **100% PASSING with 0 errors**.

---

## Broken

- **None in the core engine or P0 golden path**:
  - The previous monorepo build order, missing test suites in `bob`, invalid `workspace:*` npm protocols, and CommonJS identifier collisions have all been resolved.

---

## Missing (P1 / P2 Scope)

- **HTTP API Server (`packages/api`)**:
  - Fastify / Express server exposing `POST /api/analyze` and `GET /health` with Zod schema validation (P1).
- **React Frontend (`apps/frontend` or `frontend/`)**:
  - Web UI for structural diff viewer, risk panel, and change proof download (P1).
- **Docker Compose Setup (`docker-compose.yml`)**:
  - Containerized deployment bundle for the API server and web frontend (P2).

---

## Risky

- **Live Bob API Latency / Availability**:
  - If evaluated without internet or with invalid credentials, the live API could stall.
  - *Mitigated*: `DEMO_MODE` and automatic fallback to `demo/cached/` ensure the entire demo runs 100% locally and reliably in ~350ms.
- **Untrusted Code Execution**:
  - Test stubs are generated by LLM and executed in subprocess.
  - *Mitigated*: Stubs are AST-parsed before execution, restricted to a 5-second timeout, executed in ephemeral temporary folders, and cleaned up in `finally` blocks.

---

## Demo Blockers

- **None!**
  - `npm run demo` executes the entire golden path in 350ms, prints the structural analysis, isolates the HIGH risk bug in `calculateDiscount`, outputs the Bob explanation, executes the test stub to show the observable regression (`FAIL: Expected 0 but got -4`), and writes the canonical `change-proof.json` artifact.

---

## Submission Blockers

- **None for the core verification instrument**:
  - Build succeeds (`npm run build`).
  - Typecheck succeeds (`npm run typecheck`).
  - All 119 tests pass (`npm test`).
  - Next step for submission quality is adding the optional P1 HTTP API and React UI if desired.
