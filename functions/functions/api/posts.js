import { attachCounts, getCurrentUser, json, now, readJson, requireUser, uid } from "../_lib/common.js";

const allowedCategories = new Set(["公告", "技术", "资源", "闲聊", "反馈"]);

export async function onRequestGet({ env, request }) {
  const url = new URL(request.url);
  const q = (url.searchParams.get("q") || "").trim();
  const category = (url.searchParams.get("category") || "全部").trim();
  const sort = url.searchParams.get("sort") || "new";
  const currentUser = await getCurrentUser(env, request);

  let sql = `
    SELECT posts.id, posts.title, posts.category, posts.body, posts.created_at, posts.updated_at,
           users.username AS author, users.id AS author_id
    FROM posts
    JOIN users ON users.id = posts.author_id
  `;
  const where = [];
  const binds = [];
  if (category && category !== "全部") {
    where.push("posts.category = ?");
    binds.push(category);
  }
  if (q) {
    where.push("(posts.title LIKE ? OR posts.body LIKE ? OR users.username LIKE ?)");
    binds.push(`%${q}%`, `%${q}%`, `%${q}%`);
  }
  if (where.length) sql += ` WHERE ${where.join(" AND ")}`;
  if (sort === "hot") sql += " ORDER BY (SELECT COUNT(*) FROM post_likes WHERE post_likes.post_id = posts.id) DESC, posts.created_at DESC";
  else if (sort === "comment") sql += " ORDER BY (SELECT COUNT(*) FROM comments WHERE comments.post_id = posts.id) DESC, posts.created_at DESC";
  else sql += " ORDER BY posts.created_at DESC";
  sql += " LIMIT 100";

  const rows = await env.FORUM_DB.prepare(sql).bind(...binds).all();
  const posts = await attachCounts(env, rows.results || [], currentUser?.id || "");
  return json({ posts });
}

export async function onRequestPost({ env, request }) {
  const auth = await requireUser(env, request);
  if (auth.error) return auth.error;
  const body = await readJson(request);
  const title = String(body?.title || "").trim();
  const category = String(body?.category || "").trim();
  const content = String(body?.body || "").trim();

  if (title.length < 2 || title.length > 80) return json({ error: "BAD_TITLE", message: "标题需 2-80 字。" }, 400);
  if (!allowedCategories.has(category)) return json({ error: "BAD_CATEGORY", message: "板块无效。" }, 400);
  if (content.length < 2 || content.length > 3000) return json({ error: "BAD_BODY", message: "内容需 2-3000 字。" }, 400);

  const id = uid("p");
  const ts = now();
  await env.FORUM_DB.prepare("INSERT INTO posts (id, author_id, title, category, body, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)")
    .bind(id, auth.user.id, title, category, content, ts, ts)
    .run();
  return json({ post: { id, author: auth.user.username, author_id: auth.user.id, title, category, body: content, created_at: ts, updated_at: ts, commentsCount: 0, likesCount: 0, likedByMe: false } }, 201);
}


