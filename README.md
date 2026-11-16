# MailPilot AI

An AI-powered email management dashboard for personal assistants. Every conversation that lands in a connected mailbox is classified by **who is responsible for replying** — the assistant, the client, nobody, or a human review — so assistants can work through an inbox as decisions instead of triage.

> **Prototype status.** Gmail/Outlook connections are *simulated* (no real OAuth) and the sample inbox is seeded on first connect. AI classification calls Gemini when a key is configured and falls back to deterministic rules otherwise.

## Features

- **Onboarding & mailbox connection** — sign up, pick a role, connect a (simulated) Gmail or Outlook inbox, watch it sync and classify.
- **Assistant dashboard** — totals, classification split, action-required queue, upcoming meetings and recent conversations.
- **Segments** — automatically derived views: action required, client to reply, assistant to reply, waiting, needs review, meetings, important, no reply needed, general, unread.
- **AI reply-responsibility classification** — `assistant_reply` · `client_reply` · `no_reply` · `needs_review`, each with a reason, a confidence score and a source badge (Gemini AI vs rule-based).
- **Conversation view** — thread history, AI summary with important dates, AI-drafted reply, tone/instructions controls, and a one-click **classification override** that is always available to the human.
- **Ask AI** — free-form questions about the inbox with a rule-based fallback answer.
- **Client portal** — a minimal, read-focused view of only the conversations waiting on the client, with approve/delegate/handled actions that stay in sync with the assistant workspace.

## Tech stack

| Layer | Stack |
| --- | --- |
| Frontend | React 19 · TypeScript · Vite · React Router · Zustand · Recharts · Tailwind CSS (design tokens) + custom CSS |
| Backend | Node.js · Express 5 · TypeScript · Zod validation · JWT (access + refresh, httpOnly cookies) |
| Database | MongoDB via Mongoose |
| AI | Google Gemini (`gemini-2.5-flash`) with a rule-based fallback |

## Project structure

```
MailPilot AI/
├── backend/
│   └── src/
│       ├── config/        # db connection, env access, demo-user seed
│       ├── controllers/   # request handlers
│       ├── middleware/    # auth, validation, error handling
│       ├── models/        # Mongoose schemas
│       ├── routes/        # /api/* route definitions
│       ├── services/      # classification, summaries, drafts, inbox queries
│       ├── utils/         # ApiError / ApiResponse helpers
│       └── server.ts
└── frontend/
    └── src/
        ├── components/    # AppShell, conversation rows, badges, UI primitives
        ├── lib/           # typed API client, formatters, shared types
        ├── pages/         # Welcome, Login, Signup, Onboarding, Dashboard, Inbox,
        │                  # Conversation, AskAI, Accounts, ClientPortal, NotFound
        ├── store/         # Zustand auth store
        ├── App.css        # component styles
        └── index.css      # design tokens + base layer
```

## Getting started

### Prerequisites

- Node.js 20+
- MongoDB running locally (or a connection string to a hosted cluster)

### 1. Backend

```bash
cd backend
cp .env.example .env      # then edit the values
npm install
npm run dev               # http://localhost:5000
```

Required `.env` values are documented in [`backend/.env.example`](backend/.env.example). At minimum set `MONGODB_URI` and the two token secrets (`openssl rand -hex 32`).

### 2. Frontend

```bash
cd frontend
npm install
npm run dev               # http://localhost:5173
```

The Vite dev server proxies `/api` to `http://localhost:5000`, so no frontend environment file is needed for local development.

### Demo login

The sign-in screen has a **Fill demo credentials** button:

```
sarah@example.com · password123
```

The account is created automatically the first time the backend starts (see `backend/src/config/seed.ts`). Alternatively, create your own account from the sign-up screen — a realistic sample inbox is seeded the first time you connect a mailbox.

## Available scripts

| Where | Command | Purpose |
| --- | --- | --- |
| `backend` | `npm run dev` | Run the API with hot reload (`tsx watch`) |
| `backend` | `npm run build` | Compile TypeScript to `dist/` |
| `backend` | `npm start` | Run the compiled API |
| `frontend` | `npm run dev` | Start the Vite dev server |
| `frontend` | `npm run build` | Type-check (`tsc -b`) and build for production |
| `frontend` | `npm run lint` | Lint with oxlint |

## How the simulated integrations work

**Mailbox connection.** `POST /api/accounts/connect` creates an account record, returns a simulated authorization message instead of redirecting to Google/Microsoft, and seeds a realistic set of threads (board scheduling, vendor approvals, newsletters, invoices, travel alerts, personal mail) on first connect. `POST /api/accounts/:id/sync` re-runs ingestion for demo mail.

**AI classification.** `classifyConversation()` in `backend/src/services/ai.service.ts` asks Gemini for a structured JSON decision. If no `GEMINI_API_KEY` is set, the request fails, or the response cannot be parsed, it falls back to `classifyWithRules()` — deterministic keyword and context rules that produce the same four-way classification with a `rules` source. Summaries and reply drafts follow the same call-then-fallback pattern.

**Sending mail.** Replies are stored locally and marked as sent; no message ever leaves the machine.

## API overview

```
POST /api/auth/register|login|logout|refresh
GET  /api/users/me                    PATCH /api/users/me
GET  /api/accounts                    POST   /api/accounts/connect
POST /api/accounts/:id/sync           DELETE /api/accounts/:id
GET  /api/emails                      GET    /api/emails/segments
GET  /api/emails/client               GET    /api/emails/conversations/:id
PATCH /api/emails/conversations/:id   POST   /api/emails/conversations/:id/reply
POST /api/emails/ingest
POST /api/ai/conversations/:id/summarize|classify|draft
POST /api/ai/ask
GET  /api/dashboard/stats
```

All responses share one envelope: `{ success, statusCode, data, message }`.
