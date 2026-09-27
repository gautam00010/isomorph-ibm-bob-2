# ISOMORPH — Golden Demo Script (3-Minute Hackathon Video)

## Core Philosophy

**Simple outside. Hard inside.**

The demo must make the problem obvious in the first 15 seconds.
The technical mechanism must be deeper than the UI.
Every second must serve comprehension, not feature enumeration.

---

## Demo Scenario: Production E-Commerce Pricing Engine

### Scenario Context
- Module: `pricing/discount.js`
- An AI coding assistant was instructed to *"refactor for clarity and conciseness"*.
- The AI changed 842 lines (+482 / -360 lines of formatting, renames, and noise).
- A subtle return-condition mutation removed the negative-price guard clause in `calculateDiscount`, causing promotional $0-items to calculate negative billing amounts.
- **The Core Forensic Question**: *"An AI changed 842 lines. What ACTUALLY changed?"*

---

## 3-Minute Hackathon Video Timeline

```
[00:00 – 00:15] STAGE 1: THE PROBLEM
[00:15 – 00:35] STAGE 2: LAUNCH ISOMORPH
[00:35 – 01:05] STAGE 3: NOISE → STRUCTURAL SIGNAL
[01:05 – 01:40] STAGE 4: HIGHEST-RISK REGION
[01:40 – 02:10] STAGE 5: IBM BOB CONTEXTUAL REASONING
[02:10 – 02:40] STAGE 6: TARGETED VERIFICATION (FAIL → FIX → PASS)
[02:40 – 03:00] STAGE 7: CHANGE PROOF & CLOSING
```

---

### [00:00 – 00:15] STAGE 1: THE PROBLEM

**Visual**:
- Browser opens to the initial Isomorph hero view.
- Headline: **“An AI changed 842 lines. What ACTUALLY changed?”**
- Telemetry shows: `842 lines changed (+482 / -360 churn)`.
- The reviewer is presented with a massive wall of indistinguishable diff churn.

**Voiceover / Script**:
> *"An AI coding assistant changed 842 lines claiming to refactor for conciseness. A human reviewer cannot reliably find the regression in this wall of text diff. What actually changed?"*

---

### [00:15 – 00:35] STAGE 2: LAUNCH ISOMORPH

**Action**:
- Presenter clicks **“ANALYZE CHANGE”** (or **“RUN STRUCTURAL FORENSICS →”**).

**Visual**:
- The signature 6-stage forensic sequence overlay activates:
  1. `01: 842 LINES` — Raw diff stream ingested.
  2. `02: ANALYZING` — Tree-sitter parses 302 CST nodes.
  3. `03: STRUCTURAL SIGNAL` — CST hash matching collapses 839 lines of syntactic noise.
  4. `04: 3 BEHAVIOR CHANGES` — Functional mutation sites isolated.
  5. `05: EVIDENCE` — Subprocess test runner executes.
  6. `06: CHANGE PROOF` — Canonical SHA-256 digest assembled.

**Voiceover / Script**:
> *"We launch Isomorph. Tree-sitter parses the concrete syntax tree, builds deterministic node hashes, and diffs structurally, not textually."*

---

### [00:35 – 01:05] STAGE 3: NOISE → STRUCTURAL SIGNAL

**Visual**:
- The main forensic workspace loads.
- Level 2 transformation strip prominently displays:
  `842 LINES CHANGED` → `ANALYZING` → `STRUCTURAL SIGNAL (839 collapsed)` → `3 BEHAVIOR-SENSITIVE CHANGES` → `EVIDENCE` → `CHANGE PROOF`.
- The left column lists the 3 isolated mutations, while 839 cosmetic diffs are filtered into the collapsed background.

**Voiceover / Script**:
> *"842 lines of textual noise collapse into 3 isolated structural changes. 99% of the diff was syntactic noise: renames, whitespace, formatting. Only 3 regions alter behavior."*

---

### [01:05 – 01:40] STAGE 4: HIGHEST-RISK REGION

**Action**:
- Presenter selects the highest-risk card: `calculateDiscount` (HIGH RISK).

**Visual**:
- Workspace displays three critical forensic dimensions:
  1. **WHAT CHANGED**:
     - Original: `price > 0 ? price * (1 - rate) : 0`
     - Refactored: `price * (1 - rate)`
  2. **WHY IT MATTERS**:
     - Signals detected: `return_value_changed`, `control_flow_branch_removed`.
     - Risk Score: 85/100 (HIGH RISK).
     - Functional regression: negative-price guard removed.
  3. **SOURCE EVIDENCE**:
     - Node ID: `statement_block[2]/return_statement[2]` in function `calculateDiscount`.

