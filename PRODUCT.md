# ISOMORPH — Product Definition

## Tagline

**Deterministic verification for AI-generated code changes.**

---

## The Problem (Precise)

AI coding agents — Cursor, GitHub Copilot, agentic pipelines — routinely generate hundreds or thousands of changed lines in a single commit. Human reviewers face a structural comprehension problem:

- A text diff shows **all changes equally** — cosmetic whitespace beside silent logic rewrites.
- Textual diffs grow with reformatting, renames, and structural moves that carry zero behavioral risk.
- Behavior-sensitive changes — a narrowed return condition, a removed guard, a mutated loop bound — appear **identical in visual weight** to a renamed variable.

The human reviewer's cognitive bottleneck is signal extraction, not reading speed.

**The question that cannot currently be answered reliably:**
> "An AI changed 1,000 lines of code. What actually changed?"

---

## The Product Thesis

ISOMORPH does not review code. ISOMORPH transforms a code diff into a **deterministic structural analysis** that separates cosmetic noise from behavior-sensitive signal, then assembles an auditable **Change Proof**.

The output is not a score, a grade, or a chat response.
The output is a structured artifact — verifiable, reproducible, traceable.

---

## User Story (Primary)

> As a developer reviewing an AI-generated PR, I paste the before/after source of a changed file into ISOMORPH. Within seconds I see exactly which structural regions changed, which carry behavioral risk, what IBM Bob's targeted explanation of each risk region is, and what tests I need to verify the risky changes. I download the Change Proof JSON as an auditable record.

---

## Core User Flow

```
1. INPUT
   Paste before/after source OR provide GitHub PR URL
   → ISOMORPH detects language, validates parsability

2. STRUCTURAL ANALYSIS
   → CST parsed deterministically
   → Structural diff computed (NOT text diff)
   → Each change classified: COSMETIC / LOW / MEDIUM / HIGH risk

3. SIGNAL VIEW
   → Structural Diff Viewer shows only meaningful changes
   → Risk panel shows HIGH/MEDIUM regions with signals (e.g., "control flow change")
   → Cosmetic changes collapsed and labeled

4. AI EXPLANATION (IBM Bob)
   → Each HIGH/MEDIUM node: plain-English explanation
   → Targeted test stubs generated for risky behavior
   → Repository impact assessment (if repo context available)

5. EVIDENCE (Optional)
   → Test stubs executed (if environment supports it)
   → Results shown: PASS / FAIL / ERROR / SKIPPED
   → Execution output preserved verbatim

6. CHANGE PROOF
   → Downloadable JSON artifact with full provenance
   → Human-readable report
   → Proof hash (content-addressable, reproducible)
```

---

## What Users See

### Before ISOMORPH
```
1,000 lines of red and green
No structural signal
Equal visual weight for all changes
```

### After ISOMORPH
```
32 structural regions changed
 ↳ 3 HIGH risk (control flow modified)
 ↳ 7 MEDIUM risk (interface changed, data flow changed)
 ↳ 22 COSMETIC (whitespace, comments, renames with no logic change)

HIGH: function calculate_discount — return condition narrowed
  → "This change removes the zero-price guard. If price is 0,
     the function now returns a negative value."
  → Test stub: test_calculate_discount_zero_price

CHANGE PROOF: sha256:3f8a... | generated 2025-01-15T14:32:00Z
```

---

## Product Constraints (Non-Negotiable)

1. **Deterministic first**: Every structural fact is computed, never inferred by AI.
2. **No overclaiming**: Never claim behavior is preserved. Use "no structural change detected" not "safe."
3. **Traceable**: Every risk signal maps to a specific CST node with source range.
4. **Honest uncertainty**: If Bob cannot assess something, say so explicitly.
5. **Reproducible**: Same inputs, same ChangeProof hash.
6. **No fake data**: No invented benchmarks, no synthetic "customer" claims.

---

## Language Support (MVP)

Priority order based on AI agent prevalence and tree-sitter grammar maturity:

| Language | Parser | Status |
|---|---|---|
| Python | tree-sitter-python | MVP |
| JavaScript/TypeScript | tree-sitter-javascript / tree-sitter-typescript | MVP |
| Java | tree-sitter-java | Stretch |
| Go | tree-sitter-go | Stretch |

---

## IBM Bob Integration (Value-Add, Not Decoration)

Bob adds value at points where deterministic analysis alone is insufficient:

| Point | Deterministic Engine Provides | Bob Adds |
|---|---|---|
| Explanation | Structural signal (e.g., "return node changed") | Plain-English consequence ("callers may receive None") |
| Tests | Identifies changed function signature | Generates runnable stub targeting the specific change |
| Impact | Detects interface-level changes | Finds callers and dependents in repo context |

Bob is never asked to detect structural changes. Bob is asked to reason about them.

---

## Non-Goals (Kill List)

- ❌ General-purpose AI code review
- ❌ Vulnerability scanning
- ❌ Full repository ingestion and Q&A
- ❌ Multi-file holistic analysis in MVP
- ❌ PR comment generation workflow
- ❌ CI/CD pipeline integration (mention as future, do not build)
- ❌ User accounts, auth, persistence
- ❌ Multi-agent orchestration dashboard
- ❌ SaaS pricing, billing, teams
- ❌ Mobile / responsive design priority

---

## Differentiation (What Makes This Original)

1. **Structural, not textual**: No other mainstream code review tool uses CST structural matching as the primary analysis layer.
2. **Change Proof as artifact**: The output is a versioned, content-hashed, self-describing document — not a report, not a score, not a chat history.
3. **Explicit uncertainty preservation**: The system explicitly surfaces what it cannot determine, rather than hiding it.
4. **Minimal Bob exposure**: Bob receives only structurally isolated context — this is architecturally different from "dump code into LLM."
5. **Behavior-sensitive vs. cosmetic classification**: The explicit cosmetic/low/medium/high taxonomy is a concrete, defensible product concept.

---

## Business Value (Real)

- **AI adoption risk**: Every organization adopting AI coding tools faces unreviewed change risk. This is a real and growing problem.
- **Compliance**: Auditable Change Proof addresses regulated environments where change provenance matters.
- **Developer velocity**: Reviewers spend time on risk signal, not noise filtering.
- **Trust in AI tools**: Provides a verification layer that makes AI agent adoption safer.

---

## Success Metrics (Observable, Not Invented)

| Metric | How Measured |
|---|---|
| Structural precision | Manually verified on corpus of 10 curated diffs |
| Risk classification accuracy | Manual review of HIGH/MEDIUM labels vs. actual risk |
| Bob explanation quality | Rated by reviewer on 5 curated changes |
| Test stub correctness | Stubs syntactically valid and runnable |
| ChangeProof reproducibility | Same input → identical proof_hash (automated test) |
| Demo path completeness | Full pipeline runs end-to-end in demo scenario |
