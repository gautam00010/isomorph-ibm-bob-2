# ISOMORPH — Local Runbook & Presentation Guide

### Quick Reference for Local Execution, Verification & Demo Recording
**System**: ISOMORPH — Structural Forensics for AI-Generated Code Changes  
**Engine Version**: `0.1.0`  
**Constitution**: [`AGENTS.md`](./AGENTS.md)  

---

## 1. Prerequisites

- **Node.js**: `v18.0.0` or higher (v20+ recommended)
- **npm**: `v9.0.0` or higher
- **Operating System**: Windows, macOS, or Linux

---

## 2. Install Dependencies

From the repository root directory, run:

```bash
npm install
```

This installs all dependencies across the monorepo root and all workspaces (`packages/engine`, `packages/bob`, `packages/evidence`, `packages/proof`, `packages/core`, `packages/api`, `frontend`).

---

## 3. Run the Production Build Locally

To compile all TypeScript packages and build the optimized production frontend bundle:

```bash
npm run build
```

This executes:
1. `tsc` in all backend packages (`@isomorph/engine`, `@isomorph/bob`, `@isomorph/evidence`, `@isomorph/proof`, `@isomorph/core`, `@isomorph/api`).
2. `vite build` in `frontend`, generating the production bundle into `frontend/dist`.

---

## 4. Environment Variables & Demo Mode

### Is a Live IBM Bob API Required?
**NO.** A live IBM Bob API key is **not** required to run the demo.
- ISOMORPH includes pre-cached, verified IBM Bob 2.0 forensic annotations in `demo/cached/bob-annotations.json`.
- When `BOB_API_KEY` is not present (or when `DEMO_MODE=true` is set), the engine automatically falls back to deterministic cached responses.
- The full end-to-end pipeline, the frontend, and the CLI demo run with 100% functionality without any external network calls.

### Optional Environment Variables

If you wish to configure a custom port or connect to a live IBM Bob endpoint, configure these environment variables:

| Variable | Default Value | Purpose |
| :--- | :--- | :--- |
| `PORT` | `3000` | Port for the Fastify API backend server. |
| `HOST` | `0.0.0.0` | Host interface for the Fastify API backend server. |
| `DEMO_MODE` | `true` (auto) | Set to `true` to force cached Bob annotations even if keys are set. |
| `BOB_API_URL` | *None* | Live IBM Bob endpoint URL (e.g. `https://api.bob.ibm.com/v1`). |
| `BOB_API_KEY` | *None* | Bearer API token for live IBM Bob requests. |
| `BOB_MODEL_VERSION` | `ibm-bob-2.0` | Model version recorded in Change Proof provenance. |

---

## 5. Starting the Services Locally

To run the interactive application, you need **two terminal windows**:

### Terminal 1: Start the Backend API Server
```bash
npm run start:api
```
- **Service**: Fastify HTTP API (`@isomorph/api`)
- **Port**: `http://localhost:3000`
- **Health Check**: `http://localhost:3000/health`
- **Analyze Endpoint**: `POST http://localhost:3000/api/analyze`

### Terminal 2: Start the Frontend UI
```bash
npm run dev:frontend
```
- **Service**: Vite Dev Server (`frontend`)
- **Port**: `http://localhost:5173`
- **Proxy**: Automatically proxies `/api/*` requests to `http://localhost:3000`

---

## 6. Accessing the Application

Open your browser and navigate to:

```
http://localhost:5173
```

---

## 7. Running the CLI Golden Demo (Alternative to Web UI)

You can also run the self-contained 3-minute golden demo walkthrough directly in your terminal:

```bash
npm run demo
```

This runs `bin/demo.js`, which executes all 7 stages of the presentation timeline (00:00–03:00), executes the CST differ, calls Bob reasoning, runs the subprocess sandbox (`FAIL` $\to$ `FIX` $\to$ `PASS`), and writes `change-proof.json` to disk.

---

## 8. Demo Scenario for Video Recording

### Selected Scenario: `01 Refactor Noise` (`pricing/discount.js`)
- **Why**: This is the flagship golden corpus. An AI assistant refactored 842 lines (+482 / -360) under the guise of *"code simplification"*.
- **The Core Question**: *"An AI changed 842 lines. What ACTUALLY changed?"*
- **The Forensic Result**: 839 cosmetic diffs (renames, whitespace, formatting) are collapsed. Exactly **3 behavior-sensitive changes** are isolated. The critical flaw is an omitted price check in `calculateDiscount` (`price > 0 ? price * (1 - rate) : 0` mutated to `price * (1 - rate)`).

---

## 9. Click-by-Click Presentation Script (3-Minute Flow)

Follow this exact click-by-click sequence while recording your 3-minute submission video:

