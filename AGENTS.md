# AGENTS.md — Isomorph Engineering Constitution

This file permanently encodes the engineering principles for Isomorph.
When future instructions conflict with this file, preserve these principles unless explicitly overridden by a human with authority over this repository.

---

## Project Purpose

Isomorph provides **deterministic verification for AI-generated code changes**.

The core problem: AI coding agents produce large diffs that exaggerate cosmetic and structural noise while hiding small behavior-sensitive changes. A human reviewer cannot reliably answer "what actually changed?" from a raw text diff.

Isomorph's answer: transform a code diff into a deterministic structural analysis, classify behavior-sensitive regions, explain them through IBM Bob, verify them with executable evidence, and produce an auditable **Change Proof**.

The product is not a code reviewer. It is not a chatbot. It is a verification instrument.

---

## Architecture Rules

The pipeline has a strict layer order. Do not invert it. Do not skip layers.

```
1. DETERMINISTIC ENGINE   (parser, structural diff, risk classification)
2. AI REASONING           (IBM Bob explanation, test generation, impact assessment)
3. EXECUTION / EVIDENCE   (test runner, behavioral verification)
4. ARTIFACT               (Change Proof assembly)
```

**Rule 1**: No AI layer may produce a fact that the deterministic engine can produce. Bob explains structural findings — it does not produce them.

**Rule 2**: No evidence claim may be made without execution. "A test passed" means a test ran and passed, not that one was generated.

**Rule 3**: The Change Proof is assembled last, from all prior layers. It is never speculatively pre-filled.

**Rule 4**: Layer boundaries are module boundaries. `engine/` has no import from `bob/`. `bob/` has no import from `evidence/`. `api/` orchestrates; it does not contain analysis logic.

---

## Truth Model

| Type of claim | Required source | Forbidden source |
|---|---|---|
| Structural fact (node changed, function moved) | Deterministic parser + differ | LLM output |
| Risk classification (HIGH / MEDIUM / LOW) | Rule-based risk classifier | LLM judgment |
| Behavioral claim (test passed, output preserved) | Executed test with observed result | Inference or LLM assertion |
| AI explanation | IBM Bob, labeled as interpretation | Presented as ground truth |
| Uncertainty | Explicitly surfaced in output | Hidden or suppressed |

**Precise language required**:
- ✅ "structural equivalence" — two nodes have the same CST hash
- ✅ "structural change isolation" — changed regions identified deterministically
- ✅ "behavior-sensitive region detected" — heuristic signal present
- ✅ "no structural change detected" — the differ found no node-level changes
- ❌ "semantically equivalent" — not supported by this system
- ❌ "mathematically proven" — not supported unless a formal proof is implemented
- ❌ "safe to merge" — behavioral correctness is not asserted
- ❌ "AI verified" — AI does not verify; AI interprets

---

## AI Usage

**IBM Bob must be meaningfully integrated** into both the development workflow and the product.

### In the product

Bob is called at exactly three points in the pipeline:

1. **Explanation** — Bob receives a `RiskEntry` and minimal node-text context. It returns a plain-English explanation of the structural change and its probable consequence.
2. **Test stub generation** — Bob receives a function signature and the changed control-flow nodes. It returns a targeted unit test stub. The stub is validated with `ast.parse()` before use.
3. **Impact assessment** — Bob receives interface-level changes from the RiskMap and uses repository context to identify potentially affected callers.

### Structural rules for Bob prompts

- Bob receives **structured intermediate representation** (RiskEntry JSON + minimal node text), not raw source files.
- Prompt templates are versioned in `isomorph/bob/prompts.py`. No ad-hoc f-string prompt construction outside that module.
- Bob output is always a structured schema (`AIAnnotation`), not free-form chat text consumed directly by the UI.
- Every Bob response is labeled with its source, model version, and a confidence level.
- Bob's uncertainty is preserved in the `AIAnnotation.uncertainty` field and surfaced in the Change Proof.

