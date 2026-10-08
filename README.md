# hangout
CS601_SideProject

A no-signup group scheduler that converts everyone's availability across time zones.

| Folder     | What                                      |
| ---------- | ----------------------------------------- |
| `hangout/` | Frontend: Vite + Vue 3 + TypeScript       |
| `server/`  | Backend: NestJS + TypeORM + PostgreSQL    |

## Running locally

```bash
nix-shell                     # Node + Postgres; creates the "hangout" database on first run

cd server
cp .env.example .env          # then set YOUR_USERNAME and EDIT_TOKEN_SECRET
npm install
npm test                      # timezone + aggregation unit tests, no database needed
npm run start:dev             # API on http://localhost:3000/api

# second terminal (also inside nix-shell)
cd hangout
npm install
npm test                      # grid layout, drag selection, save queue, zone list
npm run dev                   # http://localhost:5173, proxies /api to the server
```

To try the milestone 1 demo, create an event, then open its link in two
browser windows. Set one to Los Angeles and the other to Ulaanbaatar with
"Showing times in", sign in under different names, and drag. Each window
picks up the other's changes within 10 seconds.

See [server/README.md](server/README.md) for the API and [hangout/README.md](hangout/README.md) for the frontend.
