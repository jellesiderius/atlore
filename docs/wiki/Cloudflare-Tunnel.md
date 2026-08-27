# Cloudflare Tunnel

Atlore includes an optional `cloudflared` Docker Compose profile. It is designed for a **remotely-managed, named tunnel** with a stable HTTPS hostname. This is a better production fit than a Quick Tunnel: Atlore validates request origins, uses secure session cookies, and reconnects realtime WebSockets to the current hostname.

The tunnel publishes only the Atlore web application. PostgreSQL, Redis, and MinIO remain inside the Docker network and all Docker-published host ports bind to `127.0.0.1` by default.

## What the route looks like

```text
Browser ── HTTPS/WSS ── Cloudflare ── outbound tunnel ── cloudflared
                                                              │
                                                       http://app:3000
                                                              │
                                         PostgreSQL · Redis · MinIO
```

Cloudflare terminates public HTTPS. Inside the private Compose network, `cloudflared` forwards HTTP and WebSocket traffic to the `app` service.

## Requirements

- an Atlore installation using Docker Compose;
- a Cloudflare account;
- a domain managed by Cloudflare;
- outbound connectivity from the Docker host to Cloudflare;
- a strong production `.env` configuration.

No `cloudflared` binary needs to be installed on the host; Compose pulls the official container image.

## 1. Create the named tunnel

1. Open the Cloudflare dashboard.
2. Go to **Networking → Tunnels**.
3. Select **Create Tunnel** and choose Cloudflared.
4. Give it a descriptive name, such as `atlore-production`.
5. Choose Docker as the connector type.
6. Copy the connector token from the generated command. Store only the token value in Atlore's `.env`; do not commit or paste it into an issue.

The token is the value after `--token` in Cloudflare's generated Docker command.

## 2. Add the published application

On the **Route tunnel** screen, select **Published applications** and add one route. Cloudflare splits the public hostname and origin service into separate fields; fill them in as follows:

| Cloudflare field          | Value                                                |
| ------------------------- | ---------------------------------------------------- |
| Hostname                  | `atlore`                                             |
| Domain                    | your Cloudflare domain, for example `example.com`    |
| Path                      | leave completely empty so every Atlore route matches |
| Service → Type            | **HTTP** — not HTTPS                                 |
| Service → URL after `://` | `app:3000`                                           |

The resulting public hostname is `atlore.example.com` and the complete internal service URL is `http://app:3000`. Do not enter `http://` again in the URL field when the Type selector already shows it.

Use `app`, not `localhost`, because `cloudflared` runs in its own container and reaches Atlore through Docker service discovery. Although the internal service type is HTTP, visitors still use public HTTPS because Cloudflare terminates TLS at the edge.

For an `atlore.example.com` setup, the exact values are:

```text
Hostname:     atlore
Domain:       example.com
Path:         [empty]
Service type: HTTP
Service URL:  app:3000
```

After selecting **Add route**, use this matching Atlore configuration in `.env`:

```dotenv
ORIGIN=https://atlore.example.com
HOST_BIND_ADDRESS=127.0.0.1
CLOUDFLARED_TUNNEL_TOKEN=paste-the-token-from-the-connector-step-here
CLOUDFLARED_PROTOCOL=auto
```

Then start it from the Atlore repository root:

```bash
make tunnel-check
make tunnel-up
make tunnel-status
```

Open `https://atlore.example.com`. If the tunnel still shows **Inactive** for a short moment, run `make tunnel-logs` and wait until the connector reports a registered connection.

Do not add routes for PostgreSQL, Redis, the MinIO API, or the MinIO console.

## 3. Configure Atlore

Copy the example environment file if needed and replace all production secrets:

```bash
cp .env.example .env
```

Set at least the tunnel-specific values:

```dotenv
NODE_ENV=production
ORIGIN=https://atlore.example.com
HOST_BIND_ADDRESS=127.0.0.1
CLOUDFLARED_TUNNEL_TOKEN=your-connector-token
CLOUDFLARED_PROTOCOL=auto
```

Important details:

