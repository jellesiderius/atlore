# Self-hosting and Configuration

The recommended installation uses Docker Compose and includes Atlore, PostgreSQL, Redis, and MinIO.

## Requirements

- Docker Desktop, or Docker Engine with Docker Compose;
- GNU Make;
- enough storage for PostgreSQL data and uploaded media;
- Node.js 22+ only when developing outside Docker.

## Production-style local installation

```bash
git clone https://github.com/jellesiderius/atlore.git
cd atlore
cp .env.example .env
```

Before starting, replace at least these values in `.env`:

```dotenv
POSTGRES_PASSWORD=use-a-long-random-password
REALTIME_SECRET=use-at-least-32-random-characters
S3_ACCESS_KEY=use-a-unique-access-key
S3_SECRET_KEY=use-a-long-random-secret
ORIGIN=http://localhost:3000
```

Start the stack:

```bash
make up
make seed # optional demo data
make status
```

Open `http://localhost:3000`. `make up` builds the production image and runs database migrations automatically.

## Local development

```bash
cp .env.example .env
npm install
make infra
make migrate
make seed
npm run dev
```

Open `http://localhost:5173`. PostgreSQL is exposed on port `55432`, Redis on `6379`, and the MinIO console on `9001` by default.

## Important environment variables

| Variable            | Purpose                                                              |
| ------------------- | -------------------------------------------------------------------- |
| `ORIGIN`            | Exact public origin, including scheme and optional port.             |
| `TRUSTED_ORIGINS`   | Additional comma-separated preview or proxy origins.                 |
| `APP_PORT`          | Host port for the Docker application.                                |
| `DATABASE_URL`      | PostgreSQL connection used by local scripts outside Docker.          |
| `POSTGRES_PASSWORD` | Password used by the Docker PostgreSQL service.                      |
| `REDIS_URL`         | Redis connection used outside Docker.                                |
| `REALTIME_SECRET`   | HMAC secret for short-lived realtime tokens; at least 32 characters. |
| `SESSION_TTL_DAYS`  | Session lifetime in days.                                            |
| `MAX_UPLOAD_MB`     | Maximum image upload size.                                           |
| `STORAGE_PATH`      | Local upload directory when S3 is not configured.                    |
| `S3_*`              | S3-compatible endpoint, region, bucket, and credentials.             |
| `SMTP_*`            | Email delivery for invitations and password recovery.                |
| `LOG_LEVEL`         | Application logging level.                                           |

See [`.env.example`](https://github.com/jellesiderius/atlore/blob/main/.env.example) for every supported setting.

## Public deployment checklist

1. Set `NODE_ENV=production`.
2. Set `ORIGIN` to the exact public HTTPS URL. A mismatch causes **Invalid request origin** on sign-in and other mutations.
3. Use strong and unique database, realtime, and storage secrets.
4. Configure SMTP and a real sender address.
5. Terminate TLS at a trusted reverse proxy or load balancer.
6. Proxy both HTTP traffic and WebSocket upgrades for `/realtime`.
7. Forward proxy headers only from trusted infrastructure.
8. Keep the S3 or MinIO bucket private.
9. Back up PostgreSQL and object storage regularly.
10. Run all quality checks before deployment.

## Operations

```bash
make logs       # follow app logs
make status     # inspect containers and health
make restart    # restart the complete stack
make stop       # stop without removing containers
make down       # remove containers, preserve volumes
make db-shell   # open PostgreSQL
```

The health endpoint at `/api/health` reports application, PostgreSQL, and Redis status.

## Database migrations and backups

Migrations in `drizzle/` are version controlled and automatically applied by the Docker `migrate` service.

```bash
npm run db:generate
npm run db:migrate
docker compose exec -T postgres pg_dump -U atlore -Fc atlore > atlore.backup
```

Test restoring backups regularly; a backup that has never been restored is not yet proven.

## Updating Atlore

```bash
git pull --ff-only
make up
make status
```

Review release notes and create backups before applying migrations in production.

## Destructive reset

`make destroy` removes containers and all Docker volumes after confirmation. This permanently deletes the Docker-managed database, Redis data, and uploaded MinIO media. Use it only for disposable environments or after verified backups.
