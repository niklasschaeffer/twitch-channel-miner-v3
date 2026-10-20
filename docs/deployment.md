# Deployment examples

Both examples run the prebuilt image from GHCR, so you don't need to clone or build anything. Images are published for **amd64** on every release:

| Tag            | Runtime | Use when                                                                 |
| -------------- | ------- | ------------------------------------------------------------------------ |
| `:latest`      | Bun     | Your CPU supports AVX2 (`grep -q avx2 /proc/cpuinfo && echo yes`)        |
| `:latest-node` | Node    | The container exits with `Illegal instruction` (older CPUs without AVX2) |

Pin a release (`:1.25.6`, `:1.25.6-node`) instead of `latest` if you want updates to happen only when you choose. See [Two runtimes](../README.md#two-runtimes-bun-and-node) for details.

Both examples mount a **directory** to `/app/data`, not a single file. SQLite keeps `miner.db`, `miner.db-wal` and `miner.db-shm` together there, so nothing is lost when the container is recreated. Still stop the container before you copy or back up the database.

## Docker Compose

File: [`docker-compose.example.yaml`](docker-compose.example.yaml)

```bash
mkdir twitch-miner && cd twitch-miner
curl -fsSLo docker-compose.yaml \
  https://raw.githubusercontent.com/niklasschaeffer/twitch-channel-miner-v3/main/docs/docker-compose.example.yaml
```

Edit `docker-compose.yaml`:

- Set `APP_URL` to the exact address you'll open in the browser, e.g. `http://192.168.1.10:3000` or `https://miner.example.com`. Login cookies and Google sign-in depend on it.
- Leave `TWITCH_CLIENT_ID` as it is (see the [Client-Id policy](../README.md#installation)).
- Fill in `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` only if you want "Sign in with Google".
- Switch `image:` to `:latest-node` if your CPU lacks AVX2.

Start it:

```bash
docker compose up -d
docker compose logs -f
```

Update to a newer release:

```bash
docker compose pull && docker compose up -d
```

The database ends up in `./data/miner.db`.

## Unraid

File: [`unraid/twitch-channel-miner.xml`](unraid/twitch-channel-miner.xml)

1. Open the Unraid terminal and download the template into your user templates:

   ```bash
   curl -fsSLo /boot/config/plugins/dockerMan/templates-user/my-twitch-channel-miner.xml \
     https://raw.githubusercontent.com/niklasschaeffer/twitch-channel-miner-v3/main/docs/unraid/twitch-channel-miner.xml
   ```

2. Go to **Docker → Add Container** and pick **twitch-channel-miner** from the **Template** dropdown.
3. Set **APP_URL** to the address you'll open, e.g. `http://<your-unraid-ip>:3000`. If you change **WebUI Port**, change the port in `APP_URL` too.
4. Leave **Data** at `/mnt/user/appdata/twitch-channel-miner` unless you keep appdata elsewhere.
5. If the container stops right away with `Illegal instruction` in its log, edit it and change **Repository** to `ghcr.io/niklasschaeffer/twitch-channel-miner-v3:latest-node`.
6. Click **Apply**, then open the WebUI.

Optional settings (Google sign-in, Twitch client id) are under **Show more settings**. To update, use **Check for Updates** on the Docker tab.

## After the first start

Register the first account, then connect Twitch under **Settings → Twitch Account**. The full walkthrough is in [First-run setup](../README.md#first-run-setup).