- `ORIGIN` must exactly match the browser origin: HTTPS, hostname, and optional port, with no path or trailing slash.
- Keep `TRUSTED_ORIGINS` empty unless another exact, deliberate hostname must submit mutations.
- Never commit `.env`. It is ignored by Git.
- `auto` prefers QUIC and can fall back to HTTP/2. Force a protocol only when diagnosing a restrictive network.
- `CLOUDFLARED_IMAGE` defaults to Cloudflare's latest official image and can be set to an explicit tag when your release process requires pinning.
- Keep `HOST_BIND_ADDRESS=127.0.0.1`. Set `0.0.0.0` only when you intentionally want direct trusted-LAN access to every published Compose port.

## 4. Start the stack and tunnel

Run the preflight check first. It verifies that a connector token exists and that `ORIGIN` is a valid public HTTPS origin without displaying the token.

```bash
make tunnel-check
make tunnel-up
make tunnel-status
```

Open the configured public URL and test sign-in, an editor save, an image upload, and realtime collaboration in two browser sessions.

## Operations

```bash
make tunnel-status  # show the app and connector status
make tunnel-logs    # follow connector logs
make tunnel-restart # validate config and restart the connector
make tunnel-down    # stop only public ingress; Atlore keeps running locally
make down           # stop the complete stack
```

`make up` continues to start Atlore without the optional connector. `make tunnel-up` starts the complete stack and enables the `tunnel` profile.

## Network and security notes

- Cloudflare Tunnel creates outbound connections; it does not need an inbound port forward.
- On restrictive firewalls, allow outbound TCP and UDP port `7844` to Cloudflare. With `CLOUDFLARED_PROTOCOL=auto`, the connector can fall back from QUIC to HTTP/2.
- Keep the connector token secret. Anyone who can control Docker on the host can also inspect container environment variables, so Docker host access must already be trusted.
- Rotate the connector token in Cloudflare and update `.env` if it is exposed, then run `make tunnel-restart`.
- Keep Atlore's own authentication enabled. Cloudflare Access can be added as an optional outer policy for a private group, but it is not required for a normal public Atlore instance.
- Back up PostgreSQL and object storage; the tunnel does not provide data backups.

## Realtime WebSockets

No separate public route is required for `/realtime`. The browser connects over `wss://` to the same public hostname and the HTTP route carries the WebSocket upgrade to Atlore.

When restarting the only connector, active WebSocket connections briefly disconnect and the client reconnects automatically. For stricter availability requirements, run redundant connectors on separate hosts and plan database/object-storage availability separately.

## Deploying an updated build

```bash
git pull --ff-only
make tunnel-up
make tunnel-status
```

Use `make tunnel-up`, not only `npm run build`: the public hostname points to the Docker application service, so the application image and container must be rebuilt. The small build identifier on the auth and campaign overview screens confirms the version and source commit currently served through the tunnel.

## Troubleshooting

### `403: Invalid request origin`

The public URL and `ORIGIN` differ. Set `ORIGIN=https://your-exact-hostname`, then recreate the app container:

```bash
make tunnel-up
```

### Tunnel is connected, but the site returns 502

1. Confirm the route service is exactly `http://app:3000`.
2. Run `make tunnel-status`; the app must be healthy.
3. Run `make logs` and `make tunnel-logs` in separate terminals.
4. Do not use `http://localhost:3000` as the dashboard service URL for this Compose profile.

### Connector cannot reach Cloudflare

Leave `CLOUDFLARED_PROTOCOL=auto` and allow outbound TCP and UDP port `7844`. Inspect DNS and firewall policy on the Docker host.

### Login works but realtime does not

Check the browser network panel for the `/realtime` WebSocket, then inspect `make tunnel-logs` and `make logs`. Verify that no extra Cloudflare rule blocks WebSocket upgrades or caches authenticated application/API responses.

### Stop public access immediately

```bash
make tunnel-down
```

This stops only `cloudflared`; Atlore remains available locally at `http://localhost:3000` while the app stack is running.

## Official Cloudflare references

- [Cloudflare Tunnel overview](https://developers.cloudflare.com/tunnel/)
- [Create a tunnel and publish an application](https://developers.cloudflare.com/tunnel/setup/)
- [Cloudflared run parameters and environment variables](https://developers.cloudflare.com/tunnel/advanced/run-parameters/)
- [Tunnel firewall requirements](https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/configure-tunnels/tunnel-with-firewall/)
