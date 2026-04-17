# 1-file Deploy Guide (cheap VM, $5–$10/mo)

These steps assume a small Ubuntu VM (DigitalOcean, Hetzner, Lightsail, etc.).
They keep things **simple** and **cheap**; you can scale up later.

## 0) Create VM and log in
- Choose the smallest plan (1 vCPU / 1GB or 2GB RAM is fine for MVP).
- Add your SSH key. SSH into the box.

## 1) Install basics
```bash
sudo apt update
sudo apt install -y python3-venv python3-pip git nginx
```

## 2) Add a user (optional but recommended)
```bash
sudo adduser cwords
sudo usermod -aG sudo cwords
su - cwords
```

## 3) Get your code onto the server
- Easiest: `scp` the zip to `~/` then unzip:
```bash
unzip crosswords_server.zip -d ~/
cd ~/crosswords_server
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
# edit .env as needed (SECRET_KEY, DATABASE_URL, flags)
```

## 4) Run with uvicorn (screen/tmux) — simplest
```bash
# quieter logs in local-ish mode
export LOCAL_ONLY_MODE=true
.venv/bin/uvicorn app.main:app --host 0.0.0.0 --port 8000 --log-level warning
```
Use `tmux` or `screen` to keep it running after you close SSH.

## 5) (Optional) Add systemd service so it auto-starts
Create `/etc/systemd/system/crosswords.service`:
```
[Unit]
Description=CrosSwords FastAPI
After=network.target

[Service]
User=cwords
WorkingDirectory=/home/cwords/crosswords_server
Environment=LOCAL_ONLY_MODE=true
Environment=DATABASE_URL=sqlite:///./croswords.db
ExecStart=/home/cwords/crosswords_server/.venv/bin/uvicorn app.main:app --host 0.0.0.0 --port 8000 --log-level warning
Restart=always

[Install]
WantedBy=multi-user.target
```
Then:
```bash
sudo systemctl daemon-reload
sudo systemctl enable --now crosswords.service
```

## 6) (Optional) Put Nginx in front (reverse proxy)
Create `/etc/nginx/sites-available/cwords`:
```
server {
    listen 80;
    server_name _;

    location / {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```
Enable it:
```bash
sudo ln -s /etc/nginx/sites-available/cwords /etc/nginx/sites-enabled/cwords
sudo nginx -t && sudo systemctl restart nginx
```
Later you can add HTTPS with certbot.

## 7) Update client to use your server URL
- Point your app at `http://YOUR_SERVER_IP` (or your domain).
- Keep polling `/games/{id}/state` every 2–5s only when a game is active.

Done! You now have a tiny, cheap, and turn-key backend you can stop/start as needed.
