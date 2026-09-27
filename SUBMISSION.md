# ISOMORPH — Submission Package

### IBM Bob 2.0 Challenge Submission
**Project Title**: ISOMORPH  
**Category**: Verification Instrument / Developer Forensics  
**Tagline**: *“See what actually changed.”*  
**Core Inquiry**: *“An AI changed 842 lines. What ACTUALLY changed?”*  
**Repository**: `ISOMORPH` (Monorepo, TypeScript / Node.js)  
**Verification Status**: 127/127 Tests Passing · 100% Strict TypeScript · Production Build Passing  

---

## Executive Summary

AI coding assistants (Cursor, Copilot, autonomous coding agents) routinely submit commits touching hundreds of lines of code. Standard line-based diff tools (`git diff`, GitHub PR viewer) treat every line of code as equal. Adding a wrapper block or reformatting a module creates dozens of red/green hunks that look identical in magnitude to changing an arithmetic operator, omitting a boundary check, or deleting an authorization guard.

Human reviewers cannot extract signal from an 842-line wall of textual noise. They either spend hours manually deciphering reformattings or rubber-stamp the change, allowing silent behavioral regressions into production.

**ISOMORPH** is a **verification instrument that performs structural forensics on AI-generated code changes**.

It does not guess. It parses Concrete Syntax Trees (CST) using Tree-sitter, diffs code at the structural syntax-node level, deterministically isolates behavior-sensitive mutations from cosmetic churn, uses IBM Bob 2.0 to interpret consequences and synthesize targeted test stubs, executes tests in an isolated subprocess sandbox, and issues a cryptographic, reproducible **Change Proof**.

---

## The 5 Core Differentiators

| Dimension | Generic AI Code Reviewer | Release-Risk Dashboard | ISOMORPH Structural Forensics |
| :--- | :--- | :--- | :--- |
| **Analysis Foundation** | Unstructured LLM chat inspecting raw diff text; prone to hallucinations and missed mutations. | Statistical heuristics across git history ("Risk: 72%"). | **Deterministic Tree-sitter CST differ**: 3-pass node matching with canonical subtree hashes. |
| **Noise Filtering** | LLMs read the whole diff and comment on style, renames, and formatting. | Ignores syntax; counts commit frequency and lines changed. | **Syntactic Noise Collapse**: Formattings, renames, and reordering are collapsed deterministically (99%+ noise reduction). |
| **Risk Classification** | Probabilistic LLM opinion ("looks risky"). | Coarse commit metadata. | **Rule-Based Structural Heuristics**: Classifies AST signals (`return_value_changed`, `control_flow_branch_removed`). |
| **Role of AI (IBM Bob)** | Primary reviewer generating unverified commentary. | N/A or generic summaries. | **Contextual Reasoning on Structured IR**: Bob receives verified AST node objects—never raw files. |
| **Verification & Output** | Unverified suggestions or text comments. | Dashboards and metrics. | **Subprocess Sandbox & Change Proof**: Executes test stubs; issues canonical SHA-256 Change Proof JSON. |

---

## System Architecture

Governed strictly by the Isomorph Engineering Constitution ([`AGENTS.md`](./AGENTS.md)), the verification pipeline has a strict layer order that cannot be inverted:

```
┌────────────────────────────────────────────────────────────────────────┐
│  LAYER 1: DETERMINISTIC ENGINE (@isomorph/engine)                      │
│  - Concrete Syntax Tree (CST) parsing via Tree-sitter                   │
│  - 3-Pass Structural Differ: Hash Match → Scope Match → Levenshtein    │
│  - Rule-Based Risk Classifier: HIGH / MEDIUM / LOW / COSMETIC          │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ Structured IR (RiskMap + DiffNode)
┌───────────────────────────────────▼────────────────────────────────────┐
│  LAYER 2: AI REASONING (@isomorph/bob)                                 │
│  - Grounded in structured IR (no raw source blobs)                     │
│  - Plain-English consequence explanation                               │
│  - Business impact assessment                                          │
│  - Targeted unit test stub synthesis (pre-validated with AST parse)    │
│  - Explicit surfacing of residual uncertainties                        │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ Synthesized Test Stubs
┌───────────────────────────────────▼────────────────────────────────────┐
│  LAYER 3: BEHAVIORAL EVIDENCE (@isomorph/evidence)                     │
│  - Subprocess sandbox execution (Node.js child process)                │
│  - Isolated temporary workspace with 5000ms timeout                    │
│  - Verbatim stdout/stderr capture (no inferred passes)                 │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ Executed EvidenceRecord
┌───────────────────────────────────▼────────────────────────────────────┐
│  LAYER 4: ARTIFACT ASSEMBLY (@isomorph/proof)                          │
│  - Assembles Change Proof v1.0 document                                │
│  - Canonical JSON serialization with reproducible SHA-256 hash         │
│  - Fully self-describing audit record with complete provenance         │
└────────────────────────────────────────────────────────────────────────┘
```

