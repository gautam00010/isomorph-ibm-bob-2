# ISOMORPH — Next Actions

**Goal**: Complete the end-to-end deterministic verification pipeline:  
`INPUT CHANGE → ANALYZE → STRUCTURAL SIGNAL → RISK → EXPLANATION → VERIFICATION → CHANGE PROOF`

---

## Status Summary

| Tier | Focus | Status |
|---|---|---|
| **P0** | Essential for Functioning Product / Golden Demo | ✅ **100% COMPLETE & VERIFIED** |
| **P1** | Major Improvement to Judged Quality (API & Web UI) | ⏳ Ready to implement |
| **P2** | Polish (Docker, CI) | ⏳ Queued |
| **P3** | Out of Scope / Unnecessary | ❌ Prohibited per AGENTS.md |

---

## Priority Rankings

### P0 — Essential for Functioning Product / Golden Demo [COMPLETED]

1. **[x] P0.1: Fix Workspace Test & Build Infrastructure**
   - Added unit tests for `@isomorph/bob` (`validator.test.ts`, `prompts.test.ts`).
   - Fixed npm workspace dependency protocol (migrated from unsupported `workspace:*` to standard `*`).
   - Resolved CommonJS identifier shadowing bug in `@isomorph/proof`.
   - Verified clean monorepo builds and typechecking across all workspaces.

2. **[x] P0.2: Implement Layer 5 — Behavioral Evidence Runner (`packages/evidence`)**
   - Created `@isomorph/evidence` with subprocess isolation and 5-second execution timeout.
   - Built standalone sandbox harness supporting assertions, unit tests, and error trapping.
   - Verified evidence recording: `PASS`, `FAIL`, `ERROR`, `TIMEOUT`, `SYNTAX_ERROR`.
   - Unit tests passing (4/4).

3. **[x] P0.3: Implement Change Proof Assembler (`packages/proof`)**
   - Created `@isomorph/proof` implementing canonical JSON serialization and SHA-256 `proofHash`.
   - Sanitized runtime timing jitter (`durationMs`, execution timestamp) in proof hash calculation to guarantee 100% hash reproducibility across machines.
   - Built `verifyProofHash` verification utility.
   - Unit tests passing (4/4).

4. **[x] P0.4: Create Locked Golden Demo Corpus (`demo/`)**
   - Implemented `demo/before/discount.js` (150 lines, production discount engine with zero-price guard).
   - Implemented `demo/after/discount.js` (refactored code with removed guard clause in `calculateDiscount`).
   - Created `demo/cached/bob-annotations.json` with grounded explanations and regression test stub.
   - Updated `@isomorph/bob` orchestrator to seamlessly resolve local cached annotations for zero-latency demo execution.

5. **[x] P0.5: Wire End-to-End Pipeline & CLI Demo Runner**
   - Implemented `@isomorph/core` exposing `runIsomorph(before, after, options)`.
   - Created executable CLI `bin/demo.js` (`npm run demo`) and `bin/isomorph.js`.
   - Executed golden demo in 343ms: structural breakdown, Bob explanation, observable regression (`Assertion: Expected 0 but got -4`), and generated `change-proof.json`.

6. **[x] P0.6: Acceptance Tests**
   - Added `packages/core/__tests__/pipeline.test.ts` verifying end-to-end execution and proof hash reproducibility.
   - Total test suite: 10 suites, 119 tests passing with 0 failures.

---

### P1 — Major Improvement to Judged Quality
*Ready for implementation next:*

1. **P1.1: Fastify HTTP API Server (`packages/api`)**
   - Expose `POST /api/analyze` and `GET /health` with Zod schema validation for request/response.
2. **P1.2: React + Vite Frontend (`frontend/`)**
   - Implement split structural diff viewer (grouping by CST regions, not lines), Risk Panel (HIGH/MEDIUM/LOW/COSMETIC), and Change Proof Panel with copyable `proof_hash` and JSON download.
3. **P1.3: Live IBM Bob API Connectivity**
   - Verify live calling against IBM Bob / watsonx when `BOB_API_KEY` and `BOB_API_URL` are provided in `.env`.

---

### P2 — Polish
*Implement only after P1 is complete:*

1. **P2.1: Docker & Compose Setup**
   - `docker-compose.yml` to spin up backend API and frontend in a containerized environment.
2. **P2.2: GitHub Actions CI Workflow**
   - Linting, typechecking, and automated test suite execution on commit.
3. **P2.3: UI Enhancements**
   - Syntax highlighting within CST snippets and dark mode styling.

---

### P3 — Unnecessary / Out of Scope (Explicitly Excluded per AGENTS.md)

- ❌ Multi-language parsing (Python, Java, Go) before JS/TS is complete.
- ❌ Multi-file whole-repository analysis.
- ❌ General-purpose AI chat or Q&A about code.
- ❌ User authentication, sessions, database persistence, billing.
- ❌ GitHub PR bot / auto-comment automation.
- ❌ Overclaiming semantic equivalence or automated "safety" claims.
