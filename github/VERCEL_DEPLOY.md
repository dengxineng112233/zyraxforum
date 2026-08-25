# Vercel 部署：API 直连 Cloudflare D1

这个目录已经把 Worker 的 `/api/*` 迁移成了 Vercel Serverless Function：

```text
api/[...path].js
```

页面仍由 `worker-public/` 输出，数据库仍然连 Cloudflare D1。也就是说：

- 前端静态页面：Vercel 托管
- `/api/*`：Vercel Function 执行
- 数据库：Cloudflare D1 HTTP API

## Vercel 项目设置

```text
Framework Preset: Other
Build Command: npm run build
Output Directory: worker-public
Install Command: npm install
```

Root Directory 可以选这个 `github` 目录。现在项目根目录也补了同款 `vercel.json` 和 `api/index.js`，所以选根目录也能跑；关键是部署产物里必须包含 `api/`、`src/`、`functions/` 和 `worker-public/`。

## Vercel 环境变量

必须配置这 3 个：

```text
CLOUDFLARE_ACCOUNT_ID=你的 Cloudflare Account ID
CLOUDFLARE_D1_DATABASE_ID=你的 D1 database_id
CLOUDFLARE_API_TOKEN=有 D1 Edit 权限的 Cloudflare API Token
```

可选：

```text
ADMIN_USERNAMES=admin
APP_BASE_URL=https://你的-vercel域名
RESEND_API_KEY=你的 Resend Key
MAIL_FROM=ZyraxForum <noreply@你的域名>
```

## 初始化 D1

Cloudflare Dashboard -> D1 -> 你的数据库 -> Console，执行：

```text
schema/d1.sql
```

也可以访问站点里的这两个静态路径复制 SQL：

```text
/schema/d1.sql
/schema/01.sql
```

## 验证

部署后打开：

```text
/api/health
```

结果含义：

- `ok: true`：Vercel API 已连上 Cloudflare D1，表也存在。
- `D1_HTTP_CONFIG_MISSING`：Vercel 环境变量没配全。
- `usersTable: false`：D1 已连上，但还没执行 `schema/d1.sql`。

## 截图里的 NOT_FOUND

Vercel `The page could not be found / NOT_FOUND` 通常是：

1. Root Directory 没选到 `github` 目录。
2. Output Directory 没填 `worker-public`。
3. GitHub 没上传 `worker-public/index.html`。
4. GitHub 没上传 `api/index.js` 或 `api/[...path].js`，导致 `/api/*` 没有 Function 接管。
5. 访问的是旧部署缓存，重新 Redeploy 一次。
