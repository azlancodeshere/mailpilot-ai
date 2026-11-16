# MailPilot AI — frontend

React 19 + TypeScript + Vite client for MailPilot AI. See the [project README](../README.md) for setup, demo credentials and the overall architecture.

## Commands

```bash
npm run dev      # Vite dev server on http://localhost:5173 (proxies /api → :5000)
npm run build    # tsc -b, then vite build
npm run lint     # oxlint
npm run preview  # serve the production build
```

## Where things live

- `src/pages/` — one file per route (Welcome, Login, Signup, Onboarding, Dashboard, Inbox, Conversation, AskAI, Accounts, ClientPortal, NotFound).
- `src/components/` — `AppShell` (sidebar/topbar/navigation), conversation and classification presentation, and the shared primitives in `ui.tsx` (buttons, fields, modal, toast, avatar, states).
- `src/lib/api.ts` — typed axios client: token storage, refresh-on-401 interceptor, and one typed method per backend endpoint. `src/lib/types.ts` mirrors the backend response shapes.
- `src/lib/format.ts` — date/relative-time formatting, avatar initials and the classification/segment label maps.
- `src/store/auth.ts` — Zustand store for the current user and session bootstrap.
- `src/index.css` — design tokens (CSS custom properties) and the base layer; `src/App.css` — component styles.
