# Troubleshooting

Start with:

```bash
make status
curl http://localhost:3000/api/health
make logs
```

## Sign-in or registration returns “Invalid request origin”

`ORIGIN` does not match the URL in the browser.

1. Set `ORIGIN` to the exact scheme, hostname, and port, for example `https://atlore.example.com`.
2. Put additional preview or proxy origins in `TRUSTED_ORIGINS`, separated by commas.
3. Rebuild or restart the application.
4. Do not solve this by allowing every origin; the check protects authenticated mutations.

## Changes appear only after a hard refresh

1. Confirm Redis is healthy in `/api/health`.
2. Confirm your proxy supports WebSocket upgrades for `/realtime`.
3. Check the browser console for failed WebSocket connections.
4. Check application logs with `make logs`.
5. Verify all application instances use the same Redis and `REALTIME_SECRET` values.

Normal saves still use HTTP, but realtime invalidation between users and instances requires working WebSockets and Redis.

## Map or image upload does nothing

1. Confirm the user has **Upload maps** or **Add images** permission.
2. Check the file type and the `MAX_UPLOAD_MB` limit.
3. Try both the file button and drag and drop.
4. Confirm MinIO/S3 is healthy and credentials match.
5. Keep the storage bucket private; access should flow through Atlore.

## Graph force settings do not save

Only users with **Change settings** permission can update campaign-wide graph forces. Wait for the **Saved** status, then reload the page. If it fails, inspect the campaign PATCH request and application logs.

## A hidden node is missing for a player

This is expected. Hidden nodes are removed from player API payloads. A game master can:

1. open the node dossier;
2. set visibility to **Everyone** or **Selected players**;
3. select the intended players where applicable;
4. use **View as player** to verify the result.

## `@` search says “No results”

- Type more of the node name.
- Check whether the node is visible to the current user.
- Choose **New: “name”** if there is no exact existing node.
- When an exact name already exists, Atlore intentionally does not offer an identical new node.

## The graph is slow with a very large campaign

- Use **Fit all** and avoid unnecessary continuous reflows.
- Keep the browser and GPU acceleration enabled.
- Use `make seed-10k` and `make test-10k` to reproduce performance locally.
- Inspect FPS and long-task output before changing graph physics.

Atlore uses a Web Worker and batched Canvas rendering for large graphs, but visible labels, browser extensions, and very dense relationship sets still affect performance.

## Database migration fails

1. Confirm PostgreSQL is healthy.
2. Verify `DATABASE_URL` for local commands.
3. Run `npm run db:migrate` from the repository root.
4. Never edit a migration that has already been applied in production; add a new migration instead.

## Port already in use

Change the corresponding host port in `.env`:

- `APP_PORT` for Atlore;
- `POSTGRES_PORT` for PostgreSQL;
- `REDIS_PORT` for Redis;
- `MINIO_PORT` and `MINIO_CONSOLE_PORT` for MinIO.

Then run `make up` again.

## Development reset

Use `make clean` to remove generated build and test files without touching data.

`make destroy` permanently removes Docker volumes and all Docker-managed Atlore data. Create and verify backups before using it.

## Still stuck?

Open a GitHub issue with:

- the Atlore commit or version;
- browser and operating system;
- exact reproduction steps;
- relevant application logs with secrets removed;
- screenshots or console errors where useful.

Never include `.env`, passwords, tokens, cookies, or private campaign content.
