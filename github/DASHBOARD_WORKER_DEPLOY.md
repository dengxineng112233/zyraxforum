# Cloudflare Dashboard 手动部署版

你要的是直接部署进 **Worker**，不用命令行、不用 Pages uploader。

## 你真正要用的文件

```text
worker-dashboard.js
```

路径：

```text
C:\Users\Admin\Desktop\Project\ONZYRAX\worker-dashboard.js
```

这是单文件 Worker：HTML、CSS、前端 JS、后端 API 全部内嵌在一个 Worker 脚本里。

如果你上传 GitHub，`github/worker-dashboard.js` 也已经同步了一份；Dashboard 手动部署时复制任意一份都可以。

## Cloudflare 后台操作

1. 进入 Cloudflare Dashboard。
2. Workers & Pages。
3. Create Worker。
4. 点 Edit Code。
5. 清空默认代码。
6. 把 `worker-dashboard.js` 全部复制进去。
7. Save and Deploy。

## D1 绑定

Worker 必须绑定 D1，否则 API 会提示：

```text
缺少 D1 绑定 FORUM_DB
```

操作：

1. 打开这个 Worker。
2. Settings。
3. Bindings。
4. Add binding。
5. 选择 D1 database。
6. Variable name 必须填：

```text
FORUM_DB
```

7. 选择你的 D1 数据库。
8. 保存。

## 初始化 D1 数据库

在 Cloudflare Dashboard 里打开 D1 数据库，进入 Console，把下面这个文件内容粘进去执行：

```text
schema\d1.sql
```

线上 Worker 也能直接打开下面两个地址复制同一份 SQL：

```text
/schema/d1.sql
/schema/01.sql
```

如果你要预置管理员，再执行：

```text
schema\seed_admin.sql
```

## 可选变量

Worker Settings -> Variables 里可加：

```text
ADMIN_USERNAMES=admin
APP_BASE_URL=https://你的worker域名
```

## 邮箱验证码

- 没有人机验证。
- 注册页会发送 6 位邮箱验证码。
- 如果没配置邮件服务，接口会返回 `devCode`，方便你测试注册流程。

## 如果看到 NOT_FOUND

- 看到 Vercel 的 `The page could not be found / NOT_FOUND`：说明你部署到 Vercel 静态站了，完整论坛 API 和 D1 不会运行。完整论坛要用 Cloudflare Worker。
- 看到 Worker JSON `D1_NOT_BOUND`：说明 Worker 没绑定 D1，去 Settings -> Bindings 加 `FORUM_DB`。
- 看到 `usersTable: false`：说明 D1 已绑定但没初始化，执行 `schema/d1.sql`。

## 管理员

如果执行了 `schema\seed_admin.sql`：

- 用户名：admin
- 密码：你指定的管理员密码
- 后台：/admin/

