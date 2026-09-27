# ISOMORPH — Implementation Plan

> **Stack revision**: Per `DEEP_ARCHITECTURE.md`, the backend is **TypeScript/Node.js** (Fastify), not Python/FastAPI. The target language is JS/TS; using TypeScript throughout eliminates cross-language serialization and subprocess boundaries. All task descriptions below remain valid — substitute TypeScript equivalents for Python-specific tools (`vitest` for pytest, `zod` for pydantic, TypeScript interfaces for dataclasses).

## Overview

ISOMORPH transforms a raw code diff into a deterministic structural analysis and auditable Change Proof.

This plan is organized into 10 sub-tasks, sequenced so that each builds on the last and is independently reviewable. Do not start a sub-task until the previous one passes its acceptance criteria.

**Reference documents:**
- [DEEP_ARCHITECTURE.md](./DEEP_ARCHITECTURE.md) — **primary architecture reference** (layer specs, IR schemas, risk catalog, correctness guarantees)
- [ARCHITECTURE.md](./ARCHITECTURE.md) — system overview (see DEEP_ARCHITECTURE.md for superseding details)
- [PRODUCT.md](./PRODUCT.md) — product thesis, user flow, non-goals, kill list
- [DEMO.md](./DEMO.md) — golden demo path, demo corpus specification
- [VALIDATION.md](./VALIDATION.md) — test suites, acceptance gates
- [RISKS.md](./RISKS.md) — risk register and mitigations
- [WINNING_CRITERIA.md](./WINNING_CRITERIA.md) — differentiation test, minimum complete product surface

---

## Build Order Rationale

```
Engine → API → Demo Corpus → Bob Integration → Evidence → ChangeProof → Frontend → Integration → CI → Polish
```

The structural engine is the source of truth. Everything else depends on it.
The demo corpus is defined and locked before UI work begins.
Bob integration is layered on top of a working structural layer — never before.

---

## Sub-Tasks

---

### Task 1: Project Scaffold and Dev Environment

**Status**: [ ] pending

**Intent**: Establish the project structure, tooling, and development environment so all subsequent tasks have a clean, reproducible foundation. No functional code yet — just the skeleton.

**Expected Outcomes**:
- `docker-compose up` starts backend (FastAPI) and frontend (Vite + React) containers
- Backend returns `{"status": "ok"}` from `GET /health`
- Frontend renders a placeholder page
- `pytest` runs (zero tests, zero failures)
- TypeScript compiles with strict mode
- All dependency versions pinned

**Todo List**:
1. Create `isomorph/` Python package with `__init__.py`
2. Create `frontend/` with Vite + React + TypeScript scaffold
3. Create `pyproject.toml` with dependencies: `fastapi`, `uvicorn`, `tree-sitter`, `tree-sitter-languages`, `pydantic`, `ibm-watsonx-ai`, `pytest`, `httpx`
4. Create `frontend/package.json` with dependencies: `react`, `react-dom`, `typescript`, `vite`, `tailwindcss`, `zustand`, `zod`
5. Create `Dockerfile.backend` and `Dockerfile.frontend`
6. Create `docker-compose.yml` wiring both services
7. Create `isomorph/api/routes.py` with `GET /health` endpoint
8. Create `isomorph/api/schemas.py` with Pydantic `AnalyzeRequest` and `AnalyzeResponse` stubs
9. Create `isomorph/tests/test_api.py` with `test_api_health`
10. Create `frontend/src/App.tsx` placeholder
11. Create `.env.example` documenting `BOB_API_KEY`, `BOB_PROJECT_ID`, `DEMO_MODE`
12. Create root `README.md` with quickstart

**Relevant Context**:
- Backend: Python 3.11+, FastAPI, uvicorn
- Frontend: React 18, Vite, TypeScript strict
- ARCHITECTURE.md > Technology Stack

---

### Task 2: Tree-sitter Parse Layer

**Status**: [ ] pending

**Intent**: Build the deterministic CST parsing layer. This is the foundation of all structural analysis. Must be correct, well-tested, and produce the canonical `CSTNode` intermediate representation defined in ARCHITECTURE.md.