---

## Meaningful IBM Bob Integration

In ISOMORPH, IBM Bob 2.0 is not a decorative chatbot. It is a precision reasoning layer inside a verification instrument.

1. **Structured Input Boundary**: Bob receives verified `RiskEntry` JSON and minimal AST node text—never full, unparsed source files.
2. **Deterministic-First Truth Model**: No AI layer may produce a fact that the deterministic engine can discover. Bob explains structural findings; it does not discover them.
3. **Fact vs. Interpretation Delineation**: Every Bob output in the UI and Change Proof is strictly separated from deterministic AST facts.
4. **Targeted Test Synthesis**: Bob synthesizes targeted test stubs exercising the exact mutated control-flow boundary. Stubs are syntax-validated via AST parse before entering the execution sandbox.
5. **Surfacing Uncertainty**: When Bob cannot determine callers outside the module scope, it explicitly logs `uncertainty_flags` into the Change Proof.

---

## 3-Minute Video Golden Demo Path

The complete golden flow is documented in [`DEMO.md`](./DEMO.md) and runnable via `npm run demo`:

- **00:00 – 00:15 | The Problem**: Shows an AI-generated 842-line textual diff (+482 / -360 churn) in `pricing/discount.js`. Poses the core question: *“What actually changed?”*
- **00:15 – 00:35 | Launch Isomorph**: Launches CST parsing and differencing with the 6-stage telemetry overlay.
- **00:35 – 01:05 | Noise → Signal**: 842 lines of textual churn collapse into **3 behavior-sensitive changes**; 839 cosmetic lines are filtered out.
- **01:05 – 01:40 | Highest-Risk Region**: Inspects `calculateDiscount` (HIGH RISK). Pinpoints **WHAT CHANGED** (`price > 0` guard removed), **WHY IT MATTERS** (negative billing regression), and **SOURCE EVIDENCE** (CST node `return_statement[2]`).
- **01:40 – 02:10 | IBM Bob Contextual Reasoning**: Shows Bob's plain-English explanation, business impact analysis, and surfaced residual uncertainties, cleanly separated from deterministic facts.
- **02:10 – 02:40 | Targeted Verification (FAIL → FIX → PASS)**: Subprocess executes Bob-generated test stub → **FAIL** (`calculateDiscount(-5, 0.2)` returned -4, expected 0). Presenter clicks *“Restore Guard”* and re-runs → **PASS** (`BEHAVIOR PRESERVED`).
- **02:40 – 03:00 | Change Proof & Closing**: Downloads the canonical Change Proof (`sha256:...`). Displays closing screen: **ISOMORPH — See what actually changed.**

---

## Claim Discipline & Technical Boundaries

Per the Isomorph Engineering Constitution ([`AGENTS.md`](./AGENTS.md)):

- **No universal semantic equivalence**: CST hash matching proves structural identity, not universal semantic equivalence. Proving arbitrary semantic equivalence across all programs is theoretically undecidable (Rice's Theorem).
- **No claim of perfect detection**: Heuristics isolate control flow, return conditions, guard clauses, and arithmetic mutations. Dynamic mutations without structural manifestations require broader runtime fuzzing.
- **Never claim a test passed unless it ran**: Subprocess execution status is strictly binary (`PASS` on exit code 0; `FAIL` on non-zero exit).
- **No invented metrics**: Benchmarks reflect reproducible, measured runs on locked fixtures.

---

## Verification & Build Confidence

- **Unit & Integration Tests**: `npm run test` → **127 / 127 passed** across all 7 workspaces.
- **TypeScript Typecheck**: `npm run typecheck` → **0 errors** (`"strict": true` throughout).
- **Production Build**: `npm run build` → Succeeded across all packages and Vite frontend.
- **CLI Demo**: `npm run demo` → Exits with code 0 and emits canonical `change-proof.json`.
