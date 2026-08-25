export const SECURITY_HEADERS = {
  "x-content-type-options": "nosniff",
  "referrer-policy": "strict-origin-when-cross-origin",
  "permissions-policy": "camera=(), microphone=(), geolocation=()",
};

export const json = (data, status = 200, extraHeaders = {}) => new Response(JSON.stringify(data), {
  status,
  headers: { "content-type": "application/json; charset=utf-8", ...SECURITY_HEADERS, ...extraHeaders },
});

export async function readJson(request) { try { return await request.json(); } catch { return null; } }
export function uid(prefix = "id") { const b = new Uint8Array(16); crypto.getRandomValues(b); return `${prefix}_${Date.now().toString(36)}_${[...b].map(x=>x.toString(16).padStart(2,"0")).join("")}`; }
export function now() { return Date.now(); }
export function validUsername(username) { return /^[\u4e00-\u9fa5A-Za-z0-9_-]{2,24}$/.test(username || ""); }
export function validEmail(email) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email || ""); }
export function getClientIp(request) { return request.headers.get("cf-connecting-ip") || request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown"; }
export function getCookie(request, name) { const c = request.headers.get("cookie") || ""; const p = c.split(";").map(x=>x.trim()).find(x=>x.startsWith(`${name}=`)); return p ? decodeURIComponent(p.slice(name.length + 1)) : ""; }
export function sessionCookie(token, maxAgeSeconds = 60 * 60 * 24 * 30, secure = true) { const s = secure ? "; Secure" : ""; return `cf_session=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax${s}; Max-Age=${maxAgeSeconds}`; }
export function clearSessionCookie(secure = true) { const s = secure ? "; Secure" : ""; return `cf_session=; Path=/; HttpOnly; SameSite=Lax${s}; Max-Age=0`; }
function bytesToHex(bytes) { return [...new Uint8Array(bytes)].map(b=>b.toString(16).padStart(2,"0")).join(""); }
function hexToBytes(hex) { const out = new Uint8Array(String(hex||"").length/2); for(let i=0;i<out.length;i++) out[i]=parseInt(String(hex).slice(i*2,i*2+2),16); return out; }
export async function sha256Hex(input) { return bytesToHex(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input))); }
export async function pbkdf2Hex(password, salt, iterations = 100000) { const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]); return bytesToHex(await crypto.subtle.deriveBits({ name:"PBKDF2", hash:"SHA-256", salt:new TextEncoder().encode(salt), iterations }, key, 256)); }
export async function hashPassword(password, salt) { const iterations = 100000; return `pbkdf2_sha256$${iterations}$${await pbkdf2Hex(password, salt, iterations)}`; }
export function timingSafeEqualHex(a,b){ const aa=hexToBytes(a), bb=hexToBytes(b); if(aa.length!==bb.length)return false; let d=0; for(let i=0;i<aa.length;i++) d|=aa[i]^bb[i]; return d===0; }
export async function verifyPassword(password, salt, storedHash) { if(String(storedHash||"").startsWith("pbkdf2_sha256$")){ const [,i,d]=storedHash.split("$"); const iter=Number(i||100000); if(iter>100000) return false; return timingSafeEqualHex(await pbkdf2Hex(password,salt,iter),d); } return timingSafeEqualHex(await sha256Hex(`${salt}:${password}:cloudforum-server-v1`), storedHash); }
export async function cleanupExpiredSessions(env) { await env.FORUM_DB.prepare("DELETE FROM sessions WHERE expires_at <= ?").bind(now()).run(); }
export function isAdminUsername(env, username){ return String(env.ADMIN_USERNAMES||"admin").split(",").map(x=>x.trim().toLowerCase()).includes(String(username||"").toLowerCase()); }
export function appBaseUrl(env, request){ return env.APP_BASE_URL || new URL(request.url).origin; }

export function makeEmailCode() {
  const b = new Uint32Array(1);
  crypto.getRandomValues(b);
  return String(b[0] % 1000000).padStart(6, "0");
}

export function normalizeCode(code) {
  return String(code || "").split("").filter(ch => ch >= "0" && ch <= "9").join("").slice(0, 6);
}

export async function emailCodeHash(email, code) {
  return sha256Hex(`register-email-code:${String(email || "").toLowerCase()}:${String(code || "")}:zyrax-v1`);
}

