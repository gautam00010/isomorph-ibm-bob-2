# ISOMORPH — Technical Risks

## Risk Register

Each risk is rated on two dimensions:
- **Likelihood**: LOW / MEDIUM / HIGH (probability of occurring)
- **Impact**: LOW / MEDIUM / HIGH (effect on demo/submission if it occurs)

---

## R1: Tree-sitter Grammar Edge Cases

**Risk**: Tree-sitter grammars for Python/JS/TS produce unexpected or inconsistent node types for certain syntax patterns (e.g., nested comprehensions, complex decorators, TypeScript generics). Structural diff produces wrong or missing nodes.

**Likelihood**: MEDIUM  
**Impact**: HIGH (demo could silently miss a change or produce incorrect risk classification)

**Mitigation**:
- Use `tree-sitter-languages` prebuilt wheels — battle-tested grammar versions
- Build a corpus of tricky syntax patterns and validate CST output against expected nodes
- Add a fallback: when a node type is unrecognized, classify as UNKNOWN and surface to user rather than silently passing
- Never claim completeness for all syntax patterns

**Residual**: Known grammar gaps should be documented explicitly in VALIDATION.md under "What Is Not Claimed."

---

## R2: Structural Diff Algorithm Misclassifies Refactors

**Risk**: The structural differ classifies a large-scale refactor (function reorder, extract method, inline) as many MODIFIED/ADDED/REMOVED nodes when the actual behavior is unchanged. This produces false HIGH/MEDIUM risk signals.

**Likelihood**: MEDIUM  
**Impact**: MEDIUM (reduces precision; erodes trust in risk signal)

**Mitigation**:
- Implement signature-hash matching to detect moved functions (not just added/removed)
- Implement subtree-level hash comparison to detect inline/extract patterns
- Accept known false-positive rate: label them explicitly as "structural change detected, behavioral equivalence cannot be asserted"
- The demo corpus must NOT trigger this false positive on its cosmetic changes

**Residual**: False positives on large refactors are acceptable; false negatives (missed HIGH risk) are not. Tune accordingly.

---

## R3: IBM Bob API Latency or Unavailability

**Risk**: Bob API is slow (> 5 seconds) or unavailable during demo. Demo stalls visibly.

**Likelihood**: MEDIUM  
**Impact**: HIGH (breaks demo narrative at the most critical moment)

**Mitigation**:
- Pre-cache Bob responses for the demo corpus as JSON files
- Implement a `DEMO_MODE=true` env flag that loads cached responses instantly
- UI shows Bob analysis in a separate panel that loads asynchronously — structural analysis is instant
- Fallback UI label: "IBM Bob (cached)" — honest, not hidden
- Test with actual Bob API before demo, verify latency

**Residual**: Demo path survives total Bob failure because structural analysis is independent.

---

## R4: Looking Like a Generic AI Code Reviewer

**Risk**: Judges look at the UI and see "another AI code review tool." The technical differentiation (CST structural matching) is invisible.

**Likelihood**: MEDIUM  
**Impact**: VERY HIGH (eliminates differentiation, reduces to commodity)

**Mitigation**:
- UI must show the structural diff viewer, NOT a text diff — this makes the mechanism visible
- Show the CST signal explicitly: "31 structural regions found by Tree-sitter parser"
- Show the classification taxonomy visibly: COSMETIC / LOW / MEDIUM / HIGH with counts
- Show the risk signals explicitly: "control_flow_change, return_value_change" — not just "high risk"
- Show the ChangeProof hash and its reproducibility in the UI
- The words "semantic equivalence" and "AI-powered code review" must NEVER appear
- Use the precise language from the product thesis at every touchpoint

**Residual**: If the structural diff viewer is well-implemented, this risk is largely eliminated visually.

---

## R5: Demo Corpus Produces Ambiguous Output

**Risk**: The demo before/after files produce an analysis that is unclear, cluttered, or doesn't cleanly highlight the one HIGH risk change.

**Likelihood**: LOW  
**Impact**: HIGH (demo depends on clean, unambiguous output)

**Mitigation**:
- Demo corpus is hand-crafted and validated before coding begins
- Suite 6 tests lock the expected demo output (high_risk_count == 1, specific node_id)
- Demo files are version-controlled and treated as fixtures — not generated dynamically
- Run full demo analysis 10+ times to confirm stability

