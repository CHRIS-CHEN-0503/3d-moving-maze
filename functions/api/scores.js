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

// The six maze levels in index.html (LEVELS ids). Unknown levels are refused so
// junk cannot crowd out real records; each level keeps its own top list.
const LEVEL_IDS = new Set(['indoor', 'field', 'cave', 'forest', 'mist', 'volcano']);
const PER_LEVEL = 100, MAX_SCORE = 20000;
const json = body => new Response(body, { headers: { 'content-type': 'application/json', ...CORS } });
function parseRecords(raw) {
  try { const value = JSON.parse(raw || '[]'); return Array.isArray(value) ? value : []; }
  catch (e) { return []; }
}

export async function onRequestGet({ env }) {
  if (!env.SCORES) return json('[]');
  try { return json(JSON.stringify(parseRecords(await env.SCORES.get('records')))); }
  catch (e) { return new Response('score store unavailable', { status: 503, headers: CORS }); }
}

export async function onRequestPost({ request, env }) {
  if (!env.SCORES) return new Response('KV binding "SCORES" not set', { status: 500, headers: CORS });
  // A record is a few hundred bytes; anything larger is never a real submission.
  if (Number(request.headers?.get?.('content-length') || 0) > 4096) return new Response('record too large', { status: 413, headers: CORS });
  let r;
  try { r = await request.json(); }
  catch (e) { return new Response('bad json', { status: 400, headers: CORS }); }
  if (!r || typeof r !== 'object') return new Response('bad record', { status: 400, headers: CORS });
  const rec = {
    name: String(r.name || '').replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, 20),
    char: String(r.char || '').replace(/[<>&"'\u0000-\u001f]/g, '').slice(0, 8),
    level: String(r.level || '').slice(0, 20),
    timeSec: Math.round(Math.max(0, Math.min(86400, Number(r.timeSec) || 0))),
    score: Math.round(Math.max(0, Math.min(MAX_SCORE, Number(r.score) || 0))),
    date: String(r.date || '').slice(0, 10),
  };
  // A finished maze always takes at least a second; a 0:00 entry is never real.
  if (!rec.name || !LEVEL_IDS.has(rec.level) || rec.timeSec < 1 || !/^\d{4}-\d{2}-\d{2}$/.test(rec.date)) return new Response('invalid record', { status: 400, headers: CORS });
  // The game scores max(100, 6000 − 15 s) plus 100 per star; a score no run could reach is clamped to that ceiling.
  rec.score = Math.min(rec.score, Math.max(100, 6000 - rec.timeSec * 15) + 3000);
  try {
    const arr = parseRecords(await env.SCORES.get('records'));
    arr.push(rec);
    arr.sort((a, b) => (Number(a.timeSec) || 0) - (Number(b.timeSec) || 0));
    const counts = {}, kept = arr.filter(item => (counts[item.level] = (counts[item.level] || 0) + 1) <= PER_LEVEL);
    await env.SCORES.put('records', JSON.stringify(kept));
  } catch (e) {
    // KV allows one write per key per second; report a retryable failure instead of a 500.
    return new Response('score store busy', { status: 503, headers: CORS });
  }
  return new Response('ok', { headers: CORS });
}
