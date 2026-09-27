# ISOMORPH — Validation Criteria

## Principle

Every claim must be falsifiable. Every test must actually run.
No invented benchmarks. No fabricated pass rates.
If something cannot be tested, it is labeled a claim, not a fact.

---

## Test Suites

### Suite 1: Parser Correctness

**What is tested**: Tree-sitter CST generation produces correct output for known inputs.

| Test | Input | Expected Output | Pass Criterion |
|---|---|---|---|
| `test_parse_python_function` | Simple Python function | CST with function_definition node | Node type matches |
| `test_parse_python_class` | Python class with methods | CST with class_definition + function children | Child count and types match |
| `test_parse_js_arrow` | JS arrow function | CST with arrow_function node | Node type matches |
| `test_parse_ts_interface` | TypeScript interface | CST with interface_declaration | Node type + field names |
| `test_parse_invalid_syntax` | Malformed Python | ParseError raised | Exception raised, not crash |
| `test_parse_empty_file` | Empty string | Empty CST or root node only | No crash, valid result |
| `test_signature_hash_determinism` | Same source parsed twice | Identical hashes | hash(A) == hash(A) |
| `test_signature_hash_sensitivity` | Source with 1 char changed | Different hash | hash(A) != hash(B) |

---

### Suite 2: Structural Differ Correctness

**What is tested**: Structural diff correctly classifies changes.

| Test | Scenario | Expected Classification | Pass Criterion |
|---|---|---|---|
| `test_diff_identical` | Before == After | 0 structural changes | change_count == 0 |
| `test_diff_whitespace_only` | Whitespace reformatting | COSMETIC only | all changes COSMETIC |
| `test_diff_comment_change` | Comment text changed | COSMETIC only | all changes COSMETIC |
| `test_diff_variable_rename` | Variable renamed, no logic change | COSMETIC or LOW | no HIGH/MEDIUM |
| `test_diff_return_mutation` | Return expression changed | Modified function node detected | change_type == MODIFIED |
| `test_diff_function_added` | New function added | ADDED node | change_type == ADDED |
| `test_diff_function_removed` | Function removed | REMOVED node | change_type == REMOVED |
| `test_diff_node_reorder` | Functions reordered, no body change | MOVED nodes, no body change | change_type == MOVED |
| `test_diff_guard_removed` | Guard clause deleted | Control flow change detected | signals contains control_flow_change |
| `test_diff_reproducible` | Same inputs twice | Identical StructuralDiff | diff(A,B) == diff(A,B) |

---

### Suite 3: Risk Classifier Correctness

**What is tested**: Risk signals are assigned correctly to structural changes.

| Test | Input Change | Expected Risk Level | Expected Signals |
|---|---|---|---|
| `test_risk_whitespace` | Whitespace only | COSMETIC | [] |
| `test_risk_rename_only` | Variable rename only | LOW | [rename] |
| `test_risk_return_change` | Return expression mutated | HIGH | [return_value_change] |
| `test_risk_guard_removed` | Guard clause removed | HIGH | [control_flow_change] |
| `test_risk_function_signature` | Parameter added/removed | MEDIUM | [interface_change] |
| `test_risk_assignment_mutation` | Assignment target changed | MEDIUM | [data_flow_change] |
| `test_risk_loop_bound` | Loop range/condition changed | HIGH | [control_flow_change] |
| `test_risk_exception_removed` | Except clause removed | HIGH | [control_flow_change] |
| `test_risk_comment_only` | Comment change only | COSMETIC | [] |

---

### Suite 4: Change Proof Assembly

**What is tested**: ChangeProof is assembled correctly and is reproducible.

| Test | Input | Expected | Pass Criterion |
|---|---|---|---|
| `test_proof_schema_valid` | Any valid analysis | ChangeProof matches schema | Pydantic validation passes |
| `test_proof_hash_reproducible` | Same inputs x2 | Same proof_hash | hash1 == hash2 |
| `test_proof_hash_sensitive` | Different input | Different proof_hash | hash1 != hash2 |
| `test_proof_contains_uncertainty` | Analysis with unknowns | uncertainty_flags populated | len(flags) > 0 |
| `test_proof_provenance` | Any analysis | Engine version + model recorded | fields present and non-empty |

---

### Suite 5: API Contract

**What is tested**: FastAPI endpoints return correct schemas.

| Test | Endpoint | Input | Expected | Pass Criterion |
|---|---|---|---|---|
| `test_api_analyze_valid` | POST /api/analyze | Valid before/after Python | 200 + ChangeProof JSON | Status 200, schema valid |
| `test_api_analyze_invalid_lang` | POST /api/analyze | Unsupported language | 400 with error message | Status 400 |
| `test_api_analyze_malformed` | POST /api/analyze | Syntactically invalid source | 422 or structured error | No 500 crash |
| `test_api_health` | GET /health | — | 200 + {"status": "ok"} | Status 200 |

---

### Suite 6: Demo Corpus Validation

**What is tested**: The golden demo scenario produces exactly the expected analysis.

| Test | Input | Expected | Pass Criterion |
|---|---|---|---|
| `test_demo_corpus_high_risk_count` | demo/before + demo/after | Exactly 1 HIGH risk region | high_risk_count == 1 |
| `test_demo_corpus_cosmetic_count` | demo/before + demo/after | >= 20 COSMETIC regions | cosmetic_count >= 20 |
| `test_demo_corpus_bug_detected` | demo/before + demo/after | calculate_discount in HIGH risk | node_id contains "calculate_discount" |
| `test_demo_stub_runnable` | Generated test stub | Stub is syntactically valid Python | ast.parse succeeds |
| `test_demo_stub_fails` | Generated test stub run against after | Test FAILS (demonstrating the bug) | test result == FAIL |
| `test_demo_proof_reproducible` | demo corpus x2 | Same proof_hash | hash1 == hash2 |

---

## Manual Validation Checklist

These cannot be automated but must be completed before submission:

- [ ] Bob explanation for `calculate_discount` HIGH risk region is accurate and specific
- [ ] Bob explanation does NOT fabricate information not present in the structural diff
- [ ] UI renders structural diff without visual glitches at 1080p
- [ ] Change Proof download produces valid JSON that matches the displayed proof_hash
- [ ] Full demo path runs end-to-end in < 90 seconds on demo hardware
- [ ] Fallback demo path (Bob cached) works when Bob API is mocked as unavailable
- [ ] No "Error" or "undefined" visible in UI during golden demo path

---

## Acceptance Gates (Must All Pass Before Submission)

1. All Suite 1–5 automated tests: **100% pass**
2. Suite 6 demo corpus tests: **100% pass**
3. Manual checklist: **all items checked**
4. `docker-compose up && curl localhost:8000/health` → `{"status": "ok"}`
5. Full demo recorded at 1080p and reviewed frame-by-frame

---

## What Is NOT Claimed

| Non-Claim | Why |
|---|---|
| Semantic equivalence detection | Requires formal verification; we do structural analysis |
| Complete coverage of all behavioral changes | Heuristic risk signals, not exhaustive |
| Bob explanation accuracy guarantee | AI output, qualified with confidence |
| Performance at scale | Not tested on very large files; no claims made |
| Language grammar completeness | Tree-sitter grammars have edge cases; not claimed perfect |
