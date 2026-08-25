import * as sessionApi from "../functions/api/session.js";
import * as healthApi from "../functions/api/health.js";
import * as statsApi from "../functions/api/stats.js";
import * as postsApi from "../functions/api/posts.js";
import * as postDetailApi from "../functions/api/posts/[id].js";
import * as postCommentsApi from "../functions/api/posts/[id]/comments.js";
import * as postLikeApi from "../functions/api/posts/[id]/like.js";
import * as loginApi from "../functions/api/auth/login.js";
import * as registerApi from "../functions/api/auth/register.js";
import * as sendRegisterCodeApi from "../functions/api/auth/send-register-code.js";
import * as logoutApi from "../functions/api/auth/logout.js";
import * as verifyEmailApi from "../functions/api/auth/verify-email.js";
import * as forgotPasswordApi from "../functions/api/auth/forgot-password.js";
import * as resetPasswordApi from "../functions/api/auth/password-reset/confirm.js";
import * as adminUsersApi from "../functions/api/admin/users.js";
import * as adminUserBanApi from "../functions/api/admin/users/[id]/ban.js";
import { json } from "../functions/_lib/common.js";

function context(env, request, params = {}) {
  return { env, request, params };
}

async function serveIndex(env, request) {
  const url = new URL(request.url);
  url.pathname = "/index.html";
  url.search = "";
  return env.ASSETS.fetch(new Request(url.toString(), request));
}

async function serveAsset(env, request) {
  const response = await env.ASSETS.fetch(request);
  if (response.status !== 404) return response;
  const path = new URL(request.url).pathname;
  if (path.startsWith("/t/")) return serveIndex(env, request);
  return response;
}

async function routeApi(env, request) {
  const url = new URL(request.url);
  const path = url.pathname.replace(/\/+$/, "") || "/";
  const method = request.method.toUpperCase();

  if (path === "/api/health" && method === "GET") return healthApi.onRequestGet(context(env, request));
  if (path === "/api/session" && method === "GET") return sessionApi.onRequestGet(context(env, request));
  if (path === "/api/stats" && method === "GET") return statsApi.onRequestGet(context(env, request));

  if (path === "/api/auth/send-register-code" && method === "POST") return sendRegisterCodeApi.onRequestPost(context(env, request));
  if (path === "/api/auth/register" && method === "POST") return registerApi.onRequestPost(context(env, request));
  if (path === "/api/auth/login" && method === "POST") return loginApi.onRequestPost(context(env, request));
  if (path === "/api/auth/logout" && method === "POST") return logoutApi.onRequestPost(context(env, request));
  if (path === "/api/auth/verify-email" && method === "GET") return verifyEmailApi.onRequestGet(context(env, request));
  if (path === "/api/auth/forgot-password" && method === "POST") return forgotPasswordApi.onRequestPost(context(env, request));
  if (path === "/api/auth/password-reset/confirm" && method === "POST") return resetPasswordApi.onRequestPost(context(env, request));

  if (path === "/api/posts" && method === "GET") return postsApi.onRequestGet(context(env, request));
  if (path === "/api/posts" && method === "POST") return postsApi.onRequestPost(context(env, request));

  const postMatch = path.match(/^\/api\/posts\/([^/]+)$/);
  if (postMatch && method === "GET") return postDetailApi.onRequestGet(context(env, request, { id: decodeURIComponent(postMatch[1]) }));
  if (postMatch && method === "DELETE") return postDetailApi.onRequestDelete(context(env, request, { id: decodeURIComponent(postMatch[1]) }));

  const commentMatch = path.match(/^\/api\/posts\/([^/]+)\/comments$/);
  if (commentMatch && method === "POST") return postCommentsApi.onRequestPost(context(env, request, { id: decodeURIComponent(commentMatch[1]) }));

  const likeMatch = path.match(/^\/api\/posts\/([^/]+)\/like$/);
  if (likeMatch && method === "POST") return postLikeApi.onRequestPost(context(env, request, { id: decodeURIComponent(likeMatch[1]) }));

  if (path === "/api/admin/users" && method === "GET") return adminUsersApi.onRequestGet(context(env, request));

  const banMatch = path.match(/^\/api\/admin\/users\/([^/]+)\/ban$/);
  if (banMatch && method === "POST") return adminUserBanApi.onRequestPost(context(env, request, { id: decodeURIComponent(banMatch[1]) }));
  if (banMatch && method === "DELETE") return adminUserBanApi.onRequestDelete(context(env, request, { id: decodeURIComponent(banMatch[1]) }));

  return json({ error: "NOT_FOUND", message: "API route not found." }, 404);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname.startsWith("/api/")) return routeApi(env, request);
    return serveAsset(env, request);
  },
};