**Voiceover / Script**:
> *"We inspect the highest-risk region in calculateDiscount. What changed: the negative-price guard was deleted. Why it matters: zero-dollar and negative items produce negative balances."*

---

### [01:40 – 02:10] STAGE 5: IBM BOB CONTEXTUAL REASONING

**Action**:
- Presenter switches to the **“IBM Bob Forensic Reasoning”** tab.

**Visual**:
- Truth Delineation Strip clearly separates:
  - **SOURCE 1: CST FORENSIC ENGINE (DETERMINISTIC FACT)**
  - **SOURCE 2: IBM BOB (FORENSIC INTERPRETATION)**
- Bob explanation:
  > *"The guard clause preventing non-positive pricing was removed from calculateDiscount. When price is zero or negative, the original code returned 0; the new code returns a negative value. Callers that do not validate the return value will silently accept negative prices."*
- Business Impact:
  > *"Invoices and checkout baskets with promotional zero-dollar items will calculate negative balances, leading to revenue leakage and accounting reconciliation failures."*
- Uncertainty surfaced explicitly:
  > *"Cannot determine whether upstream checkout callers validate prices before invoking calculateDiscount."*

**Voiceover / Script**:
> *"We consult IBM Bob. Bob receives only structured intermediate representation—never raw diff text. Bob interprets the business consequence, while deterministic facts remain cleanly separated from AI interpretation."*

---

### [02:10 – 02:40] STAGE 6: TARGETED VERIFICATION (FAIL → FIX → PASS)

**Action**:
- Presenter switches to the **“Executable Evidence (Subprocess)”** tab.

**Visual**:
- **Step 6A (FAIL)**:
  - Bob-generated test stub executes against the candidate code:
    `assert.strictEqual(calculateDiscount(-5, 0.2), 0)`
  - Subprocess exits with code 1.
  - Result: `❌ FAIL (REGRESSION DETECTED)`: Expected 0 but got -4.
- **Step 6B (FIX)**:
  - Presenter clicks **“🛠️ RESTORE GUARD (APPLY FIX) & RE-VERIFY →”**.
  - Code restores: `return price > 0 ? price * (1 - rate) : 0;`.
- **Step 6C (PASS)**:
  - Subprocess re-runs in sandbox.
  - Subprocess exits with code 0.
  - Result: `✅ PASS (BEHAVIOR PRESERVED)`.
  - Banner confirms: `VERIFICATION CHAIN: FAIL → FIX → PASS COMPLETE`.

**Voiceover / Script**:
> *"Bob generated a targeted test stub. We run it in an isolated subprocess. First, it FAILS—confirming the regression is real. We restore the 1-line guard. We re-run. It PASSES. Evidence is observed, never inferred."*

---

### [02:40 – 03:00] STAGE 7: CHANGE PROOF & CLOSING

**Action**:
- Presenter clicks **“Audit Change Proof →”** (or advances to Step 7 in the Demo HUD).

**Visual**:
- The signature technical audit artifact loads:
  - Header: `CHANGE PROOF`
  - Status: `VERIFICATION COMPLETE`
  - Canonical Hash: `sha256:820a50e9...`
  - All 6 auditable layers populated: Structural Summary, CST Evidence, Behavior Regions, Subprocess Tests, Bob Reasoning, Residual Uncertainty.
  - Buttons: `COPY PROOF`, `DOWNLOAD JSON`.
- Final Closing Screen displays:
  ```
  ══════════════════════════════════════════════════════════════════════════
                            ISOMORPH
                   See what actually changed.
  ══════════════════════════════════════════════════════════════════════════
  ```

**Voiceover / Script**:
> *"The final artifact is the Change Proof: a content-hashed, reproducible JSON evidence document. Same inputs, same hash. Isomorph: See what actually changed."*

---

## Reproducibility & CLI Execution

To run the exact 3-minute golden demo sequence in the terminal:

```bash
npm run demo
```

Or execute directly:

```bash
node bin/demo.js
```

All fixtures in `demo/before/discount.js` and `demo/after/discount.js` are locked and deterministically tested in Suite 6.
