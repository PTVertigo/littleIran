LittleIran is a responsive web app: a React frontend in `web/` (Vite, React Router v8) and a Node/Express + PostgreSQL API in `server/`. `planning.md` is the project plan; read it before planning work.

## Commands

```bash
cd server && docker compose up -d   # local Postgres (dev + test databases)
cd server && npm run dev            # API on :3000
cd web && npm run dev               # web app on :5173, proxies /api to :3000
cd server && npm run typecheck && npm test
cd web && npm run typecheck && npm run lint && npm test
```

Run the typecheck, lint and tests for every package you touched before calling a task done.

## Rules

- Sessions are HttpOnly cookies, and every POST/PUT/DELETE must send the `csrf_token` cookie value in an `X-CSRF-Token` header. `web/src/lib/api.ts` does this for you, so always call the API through it.
- React Router v8: import `RouterProvider` from `react-router/dom` and everything else from `react-router`. There is no `react-router-dom`.
- Unit tests use Jest + React Testing Library (not Vitest). `web` runs Jest with `--experimental-vm-modules` because react-router ships ESM only.
- Use semantic HTML (headings, landmarks, labels). Accessibility is graded (WCAG 2.1, see planning.md §5.3).
