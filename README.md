# LittleIran

A web platform connecting the Iranian community in Southern Ontario: Iranian-owned businesses, cultural events, and community forums.

- `server/`: Node.js + Express REST API with PostgreSQL
- `web/`: React web app (Vite + React Router)

## Running locally

Requires Node 22.22+ and Docker.

```bash
# 1. Database (Postgres on localhost:5432, plus a littleiran_test database for the test suite)
cd server
docker compose up -d
cp .env.example .env
npm install
npm run migrate

# 2. Web app dependencies
cd ../web
npm install

# 3. From the repo root: API on http://localhost:3000 and web app on http://localhost:5173
cd ..
npm install
npm run dev
```

The web app proxies `/api` to the API, so open http://localhost:5173.

## Checks

```bash
cd server && npm run typecheck && npm test     # API tests (Jest + supertest)
cd web && npm run typecheck && npm run lint && npm test   # unit tests (Jest + React Testing Library)
```
