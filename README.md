# Docker Restart Web UI

A minimal Node.js/Express application that provides a web interface for restarting Docker containers.

The reccomended containers for use with this script are
- `ghcr.io/zhliau/fika-headless-docker`
- `ghcr.io/zhliau/fika-spt-server-docker`

## Configuration

This application can be configured via environment variables or a `.env` file. Defaults:

- `RESTART_UI_PASSWORD`: `techyiscool`
- `CONTAINER_HEADLESS`: `fika_headless`
- `CONTAINER_SERVER`: `fika-server`
- `PORT`: `8125`

### Using a `.env` file

Create a file named `.env` in the project root:

```dotenv
RESTART_UI_PASSWORD=your_password
CONTAINER_HEADLESS=your_headless_container
CONTAINER_SERVER=your_server_container
PORT=8125
```

## Installation

```bash
git clone <your-repo-url>
cd <project-directory>
npm install
```

## Docker Socket Access

Ensure the application user can access Docker’s UNIX socket (`/var/run/docker.sock`):

```bash
sudo usermod -aG docker compute
# Log out and back in, or run:
newgrp docker
```

Alternatively, grant passwordless sudo for the restart commands:

```bash
sudo visudo
# add:
compute ALL=(ALL) NOPASSWD: /usr/bin/docker restart *
```

## Running with PM2

### 1. Install PM2 globally

```bash
npm install -g pm2
```

### 2. Start the app

```bash
pm2 start index.js --name restart-ui
```

### 3. Generate systemd unit

```bash
pm2 startup systemd -u compute --hp /home/compute
# Follow the printed instructions
```

### 4. Save process list

```bash
pm2 save
```

### 5. Enable & start the service

```bash
sudo systemctl daemon-reload
sudo systemctl enable pm2-compute
sudo systemctl start pm2-compute
```

## Usage

1. Open your browser to `http://<server-ip>:<PORT>/`.
2. Enter the configured password.
3. Click **Restart Headless** or **Full Restart**.
4. The interface will poll every 30 seconds and display the results.

## Security Considerations

- **Credentials:** Defaults are stored in environment variables; avoid hardcoding in production.
- **TLS/HTTPS:** Run behind a reverse proxy (e.g., Nginx, Caddy) with TLS.
- **Authentication:** Consider more robust auth (e.g., OAuth, tokens).
- **Docker Group:** Any user in `docker` can escalate privileges; restrict access.
- **In-Memory State:** Job states are not persisted; consider external storage for reliability.

## License

MIT
