# IBM Bob Usage Statement — ISOMORPH

### Official Usage Statement for the IBM Bob 2.0 Challenge
**Project**: ISOMORPH — Structural Forensics for AI-Generated Code Changes  
**Engine Version**: `0.1.0`  
**Repository Standard**: Strict Monorepo (`TypeScript`, Node.js v18+)  
**Engineering Constitution**: Enforced via [`AGENTS.md`](./AGENTS.md)  

---

## 1. Executive Statement

This document provides a factual, evidence-grounded record of how **IBM Bob 2.0** was utilized in the development and execution of ISOMORPH.

ISOMORPH adheres to strict claim discipline:
- We document only **real** IBM Bob usage.
- We do not claim that Bob performed tasks executed by deterministic compilers, AST parsers, or runtime sandboxes.
- We do not present AI interpretations as ground truth.
- We strictly delineate the boundary between **Deterministic Facts** (discovered by Tree-sitter CST analysis) and **Forensic Interpretation** (synthesized by IBM Bob 2.0).

---

## 2. IBM Bob in Architecture & Planning

During early system design, IBM Bob was utilized as a technical reasoning partner to formulate the core architecture and establish strict domain boundaries:

### 2.1 The 4-Layer Non-Invertible Pipeline
Bob was used to review and refine the pipeline order, ensuring that probabilistic AI reasoning never precedes or contaminates deterministic parsing:
```
1. DETERMINISTIC ENGINE   (Tree-sitter CST parser, 3-pass structural differ, risk classifier)
2. AI REASONING           (IBM Bob explanation, impact assessment, test stub synthesis)
3. EXECUTION / EVIDENCE   (Isolated Node.js subprocess sandbox)
4. ARTIFACT ASSEMBLY      (Canonical JSON Change Proof with SHA-256 digest)
```
*Bob's Architectural Guidance*: Bob advised against feeding unparsed raw diffs to an LLM. Instead, Bob helped define a **Structured Intermediate Representation (IR)** (`BobInput`) so that the AI reasoning layer receives only verified syntax nodes, deterministic risk scores, and minimal localized context.

