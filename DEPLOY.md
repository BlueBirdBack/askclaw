# 部署指南 / Deployment Guide

## 前置要求 / Prerequisites

- 一台 VPS（1核 2GB 内存即可）/ A VPS (1 core, 2GB RAM minimum)
- 一个域名指向你的 VPS IP / A domain pointing to your VPS IP
- 运行中的 [OpenClaw](https://github.com/openclaw/openclaw) 实例 / A running OpenClaw instance
- Node.js ≥ 22

## 方式一：Docker Compose（推荐）/ Option 1: Docker Compose (Recommended)

> 🚧 即将推出 / Coming soon

```bash
git clone https://github.com/BlueBirdBack/askclaw.git
cd askclaw
cp agents.example.json agents.json
# 编辑 agents.json，填入你的 agent 信息
# Edit agents.json with your agent info
docker compose up -d
```

## 方式二：手动部署 / Option 2: Manual Deployment

### 1. 安装依赖 / Install Dependencies

```bash
# Node.js (如果没有)
curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
apt-get install -y nodejs

# nginx
apt-get install -y nginx

# certbot (SSL)
apt-get install -y certbot python3-certbot-nginx

# NATS server
curl -sf https://binaries.nats.dev/nats-io/nats-server/v2@latest | sh
mv nats-server /usr/local/bin/
```

### 2. 克隆并构建 / Clone and Build

```bash
cd /opt
git clone https://github.com/BlueBirdBack/askclaw.git
cd askclaw
npm install
npm run build
```

### 3. 配置 agents / Configure Agents

```bash
cp agents.example.json agents.json
```

编辑 `agents.json`，填入你的 OpenClaw agent 信息：

```json
{
  "my-agent": {
    "label": "我的 Agent",
    "emoji": "🤖",
    "gateway": "ws://127.0.0.1:18789/",
    "token": "你的OpenClaw令牌",
    "origin": "http://127.0.0.1:18789"
  }
}
```

**获取 token / Get your token:**

```bash
# 在 OpenClaw 配置目录中查找
cat ~/.openclaw/openclaw.json | grep -A2 '"auth"'
```

### 4. 配置 NATS / Configure NATS

```bash
cat > /etc/nats.conf << 'EOF'
listen: 127.0.0.1:4222
max_payload: 8MB
EOF
```

创建 systemd 服务 / Create systemd service:

```bash
cat > /etc/systemd/system/nats.service << 'EOF'
[Unit]
Description=NATS Server
After=network.target

[Service]
ExecStart=/usr/local/bin/nats-server -c /etc/nats.conf
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable --now nats
```

### 5. 启动 bridge / Start Bridge

```bash
cat > /etc/systemd/system/askclaw-bridge.service << 'EOF'
[Unit]
Description=AskClaw IM Bridge
After=network.target nats.service

[Service]
WorkingDirectory=/opt/askclaw
ExecStart=/usr/bin/node bridge-nats.cjs
Restart=always
RestartSec=5
Environment=PORT=3001
Environment=NATS_URL=nats://127.0.0.1:4222

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable --now askclaw-bridge
```

### 6. 配置 nginx / Configure nginx

将 `your-domain.com` 替换为你的域名 / Replace `your-domain.com` with your domain:

```bash
cat > /etc/nginx/sites-available/askclaw << 'NGINX'
server {
    listen 80;
    server_name your-domain.com;

    # 前端静态文件 / Frontend static files
    location / {
        root /opt/askclaw/dist;
        try_files $uri $uri/ /index.html;
    }

    # Bridge API
    location /bridge/ {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header Connection '';
        proxy_buffering off;
        proxy_cache off;
        chunked_transfer_encoding on;
    }
}
NGINX

ln -sf /etc/nginx/sites-available/askclaw /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx
```

### 7. SSL 证书 / SSL Certificate

```bash
certbot --nginx -d your-domain.com --non-interactive --agree-tos -m your@email.com
```

### 8. 启动 relay（每个 agent 一个）/ Start Relay (one per agent)

如果 agent 和 bridge 在同一台机器上，relay 会自动连接本地 gateway：

```bash
cat > /etc/systemd/system/askclaw-relay@.service << 'EOF'
[Unit]
Description=AskClaw Relay for %i
After=network.target nats.service

[Service]
WorkingDirectory=/opt/askclaw
ExecStart=/usr/bin/node relay.cjs
Restart=always
RestartSec=5
Environment=AGENT=%i
Environment=NATS_URL=nats://127.0.0.1:4222
Environment=GATEWAY_ORIGIN=http://127.0.0.1:18789

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
# 为每个 agent 启动一个 relay / Start a relay for each agent
systemctl enable --now askclaw-relay@my-agent
```

### 9. 验证 / Verify

```bash
# 检查所有服务
systemctl status nats askclaw-bridge askclaw-relay@my-agent

# 检查 bridge 健康
curl http://127.0.0.1:3001/bridge/health

# 打开浏览器访问
echo "打开 https://your-domain.com 开始聊天！"
```

## 常见问题 / Troubleshooting

### Bridge 启动失败 / Bridge fails to start

```bash
journalctl -u askclaw-bridge -f
```

常见原因 / Common causes:
- NATS 未运行 / NATS not running → `systemctl start nats`
- 端口冲突 / Port conflict → 修改 `PORT` 环境变量

### Agent 离线 / Agent offline

```bash
journalctl -u askclaw-relay@my-agent -f
```

常见原因 / Common causes:
- OpenClaw gateway 未运行 / Gateway not running → `openclaw gateway start`
- Token 错误 / Wrong token → 检查 `agents.json`
- Gateway 地址错误 / Wrong gateway URL → 检查 `GATEWAY_ORIGIN`

### SSL 证书失败 / SSL certificate fails

```bash
# 确保域名已指向 VPS IP / Make sure domain points to VPS IP
dig your-domain.com

# 确保 80 端口开放 / Make sure port 80 is open
curl -I http://your-domain.com
```

## 最低配置 / Minimum Requirements

| 组件 / Component | 内存 / RAM |
|---|---|
| NATS Server | ~20MB |
| AskClaw Bridge | ~50MB |
| AskClaw Relay (每个) | ~30MB |
| nginx | ~5MB |
| **总计（1个 agent）** | **~105MB** |

加上 OpenClaw gateway (~200-600MB)，1GB 内存可以运行，2GB 比较舒服。

With OpenClaw gateway (~200-600MB), 1GB RAM is the minimum, 2GB is comfortable.

---

[中文](./DEPLOY.md) | [English](./DEPLOY.en.md)
