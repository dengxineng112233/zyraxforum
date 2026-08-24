# ZyraxForum

Cloudflare Worker + Static Assets + D1 的轻量论坛模板。

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
- `functions/`：复用的 API handler 模块，由 `src/worker.js` import 后路由
- `schema/d1.sql`：D1 全新库表结构
- `schema/migration_auth_plus.sql`：旧库升级迁移
- `schema/seed_admin.sql`：预置 admin 用户
- `wrangler.toml`：Worker、Static Assets、D1 绑定配置

## 路由

- `/` -> 首页主题列表
- `/login/` -> 登录
- `/register/` -> 注册
- `/admin/` -> 管理后台
- `/forgot/` -> 找回密码
- `/reset-password/?token=...` -> 重置密码
- `/t/<slug>/<post-id>/` -> 帖子详情，Worker fallback 到 `worker-public/index.html`
- `/api/auth/register` -> 注册
- `/api/auth/login` -> 登录
- `/api/auth/logout` -> 退出
- `/api/session` -> 当前用户
- `/api/posts` -> 主题列表 / 发帖
- `/api/posts/:id` -> 主题详情 / 删除
- `/api/posts/:id/comments` -> 回复
- `/api/posts/:id/like` -> 点赞
- `/api/admin/users` -> 管理员用户列表
- `/api/admin/users/:id/ban` -> 封禁 / 解封

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


