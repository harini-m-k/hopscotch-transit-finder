<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Project rules
- Transport data (stops, routes, route_stops, buses) is read/written from the browser with the generated client; RLS enforces admin-only writes via `has_role`. Why: simple for a student project, security stays in the database.
- Distance, time, fare, routing and simulation logic live as pure functions in `src/lib/` (transit.ts, route-planner.ts, simulation.ts) with tests in `src/test/`. Why: easy to explain and test.
- Route stop order is saved only through the `set_route_stops` SQL function. Why: replaces the list in one transaction.
- The Leaflet map is loaded only in the browser through `src/components/map/MapView.tsx`. Why: Leaflet needs `window` and breaks SSR.
- The first account created gets the admin role (trigger on auth.users). Why: lets a demo be set up without manual role edits.