**Expected Outcomes**:
- `ParseLayer.parse(source, language)` returns a `CSTNode` tree
- `CSTNode` has: `type`, `signature_hash`, `children`, `source_range`, `text`
- `signature_hash` is SHA-256 of `type + canonical_text` (deterministic)
- Supported languages: Python, JavaScript, TypeScript
- Invalid syntax raises `ParseError` (not crashes)
- All Suite 1 tests pass

**Todo List**:
1. Create `isomorph/engine/parser.py`
2. Implement `CSTNode` dataclass matching ARCHITECTURE.md schema
3. Implement `ParseLayer.parse(source: str, language: str) -> CSTNode`
4. Use `tree-sitter-languages` for grammar loading
5. Implement `_compute_signature_hash(node)` using SHA-256
6. Implement `ParseError` exception class
7. Handle unsupported language → raise `ParseError` with message
8. Handle syntactically invalid source → raise `ParseError` (not crash)
9. Create `isomorph/tests/test_parser.py` with all Suite 1 tests from VALIDATION.md
10. All tests pass

**Relevant Context**:
- ARCHITECTURE.md > Parse Layer, CSTNode schema
- VALIDATION.md > Suite 1: Parser Correctness
- RISKS.md > R1: Tree-sitter Grammar Edge Cases

---

### Task 3: Structural Diff Engine

**Status**: [ ] pending

**Intent**: Build the deterministic structural matching and diff algorithm. This is the technical heart of ISOMORPH. It must classify every node-level change as ADDED / REMOVED / MODIFIED / MOVED / UNCHANGED, and further classify MODIFIED changes into sub-types.

**Expected Outcomes**:
- `StructuralDiffEngine.diff(tree_a, tree_b)` returns `StructuralDiff`
- `StructuralDiff` is a list of `DiffNode` entries with `change_type`, `before_hash`, `after_hash`, `before_range`, `after_range`
- Identical trees → 0 change entries
- Whitespace/comment-only changes → COSMETIC entries only
- Function body changes → MODIFIED with correct ranges
- Moved functions detected via hash matching (not false REMOVED + ADDED)
- Diff is reproducible: same inputs always produce identical output
- All Suite 2 tests pass

**Todo List**:
1. Create `isomorph/engine/differ.py`
2. Implement `DiffNode` dataclass: `node_id`, `change_type`, `before_hash`, `after_hash`, `before_range`, `after_range`, `sub_changes`
3. Implement `ChangeType` enum: ADDED, REMOVED, MODIFIED, MOVED, UNCHANGED, COSMETIC
4. Implement top-down structural matching algorithm using signature hashes
5. Implement moved-node detection: hash present in both trees at different positions
6. Implement cosmetic classification: whitespace-only, comment-only, rename-only detection
7. Implement `StructuralDiffEngine.diff(tree_a: CSTNode, tree_b: CSTNode) -> StructuralDiff`
8. Create `isomorph/tests/test_differ.py` with all Suite 2 tests from VALIDATION.md
9. All tests pass

**Relevant Context**:
- ARCHITECTURE.md > Structural Diff Layer, StructuralDiff schema
- VALIDATION.md > Suite 2: Structural Differ Correctness
- RISKS.md > R2: Misclassified Refactors

---

### Task 4: Risk Classifier

**Status**: [ ] pending

**Intent**: Build the heuristic risk classification layer. For each MODIFIED/ADDED/REMOVED node in the StructuralDiff, assign a risk level (HIGH / MEDIUM / LOW / COSMETIC) and a set of named risk signals. This is deterministic and rule-based — no AI involved.

**Expected Outcomes**:
- `RiskClassifier.classify(diff: StructuralDiff) -> RiskMap`
- `RiskMap` is a list of `RiskEntry` with `node_id`, `risk_level`, `signals`, `human_label`
- Risk signals: `control_flow_change`, `return_value_change`, `interface_change`, `data_flow_change`, `rename_only`, `comment_only`, `whitespace_only`
- Correct classification for all Suite 3 test cases
- All Suite 3 tests pass

**Todo List**:
1. Create `isomorph/engine/risk.py`
2. Implement `RiskLevel` enum: HIGH, MEDIUM, LOW, COSMETIC
3. Implement `RiskSignal` enum with all signal types
4. Implement `RiskEntry` dataclass: `node_id`, `risk_level`, `signals`, `human_label`
5. Implement `RiskClassifier.classify(diff: StructuralDiff) -> list[RiskEntry]`
6. Implement signal detection rules for each signal type (CST node type pattern matching)
7. Implement `_determine_risk_level(signals) -> RiskLevel` (signal → level mapping)
8. Create `isomorph/tests/test_risk.py` with all Suite 3 tests from VALIDATION.md
9. All tests pass

