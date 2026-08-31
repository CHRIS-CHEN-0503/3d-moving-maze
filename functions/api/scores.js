// Cloudflare Pages Function：3D迷宮分數牆 API
// 部署到 Cloudflare Pages 後，在專案設定 → Bindings 綁定一個 KV namespace，
// 變數名稱取為 SCORES，分數牆就會自動變成雲端共享（遊戲會自動偵測 /api/scores）。
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export async function onRequestOptions() {
  return new Response(null, { headers: CORS });
}

export async function onRequestGet({ env }) {
  if (!env.SCORES) return new Response('[]', { headers: { 'content-type': 'application/json', ...CORS } });
  const raw = await env.SCORES.get('records');
  return new Response(raw || '[]', { headers: { 'content-type': 'application/json', ...CORS } });
}

export async function onRequestPost({ request, env }) {
  if (!env.SCORES) return new Response('KV binding "SCORES" not set', { status: 500, headers: CORS });
  let r;
  try { r = await request.json(); }
  catch (e) { return new Response('bad json', { status: 400, headers: CORS }); }
  const rec = {
    name: String(r.name || '').slice(0, 20),
    char: String(r.char || '').slice(0, 8),
    level: String(r.level || '').slice(0, 20),
    timeSec: Math.max(0, Math.min(86400, Number(r.timeSec) || 0)),
    score: Math.max(0, Math.min(999999, Number(r.score) || 0)),
    date: String(r.date || '').slice(0, 10),
  };
  if (!rec.name || !rec.level) return new Response('missing fields', { status: 400, headers: CORS });
  const raw = await env.SCORES.get('records');
  const arr = raw ? JSON.parse(raw) : [];
  arr.push(rec);
  arr.sort((a, b) => a.timeSec - b.timeSec);
  await env.SCORES.put('records', JSON.stringify(arr.slice(0, 500)));
  return new Response('ok', { headers: CORS });
}