export async function ensureRegisterCodes(env) {
  await env.FORUM_DB.prepare("CREATE TABLE IF NOT EXISTS register_email_codes (id TEXT PRIMARY KEY, email TEXT NOT NULL COLLATE NOCASE, code_hash TEXT NOT NULL, attempt_count INTEGER NOT NULL DEFAULT 0, created_at INTEGER NOT NULL, expires_at INTEGER NOT NULL, used_at INTEGER, ip_hash TEXT)").run();
  await env.FORUM_DB.prepare("CREATE INDEX IF NOT EXISTS idx_register_email_codes_email ON register_email_codes(email, created_at DESC)").run();
  await env.FORUM_DB.prepare("CREATE INDEX IF NOT EXISTS idx_register_email_codes_ip ON register_email_codes(ip_hash, created_at DESC)").run();
}

export async function sendMail(env, { to, subject, text }) {
  if (env.RESEND_API_KEY && env.MAIL_FROM) {
    const r = await fetch("https://api.resend.com/emails", { method:"POST", headers:{ authorization:`Bearer ${env.RESEND_API_KEY}`, "content-type":"application/json" }, body: JSON.stringify({ from: env.MAIL_FROM, to, subject, text }) });
    return { sent: r.ok, provider: "resend", status: r.status };
  }
  console.log(`[CloudForum mail dev]\nTO: ${to}\nSUBJECT: ${subject}\n${text}`);
  return { sent: false, provider: "dev-log" };
}

export async function getCurrentUser(env, request) {
  const token = getCookie(request, "cf_session");
  if (!token) return null;
  const row = await env.FORUM_DB.prepare(`SELECT users.id, users.username, users.email, users.email_verified, users.role, users.banned_at, users.banned_reason, users.created_at FROM sessions JOIN users ON users.id=sessions.user_id WHERE sessions.token=? AND sessions.expires_at>?`).bind(token, now()).first();
  return row || null;
}
export async function requireUser(env, request, options = {}) { const user = await getCurrentUser(env, request); if(!user) return { error: json({ error:"UNAUTHENTICATED", message:"请先登录。" },401) }; if(user.banned_at) return { error: json({ error:"BANNED", message:`账号已封禁：${user.banned_reason||"未填写原因"}` },403) }; return { user }; }
export async function requireAdmin(env, request){ const auth=await requireUser(env,request); if(auth.error)return auth; if(auth.user.role!=="admin") return { error: json({ error:"FORBIDDEN", message:"需要管理员权限。" },403) }; return auth; }
export async function checkLoginRateLimit(env,key,windowMs=15*60*1000,maxAttempts=10){ const since=now()-windowMs; await env.FORUM_DB.prepare("DELETE FROM login_attempts WHERE created_at < ?").bind(since).run(); const row=await env.FORUM_DB.prepare("SELECT COUNT(*) count FROM login_attempts WHERE attempt_key=? AND created_at>=?").bind(key,since).first(); return Number(row?.count||0)<maxAttempts; }
export async function recordLoginAttempt(env,key){ await env.FORUM_DB.prepare("INSERT INTO login_attempts (id, attempt_key, created_at) VALUES (?, ?, ?)").bind(uid("la"),key,now()).run(); }
export async function clearLoginAttempts(env,key){ await env.FORUM_DB.prepare("DELETE FROM login_attempts WHERE attempt_key=?").bind(key).run(); }
export async function attachCounts(env, posts, currentUserId="") { if(!posts.length)return []; const ids=posts.map(p=>p.id), ph=ids.map(()=>"?").join(","); const comments=await env.FORUM_DB.prepare(`SELECT post_id, COUNT(*) count FROM comments WHERE post_id IN (${ph}) GROUP BY post_id`).bind(...ids).all(); const likes=await env.FORUM_DB.prepare(`SELECT post_id, COUNT(*) count FROM post_likes WHERE post_id IN (${ph}) GROUP BY post_id`).bind(...ids).all(); const liked=currentUserId?await env.FORUM_DB.prepare(`SELECT post_id FROM post_likes WHERE user_id=? AND post_id IN (${ph})`).bind(currentUserId,...ids).all():{results:[]}; const cm=new Map((comments.results||[]).map(r=>[r.post_id,Number(r.count)])); const lm=new Map((likes.results||[]).map(r=>[r.post_id,Number(r.count)])); const ls=new Set((liked.results||[]).map(r=>r.post_id)); return posts.map(p=>({...p, commentsCount:cm.get(p.id)||0, likesCount:lm.get(p.id)||0, likedByMe:ls.has(p.id)})); }