**Relevant Context**:
- ARCHITECTURE.md > Risk Classification Layer, RiskEntry schema
- VALIDATION.md > Suite 3: Risk Classifier Correctness
- WINNING_CRITERIA.md > Risk signal classification as differentiator

---

### Task 5: Demo Corpus

**Status**: [ ] pending

**Intent**: Build and lock the golden demo scenario files. This is the most important content asset for the demo. The demo corpus must produce exactly the expected analysis output (1 HIGH, 25+ COSMETIC) and be locked by Suite 6 tests. Build the corpus before the API or UI so the target output is clear.

**Expected Outcomes**:
- `demo/before/discount.py` — 150-line Python discount engine, working correctly
- `demo/after/discount.py` — same file after "AI refactoring": cosmetic changes + 1 HIGH risk change (guard clause removed) + 1 MEDIUM risk change
- Running the full analysis pipeline on this corpus produces: `high_risk_count == 1`, `cosmetic_count >= 20`, `high_risk_node_id contains "calculate_discount"`
- All Suite 6 tests pass

**Todo List**:
1. Write `demo/before/discount.py` — realistic 150-line discount engine with: `calculate_discount(price, rate)` with zero-price guard, 3–4 helper functions, clear docstrings
2. Write `demo/after/discount.py` — same file with: 20+ whitespace/comment/rename cosmetic changes, guard clause removed from `calculate_discount`, one helper function inlined
3. Write `isomorph/tests/test_demo_corpus.py` with all Suite 6 tests from VALIDATION.md
4. Run the pipeline against demo corpus and verify expected output
5. All Suite 6 tests pass
6. Commit demo corpus as a fixture (do not generate dynamically)

**Relevant Context**:
- DEMO.md > Demo Scenario: The Discount Engine Commit
- VALIDATION.md > Suite 6: Demo Corpus Validation
- RISKS.md > R5: Demo corpus ambiguity

---

### Task 6: IBM Bob Integration Layer

**Status**: [ ] pending

**Intent**: Build the Bob orchestrator that sends structured inputs to IBM Bob and returns structured outputs. Bob receives only RiskEntry + minimal node text — never raw source files. Implement all three Bob use cases: explanation, test generation, impact assessment.

**Expected Outcomes**:
- `BobOrchestrator.annotate(diff: StructuralDiff, risk_map: RiskMap) -> list[AIAnnotation]`
- `AIAnnotation` schema matches ARCHITECTURE.md
- Prompts are templated (not f-string free-form), versioned in `isomorph/bob/prompts.py`
- `DEMO_MODE=true` loads cached responses from `demo/cached_bob/` instead of calling API
- Bob failure (API error) → returns `AIAnnotation` with `explanation=None`, `uncertainty="Bob API unavailable"`
- All generated test stubs are validated with `ast.parse()` before inclusion
- Integration can run against real Bob API and produce non-empty annotations

**Todo List**:
1. Create `isomorph/bob/prompts.py` with versioned prompt templates for: explanation, test stub generation, impact assessment
2. Create `isomorph/bob/orchestrator.py` with `BobOrchestrator` class
3. Implement `_call_bob(prompt: str) -> str` wrapping `ibm-watsonx-ai` SDK
4. Implement `annotate_explanation(risk_entry, node_text) -> str`
5. Implement `generate_test_stub(risk_entry, function_signature) -> str`
6. Implement `assess_impact(interface_changes) -> list[ImpactEntry]`
7. Implement `DEMO_MODE` cache loading from `demo/cached_bob/*.json`
8. Implement stub validation: `ast.parse(stub)` — invalid stubs labeled, not crashed
9. Create `demo/cached_bob/` with pre-generated Bob responses for demo corpus
10. Manual validation: run against real Bob API for demo corpus, verify explanation accuracy

**Relevant Context**:
- ARCHITECTURE.md > IBM Bob AI Layer, AIAnnotation schema
- PRODUCT.md > IBM Bob Integration table
- RISKS.md > R3: Bob API latency, R9: Bob hallucination
- WINNING_CRITERIA.md > Criterion 2: IBM Bob Integration Quality

