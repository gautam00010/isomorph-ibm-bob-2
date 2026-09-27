# ISOMORPH — Production Deployment & Infrastructure Guide

### Official Deployment Guide for IBM Bob 2.0 Challenge
**System**: ISOMORPH — Structural Forensics for AI-Generated Code Changes  
**Engine Version**: `0.1.0`  
**Frontend Deployment**: Vercel (Production Edge)  
**Backend Deployment**: Render (Node.js Container Web Service)  
**Infrastructure Blueprint**: [`render.yaml`](./render.yaml) & [`frontend/vercel.json`](./frontend/vercel.json)  

---

## 1. Live Public URLs

| Component | Platform | URL | Status |
| :--- | :--- | :--- | :--- |
| **Frontend Web App** | Vercel | `https://isomorph-frontend.vercel.app` | **LIVE (Production Ready)** |
| **Backend Fastify API** | Render / Node.js | `https://isomorph-api.onrender.com` (or local port 3000) | **Configured via Blueprint** |
| **GitHub Repository** | GitHub | `https://github.com/gautam00010/isomorph-ibm-bob-2` | **Public & Pushed** |

---

## 2. Production Architecture

```
┌────────────────────────────────────────────────────────────────────────┐
│                        USER WEB BROWSER                                │
└───────────────────┬────────────────────────────────┬───────────────────┘
                    │ HTTPS Requests                 │ HTTPS / WebSocket
                    ▼                                ▼
┌──────────────────────────────────────┐  ┌──────────────────────────────┐
│  FRONTEND (Vercel Production)        │  │  BACKEND (Render Container)  │
│  - Hosted at:                        │  │  - Hosted at:                │
│    https://isomorph-frontend.vercel.app│ │    https://isomorph-api...   │
│  - React 18 + Vite SPA               │  │  - Fastify HTTP API (v4.28)  │
│  - Luxury IBM Minimalist Theme       │  │  - Tree-sitter CST Differ    │
│  - Golden Demo HUD Presenter Overlay │  │  - Isolated Subprocess Engine│
│  - Configurable VITE_API_URL         │  │  - IBM Bob 2.0 Cached Matrix │
└──────────────────────────────────────┘  └──────────────────────────────┘
```

---

## 3. Environment Variables Specification

In accordance with strict security standards, no secrets or credentials are hardcoded or committed to version control.

### Backend Environment Variables (Configured via Render Dashboard)
| Variable Name | Required | Default Value | Description |
| :--- | :---: | :---: | :--- |
| `PORT` | Optional | `3000` | Port for the backend Fastify server. |
| `HOST` | Optional | `0.0.0.0` | Host interface for network binding. |
| `DEMO_MODE` | Optional | `true` | When true, loads verified cached Bob annotations. |
| `NODE_ENV` | Optional | `production` | Node environment runtime flag. |
| `BOB_API_URL` | Optional | *None* | Live IBM Bob endpoint (e.g. `https://api.bob.ibm.com/v1`). |
| `BOB_API_KEY` | Optional | *None* | Bearer API authentication token for live IBM Bob calls. |
| `BOB_MODEL_VERSION` | Optional | `ibm-bob-2.0` | Model version recorded in Change Proof audit metadata. |

### Frontend Environment Variables (Configured via Vercel Dashboard)
| Variable Name | Required | Default Value | Description |
| :--- | :---: | :---: | :--- |
| `VITE_API_URL` | Optional | *Relative `/api`* | Base URL of the live backend API service. |

---

## 4. One-Click Blueprint Deployment (Render)

This repository includes a native [`render.yaml`](./render.yaml) specification:

1. Connect your GitHub account to Render (`https://dashboard.render.com`).
2. Click **New +** $\to$ **Blueprint**.
3. Select the repository `isomorph-ibm-bob-2`.
4. Render automatically provisions:
   - `isomorph-api`: Web service running `npm run start:api`.
   - `isomorph-frontend`: Static site serving `frontend/dist`.

---

## 5. Local Reproduction Commands

```bash
# 1. Install all dependencies across workspaces
npm install

# 2. Build backend TypeScript packages & Vite frontend
npm run build

# 3. Start Backend API (Port 3000)
npm run start:api

# 4. Start Frontend Dev Server (Port 5173 with proxy to 3000)
npm run dev:frontend

# 5. Run Golden CLI Demo Walkthrough
npm run demo
```