```
┌────────────────────────────────────────────────────────────────────────┐
│ [00:00 – 00:15] STEP 1: THE PROBLEM                                    │
│ 1. Open http://localhost:5173 in full screen.                          │
│ 2. Point out the clean initial question:                               │
│    "An AI changed 842 lines. What actually changed?"                   │
│ 3. Note that Scenario "01 Refactor Noise" is selected by default.      │
│ 4. Click [▶ 3-MIN GOLDEN DEMO] in the top navigation bar to activate  │
│    the presenter timeline HUD.                                         │
└────────────────────────────────────────────────────────────────────────┘
                                    ↓
┌────────────────────────────────────────────────────────────────────────┐
│ [00:15 – 00:35] STEP 2: LAUNCH ISOMORPH                                │
│ 1. Click the large blue primary action button: [ANALYZE CHANGE].       │
│ 2. The 6-stage telemetry overlay pulses:                               │
│    Lines Changed → Analyzing CST → Structural Signal →                 │
│    Behavioral Mutations → Evidence Runner → Complete.                  │
│ 3. Analysis completes deterministically in ~260ms.                     │
└────────────────────────────────────────────────────────────────────────┘
                                    ↓
┌────────────────────────────────────────────────────────────────────────┐
│ [00:35 – 01:05] STEP 3: NOISE → STRUCTURAL SIGNAL                      │
│ 1. Observe the top forensic KPI metrics:                               │
│    • 842 Textual Lines Changed                                         │
│    • 839 Cosmetic Diffs Collapsed (99.6% Noise Reduction)              │
│    • 3 Behavior-Sensitive Changes Isolated                             │
│ 2. Point out the cosmetic filter toggle: cosmetic diffs are not       │
│    deleted, but deprioritized to eliminate cognitive overload.         │
└────────────────────────────────────────────────────────────────────────┘
                                    ↓
┌────────────────────────────────────────────────────────────────────────┐
│ [01:05 – 01:40] STEP 4: INSPECT HIGHEST-RISK REGION                    │
│ 1. In the left risk list, click on calculateDiscount (HIGH RISK).      │
│ 2. The center forensic card displays:                                  │
│    • WHAT CHANGED: Guard price > 0 removed from return expression.     │
│    • WHY IT MATTERS: Negative input produces negative billing values.  │
│    • SOURCE EVIDENCE: CST node return_statement[2] in calculateDiscount│
└────────────────────────────────────────────────────────────────────────┘
                                    ↓
┌────────────────────────────────────────────────────────────────────────┐
│ [01:40 – 02:10] STEP 5: IBM BOB CONTEXTUAL REASONING                   │
│ 1. Click the [IBM BOB ANALYSIS] tab in the right-hand panel.           │
│ 2. Emphasize the truth delineation badges:                             │
│    • [DETERMINISTIC FACT] (from Tree-sitter CST differ)                │
│    • [BOB INTERPRETATION] (from IBM Bob 2.0 reasoning)                 │
│ 3. Point out:                                                          │
│    • Plain-English explanation of why the change is behavior-sensitive│
│    • Business Impact: Promotional $0-items produce negative balances   │
│    • Surfaced Uncertainty: External checkout validation not proven     │
└────────────────────────────────────────────────────────────────────────┘
                                    ↓
┌────────────────────────────────────────────────────────────────────────┐
│ [02:10 – 02:40] STEP 6: TARGETED VERIFICATION (FAIL → FIX → PASS)      │
│ 1. Click the [EVIDENCE RUNNER] tab.                                    │
│ 2. Show the Bob-generated test stub targeting calculateDiscount(-5,0.2)│
│ 3. Highlight the execution status: [❌ FAIL] (Assertion failed: -4 != 0)│
│ 4. Click the blue action button: [RESTORE GUARD].                      │
│ 5. Watch the pipeline re-run verification:                             │
│    Status transitions to [✅ PASS] (Exit code 0, Behavior Preserved).   │
└────────────────────────────────────────────────────────────────────────┘
                                    ↓
┌────────────────────────────────────────────────────────────────────────┐
│ [02:40 – 03:00] STEP 7: CHANGE PROOF & CLOSING                         │
│ 1. Click [VIEW CHANGE PROOF] in the header.                            │
│ 2. Display the cryptographic Change Proof JSON artifact:               │
│    • proofVersion: "1.0"                                               │
│    • proofHash: sha256:... (bit-for-bit reproducible)                  │
│    • Full execution provenance & uncertainty flags                     │
│ 3. Click [COPY HASH] or [DOWNLOAD PROOF JSON].                         │
│ 4. Conclude on the brand closing screen:                               │
│    ISOMORPH — See what actually changed.                               │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 10. Summary Command Checklist

```bash
# 1. Install dependencies
npm install

# 2. Build everything locally
npm run build

# 3. Terminal 1: Run Backend API
npm run start:api
# Listening on http://localhost:3000

# 4. Terminal 2: Run Frontend UI
npm run dev:frontend
# Listening on http://localhost:5173

# 5. (Optional) Run CLI Golden Demo
npm run demo
```
