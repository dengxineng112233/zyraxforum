const CATEGORIES = ["全部", "公告", "技术", "资源", "闲聊", "反馈"];
const $ = (id) => document.getElementById(id);

let currentUser = null;
let activeCategory = "全部";
let activeTab = "latest";
let composing = false;
let postsCache = [];
let statsCache = { users: 0, posts: 0, comments: 0 };

function safeText(value) {
  const div = document.createElement("div");
  div.textContent = value ?? "";
  return div.innerHTML;
}

function setMessage(el, text, type = "") {
  if (!el) return;
  el.textContent = text;
  el.className = `message ${type}`;
}

function formatTime(ts) {
  return new Intl.DateTimeFormat("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).format(new Date(ts));
}

function timeAgo(ts) {
  const s = Math.max(1, Math.floor((Date.now() - ts) / 1000));
  if (s < 60) return `${s} 秒前`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} 分钟前`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} 小时前`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d} 天前`;
  return formatTime(ts);
}

function slugify(text) {
  const ascii = String(text || "")
    .toLowerCase()
    .trim()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return encodeURIComponent(ascii || "topic");
}

function topicUrl(post) {
  return `/t/${slugify(post.title)}/${post.id}/`;
}

function readStorageKey() {
  return currentUser ? `zyraxforum_read_${currentUser.id}` : "zyraxforum_read_guest";
}

function getReadSet() {
  try { return new Set(JSON.parse(localStorage.getItem(readStorageKey()) || "[]")); } catch { return new Set(); }
}

function markRead(postId) {
  if (!postId) return;
  const read = getReadSet();
  read.add(String(postId));
  localStorage.setItem(readStorageKey(), JSON.stringify([...read].slice(-1000)));
}

function isRead(postId) {
  return getReadSet().has(String(postId));
}

function parseTopicPath() {
  const m = location.pathname.match(/^\/t\/[^/]+\/([^/]+)\/?$/);
  return m ? decodeURIComponent(m[1]) : null;
}

function redirectTarget() {
  const url = new URL(location.href);
  return url.searchParams.get("next") || "/";
}

async function api(path, options = {}) {
  const res = await fetch(path, {
    credentials: "include",
    headers: { "content-type": "application/json", ...(options.headers || {}) },
    ...options,
  });
  const text = await res.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = { message: text || "API 返回格式错误" }; }
  if (!res.ok) throw new Error(data?.message || data?.error || `HTTP ${res.status}`);
  return data;
}

async function loadSession() {
  try {
    const data = await api("/api/session");
    currentUser = data.user || null;
  } catch {
    currentUser = null;
  }
}

async function loadStats() {
  try {
    statsCache = await api("/api/stats");
  } catch {
    statsCache = { users: 0, posts: 0, comments: 0 };
  }
}

async function loadPosts() {
  const q = encodeURIComponent(($("searchInput")?.value || "").trim());
  const sort = encodeURIComponent(activeTab === "hot" ? "views" : ($("sortSelect")?.value || "new"));
  const data = await api(`/api/posts?q=${q}&sort=${sort}&category=全部`);
  postsCache = data.posts || [];
}

function updateNav() {
  const label = $("currentUserLabel"), logout = $("logoutBtn"), login = $("loginLink"), register = $("registerLink"), compose = $("composeLink");
  if (label) {
    label.style.display = currentUser ? "inline-flex" : "none";
    label.textContent = currentUser ? `已登录：${currentUser.username}` : "";
  }
  if (logout) logout.style.display = currentUser ? "inline-flex" : "none";
  if (login) login.style.display = currentUser ? "none" : "inline-flex";
  if (register) register.style.display = currentUser ? "none" : "inline-flex";
  if (compose) {
    compose.style.display = currentUser ? "inline-flex" : "none";
    compose.onclick = async (e) => {
      e.preventDefault();
      if (!requireLogin()) return;
      composing = true;
      history.replaceState(null, "", "/");
      renderTopicListShell();
      await refreshList();
      window.scrollTo({ top: 0, behavior: "smooth" });
    };
  }
  if (logout) logout.onclick = async () => {
    await api("/api/auth/logout", { method: "POST", body: "{}" }).catch(() => null);
    currentUser = null;
    location.href = "/";
  };
}

function requireLogin() {
  if (currentUser) return true;
  location.href = `/login/?next=${encodeURIComponent(location.pathname + location.search + location.hash)}`;
  return false;
}

async function initLoginPage() {
  await loadSession();
  updateNav();
  const form = $("loginForm");
  if (!form) return;
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const msg = $("authMsg");
    setMessage(msg, "登录中...");
    try {
      const data = await api("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ username: $("username").value.trim(), password: $("password").value }),
      });
      currentUser = data.user;
      setMessage(msg, "登录成功，正在跳转。", "ok");
      setTimeout(() => location.href = redirectTarget(), 300);
    } catch (err) {
      setMessage(msg, err.message, "err");
    }
  });
}

async function initRegisterPage() {
  await loadSession();
  updateNav();
  const form = $("registerForm");
  if (!form) return;
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const msg = $("authMsg");
    const username = $("username").value.trim().replace(/\s+/g, "_");
    const email = $("email").value.trim();
    const password = $("password").value;
    const confirm = $("confirmPassword").value;
    if (password !== confirm) return setMessage(msg, "两次密码不一致。", "err");
    setMessage(msg, "注册中...");
    try {
      const data = await api("/api/auth/register", { method: "POST", body: JSON.stringify({ username, email, password }) });
      currentUser = data.user;
      setMessage(msg, "注册成功，正在进入论坛。", "ok");
      setTimeout(() => location.href = redirectTarget(), 300);
    } catch (err) {
      setMessage(msg, err.message, "err");
    }
  });
}

function renderStats() {
  if ($("statUsers")) $("statUsers").textContent = statsCache.users || 0;
  if ($("statPosts")) $("statPosts").textContent = statsCache.posts || 0;
  if ($("statComments")) $("statComments").textContent = statsCache.comments || 0;
}

function renderCategories() {
  const list = $("categoryList");
  if (!list) return;
  const counts = Object.fromEntries(CATEGORIES.map((c) => [c, 0]));
  counts["全部"] = statsCache.posts || 0;
  postsCache.forEach((p) => counts[p.category] = (counts[p.category] || 0) + 1);
  list.innerHTML = CATEGORIES.map((cat) => `<button class="category ${cat === activeCategory ? "active" : ""}" data-category="${cat}" type="button"><span>${cat}</span><span class="badge">${counts[cat] || 0}</span></button>`).join("");
  document.querySelectorAll("[data-category]").forEach((btn) => btn.onclick = async () => {
    activeCategory = btn.dataset.category;
    history.replaceState(null, "", "/");
    await refreshList();
  });
}

function renderTopicListShell() {
  const root = $("forumRoot");
  if (!root) return;
  const toolsStyle = composing ? "display:none" : "";
  const listStyle = composing ? "display:none" : "";
  const composerExtra = composing ? "" : " locked";
  root.innerHTML = `<div class="panel feed-tools" style="${toolsStyle}"><div class="feed-tools-left"><div class="tabs"><button class="tab ${activeTab === "latest" ? "active" : ""}" data-tab="latest" type="button">最新</button><button class="tab ${activeTab === "hot" ? "active" : ""}" data-tab="hot" type="button">热门</button><button class="tab ${activeTab === "unread" ? "active" : ""}" data-tab="unread" type="button">未读</button></div></div><div style="display:flex;gap:8px;flex-wrap:wrap"><input class="input" id="searchInput" placeholder="搜索主题、内容或作者..." style="width:min(360px,70vw)"/><select class="select" id="sortSelect" style="width:142px"><option value="new">最新发布</option><option value="views">最多浏览</option><option value="hot">最多点赞</option><option value="comment">最多评论</option></select></div></div><form class="panel composer${composerExtra}" id="composer"><div style="display:flex;align-items:center;justify-content:space-between;gap:12px"><h2 class="section-title" style="margin:0">发布新主题</h2><button class="ghost" id="cancelComposeBtn" type="button">取消</button></div><div class="field" style="margin-top:14px"><label for="postTitle">标题</label><input class="input" id="postTitle" maxlength="80" placeholder="写一个清晰标题" required /></div><div class="field" style="margin-top:12px"><label for="postCategory">板块</label><select class="select" id="postCategory"></select></div><div class="field" style="margin-top:12px"><label for="postBody">内容</label><textarea class="textarea" id="postBody" maxlength="3000" placeholder="分享问题、经验或公告..." required></textarea></div><button class="pill primary" type="submit" style="margin-top:12px">发布主题</button><div class="message" id="postMsg"></div></form><div class="panel topic-list" id="postList" style="${listStyle}"></div>`;
  const search = $("searchInput"), sort = $("sortSelect");
  document.querySelectorAll("[data-tab]").forEach((btn) => btn.onclick = async () => {
    activeTab = btn.dataset.tab || "latest";
    document.querySelectorAll("[data-tab]").forEach((b) => b.classList.toggle("active", b === btn));
    await refreshList();
  });
  if (search) search.oninput = debounce(refreshList, 250);
  if (sort) sort.onchange = refreshList;
  const cancel = $("cancelComposeBtn");
  if (cancel) cancel.onclick = async () => {
    composing = false;
    renderTopicListShell();
    await refreshList();
  };
  renderComposer();
}

function renderComposer() {
  const composer = $("composer"), select = $("postCategory");
  if (!composer) return;
  if (select) select.innerHTML = CATEGORIES.filter((c) => c !== "全部").map((c) => `<option value="${c}">${c}</option>`).join("");
  composer.classList.toggle("locked", !currentUser || !composing);
  composer.onsubmit = async (e) => {
    e.preventDefault();
    if (!requireLogin()) return;
    const msg = $("postMsg");
    const payload = { title: $("postTitle").value.trim(), category: $("postCategory").value, body: $("postBody").value.trim() };
    try {
      setMessage(msg, "发布中...");
      const data = await api("/api/posts", { method: "POST", body: JSON.stringify(payload) });
      composing = false;
      history.pushState(null, "", topicUrl(data.post));
      await renderForum();
    } catch (err) {
      setMessage(msg, err.message, "err");
    }
  };
}

function renderPosts() {
  const list = $("postList");
  if (!list) return;
  let visiblePosts = activeCategory === "全部" ? [...postsCache] : postsCache.filter((p) => p.category === activeCategory);
  if (activeTab === "hot") visiblePosts = visiblePosts.filter((p) => Number(p.views || 0) >= 10).sort((a, b) => Number(b.views || 0) - Number(a.views || 0));
  if (activeTab === "unread") visiblePosts = visiblePosts.filter((p) => !isRead(p.id));
  if (!visiblePosts.length) {
    const emptyText = activeTab === "hot" ? "还没有达到 10 次浏览的热门主题。" : activeTab === "unread" ? "没有未读主题。" : "这个板块还没有主题。";
    list.innerHTML = `<div class="empty">${emptyText}</div>`;
    return;
  }
  list.innerHTML = visiblePosts.map((post) => {
    const excerpt = post.body.length > 110 ? post.body.slice(0, 110) + "..." : post.body;
    return `<article class="topic-row"><span class="avatar">${safeText(post.author[0]?.toUpperCase() || "U")}</span><div><a class="topic-title" href="${topicUrl(post)}" data-topic-link>${safeText(post.title)}</a><p class="topic-excerpt">${safeText(excerpt)}</p><div class="topic-meta"><span class="tag">${safeText(post.category)}</span><span>${safeText(post.author)}</span><span>创建于 ${formatTime(post.created_at)}</span></div></div><div class="metric"><b>${post.commentsCount || 0}</b>回复</div><div class="metric views"><b>${post.views || 0}</b>浏览</div><div class="activity">${timeAgo(post.created_at)}</div></article>`;
  }).join("");
}

async function refreshList() {
  try {
    await loadPosts();
    renderCategories();
    renderPosts();
  } catch (err) {
    const list = $("postList");
    if (list) list.innerHTML = `<div class="empty">API 未连接：${safeText(err.message)}<br>Cloudflare Worker 请检查 FORUM_DB 绑定；Vercel 请检查 CLOUDFLARE_ACCOUNT_ID / CLOUDFLARE_D1_DATABASE_ID / CLOUDFLARE_API_TOKEN，并确认 D1 已执行 schema/d1.sql。</div>`;
  }
}

async function renderTopicDetail(postId) {
  const root = $("forumRoot");
  if (!root) return;
  try {
    const data = await api(`/api/posts/${encodeURIComponent(postId)}`);
    const post = data.post;
    markRead(post.id);
    const comments = data.comments || [];
    document.title = `${post.title} - ZyraxForum`;
    const canDelete = currentUser && currentUser.id === post.author_id;
    root.innerHTML = `<article class="panel detail"><div class="detail-head"><a class="back-link" href="/" data-home-link>← 返回主题列表</a><h1 class="detail-title">${safeText(post.title)}</h1><div class="topic-meta" style="margin-top:10px"><span class="tag">${safeText(post.category)}</span><span>${safeText(post.author)}</span><span>${formatTime(post.created_at)}</span><span>${post.commentsCount || 0} 回复</span><span>${post.views || 0} 浏览</span><span>${post.likesCount || 0} 点赞</span></div></div><div class="detail-body"><span class="avatar">${safeText(post.author[0]?.toUpperCase() || "U")}</span><div><div class="post-content">${safeText(post.body)}</div><div class="detail-actions"><button class="ghost like-btn" type="button">${post.likedByMe ? "已赞" : "点赞"} · ${post.likesCount || 0}</button>${canDelete ? `<button class="ghost danger delete-btn" type="button">删除主题</button>` : ""}</div></div></div><section class="comments"><h2 class="section-title">回复</h2>${comments.length ? comments.map((c) => `<div class="comment"><span class="avatar">${safeText(c.author[0]?.toUpperCase() || "U")}</span><div><small>${safeText(c.author)} · ${formatTime(c.created_at)}</small><div class="comment-body">${safeText(c.body)}</div></div></div>`).join("") : `<div class="hint">还没有回复。</div>`}<form class="comment-form" id="detailCommentForm"><input class="input" id="detailCommentInput" placeholder="写回复..." maxlength="500"/><button class="pill primary" type="submit">回复</button></form></section></article>`;
    root.querySelector(".like-btn").onclick = async () => {
      if (!requireLogin()) return;
      await api(`/api/posts/${encodeURIComponent(post.id)}/like`, { method: "POST", body: "{}" });
      await renderForum();
    };
    const del = root.querySelector(".delete-btn");
    if (del) del.onclick = async () => {
      if (!confirm("确认删除这个主题？")) return;
      await api(`/api/posts/${encodeURIComponent(post.id)}`, { method: "DELETE" });
      history.pushState(null, "", "/");
      await renderForum();
    };
    $("detailCommentForm").onsubmit = async (e) => {
      e.preventDefault();
      if (!requireLogin()) return;
      const input = $("detailCommentInput");
      const body = input.value.trim();
      if (!body) return;
      await api(`/api/posts/${encodeURIComponent(post.id)}/comments`, { method: "POST", body: JSON.stringify({ body }) });
      input.value = "";
      await renderForum();
    };
  } catch (err) {
    root.innerHTML = `<div class="panel empty"><p>主题加载失败：${safeText(err.message)}</p><a class="pill primary" href="/" data-home-link>返回首页</a></div>`;
  }
}

async function seedDemo() {
  if (!currentUser) return location.href = "/login/?next=/";
  const demo = [
    { title: "欢迎来到 ZyraxForum", category: "公告", body: "这是接入 Cloudflare D1 后的云端论坛。注册用户、帖子、评论、点赞都会存到 D1。" },
    { title: "Cloudflare Pages Functions + D1 路由说明", category: "技术", body: "登录注册走 /api/auth/*，主题列表走 /api/posts，单帖详情走 /api/posts/:id。前端帖子链接仍是 /t/slug/id/。" },
  ];
  for (const item of demo) await api("/api/posts", { method: "POST", body: JSON.stringify(item) });
  await refreshList();
}

async function renderForum() {
  updateNav();
  await loadStats();
  renderStats();
  const topicId = parseTopicPath();
  if (topicId) { composing = false; await renderTopicDetail(topicId); }
  else {
    document.title = "ZyraxForum - 首页";
    renderTopicListShell();
    await refreshList();
  }
}

async function initForumPage() {
  await loadSession();
  const seed = $("seedBtn");
  if (seed) seed.onclick = seedDemo;
  document.addEventListener("click", async (e) => {
    const topic = e.target.closest("a[data-topic-link]");
    const home = e.target.closest("a[data-home-link]");
    if (topic) {
      e.preventDefault();
      const href = topic.getAttribute("href");
      const m = href.match(/\/t\/[^/]+\/([^/]+)\/?$/);
      if (m) markRead(decodeURIComponent(m[1]));
      history.pushState(null, "", href);
      await renderForum();
    }
    if (home) {
      e.preventDefault();
      history.pushState(null, "", "/");
      await renderForum();
    }
  });
  window.addEventListener("popstate", renderForum);
  await renderForum();
}

function debounce(fn, ms) {
  let timer = null;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
}


async function initForgotPage() {
  const form = $("forgotForm");
  if (!form) return;
  form.onsubmit = async (e) => {
    e.preventDefault();
    const msg = $("authMsg");
    setMessage(msg, "发送中...");
    try {
      const data = await api("/api/auth/forgot-password", { method: "POST", body: JSON.stringify({ email: $("email").value.trim() }) });
      setMessage(msg, data.devResetUrl ? `${data.message} 开发模式链接：${data.devResetUrl}` : data.message, "ok");
    } catch (err) { setMessage(msg, err.message, "err"); }
  };
}

async function initResetPage() {
  const form = $("resetForm");
  if (!form) return;
  form.onsubmit = async (e) => {
    e.preventDefault();
    const msg = $("authMsg");
    const password = $("password").value;
    const confirm = $("confirmPassword").value;
    if (password !== confirm) return setMessage(msg, "两次密码不一致。", "err");
    try {
      await api("/api/auth/password-reset/confirm", { method: "POST", body: JSON.stringify({ token: new URL(location.href).searchParams.get("token"), password }) });
      setMessage(msg, "密码已重置，正在跳转登录。", "ok");
      setTimeout(() => location.href = "/login/", 700);
    } catch (err) { setMessage(msg, err.message, "err"); }
  };
}

async function initVerifyPage() {
  const el = $("verifyMsg");
  try {
    const data = await api(`/api/auth/verify-email?token=${encodeURIComponent(new URL(location.href).searchParams.get("token") || "")}`);
    el.textContent = data.message || "邮箱验证完成。";
    el.className = "lead message ok";
  } catch (err) {
    el.textContent = err.message;
    el.className = "lead message err";
  }
}

async function initAdminPage() {
  await loadSession();
  updateNav();
  const root = $("adminRoot");
  if (!root) return;
  if (!currentUser || currentUser.role !== "admin") { root.innerHTML = `<div class="empty">需要管理员账号。</div>`; return; }
  async function loadUsers() {
    try {
      const data = await api("/api/admin/users");
      root.innerHTML = data.users.map(u => `<article class="topic-row"><span class="avatar">${safeText(u.username[0]?.toUpperCase() || "U")}</span><div><strong>${safeText(u.username)}</strong><p class="topic-excerpt">${safeText(u.email || "无邮箱")} · ${u.email_verified ? "已验证" : "未验证"} · ${safeText(u.role)}</p>${u.banned_at ? `<p class="message err">已封禁：${safeText(u.banned_reason || "")}</p>` : ""}</div><div class="metric"><b>${u.email_verified ? "是" : "否"}</b>验证</div><div class="metric views"><b>${u.role}</b>角色</div><div class="activity"><button class="ghost ${u.banned_at ? "" : "danger"}" data-ban="${u.id}" data-banned="${u.banned_at ? "1" : "0"}" type="button">${u.banned_at ? "解封" : "封禁"}</button></div></article>`).join("") || `<div class="empty">暂无用户。</div>`;
      root.querySelectorAll("[data-ban]").forEach(btn => btn.onclick = async () => {
        const id = btn.dataset.ban;
        if (btn.dataset.banned === "1") await api(`/api/admin/users/${encodeURIComponent(id)}/ban`, { method: "DELETE" });
        else await api(`/api/admin/users/${encodeURIComponent(id)}/ban`, { method: "POST", body: JSON.stringify({ reason: prompt("封禁原因", "违反社区规则") || "违反社区规则" }) });
        await loadUsers();
      });
    } catch (err) { root.innerHTML = `<div class="empty">${safeText(err.message)}</div>`; }
  }
  await loadUsers();
}

document.addEventListener("DOMContentLoaded", async () => {
  const page = document.body.dataset.page;
  if (page === "login") await initLoginPage();
  if (page === "register") await initRegisterPage();
  if (page === "forum") await initForumPage();
  if (page === "forgot") await initForgotPage();
  if (page === "reset") await initResetPage();
  if (page === "verify") await initVerifyPage();
  if (page === "admin") await initAdminPage();
});




