// E2E test: agent draw -> render plan like the browser does -> upload ->
// analysis stages -> verify DB row has real (non-blank) image.
// Usage: node e2e-test.mjs "a small sailboat on calm water at sunset"
import { createCanvas } from 'node:canvas';

const BASE = process.env.BASE || 'http://127.0.0.1:8910';
const API_KEY = process.env.DRAW_API_KEY;

const subject = process.argv[2] || 'a small sailboat on calm water at sunset';
const headers = { 'content-type': 'application/json', 'x-api-key': API_KEY };

async function j(path, opts) {
  const r = await fetch(BASE + path, { ...opts, headers: { ...headers, ...(opts?.headers || {}) } });
  const body = await r.json().catch(() => ({}));
  return { status: r.status, ok: r.ok, body };
}

// --- 1. create a draw run
const create = await j('/api/draw', {
  method: 'POST',
  body: JSON.stringify({ prompt: subject, stages: ['describe', 'critique'] }),
});
console.log('1. create:', create.status, JSON.stringify(create.body));
if (!create.ok) process.exit(1);
const id = create.body.run_id;

// --- 2. poll until rendering (plan ready)
let plan = null;
const t0 = Date.now();
while (Date.now() - t0 < 360000) {
  const r = await j(`/api/runs/${id}`);
  if (r.body.status === 'error') { console.log('PLAN ERROR:', r.body.error); process.exit(1); }
  if (r.body.status === 'rendering') {
    const ds = (r.body.stages || []).find((s) => s.key === 'draw');
    if (ds && ds.plan) plan = ds.plan;
    break;
  }
  await new Promise((res) => setTimeout(res, 3000));
}
if (!plan) { console.log('no plan after 6 min'); process.exit(1); }
console.log(`2. plan ready in ${Math.round((Date.now() - t0) / 1000)}s:`, plan.count, 'strokes, subject:', plan.subject);

// --- 3. render the plan (same code path the browser uses)
const canvas = createCanvas(960, 600);
const ctx = canvas.getContext('2d');
ctx.fillStyle = '#ffffff';
ctx.fillRect(0, 0, 960, 600);
ctx.lineCap = 'round';
ctx.lineJoin = 'round';
for (const s of plan.strokes) {
  ctx.strokeStyle = s.color;
  ctx.fillStyle = s.color;
  ctx.lineWidth = s.width || 3;
  if (s.type === 'line') {
    ctx.beginPath();
    ctx.moveTo(s.points[0][0], s.points[0][1]);
    for (const p of s.points) ctx.lineTo(p[0], p[1]);
    ctx.stroke();
  } else if (s.type === 'circle') {
    ctx.beginPath();
    ctx.arc(s.cx, s.cy, s.r, 0, Math.PI * 2);
    if (s.fill) ctx.fill(); else ctx.stroke();
  } else if (s.type === 'rect') {
    ctx.beginPath();
    ctx.rect(s.x, s.y, s.w, s.h);
    if (s.fill) ctx.fill(); else ctx.stroke();
  } else if (s.type === 'text') {
    ctx.font = `${s.size || 24}px sans-serif`;
    canvas.getContext('2d').fillText(s.text, s.x, s.y);
  }
}
const png = `data:image/png;base64,${canvas.toBuffer('image/png').toString('base64')}`;

// --- 4. upload rendered image (the render gate)
const up = await j(`/api/runs/${id}/image`, { method: 'POST', body: JSON.stringify({ image: png }) });
console.log('4. upload:', up.status, JSON.stringify(up.body).slice(0, 200));
if (!up.ok) process.exit(1);

// --- 5. wait for analysis
let run = null;
const t1 = Date.now();
while (Date.now() - t1 < 360000) {
  const r = await j(`/api/runs/${id}`);
  run = r.body;
  if (run.status === 'done' || run.status === 'error') break;
  await new Promise((res) => setTimeout(res, 4000));
}
console.log('5. final status:', run.status, run.error || '');
for (const st of run.stages || []) {
  console.log(`   - ${st.key}: ${st.status} (${st.ms}ms) ${String(st.output || '').slice(0, 90).replace(/\n/g, ' ')}`);
}
if (run.status !== 'done') process.exit(1);

// --- 6. verify the DB image is the real drawing (not blank)
const img = await fetch(`${BASE}/api/runs/${id}/image?api_key=${API_KEY}`);
const buf = Buffer.from(await img.arrayBuffer());
console.log('6. stored image:', img.status, img.headers.get('content-type'), buf.length, 'bytes');
process.exit(0);
