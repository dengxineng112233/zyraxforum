import { json } from "../_lib/common.js";

export async function onRequestGet({ env }) {
  const users = await env.FORUM_DB.prepare("SELECT COUNT(*) count FROM users").first();
  const posts = await env.FORUM_DB.prepare("SELECT COUNT(*) count FROM posts").first();
  const comments = await env.FORUM_DB.prepare("SELECT COUNT(*) count FROM comments").first();
  return json({ users: Number(users.count || 0), posts: Number(posts.count || 0), comments: Number(comments.count || 0) });
}
