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
# Environment=AUTH_TOKEN=your-secret-token
Environment=NATS_URL=nats://127.0.0.1:4222

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable --now askclaw-bridge
```

**Bridge 环境变量 / Bridge environment variables**

| 变量 / Variable | 说明 / Description | 默认值 / Default |
|---|---|---|
| `PORT` | Bridge 监听端口 / Bridge listen port | `18795` |
| `AUTH_TOKEN` | API Bearer token；留空时为 trusted mode / API Bearer token; empty means trusted mode | 空 / empty |
| `NATS_URL` | NATS 连接地址 / NATS server URL | `tls://127.0.0.1:4222` |
| `NATS_USER` | NATS 用户名 / NATS username | 空 / empty |
| `NATS_PASS` | NATS 密码 / NATS password | 空 / empty |
| `NATS_CA` | NATS CA 证书路径 / NATS CA certificate path | `/etc/nats/certs/ca.pem` |
| `CORS_ORIGIN` | 允许跨域访问的固定 Origin；未设置时仅支持 same-origin / Fixed allowed cross-origin Origin; unset keeps same-origin only | 空 / empty |
| `AGENTS_FILE` | agent 配置文件路径 / agent config file path | `./agents.json` |

Note: The `nats://127.0.0.1:4222` values in the example service files are intended for loopback-only deployments on the same host. If NATS runs on a remote host, use `tls://...` for `NATS_URL` and configure `NATS_CA`.

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
# Environment=GATEWAY_TOKEN=your-openclaw-token

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

## 使用 Cloudflare / Using Cloudflare (推荐)

使用 Cloudflare 可以隐藏服务器 IP、加速静态资源、并提供免费 SSL 管理。

Using Cloudflare hides your server IP, accelerates static assets, and provides free SSL management.

### 1. 添加域名到 Cloudflare / Add domain to Cloudflare

登录 [https://dash.cloudflare.com](https://dash.cloudflare.com)，点击 **Add a Site**，输入你的域名并选择免费计划。

Log in to [https://dash.cloudflare.com](https://dash.cloudflare.com), click **Add a Site**, enter your domain and select the Free plan.

### 2. 修改域名注册商 Nameserver / Change nameservers at your registrar

Cloudflare 会提供两个 nameserver（如 `aria.ns.cloudflare.com`）。登录你的域名注册商，将 nameserver 替换为 Cloudflare 提供的地址。生效可能需要几分钟到 48 小时。

Cloudflare will give you two nameservers (e.g. `aria.ns.cloudflare.com`). Log in to your domain registrar and replace the existing nameservers with those provided by Cloudflare. Propagation may take a few minutes to 48 hours.

### 3. 添加 A 记录（灰云）/ Add A record (grey cloud initially)

在 Cloudflare DNS 控制台，添加一条 **A 记录**：

In the Cloudflare DNS dashboard, add an **A record**:

| 类型 / Type | 名称 / Name | 内容 / Content | 代理 / Proxy |
|---|---|---|---|
| A | `@` 或你的子域 | 你的 VPS IP | 🔘 仅 DNS（灰云）|

> ⚠️ 申请 SSL 证书时必须先使用灰云（仅 DNS），否则 certbot 的 HTTP 验证会失败。
>
> Keep grey cloud (DNS only) when obtaining the SSL certificate — certbot's HTTP challenge requires a direct connection to your server.

### 4. 设置 SSL 模式为 Full / Set SSL mode to Full

在 Cloudflare 控制台，进入 **SSL/TLS** → **Overview**，将加密模式设置为 **Full**（不是 Full Strict）。

In the Cloudflare dashboard, go to **SSL/TLS** → **Overview** and set the encryption mode to **Full** (not Full Strict).

> Full 模式：Cloudflare 到源服务器使用 SSL，但不验证证书有效性。适合 certbot 自签名或 Let's Encrypt 证书。
>
> Full mode: Cloudflare connects to your origin over SSL but does not verify certificate validity. Works well with Let's Encrypt certificates.

### 5. 申请 SSL 证书 / Obtain SSL certificate

按照上方 [步骤 7](#7-ssl-证书--ssl-certificate) 运行 certbot。

Follow [Step 7](#7-ssl-证书--ssl-certificate) above to run certbot.

### 6. 切换为橙云（代理模式）/ Switch to orange cloud (proxied)

certbot 申请成功后，回到 Cloudflare DNS 控制台，点击 A 记录旁边的云图标，将其切换为 **橙色**（已代理）。

Once certbot succeeds, return to the Cloudflare DNS dashboard and click the cloud icon next to your A record to switch it to **orange** (proxied).

这样流量将通过 Cloudflare CDN，服务器 IP 得到保护。

Traffic will now flow through Cloudflare's CDN, protecting your server IP.

---

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
