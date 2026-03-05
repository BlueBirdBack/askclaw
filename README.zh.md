# AskClaw

> 可自托管的生产级 AI 对话平台。  
> 线上体验：[askclaw.top](https://askclaw.top) · 20+ 活跃用户 · MIT 开源协议

![桌面端](docs/screenshots/desktop-chat-zh.png)

[English](README.md) · **中文**

---

## 简介

AskClaw 是一个简洁、私密的 AI 对话界面，可部署在你自己的服务器上。数据不会离开你的基础设施，没有供应商锁定。支持 OpenAI 或任何兼容 OpenAI 接口的服务——包括 [OpenClaw](https://github.com/openclaw/openclaw)。

为那些不想为 SaaS 付高价、也不愿妥协数据隐私的团队而生。

## 功能特性

- 💬 **实时流式对话** — 回复逐字流出，响应即时
- 👥 **多用户支持** — 每个用户独立会话，共享同一套基础设施
- 📄 **导出对话** — 支持导出为 PDF 或 DOCX 文档
- 🌐 **双语界面** — 内置中英文切换
- 📱 **响应式布局** — 适配桌面、平板与手机
- 🔍 **全文搜索** — 基于 SQLite FTS5，搜遍所有对话记录
- 🔌 **模型无关** — 支持 OpenAI API 或任何兼容接口
- 🔒 **身份认证** — HTTP Basic Auth，每用户独立会话隔离

## 界面截图

| 初始状态 | 对话中 |
|---|---|
| ![桌面空状态](docs/screenshots/desktop-empty-zh.png) | ![桌面对话](docs/screenshots/desktop-chat-zh.png) |

| 手机端 |
|---|
| ![手机端](docs/screenshots/mobile-zh.png) |

## 技术栈

| 层级 | 技术 |
|---|---|
| 前端 | Svelte 5 + TypeScript + Vite |
| 后端 | FastAPI + Python 3.13 |
| 数据库 | SQLite（WAL 模式 + FTS5 全文搜索） |
| 认证 | HTTP Basic Auth（htpasswd） |
| 导出 | PDF（html2pdf）+ DOCX（docx.js） |
| 国际化 | 自定义方案（中文 + 英文） |

## 系统架构

```
浏览器
  └─▶ nginx（TLS 终止 + Basic Auth 鉴权）
        ├─▶ FastAPI 后端（:8000）  ← 对话记录、文件、搜索
        └─▶ AI 服务商             ← OpenAI / OpenClaw / 任何兼容接口
```

每个用户拥有独立的会话空间。后端使用 SQLite 存储对话记录并支持全文检索。AI 服务商可通过一个环境变量随时切换。

## 快速开始

### 前置要求
- Python 3.13+
- Node.js 18+
- 一个兼容 OpenAI 接口的 API 端点

### 启动后端

```bash
cd server
python -m venv .venv && source .venv/bin/activate
pip install -e .
uvicorn askclaw.main:app --host 127.0.0.1 --port 8000
```

### 启动前端

```bash
npm install
npm run dev        # 开发模式
npm run build      # 生产构建 → dist/
```

### 环境配置

```bash
# 复制示例文件并填写配置
cp server/.env.example server/.env
```

**默认配置（OpenAI / OpenClaw）：**
```bash
ASKCLAW_OPENCLAW_CONFIG=/root/.openclaw/openclaw.json
```

### OpenClaw 专属 Agent

AskClaw 使用一个独立的 OpenClaw Agent（`openclaw:askclaw`），配备最简工作空间，防止主 Agent 的系统提示词污染用户对话。详见 [`docs/openclaw-agent.md`](docs/openclaw-agent.md)。

### 生产环境（nginx）

完整的 nginx + TLS + Basic Auth 配置方案，参见 [`docs/nginx.md`](docs/nginx.md)。

## 项目结构

```
/
├── src/                    # Svelte 5 前端
│   ├── components/         # 对话界面组件
│   └── lib/               # API 客户端、国际化、导出、状态管理
├── server/
│   └── askclaw/           # FastAPI 后端
│       ├── routers/       # API 路由（对话、文件、认证、搜索）
│       ├── main.py        # 应用入口
│       ├── models.py      # Pydantic 数据模型
│       └── db.py          # SQLite + FTS5
└── public/                # 静态资源
```

## 线上演示

[askclaw.top](https://askclaw.top) — 真实用户在用的生产环境。

## 路线图

- [ ] Docker Compose 一键部署
- [ ] 单次对话多模型切换
- [ ] 团队 / 组织支持
- [ ] 用量统计面板

## 开源协议

MIT — 详见 [LICENSE](LICENSE)

## 依赖项目

- [OpenClaw](https://github.com/openclaw/openclaw) — 驱动后端的多 Agent AI 框架
- [Svelte](https://svelte.dev) — 前端框架
- [FastAPI](https://fastapi.tiangolo.com) — 后端框架