---

### Task 7: Evidence Runner and ChangeProof Assembler

**Status**: [ ] pending

**Intent**: Build the evidence collection layer (test stub execution) and the ChangeProof assembler. The ChangeProof is the central output artifact — content-hashed, schema-validated, reproducible.

**Expected Outcomes**:
- `EvidenceCollector.run(stubs: list[str]) -> EvidenceRecord`
- `EvidenceRecord` contains: tests run, results (PASS/FAIL/ERROR/SKIP), raw output, execution timestamp
- Tests run in subprocess isolation with a timeout (5 seconds)
- A test is NEVER marked PASS unless it actually ran and passed
- `ChangeProofAssembler.assemble(...) -> ChangeProof`
- `ChangeProof` schema matches ARCHITECTURE.md exactly
- `proof_hash` is SHA-256 of canonical JSON of the proof content (excluding the hash field)
- Same inputs always produce the same `proof_hash`
- All Suite 4 tests pass
- Suite 6 `test_demo_stub_fails` passes (demo test runs and correctly FAILS)

**Todo List**:
1. Create `isomorph/evidence/runner.py` with `EvidenceCollector`
2. Implement subprocess-isolated test execution with timeout
3. Implement `EvidenceRecord` dataclass
4. Create `isomorph/engine/proof.py` with `ChangeProofAssembler`
5. Implement `ChangeProof` dataclass matching ARCHITECTURE.md schema exactly
6. Implement `_compute_proof_hash(proof)` using canonical JSON + SHA-256
7. Create `isomorph/tests/test_proof.py` with all Suite 4 tests from VALIDATION.md
8. All Suite 4 tests pass
9. Run `test_demo_stub_fails` — verify demo test actually runs and fails against `demo/after/discount.py`

**Relevant Context**:
- ARCHITECTURE.md > Evidence Layer, Change Proof Layer, ChangeProof schema
- VALIDATION.md > Suite 4: ChangeProof Assembly, Suite 6 stub tests
- RISKS.md > R6: Unrunnable test stubs, R8: ChangeProof feels cosmetic

---

### Task 8: FastAPI Endpoint and API Layer

**Status**: [ ] pending

**Intent**: Wire all engine components into the FastAPI endpoint. The API must be schema-validated end-to-end (Pydantic in, Pydantic out), handle errors gracefully, and pass all Suite 5 tests.

**Expected Outcomes**:
- `POST /api/analyze` accepts `AnalyzeRequest`, runs full pipeline, returns `ChangeProof` JSON
- `GET /health` returns `{"status": "ok"}`
- Invalid language → 400 with structured error
- Invalid/unparseable source → 422 with structured error
- No 500 crashes on any expected error path
- All Suite 5 tests pass

**Todo List**:
1. Finalize `isomorph/api/schemas.py`: `AnalyzeRequest` (before, after, language), `AnalyzeResponse` wrapping `ChangeProof`
2. Update `isomorph/api/routes.py`: wire `POST /api/analyze` through full pipeline
3. Implement error handling middleware: `ParseError` → 422, unsupported language → 400
4. Create `isomorph/tests/test_api.py` with all Suite 5 tests from VALIDATION.md
5. All Suite 5 tests pass
6. Manual test: `curl -X POST localhost:8000/api/analyze` with demo corpus → valid ChangeProof JSON

**Relevant Context**:
- ARCHITECTURE.md > Data Flow (Request Lifecycle), API module
- VALIDATION.md > Suite 5: API Contract

---

### Task 9: React Frontend

**Status**: [ ] pending

**Intent**: Build the UI that makes the structural analysis visible and comprehensible. This is NOT a text diff viewer. The UI must show structural regions, risk classification, Bob annotations, and the ChangeProof. It must support the 90-second demo path exactly.

**Expected Outcomes**:
- `DemoInput` component: before/after text areas with pre-loaded demo corpus
- "Analyze" button triggers `POST /api/analyze`
- `StructuralDiffViewer`: shows structural regions (not text lines), color-coded by risk level
- `RiskPanel`: lists HIGH/MEDIUM/LOW/COSMETIC counts, expandable entries with signals and Bob explanation
- `ChangeProofPanel`: shows `proof_hash`, generation time, summary stats, "Download JSON" button
- Loading state: spinner, no blank screens
- Error state: clear error message, no raw JSON visible
- UI renders cleanly at 1080p for screencasting
- Demo pre-loads automatically (no blank state on page load)

