# hangout frontend

Vite + Vue 3 + TypeScript. Run it next to the server (see the root README);
`npm run dev` forwards `/api` to `http://localhost:3000`.

## Layout

| Path                              | What                                                            |
| --------------------------------- | --------------------------------------------------------------- |
| `src/App.vue`                     | Two routes: `/` creates an event, `/e/<id>` shows one.          |
| `src/components/EventPage.vue`    | Share link, timezone switcher, sign-in, both grids, autosave.   |
| `src/components/AvailabilityGrid.vue` | Your drag-to-select grid, or the group heatmap.             |
| `src/lib/grid.ts`                 | Places UTC slots into local-date columns and local-time rows for the viewer's zone, including DST days. |
| `src/lib/drag-selection.ts`       | when2meet-style rectangle selection (add or erase).             |
| `src/lib/pointer.ts`              | Mouse/touch/pen drag wiring via `elementFromPoint`.             |
| `src/lib/latest-only-saver.ts`    | Sends one save at a time, always the newest selection.          |
| `src/lib/zoned-time.ts`           | Exact copy of the server's file. Edit the server one, then `npm run sync:shared`. |

Everything in `src/lib` is plain TypeScript with no Vue, so `npm test`
runs it directly in Node (22.18+ strips the types itself).

## Deploying

The app uses real paths (`/e/<id>`), so the static host must serve
`index.html` for unknown paths (a "SPA fallback" or rewrite rule). Set
`VITE_API_URL` at build time if the API lives on another origin.
