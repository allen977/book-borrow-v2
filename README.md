# 扫码借书 / 还书系统（Cloudflare 版）

微信扫码 → 进借还书 H5 页面 → 数据存 Cloudflare D1 → 管理员后台看全部 + 超期提醒。

## 功能

- 扫码进借书/还书页，书名自动识别
- 借书校验：每人最多借 2 本，每本最多 14 天
- 还书页超期高亮 + 超期天数徽标
- 管理员后台：统计卡片 + 全量记录 + 超期筛选
- CSV 导出（含超期列）
- 每日 09:00 定时检测超期，推送到企业微信机器人

## 项目结构

```
book-borrow-v2/
├── README.md
├── frontend/            ← 部署到 Cloudflare Pages
│   ├── index.html       借书/还书页（扫码入口）
│   └── admin.html       管理后台
└── worker/              ← 部署到 Cloudflare Worker
    ├── wrangler.jsonc   配置（填 D1_id / 密码 / webhook）
    ├── schema.sql        建表语句
    └── src/
        ├── index.js     API + 定时任务
        └── db.js        D1 操作
```

## 部署步骤

### 1. 安装 wrangler 并登录

```bash
npm install -g wrangler
wrangler login
```

### 2. 创建 D1 数据库

```bash
wrangler d1 create book_borrow_db
```

记下返回的 `database_id`，填进 `worker/wrangler.jsonc`。

### 3. 建表

```bash
wrangler d1 execute book_borrow_db --remote --file=./worker/schema.sql
```

### 4. 修改配置

打开 `worker/wrangler.jsonc`，改 3 处：

- `database_id`：第 2 步拿到的 id
- `ADMIN_PWD`：你的管理密码
- `NOTIFY_URL`：企业微信机器人 webhook（不用推送就留空字符串）

### 5. 部署 Worker（API）

```bash
cd worker
wrangler deploy
```

拿到 Worker 地址，如 `https://book-borrow.你的名.workers.dev`。

### 6. 部署前端（Pages）

因为前端要调 API，需要把 API 地址写进页面。打开 `frontend/index.html` 和
`frontend/admin.html`，把顶部的：

```js
const API = location.origin
```

改成你的 Worker 地址（同域部署可保持 `location.origin`）：

```js
const API = 'https://book-borrow.你的名.workers.dev'
```

然后部署：

```bash
cd frontend
wrangler pages deploy . --project-name book-borrow-frontend
```

拿到 Pages 地址，如 `https://book-borrow-frontend.pages.dev`。

### 7. 绑自定义域名（推荐）

`xxx.pages.dev` 在微信里容易被拦截，正式使用建议：

1. 买一个已备案域名，DNS 托管到 Cloudflare
2. Pages 项目绑自定义域名（如 `book.你的域名.com`）
3. 前端 `API` 地址改成该域名

## 生成每本书的二维码

二维码内容格式：

```
https://book.你的域名.com/?book=三体
```

微信扫一扫 → 打开页面 → 书名自动填好。

可到 https://cli.im 批量生成。

## 二维码规则说明

| 参数 | 作用 |
|------|------|
| `?book=三体` | 扫码后书名自动填入借书页 |

## 管理后台

访问：

```
https://book.你的域名.com/admin
```

输入 `wrangler.jsonc` 里配置的 `ADMIN_PWD` 进入。

## 规则说明

| 规则 | 值 | 校验位置 |
|------|----|----------|
| 每人最多借 | 2 本 | Worker API |
| 每本最多借 | 14 天 | Worker 计算 |

超期在还书页、管理员后台都会以红色高亮 + 超期天数显示。

## 常见问题

| 问题 | 原因 | 解决 |
|------|------|------|
| `D1 binding not found` | database_id 错 | 检查 wrangler.jsonc |
| 借书报「信息不完整」 | 字段为空 | 填完整再提交 |
| 超期不推送 | NOTIFY_URL 未配 | 填企业微信机器人 webhook |
| 微信打不开页面 | pages.dev 被拦 | 绑已备案自定义域名 |
| 时间差 1 天 | 时区 | D1 用 localtime，前端按 +08:00 解析 |
