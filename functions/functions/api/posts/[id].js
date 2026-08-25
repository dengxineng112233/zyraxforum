import { attachCounts, getCurrentUser, json, requireUser } from "../../_lib/common.js";

export async function onRequestGet({ env, request, params }) {
  const currentUser = await getCurrentUser(env, request);
  const row = await env.FORUM_DB.prepare(`
    SELECT posts.id, posts.title, posts.category, posts.body, posts.created_at, posts.updated_at,
           users.username AS author, users.id AS author_id
    FROM posts JOIN users ON users.id = posts.author_id
    WHERE posts.id = ?
  `).bind(params.id).first();
  if (!row) return json({ error: "NOT_FOUND", message: "主题不存在。" }, 404);
  const [post] = await attachCounts(env, [row], currentUser?.id || "");
  const comments = await env.FORUM_DB.prepare(`
    SELECT comments.id, comments.body, comments.created_at, users.username AS author, users.id AS author_id
    FROM comments JOIN users ON users.id = comments.author_id
    WHERE comments.post_id = ?
    ORDER BY comments.created_at ASC
  `).bind(params.id).all();
  return json({ post, comments: comments.results || [] });
}

export async function onRequestDelete({ env, request, params }) {
  const auth = await requireUser(env, request);
  if (auth.error) return auth.error;
  const post = await env.FORUM_DB.prepare("SELECT author_id FROM posts WHERE id = ?").bind(params.id).first();
  if (!post) return json({ error: "NOT_FOUND", message: "主题不存在。" }, 404);
  if (post.author_id !== auth.user.id) return json({ error: "FORBIDDEN", message: "只能删除自己的主题。" }, 403);
  await env.FORUM_DB.prepare("DELETE FROM posts WHERE id = ?").bind(params.id).run();
  return json({ ok: true });
}
