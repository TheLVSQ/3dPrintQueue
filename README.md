# 3D Print Queue

Touch-friendly dashboard + REST API for tracking additive manufacturing jobs from a kiosk, laptop, or tablet.

## Highlights

- Express API with CRUD endpoints for order management.
- Local JSON storage (`data/orders.json`) by default, but easy to swap to a database.
- Responsive UI bundled in `public/` with large tap targets and quick status filters.
- Ships with Docker + Compose definitions for Pi, NUC, or any container host.

## Repo layout

| Path | Purpose |
| --- | --- |
| `src/server.js` | Express server, API handlers, and static asset hosting. |
| `public/` | Front-end assets (HTML/CSS/JS). |
| `data/orders.json` | Flat-file persistence; initialized empty for privacy. |
| `Dockerfile`, `docker-compose.yml` | Container build/run definitions. |

## Prerequisites

- Node.js 18+
- npm
- (Optional) Docker / Docker Compose

## Local development

```bash
npm install
npm run dev         # nodemon reloads on file changes
```

Production-style run:

```bash
npm start           # serves on http://localhost:4000
```

Orders persist to `data/orders.json`. The file is git-tracked only with placeholder content; replace with your own sample data if needed.

## API quick reference

All endpoints return JSON.

| Method | Path | Notes |
| --- | --- | --- |
| `GET` | `/api/health` | Simple heartbeat with server timestamp. |
| `GET` | `/api/orders[?status=pending|completed|archived]` | Returns the current queue, ordered by ship date then creation time. |
| `POST` | `/api/orders` | Body requires `orderNumber`, `itemName`, `filamentType`, `filamentColor`, `quantity`; optional `shipBy`, `notes`. |
| `PATCH` | `/api/orders/:id/status` | Body `{ "status": "pending|completed|archived" }`. |
| `DELETE` | `/api/orders/:id` | Removes an order. |

Sample payload for automation tools (n8n, Make, Etsy webhook proxy, etc.):

```json
{
  "orderNumber": "SAMPLE-0001",
  "itemName": "Articulated lizard",
  "filamentType": "PLA+",
  "filamentColor": "Silk gold",
  "quantity": 2,
  "shipBy": "2025-12-01",
  "notes": "Gift wrap"
}
```

## Docker usage

Build + run manually:

```bash
docker build -t print-queue .
docker run -d --name print-queue -p 4000:4000 -v ${PWD}/data:/app/data print-queue
```

Compose workflow:

```bash
docker compose up -d
# Stop and remove
docker compose down
```

Why mount `data/`? It keeps the queue intact between container restarts. Remove `data/orders.json` if you want to reset.

### Raspberry Pi tips

- The provided `node:18-alpine` image runs on 64-bit ARM. For 32-bit OS builds, switch the base image to `node:18-bullseye`.
- Add `restart: unless-stopped` (already in `docker-compose.yml`) so the queue restarts on power loss.

## Hardening suggestions

1. Place the container behind a reverse proxy (Traefik, Caddy, nginx) and enforce TLS.
2. Configure HTTP auth or network ACLs if the dashboard is exposed outside your LAN.
3. If you migrate to a database, add schema validation + migrations before swapping the persistence adapter.

## Contributing

1. Fork + clone.
2. Create a feature branch.
3. Run `npm test` (if/when tests land) or at least `npm start` to verify.
4. Submit a PR with a clear description of the change.

## License

MIT License.