### Do not use an LLM as the sole verifier of its own output

- Bob-generated test stubs must be syntactically validated (AST parse) before execution.
- Bob explanations must be traceable to a specific `DiffNode` in the structural diff.
- Bob impact assessments must reference specific file paths returned by repo context tools, not invented paths.

### In the development workflow

- Use IBM Bob to reason about implementation choices, generate test cases, and review code during development.
- Always ground Bob's development assistance in actual code evidence from the repository — do not accept fabricated code claims.

---

## Claim Discipline

These rules are non-negotiable and apply to all code, documentation, UI copy, and demo scripts.

- **Never invent metrics.** No "73% faster review time" unless a reproducible measurement produced that number.
- **Never invent customers.** No "used by 500 teams" unless it is true.
- **Never invent performance results.** Benchmark only what is actually benchmarked.
- **Never call structural equivalence semantic equivalence.** CST hash matching proves structural identity, not behavioral identity.
- **Never say "mathematically proven"** unless a formal theorem and a verified implementation support the exact claim.
- **Fail closed.** When uncertain, surface the uncertainty. Never suppress it to appear more capable.
- **Never claim a test passed unless it ran.** `SKIPPED` and `ERROR` are not `PASS`.

---

## Quality Standards

### TypeScript
- Strict mode is always on (`"strict": true` in `tsconfig.json`). No exceptions.
- No `any` types in production code paths. Use `unknown` and narrow explicitly.
- All API responses validated with Zod at the boundary. Never trust raw JSON shapes.
- No `as` type assertions except where unavoidable, with a comment explaining why.

### Python
- Type annotations on all public functions.
- Pydantic models for all data crossing module boundaries.
- `ParseError`, `DiffError`, `ProofError` are defined and used — never let internal exceptions leak to the API layer.
- No `print()` statements in production paths. Use structured logging.

### Tests
- Unit tests for all deterministic engine components: parser, differ, risk classifier, proof assembler.
- Tests use **deterministic fixtures** — not generated inputs, not random data.
- Same test input always produces the same output. No time-dependent or environment-dependent assertions.
- The demo corpus (`demo/before/discount.py`, `demo/after/discount.py`) is a locked fixture. Suite 6 tests assert exact expected output.
- A test that does not run is not a test. Do not commit skipped tests without a documented reason.

### Reproducibility
- The Change Proof `proof_hash` must be a SHA-256 of canonical input. Same inputs → same hash, always.
- The structural diff is deterministic. Same source pair → same `StructuralDiff`, always.
- All randomness in test generation (if any) must use a seeded RNG.

### Error handling
- All error states must produce a structured response, not a crash.
- The API never returns a 500 for a predictable error (bad input, unsupported language, parse failure).
- The UI always shows a clear error state — never blank, never raw JSON stack trace.
- Bob API failure is a handled state, not an exception. The pipeline continues with `AIAnnotation.explanation = None`.

### Domain boundaries
- `engine/` — deterministic analysis only. No Bob imports, no API imports.
- `bob/` — AI orchestration only. Imports from `engine/` for types, never for execution.
- `evidence/` — test execution only. Subprocess isolation required.
- `api/` — orchestration and schema validation only. No analysis logic.
- `frontend/` — display and interaction only. All data from API, never computed client-side.

---

## Product

### The key user journey

```
Analyze change
  → Isolate structural signal
    → Classify risk (HIGH / MEDIUM / LOW / COSMETIC)
      → Explain with IBM Bob
        → Verify with executed tests
          → Generate Change Proof
```

Every product feature must serve this journey. Features that do not appear in this path are not in scope.

### The Change Proof

The Change Proof is the central output artifact. It is:
- A versioned, content-hashed JSON document
- Self-describing (includes provenance: engine version, Bob model, timestamp)
- Reproducible: the same inputs always produce the same `proof_hash`
- Honest: includes `uncertainty_flags` for everything the system cannot determine

