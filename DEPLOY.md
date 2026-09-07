# Self-hosting on a UGREEN NAS (UGOS Pro)

The stack replaces the Render deployment with two containers running on the NAS:

```
Browser (friends)  --HTTPS-->  Cloudflare edge  --tunnel-->  cloudflared  --> api:3000
                                                                                 |
                                                                    uploads volume (auto-cleaned)
```

`cloudflared` opens an outbound connection to Cloudflare, so **no port forwarding and no
open port on the router** are required. Guests only need the public URL.

## 1. Create the Cloudflare tunnel

1. Open [Cloudflare Zero Trust](https://one.dash.cloudflare.com) > **Networks > Tunnels >
   Create a tunnel** > **Cloudflared**. Name it (e.g. `nas-live-chat`).
2. Skip the install instructions and copy the **tunnel token** (the long string after
   `--token`). It goes into `TUNNEL_TOKEN`.
3. In **Public Hostnames**, add:
   - Subdomain `api`, domain `intrlude.app` (final URL: `https://api.intrlude.app`)
   - Type `HTTP`, URL `api:3000` — `api` is the Compose service name, resolved on the
     internal Docker network.
4. The DNS record is created automatically. Cloudflare refuses the hostname if a record
   already exists for it, so pick a subdomain that is still free.

WebSockets are enabled by default on Cloudflare; Socket.IO works through the tunnel with
no extra configuration.

`intrlude.app` is on the `.app` TLD, which is HSTS-preloaded: browsers refuse plain HTTP on
any of its hostnames. The tunnel terminates TLS at the Cloudflare edge, so the public URL
is HTTPS by construction. LAN access goes through the NAS IP (`http://<nas-ip>:3000`),
which is not covered by the preload list.

## 2. Configure the environment

Copy `.env.example` to `.env.production` next to `docker-compose.yml` and fill it in:

```bash
cp .env.example .env.production
openssl rand -hex 32   # value for API_KEY
```

| Variable | Purpose |
| --- | --- |
| `SERVER_URL` | Public tunnel URL. Media URLs returned to clients are built from it. |
| `API_KEY` | Required on every `/api/upload` route. The server refuses to start without it in production. |
| `CORS_ORIGINS` | Comma-separated allowed origins, or `*`. |
| `TUNNEL_TOKEN` | Cloudflare tunnel connector token. |
| `UPLOAD_MAX_BYTES` | Per-file cap. Default 90MB, deliberately under Cloudflare's limit. |
| `UPLOAD_TTL_MINUTES` | Age after which an uploaded file is deleted. Default 120. |
| `UPLOAD_MAX_TOTAL_BYTES` | Total size cap for the uploads folder. Default 5GB. |
| `YTDL_MAX_BYTES` | Hard cap on a single YouTube download. Default 500MB. |

## 3. Deploy on the NAS

**Via UGOS Pro** — copy the project folder to a NAS share, then **Docker > Project >
Create**, point it at the folder containing `docker-compose.yml`, and deploy.

**Via SSH** — enable SSH in UGOS (Control Panel > Terminal), then:

```bash
cd /volume1/docker/live-chat-back
docker compose up -d --build
docker compose logs -f
```

Check the deployment:

```bash
curl http://<nas-ip>:3000/health
curl https://api.intrlude.app/health
```

## 4. Update the client

Point the front end at `https://api.intrlude.app` and send the key on upload calls:

```js
fetch(`${API_URL}/api/upload/image-by-file`, {
  method: "POST",
  headers: { "x-api-key": API_KEY },
  body: formData,
});
```

Socket.IO connections and `GET /uploads/*` stay unauthenticated, so viewers need nothing.

## Maintenance

Handled automatically:

- **Uploads** — purged entirely on startup (the queue is in-memory, so old files are
  unplayable anyway), then swept every 10 minutes: files past the TTL are deleted, and the
  oldest files are evicted whenever the folder exceeds `UPLOAD_MAX_TOTAL_BYTES`. Files
  younger than a minute are never evicted, so an in-progress upload is safe.
- **Logs** — capped by Docker at 3 x 10MB for the API and 2 x 5MB for the tunnel, so they
  cannot fill the NAS disk.
- **Resources** — the API is limited to 1 CPU and 512MB, `cloudflared` to 0.25 CPU and
  128MB. On the DXP2800 (N100, 8GB) that leaves the rest of the NAS untouched.
- **Restarts** — `restart: unless-stopped` brings the stack back after a reboot or a crash.
  The healthcheck on `/health` marks the container unhealthy if the app stops responding.

Manual operations:

```bash
docker compose pull && docker compose up -d --build   # update
docker compose exec api du -sh /app/uploads           # disk usage
docker compose logs --tail=100 api                    # recent logs
curl -s https://api.intrlude.app/health                # queue state and uploads usage
```

## Known limits

- **100MB per request.** Cloudflare's Free and Pro plans reject larger request bodies with
  a 413, whatever the tunnel configuration. `UPLOAD_MAX_BYTES` is set just below so the API
  returns a clear error instead. To send a bigger file, upload from the local network
  against `http://<nas-ip>:3000` — that path bypasses Cloudflare entirely.
- **100s per request.** Cloudflare returns a 524 if the origin takes longer to answer.
  `POST /api/upload/video-by-link/youtube` responds only once the download finishes, so a
  long video can time out on the client even though the download completes on the NAS.
  Fixing this properly means returning immediately and pushing the item to the queue over
  Socket.IO once ready.
- **The queue is in-memory.** Restarting the container clears it and wipes the uploads.