**Residual**: If demo output is clean and Suite 6 passes, this risk is eliminated.

---

## R6: Test Stub Generation Produces Unrunnable Code

**Risk**: Bob generates test stubs that are syntactically invalid, import nonexistent modules, or use incorrect function signatures. Running them crashes or shows error output.

**Likelihood**: MEDIUM  
**Impact**: MEDIUM (breaks the evidence step of the demo)

**Mitigation**:
- Syntactically validate all stubs with `ast.parse()` before presenting them
- Run stubs in an isolated subprocess with a timeout
- If a stub is invalid: label it "Generated stub (syntax error — not run)" in the UI
- For demo corpus: pre-validate that the expected test stub is runnable and fails correctly
- Prompt engineering: provide Bob with exact function signature from CST, not inferred text

**Residual**: Demo corpus stub is pre-validated. Live stubs may occasionally fail — handled gracefully.

---

## R7: Scope Creep Kills Depth

**Risk**: Team (or planning) adds features (CI/CD integration, multi-file analysis, repo ingestion, authentication, etc.) that spread implementation thin and produce a shallow demo of many half-built features.

**Likelihood**: HIGH  
**Impact**: HIGH (destroys the "simple outside, hard inside" principle)

**Mitigation**:
- Kill list in PRODUCT.md is authoritative — no feature added without explicit decision
- Every implementation decision must answer: "Does this make the 90-second demo better?"
- The structural diff engine must be deep and correct before ANY UI work
- Prioritize: Engine → API → Demo corpus → UI → Bob integration → Evidence → ChangeProof
- Stretch features (Java, Go, multi-file) are explicitly labeled stretch and never started until MVP is done

**Residual**: Track scope daily. If it's not in the demo path, it doesn't exist.

---

## R8: ChangeProof Feels Cosmetic

**Risk**: The ChangeProof panel looks like a summary report — judges don't understand that it's a content-hashed, reproducible, self-describing artifact with real provenance value.

**Likelihood**: MEDIUM  
**Impact**: MEDIUM (undersells the strongest differentiator)

**Mitigation**:
- Show the proof_hash prominently in the UI with a copy button
- Include a "Reproduce this proof" instruction in the UI: "Same inputs will produce this exact hash"
- The downloadable JSON must be well-formatted and self-describing (include field documentation)
- Demo script explicitly calls this out as the auditable artifact

**Residual**: If the hash + reproducibility claim is demonstrated live, this risk is eliminated.

---

## R9: IBM Bob Hallucination in Explanations

**Risk**: Bob produces an explanation for a changed region that is factually wrong about the code (e.g., claims a function does something it doesn't, invents caller behavior).

**Likelihood**: MEDIUM  
**Impact**: MEDIUM (erodes trust if demonstrated to judges; demo corpus is controlled so unlikely there)

**Mitigation**:
- Prompts are structured to ask Bob to explain only what the structural diff shows — not general code behavior
- All explanations are labeled "IBM Bob analysis (AI-generated, verify before acting)"
- uncertainty_flags in ChangeProof explicitly surface Bob's low-confidence outputs
- Demo corpus Bob response is pre-validated for accuracy before demo day
- Fail closed: if Bob returns empty/error, show "AI analysis unavailable" rather than fabricated content

**Residual**: For live inputs beyond demo corpus, Bob hallucination is possible — mitigated by labeling and uncertainty flags.

---

## Risk Priority Summary

| Risk | Likelihood | Impact | Priority |
|---|---|---|---|
| R4: Looks like generic reviewer | MEDIUM | VERY HIGH | 🔴 Critical |
| R3: Bob API unavailability | MEDIUM | HIGH | 🔴 Critical |
| R1: Grammar edge cases | MEDIUM | HIGH | 🟠 High |
| R2: False-positive refactors | MEDIUM | MEDIUM | 🟠 High |
| R7: Scope creep | HIGH | HIGH | 🔴 Critical |
| R5: Demo corpus ambiguity | LOW | HIGH | 🟡 Medium |
| R6: Unrunnable test stubs | MEDIUM | MEDIUM | 🟡 Medium |
| R8: ChangeProof feels cosmetic | MEDIUM | MEDIUM | 🟡 Medium |
| R9: Bob hallucination | MEDIUM | MEDIUM | 🟡 Medium |