The Change Proof is **not** a report. It is not a score. It is not a summary. It is a structured evidence record.

---

## UX Principles

- **Structural diff viewer, not text diff viewer.** The primary diff display shows CST structural regions — not line-by-line red/green text. The mechanism must be visible.
- **Information density is controlled.** The UI surfaces signal (risk level, risk signals, explanation) before implementation detail (node types, hashes, raw IR).
- **No raw AST spiderweb as the primary experience.** Tree visualization is secondary or absent in MVP. The primary view is a risk-annotated change list.
- **Cosmetic changes are collapsed.** The default view hides COSMETIC changes behind a toggle. They are not deleted — they are deprioritized.
- **The proof hash is prominent.** The `proof_hash` is displayed in the UI, not buried in the JSON download. This communicates reproducibility to non-technical judges and users.
- **Loading states are always shown.** No blank screens during analysis. Structural analysis completes fast; Bob analysis is async and shown when ready.
- **Error states are always shown.** No silent failures.

---

## Scope

### In scope (MVP)
- JavaScript and TypeScript source files
- Single-file before/after comparison
- Structural diff + risk classification (deterministic)
- IBM Bob explanation + test stub generation
- Evidence runner (Python subprocess for generated stubs)
- Change Proof assembly and download
- Demo corpus (locked, reproducible)

### Explicitly out of scope
- **Multi-language support** — do not add Python, Java, Go, Rust grammars until JS/TS is deeply correct. No premature multi-language abstraction.
- **Authentication** — no user accounts, no sessions, no JWT.
- **Billing** — no payment, no plans, no feature gates.
- **Settings pages** — no configuration UI that does not directly serve the demo path.
- **Decorative dashboards** — no analytics, no "files analyzed" counters, no activity feeds.
- **Multi-file analysis** — single-file comparison only in MVP.
- **CI/CD pipeline integration** — mention as future work, do not build.
- **PR automation** — no auto-comment, no auto-approve workflows.
- **General code Q&A** — Isomorph answers "what changed?" not "what does this do?"

---

## Demo

### The golden path

The golden demo path is defined in [`DEMO.md`](./DEMO.md). It must always be stable.

- The demo corpus files (`demo/before/discount.py`, `demo/after/discount.py`) are **locked fixtures**. Do not modify them without updating Suite 6 tests and re-validating expected output.
- Suite 6 tests (`test_demo_corpus_*`) are **acceptance gates**. They must pass before any demo is run.
- The `DEMO_MODE=true` environment flag loads cached Bob responses from `demo/cached_bob/`. This ensures the demo path survives Bob API unavailability.
- The full demo path must run end-to-end in under 90 seconds on demo hardware.
- Bob API responses for the demo corpus are pre-fetched and stored verbatim in `demo/cached_bob/`. They are reviewed for accuracy before each demo.

### Benchmark fixtures

- All benchmarks use deterministic fixture files, not generated or random inputs.
- Benchmark results are never claimed in documentation or UI unless they come from an actual run against the fixture.
- If a benchmark is not yet run, the number does not appear anywhere in the product.

---

## Security

- **Never execute untrusted submitted code directly on the host.** The Evidence Runner executes only IBM Bob–generated test stubs, not user-submitted code.
- Generated test stubs are validated with `ast.parse()` before execution.
- Test execution runs in a **subprocess with a timeout** (default: 5 seconds). No subprocess has network access in the evidence runner.
- If sandboxed execution (Docker, gVisor, Firecracker) is added, it replaces subprocess isolation — it does not layer on top.
- The API accepts source code as text for parsing only. Parsing with Tree-sitter does not execute the source code.
- No secrets are committed to the repository. `BOB_API_KEY` and `BOB_PROJECT_ID` are always environment variables, documented in `.env.example`, never hardcoded.

---

## Revision History

| Version | Change |
|---|---|
| 1.0 | Initial constitution — project purpose, architecture rules, truth model, AI usage, claim discipline, quality, product, UX, scope, demo, security |
