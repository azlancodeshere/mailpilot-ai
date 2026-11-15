# MailPilot AI

**AI-powered email management for personal assistants.**
MailPilot connects your clients' inboxes, works out who actually needs to reply — you or the client — and turns a crowded inbox into a short, prioritised list. Clients only ever see what needs them.

This is a working prototype built on the MERN stack (MongoDB is optional — see [Storage](#storage)). Everything runs locally with zero external services.

---

## Quick start

```bash
npm install            # root deps (concurrently)
npm run install:all    # server + client deps

npm run dev            # API on :4000, Vite dev server on :5173 (proxied)
```

Open http://localhost:5173

### Single-port production build

```bash
npm run build          # builds client/dist
npm start              # Express serves the API + built app on http://localhost:4000
```

## Demo accounts

Password for all accounts: **`demo1234`**

| Role | Email | Lands on |
| --- | --- | --- |
| Assistant | `ava@northstarassist.com` | `/app` assistant workspace |
| Client | `marcus@reedadvisory.com` | `/client` minimal client view |
| Client | `elena@vasquezstudio.com` | `/client` (second client, separate data) |

One-click demo login is also available: `POST /api/auth/demo {"role":"assistant" | "client"}`,
on the login screen, and via **Reset demo data** in the sidebar.

---

## What's simulated

The brief allows a simulated prototype. Everything below is faked on purpose, and nothing else is:

1. **Email connection (OAuth)** — the provider picker, consent screen, sync progress and mailbox
   cards are a front-end simulation. No Google/Microsoft credentials are used and no real mailbox
   is read.
2. **Incoming mail** — the **Simulate incoming email** button injects a message from a curated
   queue (`server/src/store/incoming.js`) on the correct client mailbox, then runs live
   classification — including re-classifying an existing thread when a new message lands. In
   production this would be a Gmail/Outlook push webhook.
3. **AI engine** — the default is a deterministic, explainable rule/signal classifier
   (`server/src/ai/classifier.js`) that scores each conversation for *assistant / client / none /
   review* with a confidence %, human-readable reason and the signals that drove it. Summaries,
   draft replies and the "Ask MailPilot" Q&A use the same built-in engine. Set
   `AI_PROVIDER=openai` + `OPENAI_API_KEY` to route classification, summaries and drafting through
   an LLM instead (the built-in engine remains the fallback if the call fails).
4. **Sending email** — *Approve & send* appends an outbound message to the thread locally. No
   email ever leaves the machine.
5. **Storage** — in-memory + JSON snapshot by default (see below). No cloud database is required.
6. **Dates** — the seed corpus uses relative timestamps so the demo always reads "9h ago".

---

## Features

**Onboarding & mailboxes**
Sign up / log in, simulated connect flow for Gmail and Outlook, account list with sync,
reconnect and error states (`/connect`, `/app/accounts`).

**Assistant workspace** (`/app`)
Dashboard with reply-responsibility and workflow stats; segmented inbox (inbox, unread, needs your
reply, assistant to reply, needs review, no reply needed, action required, waiting, meetings,
important, general, completed, archived); full-text search and a ⌘K command palette.

**AI classification you can overrule**
Every conversation shows who must reply, a confidence %, a plain-English reason and the signals
behind it. The assistant can change the label (manual override, stamped "set by a human"), ask the
AI to re-analyse, and the AI re-decides automatically when a new message arrives or a reply is
sent — with a visible history trail of every classification change.

**Summaries & Q&A**
Plain-English thread summaries on the conversation detail page, plus **Ask MailPilot** (`/app/ask`)
for questions across the inbox ("what's waiting on Marcus?", "any deadlines this week?").

**Draft → approve → send**
Generate a draft with AI, edit it, then **Approve & send**. Sending re-classifies the thread in the
same pass.

**Minimal client view** (`/client`)
Clients see only the threads waiting on them, a one-line explanation of *why* it's with them, a
read-only thread, **I've handled this**, and **Hand to my assistant** (takeover, which flips
responsibility back to the assistant).

**UI/UX** — responsive layouts (desktop + mobile), toasts, skeletons, empty and error states,
role-guarded routes, 404 page, dark, polished visual design.

---

## Architecture

```
server/src/
  index.js            Express app — API, JSON 404 for unknown /api routes, SPA fallback for client/dist
  config.js           port, JWT, storage + AI provider settings (env-driven)
  routes/
    auth.js           login, signup, demo login, /me           → /api/auth
    dashboard.js      overview, clients, segments, search      → /api/overview, /api/clients
    conversations.js  list, detail, patch, reply, reclassify,
                      summarize, draft, draft send             → /api/conversations
    ai.js             Ask MailPilot Q&A + engine meta           → /api/ai
    accounts.js       list, connect, reconnect, sync            → /api/accounts
    client.js         client-facing items/thread/handle/takeover→ /api/client
    simulate.js       inject incoming email                     → /api/simulate
  ai/                 classifier · summarizer · replier · qa · dates
  store/              db.js (memory/Mongo backends) · seed.js · incoming.js
  middleware/auth.js  JWT + role guards (assistant | client)

client/src/
  pages/              Welcome, Auth (login/signup), Connect, Dashboard, Inbox, Accounts,
                      AskAI, Client (home + thread), NotFound
  components/         shell (sidebar/topbar/search), conversation, composer, charts, common
  lib/                api (fetch + auth), segments, format helpers
  styles/             design tokens + component CSS
```

### Storage

* **Default:** in-memory collections seeded with a realistic corpus, snapshotted to
  `server/.data/db.json` after each mutation so state survives restarts. Delete the file or set
  `RESET_DATA=1` to reseed. (`POST /api/dev/reset` wipes + reseeds in place — memory backend only.)
* **MongoDB:** set `MONGODB_URI` and the same collection interface is backed by real collections;
  the prototype behaves identically.

### Environment variables

| Variable | Default | Purpose |
| --- | --- | --- |
| `PORT` | `4000` | API + built-app server |
| `JWT_SECRET` | dev secret | token signing (set in production) |
| `MONGODB_URI` | *(unset)* | use MongoDB instead of memory + snapshot |
| `DATA_DIR` | `server/.data` | snapshot location |
| `PERSIST` | `1` | set `0` to disable snapshot writes |
| `AI_PROVIDER` | `builtin` | `openai` to use an LLM |
| `OPENAI_API_KEY` / `AI_MODEL` / `AI_BASE_URL` | — | LLM settings (`gpt-4o-mini`, OpenAI-compatible) |
| `RESET_DATA` | *(unset)* | ignore snapshot and reseed on boot |

---

## API surface

| Area | Endpoints |
| --- | --- |
| Auth | `POST /api/auth/login` · `POST /api/auth/signup` · `POST /api/auth/demo` · `GET /api/auth/me` |
| Dashboard | `GET /api/overview` · `GET /api/clients` |
| Conversations | `GET /api/conversations?segment=&q=` · `GET /api/conversations/:id` · `PATCH /api/conversations/:id` (labels/flags) · `POST /:id/reply` · `POST /:id/reclassify` · `POST /:id/summarize` · `POST /:id/draft` · `POST /drafts/:draftId/send` |
| AI | `POST /api/ask` · `GET /api/ai/meta` |
| Mailboxes | `GET /api/accounts` · `GET /api/accounts/providers` · `POST /api/accounts/connect` · `POST /api/accounts/:id/reconnect` · `POST /api/accounts/:id/sync` |
| Client view | `GET /api/client/items` · `GET /api/client/items/:id` · `POST /api/client/items/:id/handle` · `POST /api/client/items/:id/takeover` |
| Demo | `GET /api/simulate/queue` · `POST /api/simulate/incoming` · `POST /api/dev/reset` |

All endpoints except login/signup/demo require a `Bearer` token; client and simulate routes are
role-guarded.
