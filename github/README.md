# ZyraxForum

Cloudflare Worker + Static Assets + D1 的轻量论坛模板。

## GitHub 上传重点

GitHub 不保存空文件夹，所以 `schema/` 里已经放了实际文件：

- `schema/d1.sql`：D1 初始化 SQL
- `schema/01.sql`：同一份 SQL 的兼容别名
- `schema/seed_admin.sql`：预置管理员 SQL

如果你用 Cloudflare Dashboard 手动部署，直接复制 `worker-dashboard.js` 到 Worker。也可以直接部署到 Vercel：`api/[...path].js` 会把 `/api/*` 移植成 Vercel Serverless Function，数据库仍然连接 Cloudflare D1。

## 当前结构

- `src/worker.js`：Worker 入口，统一处理 API 路由和帖子详情 fallback
- `worker-public/`：Worker Static Assets 静态资源目录
- `worker-public/index.html`：论坛首页 / 主题列表
- `worker-public/login/index.html`：登录页 `/login/`
- `worker-public/register/index.html`：注册页 `/register/`
- `worker-public/admin/index.html`：管理后台 `/admin/`
- `worker-public/forgot/index.html`：找回密码 `/forgot/`
- `worker-public/reset-password/index.html`：重置密码 `/reset-password/`
- `worker-public/assets/app.js`：前端逻辑，调用 `/api/*`
- `worker-public/assets/style.css`：公共样式
- `worker-public/schema/d1.sql`：静态可访问的 D1 初始化 SQL，访问 `/schema/d1.sql`
- `functions/`：复用的 API handler 模块，由 `src/worker.js` import 后路由
- `schema/d1.sql`：D1 全新库表结构
- `schema/01.sql`：`schema/d1.sql` 的兼容别名
- `schema/migration_auth_plus.sql`：旧库升级迁移
- `schema/seed_admin.sql`：预置 admin 用户
- `wrangler.toml`：Worker、Static Assets、D1 绑定配置
- `worker-dashboard.js`：Cloudflare Dashboard 手动复制部署用的单文件 Worker
- `api/[...path].js`：Vercel API 入口，使用 Cloudflare D1 HTTP API 访问同一个 D1 数据库

## 路由

- `/` -> 首页主题列表
- `/login/` -> 登录
- `/register/` -> 注册
- `/admin/` -> 管理后台
- `/forgot/` -> 找回密码
- `/reset-password/?token=...` -> 重置密码
- `/t/<slug>/<post-id>/` -> 帖子详情，Worker fallback 到 `worker-public/index.html`
- `/api/auth/register` -> 注册
- `/api/auth/send-register-code` -> 发送注册邮箱验证码
- `/api/auth/login` -> 登录
- `/api/auth/logout` -> 退出
- `/api/session` -> 当前用户
- `/api/posts` -> 主题列表 / 发帖
- `/api/posts/:id` -> 主题详情 / 删除
- `/api/posts/:id/comments` -> 回复
- `/api/posts/:id/like` -> 点赞
- `/api/admin/users` -> 管理员用户列表
- `/api/admin/users/:id/ban` -> 封禁 / 解封

## Vercel + Cloudflare D1

Vercel 项目设置：

```text
Framework Preset: Other
Build Command: npm run build
Output Directory: worker-public
Install Command: npm install
```

环境变量必须配置：

```text
CLOUDFLARE_ACCOUNT_ID=你的 Cloudflare Account ID
CLOUDFLARE_D1_DATABASE_ID=你的 D1 database_id
CLOUDFLARE_API_TOKEN=有 D1 Edit 权限的 Cloudflare API Token
```

部署后访问 `/api/health` 检查连接状态。

## 如果看到 NOT_FOUND

- Vercel `The page could not be found / NOT_FOUND`：检查 Output Directory 是否是 `worker-public`，以及项目根目录是否选到包含 `vercel.json` 的这一层。
- Worker JSON `D1_NOT_BOUND`：Cloudflare Worker 没有绑定 D1，变量名必须叫 `FORUM_DB`。
- `/api/health` 里 `usersTable: false`：D1 已连接但没初始化，执行 `schema/d1.sql`。

## 初始化

```powershell
cd C:\Users\Admin\Desktop\Project\ONZYRAX
npm install
npx wrangler login
npm run d1:create
```

把 `npm run d1:create` 输出的 `database_id` 填进 `wrangler.toml`：

```toml
[[d1_databases]]
binding = "FORUM_DB"
database_name = "cloudforum-db"
database_id = "你的 database_id"
```

全新库初始化：

```powershell
npm run d1:init:local
npm run d1:init:remote
```

旧库升级：

```powershell
npm run d1:migrate:auth-plus:local
npm run d1:migrate:auth-plus:remote
```

写入预置管理员：

```powershell
npm run seed:admin:local
npm run seed:admin:remote
```

默认管理员：

- 用户名：`admin`
- 密码：你指定的管理员密码
- 角色：`admin`

## 本地预览

不要用 `python -m http.server`，因为 Worker API 和 D1 不会启动。使用：

```powershell
npm run dev
```

通常打开：

```text
http://127.0.0.1:8787/
```

## 部署到 Cloudflare Worker

```powershell
cd C:\Users\Admin\Desktop\Project\ONZYRAX
npm run deploy
```

或者：

```powershell
.\deploy.ps1 -WorkerName cloudforum
```

这会使用：

```powershell
npx wrangler deploy
```

## wrangler.toml 关键配置

```toml
name = "cloudforum"
main = "src/worker.js"
compatibility_date = "2026-08-22"

[assets]
directory = "./worker-public"
binding = "ASSETS"

[[d1_databases]]
binding = "FORUM_DB"
database_name = "cloudforum-db"
database_id = "REPLACE_WITH_D1_DATABASE_ID"

[vars]
ADMIN_USERNAMES = "admin"
APP_BASE_URL = "https://你的-worker域名"
```

## 认证说明

当前版本保留云端账号系统，但已按你的要求去掉：

- Turnstile 人机验证
- 邮箱验证码 / 邮箱验证门槛

现在注册后会直接创建云端账号并自动登录，用户可以直接发帖、评论、点赞。找回密码功能仍保留，依赖邮箱发送重置链接；不配置邮件服务时，重置链接会显示在 Wrangler 日志和开发返回值里。

仍保留的安全项：

- 密码使用 PBKDF2-SHA256 + salt 存储，不存明文。
- 登录态使用 HttpOnly Cookie。
- 登录失败有简单限速表 `login_attempts`。
- 管理员后台 `/admin/` 可封禁/解封用户。
- 静态响应保留 CSP、X-Frame-Options、nosniff 等安全头。

## 邮件发送

找回密码支持两种模式：

1. 没配邮件服务：重置链接会输出到 Wrangler 控制台日志，并在 API 返回里带 `devResetUrl`，适合本地开发。
2. 配 Resend：设置 `RESEND_API_KEY` 和 `MAIL_FROM` 后，后端会调用 Resend 发邮件。

生产环境建议在 Cloudflare Worker 环境变量里配置：

```text
RESEND_API_KEY=你的 Resend API Key
MAIL_FROM=ZyraxForum <noreply@你的域名>
APP_BASE_URL=https://你的-worker域名
```


