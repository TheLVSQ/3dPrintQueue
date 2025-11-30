# 3D Print Queue

Touch-friendly dashboard + REST API for tracking additive manufacturing jobs from a kiosk, laptop, or tablet.

## Highlights

- Express API with CRUD endpoints for order management.
- File-backed SQLite database (`data/orders.db`) for zero-config persistence.
- Responsive UI bundled in `public/` with large tap targets and quick status filters.
- Ships with Docker + Compose definitions for Pi, NUC, or any container host.

## Repo layout

| Path | Purpose |
| --- | --- |
| `src/server.js` | Express server, API handlers, and static asset hosting. |
| `public/` | Front-end assets (HTML/CSS/JS). |
| `data/` | Stores the generated `orders.db` SQLite database (gitignored). |
| `Dockerfile`, `docker-compose.yml` | Container build/run definitions. |

## Prerequisites

- Node.js 18+
- npm
- (Optional) Docker / Docker Compose
- Native build tools (python3, make, g++) may be required the first time `better-sqlite3` compiles on your host OS. The provided Dockerfile installs them automatically.

## Local development

```bash
npm install
npm run dev         # nodemon reloads on file changes
```

Production-style run:

```bash
npm start           # serves on http://localhost:4000
```

Orders persist to `data/orders.db`. The file is created on first write and ignored by git so you can keep production data out of version control.

## Database notes

- Uses SQLite with a single `orders` table (columns: id, orderNumber, itemName, filamentType, filamentColor, quantity, shipBy, notes, status, createdAt, updatedAt).
- Records are ordered by `shipBy` date (NULLs last) and then creation time.
- Delete `data/orders.db` to reset the queue, or open it with any SQLite browser for manual edits/backups.
- If you previously had `data/orders.json`, the server will migrate it once at startup and rename the original file to `orders.json.bak`.

## Configuration

| Env var | Default | Purpose |
| --- | --- | --- |
| `PORT` | `4000` | HTTP port for the Express server. |
| `ENABLE_TLS` | `false` | When `true`, Helmet includes the `upgrade-insecure-requests` CSP directive for HTTPS deployments. Leave `false` (default) for HTTP-only LAN or kiosk installs so CSS/JS still load over plain HTTP. |

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

Why mount `data/`? It keeps the SQLite database intact between container restarts. Remove `data/orders.db` if you want to reset.

If your reverse proxy terminates HTTPS before forwarding traffic to the container, set `ENABLE_TLS=true` (env var) so Helmet enforces `upgrade-insecure-requests`.

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
