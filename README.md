# Smart Public Transport Management and Route Optimization System

College PE II project. A full-stack web app to manage a city bus network (buses, routes, bus stops),
search buses between two stops, see fare and travel time, get the fastest suggested route, and view
everything on an interactive map with **simulated** bus tracking.

## Tech stack

| Part      | Technology |
|-----------|------------|
| Frontend  | React 19 + TanStack Router, Tailwind CSS, shadcn/ui components |
| Map       | Leaflet + OpenStreetMap tiles (react-leaflet) |
| Backend   | Lovable Cloud (PostgreSQL database, authentication, row-level security) |
| Tests     | Vitest |

## Features → where to find them

| Feature | Page |
|---|---|
| Dashboard (stats, map, routes table) | `/` |
| Search buses by start and destination | `/search` |
| Route details: stops, time, fare | `/routes` and `/routes/<id>` |
| Shortest suggested route (Dijkstra) | `/search` → "Suggested fastest route" |
| Interactive map + simulated tracking | `/map` |
| Admin login | `/auth` |
| Add / edit / delete buses, routes, stops | `/admin` |

## Database tables

- `stops` — name, area, latitude, longitude
- `routes` — route number, name, colour, average speed, base fare, fare per km, in service
- `route_stops` — which stops a route visits and in what order
- `buses` — bus number, route, type, seats, status, driver
- `user_roles` — which accounts are admins

Anyone can **read** the data. Only accounts with the `admin` role can **add, edit or delete** — this is
enforced by the database itself, not just hidden buttons. The **first account ever created becomes admin**.

Sample data (16 Chennai stops, 6 routes, 12 buses) is loaded automatically, so the app can be demoed immediately.

## How the calculations work (`src/lib/`)

- **Distance** (`transit.ts`): straight-line distance between stop coordinates (Haversine formula) × 1.3 road factor.
- **Travel time**: distance ÷ route's average speed, plus 1 minute at each intermediate stop.
- **Fare**: `base fare + fare per km × distance`, rounded up to the next rupee.
- **Shortest route** (`route-planner.ts`): Dijkstra's algorithm over the stop network. Changing buses
  adds a 10-minute waiting penalty, so a direct bus is preferred unless a change is clearly faster.
- **Simulated tracking** (`simulation.ts`): no GPS. Each active bus's position is calculated from the
  current time, moving back and forth along its route (sped up 20× so you can see it move).

## How to run

**In Lovable:** the preview runs automatically. Click **Publish** to get a public link.

**On your own computer** (after exporting the code to GitHub and cloning it):

```bash
npm install        # or: bun install
npm run dev        # opens on http://localhost:8080
npm test           # runs the automated tests
```

The `.env` file already contains the connection details for the database.

## How to test (demo script)

1. Open the **Dashboard** — check the stats cards, network map with moving buses, and the routes table.
2. **Search Buses**: From *Anna Nagar* → To *Tambaram*. You should see a 2-step suggested route
   (47A then 70) with time, distance, fare, and the route drawn on the map.
3. Try *Chennai Central* → *Adyar* to see direct buses (M15) listed.
4. Open **Routes** → pick a route to see its stop table, cumulative time/fare and map.
5. Open **Live Map**, filter by route, click a bus marker. Note the "SIMULATED TRACKING" label.
6. Go to **Admin login** → *Create account* (the first account becomes admin).
7. In **Admin**: add a stop (click the map to fill coordinates), add a route using that stop,
   add a bus on the route, edit it, then delete it. Every change shows on the other pages right away.
8. Try adding a bus with an existing bus number — you'll get a real error from the database.
9. Sign out, create a second account, open Admin — it says "No admin access".