**Todo List**:
1. Create `frontend/src/lib/schemas.ts` — Zod schemas matching all backend Pydantic models
2. Create `frontend/src/lib/api.ts` — typed `analyzeCode(request)` function using fetch + Zod validation
3. Create `frontend/src/components/DemoInput.tsx` — textarea pair, pre-loaded with demo corpus text, Analyze button
4. Create `frontend/src/components/StructuralDiffViewer.tsx` — structural region list grouped by risk level
5. Create `frontend/src/components/RiskPanel.tsx` — risk breakdown, expandable entries, Bob explanation text
6. Create `frontend/src/components/ChangeProofPanel.tsx` — hash display, stats, download button
7. Create `frontend/src/App.tsx` — orchestrate components, manage analysis state with Zustand
8. Wire API call: DemoInput submit → api.analyzeCode → populate all panels
9. Implement download: JSON.stringify(changeProof) → Blob → download link
10. Visual QA: render at 1080p, verify no overflow, no raw JSON visible, no errors in console

**Relevant Context**:
- ARCHITECTURE.md > UI Layer
- DEMO.md > Golden Demo Path (second-by-second)
- WINNING_CRITERIA.md > Criterion 4: Demo Quality
- RISKS.md > R4: Looks like generic reviewer

---

### Task 10: CI, README, and Submission Polish

**Status**: [ ] pending

**Intent**: Make the repository look like a production-quality open-source project. CI must pass on main branch. README must enable a fresh clone to work. All acceptance gates from VALIDATION.md must pass.

**Expected Outcomes**:
- GitHub Actions CI workflow: lint (ruff), type-check (mypy + tsc), tests (pytest + vitest), build
- `README.md` with: project description, architecture diagram, quickstart (docker-compose), demo instructions, tech stack
- All automated acceptance gates from VALIDATION.md pass
- Full demo path recorded at 1080p
- `docker-compose up` from a fresh clone produces working demo
- No TODO comments in production code paths
- No print() debug statements

**Todo List**:
1. Create `.github/workflows/ci.yml` with: Python lint (ruff), Python typecheck (mypy), pytest, Node typecheck (tsc), frontend tests (vitest if applicable)
2. Update `README.md`: add full architecture diagram (ASCII), quickstart, demo instructions, tech stack table, IBM Bob integration section
3. Add `vitest` to frontend and write at least one frontend component test
4. Run full VALIDATION.md checklist: Suite 1–6 all pass, manual checklist completed
5. Run full demo path end-to-end, record at 1080p
6. Review all production code for TODO/print/debug artifacts
7. Verify `docker-compose up && curl localhost:8000/health` → `{"status": "ok"}` in fresh environment
8. Verify ChangeProof download produces valid JSON with matching proof_hash

**Relevant Context**:
- VALIDATION.md > Acceptance Gates
- WINNING_CRITERIA.md > Criterion 5: Code Quality and Production Readiness
- DEMO.md > Demo Technical Requirements

---

## Implementation Notes for Agent Mode

When switching to agent mode, process each sub-task as follows:

1. Read this plan file
2. Read the referenced documents for the task (ARCHITECTURE.md, VALIDATION.md, etc.)
3. Implement the task
4. Run the acceptance tests for the task
5. Update task status in this file: `[ ] pending` → `[x] done`
6. Note any findings or constraints for the next task in a "Context for Next Task" section below

---

## Context for Next Task

_(Updated by agent after each task completion)_

**After Task 1**: Note Python version used, confirm dependency versions that resolved correctly, note any Docker networking issues.

**After Task 2**: Note which Tree-sitter node types are available for Python/JS/TS grammars. Note any grammar edge cases found during testing.

**After Task 3**: Note the structural matching algorithm approach chosen. Note any false-positive cases found in testing that need risk classifier awareness.

**After Task 5**: Note exact output of pipeline on demo corpus. Confirm Suite 6 expected values (exact counts).

**After Task 6**: Note Bob model ID used, note prompt template versions, note any Bob response quality issues found during manual validation.

**After Task 8**: Note exact API response schema version. Frontend must match this exactly.