### 2.2 Formulation of the Truth Model
In collaboration with Bob's reasoning on formal verification limits, we drafted the Truth Model encoded in [`AGENTS.md`](./AGENTS.md):
- Proving arbitrary semantic equivalence across all programs is theoretically impossible (**Rice's Theorem**). Therefore, CST hash matching proves **structural identity**, never "universal semantic equivalence."
- No AI layer may produce a fact that the deterministic engine can produce.
- A test claim cannot be made without execution (`PASS` requires a subprocess exit code of 0).

---

## 3. IBM Bob in Repository-Context Reasoning

A critical strength of IBM Bob 2.0 is its ability to reason across repository context without hallucinating external dependencies. Bob was employed to analyze cross-module blast radius for structural mutations:

### 3.1 Tracing Callers in the Demo Corpus
When the deterministic differ flagged a deleted guard in `calculateDiscount` (`demo/before/discount.js` vs `demo/after/discount.js`), Bob used repository context to trace how `calculateDiscount` was consumed:
- **Direct Caller Identified**: Traced to `processOrderPricing` within `pricing/discount.js`.
- **Business Vulnerability Exposed**: Bob identified that promotional checkout baskets with zero-dollar items would calculate negative balances, resulting in revenue leakage and downstream accounting errors.
- **Honest Uncertainty Boundary**: Because the demo corpus did not include the external checkout gateway, Bob explicitly declared:  
  *“Cannot determine whether upstream checkout callers validate prices before invoking calculateDiscount.”*

### 3.2 Authorization Middleware Analysis
In `demo/after/auth.js`, the differ flagged the removal of token expiration checks and the addition of `request.user.role === 'admin'`. Bob reasoned about the security impact:
- Traced caller dependencies in `security/auth.js` (`authorize` invoking `verifyToken` and `hasRequiredPermissions`).
- Explained that spoofed unverified headers completely bypass cryptographic validation.
- Highlighted that permissions were degraded from conjunction (`every`) to disjunction (`some`).

---

## 4. Development Tasks Bob Assisted With

IBM Bob was actively used in the developer workflow during the implementation of the TypeScript monorepo packages:

| Development Task | Monorepo Package | Bob's Contribution | Independent Verification |
| :--- | :--- | :--- | :--- |
| **3-Pass Differ Strategy** | `@isomorph/engine` | Suggested separating node diffing into 3 passes (Hash Match $\to$ Scope Match $\to$ Levenshtein) to avoid $O(N^2)$ AST comparisons. | Verified via 103 Jest unit tests (`hash.test.ts`, `differ.test.ts`). |
| **AST Pre-Validation** | `@isomorph/bob` | Advised that all generated test stubs must be pre-parsed via Tree-sitter before being sent to the execution sandbox. | Verified via `validator.test.ts` rejecting malformed test stubs. |
| **Canonical JSON Serializer** | `@isomorph/proof` | Recommended recursive lexicographical key sorting to ensure consistent SHA-256 digests across different JS runtimes. | Verified via 1,000-run bit-for-bit identity test in `assembler.test.ts`. |
| **Subprocess Timeout Protection** | `@isomorph/evidence` | Designed the process isolation pattern using `child_process.spawn` with explicit 5000ms timeout and stdout/stderr byte-capping. | Verified via `runner.test.ts` executing real subprocess runs. |
| **Heuristic Risk Rules** | `@isomorph/engine` | Helped define the signal taxonomy (`control_flow_branch_removed`, `return_value_changed`, `guard_clause_mutated`). | Verified via `classifier.test.ts` asserting exact risk classifications. |

---

## 5. How Bob Contributes Inside Isomorph (Product Runtime)

Inside the running application, IBM Bob is invoked through `@isomorph/bob` at **three strictly defined pipeline stages**:

```
                  ┌─────────────────────────────────────┐
                  │ Deterministic Risk Entry (Layer 1)  │
                  └──────────────────┬──────────────────┘
                                     │ Structured IR
                                     ▼
┌────────────────────────────────────────────────────────────────────────┐
│                   IBM BOB 2.0 REASONING (Layer 2)                      │
│                                                                        │
│  [Role 1: Technical Explanation]                                       │
│  Input : RiskEntry + Normalized Node Text                              │
│  Output: Plain-English explanation of the mutation & consequence       │
│                                                                        │
│  [Role 2: Business Impact Assessment]                                  │
│  Input : Enclosing context + Interface signatures                      │
│  Output: Concrete operational/financial risk analysis                  │
│                                                                        │
│  [Role 3: Targeted Test Stub Synthesis]                                │
│  Input : Mutated control-flow node + function signature                │
│  Output: Focused Jest unit test targeting the boundary condition       │
│                                                                        │
│  [Residual Uncertainty Surfacing]                                      │
│  Output: Explicit list of what cannot be determined                    │
└────────────────────────────────────┬───────────────────────────────────┘
                                     │ Validated AIAnnotation
                                     ▼
                  ┌─────────────────────────────────────┐
                  │ Pre-Execution AST Parse (Layer 3)   │
                  └─────────────────────────────────────┘
```

### Strict Bounded Input Rules:
- Bob receives **Structured IR** (`BobInput`), never raw source code files.
- Text representation of changed nodes is strictly capped at 500 tokens.
- Versioned prompt templates (`v1/explain`, `v1/test_stub`, `v1/impact`) are maintained in `packages/bob/src/prompts.ts`.

---

## 6. What Was Verified Independently

To guarantee that Isomorph never relies on an LLM as the sole verifier of its own output, every Bob output is subjected to independent deterministic verification:

1. **Syntactic AST Verification**:  
   Every synthesized test stub is parsed with `parse(stub)` before execution. If `countParseErrors(tree) > 0`, the stub is rejected with `SYNTAX_ERROR` and never executed.
2. **Subprocess Execution**:  
   Test stubs are written to an isolated temporary directory and executed via an independent Node.js child process. The evidence runner captures verbatim exit codes and outputs. A claim of `PASS` is recorded only when the process exits with code 0.
3. **Evidence Reference Validation**:  
   The `evidenceReferences` returned by Bob are validated against the actual CST node IDs present in the `StructuralDiff`. Any fabricated or hallucinated node IDs are stripped by `validateAIAnnotation()`.
4. **Deterministic Fact Segregation**:  
   In both the Web UI and the Change Proof JSON, Bob's output is explicitly labeled as `FORENSIC INTERPRETATION`, while Tree-sitter diff nodes are labeled as `DETERMINISTIC FACT`.

---

## 7. What Bob Did NOT Do (Claim Discipline)

In adherence to [`AGENTS.md`](./AGENTS.md), we explicitly clarify what IBM Bob did **not** do:
- **Did NOT perform CST parsing**: Concrete syntax tree parsing is performed 100% deterministically by Tree-sitter.
- **Did NOT compute node hashes**: Canonical SHA-256 node hashes are calculated mathematically by `@isomorph/engine/hash.ts`.
- **Did NOT classify risk**: Risk levels (`HIGH`, `MEDIUM`, `LOW`, `COSMETIC`) are calculated by rule-based heuristic code in `@isomorph/engine/classifier.ts`.
- **Did NOT verify test executions**: Tests are executed and scored by the operating system subprocess runner in `@isomorph/evidence/runner.ts`.
- **Did NOT replace human or compiler verification**: Bob provides contextual interpretation; deterministic software instruments provide proof.
