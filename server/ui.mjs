/** Shared chrome for server-rendered pages (share replay + 404).
 *  Keep visually in sync with src/app.css (fal-inspired workspace). */

export function esc(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export const FONT_LINKS = `<link rel="preconnect" href="https://fonts.googleapis.com"/>
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin/>
<link href="https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,400;0,9..40,500;0,9..40,560;0,9..40,650;1,9..40,400&family=Syne:wght@600;700&display=swap" rel="stylesheet"/>`;

export const THEME_CSS = `
:root{
  --ink:#0a0a0a;--ink-soft:#2a2a2a;--muted:#5c6470;
  --line:rgba(10,10,10,.1);--line-strong:rgba(10,10,10,.18);
  --surface:rgba(255,255,255,.72);--surface-solid:#fff;
  --accent:#1ec8a5;--accent-soft:rgba(30,200,165,.14);--danger:#d7263d;
  --sky:#b8d4f0;--sky-2:#d7ebe3;--page-max:1080px;--radius:12px;
  --font-display:'Syne',sans-serif;--font-body:'DM Sans',sans-serif;
}
*,*::before,*::after{box-sizing:border-box}
html{min-height:100%}
body{
  margin:0;min-height:100%;color:var(--ink);font-family:var(--font-body);font-size:15px;line-height:1.5;
  -webkit-font-smoothing:antialiased;
  background:
    radial-gradient(ellipse 80% 50% at 10% -10%,rgba(255,230,80,.38),transparent 55%),
    radial-gradient(ellipse 55% 40% at 98% 8%,rgba(30,200,165,.28),transparent 50%),
    radial-gradient(ellipse 70% 60% at 80% 100%,rgba(80,150,220,.2),transparent 55%),
    linear-gradient(165deg,var(--sky) 0%,#e8f1fa 42%,var(--sky-2) 100%);
  background-attachment:fixed;
}
body::before{
  content:'';position:fixed;inset:0;pointer-events:none;z-index:0;opacity:.35;
  background-image:linear-gradient(rgba(10,10,10,.04) 1px,transparent 1px),linear-gradient(90deg,rgba(10,10,10,.04) 1px,transparent 1px);
  background-size:48px 48px;
  mask-image:radial-gradient(ellipse 80% 70% at 50% 30%,#000 20%,transparent 75%);
}
.shell{position:relative;z-index:1;min-height:100vh;display:flex;flex-direction:column}
.topbar{
  display:flex;align-items:center;justify-content:space-between;gap:16px;
  max-width:var(--page-max);width:100%;margin:0 auto;padding:18px 20px 8px;
}
.brand{display:inline-flex;align-items:center;gap:10px;text-decoration:none;color:var(--ink)}
.brand__mark{
  width:28px;height:28px;border-radius:8px;flex-shrink:0;
  background:conic-gradient(from 210deg,#ffe650,#1ec8a5,#4aa3e8,#ffe650);
  box-shadow:inset 0 0 0 2px rgba(255,255,255,.55);
}
.brand__name{font-family:var(--font-display);font-weight:700;font-size:1.15rem;letter-spacing:-.03em}
.topbar__status{
  display:inline-flex;align-items:center;gap:8px;font-size:.78rem;color:var(--muted);
  background:var(--surface);border:1px solid var(--line);backdrop-filter:blur(10px);
  padding:6px 12px;border-radius:8px;
}
.dot{width:8px;height:8px;border-radius:50%;background:#9ca3af;flex-shrink:0}
.dot.ok{background:#19c37d}
.dot.bad{background:var(--danger)}
.pulse{
  width:8px;height:8px;border-radius:50%;background:var(--accent);flex-shrink:0;
  box-shadow:0 0 0 0 rgba(30,200,165,.55);animation:ping 1.4s ease-out infinite;
}
@keyframes ping{0%{box-shadow:0 0 0 0 rgba(30,200,165,.55)}70%{box-shadow:0 0 0 8px rgba(30,200,165,0)}100%{box-shadow:0 0 0 0 rgba(30,200,165,0)}}
.workspace{
  flex:1;width:100%;max-width:var(--page-max);margin:0 auto;padding:8px 20px 40px;
  display:flex;flex-direction:column;gap:16px;min-width:0;
}
.stage{display:flex;flex-direction:column;gap:10px}
.stage__bar{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;min-width:0}
.stage-line{display:flex;align-items:center;gap:8px;font-size:.85rem;color:var(--muted);min-width:0}
.stage__frame{
  position:relative;border-radius:16px;padding:10px;background:var(--surface);
  border:1px solid var(--line);backdrop-filter:blur(14px);
  box-shadow:0 18px 50px rgba(20,40,80,.08);
  transition:border-color .25s ease,box-shadow .25s ease;
}
.stage__frame.active{
  border-color:rgba(30,200,165,.55);
  box-shadow:0 18px 50px rgba(20,40,80,.08),0 0 0 3px var(--accent-soft);
}
canvas.draw,canvas.replay{
  width:100%;max-width:100%;aspect-ratio:960/600;height:auto;display:block;
  background:#fff;border-radius:10px;border:1px solid var(--line);touch-action:none;
}
.canvas-actions,.actions{display:flex;gap:6px;flex-wrap:wrap}
.composer{
  display:flex;flex-direction:column;gap:10px;padding:16px;border-radius:16px;
  background:var(--surface-solid);border:1px solid var(--line-strong);
  box-shadow:0 12px 36px rgba(20,40,80,.07);
}
.composer__label{font-family:var(--font-display);font-size:.92rem;font-weight:650;letter-spacing:-.02em}
.composer__hint{font-size:.75rem;color:var(--muted);text-transform:uppercase;letter-spacing:.06em}
.meta{font-size:.88rem;color:var(--muted);line-height:1.5;overflow-wrap:break-word;margin:0}
.pill,.badge{
  display:inline-flex;align-items:center;font-size:.65rem;font-weight:650;letter-spacing:.04em;
  text-transform:uppercase;padding:2px 8px;border-radius:6px;background:rgba(10,10,10,.78);color:#fff;
}
.badge--done{background:#0f5f4d}
.badge--error{background:var(--danger)}
.badge--running{background:#a16207}
.btn{
  appearance:none;border:1px solid transparent;font-family:var(--font-body);font-size:.84rem;font-weight:560;
  padding:8px 14px;border-radius:8px;cursor:pointer;
  transition:background .15s ease,border-color .15s ease,transform .15s ease,opacity .15s ease;
  text-decoration:none;display:inline-flex;align-items:center;justify-content:center;color:inherit;
}
.btn:disabled{opacity:.4;cursor:default}
.btn--primary{background:var(--ink);color:#fff;padding:11px 20px;font-size:.9rem;letter-spacing:-.01em}
.btn--primary:not(:disabled):hover{background:var(--ink-soft);transform:translateY(-1px)}
.btn--ghost,.btn:not(.btn--primary){background:transparent;border-color:var(--line-strong);color:var(--ink-soft)}
.btn--ghost:not(:disabled):hover,.btn:not(.btn--primary):not(:disabled):hover{background:rgba(255,255,255,.7);border-color:var(--ink)}
.sharebar{display:flex;gap:8px;align-items:center;flex-wrap:wrap}
.sharebar input{
  flex:1 1 220px;min-width:0;padding:10px 12px;border:1px solid var(--line-strong);border-radius:10px;
  font:inherit;font-size:.84rem;background:#f7f9fc;color:var(--ink);outline:none;
}
.sharebar input:focus{border-color:var(--ink);background:#fff;box-shadow:0 0 0 3px rgba(10,10,10,.06)}
.hint{font-size:.8rem;color:var(--muted);line-height:1.5;margin:0;overflow-wrap:break-word}
.toast{margin:0;padding:10px 12px;border-radius:8px;font-size:.84rem;line-height:1.45}
.toast--info{background:var(--accent-soft);color:#0f5f4d}
.toast--error,.err{background:rgba(215,38,61,.1);color:#8f1024;border:none;border-radius:8px;padding:10px 12px;font-size:.84rem}
.foot{max-width:var(--page-max);width:100%;margin:0 auto;padding:8px 20px 24px;font-size:.75rem;color:var(--muted)}
.foot a{color:var(--ink)}
.empty-page{
  flex:1;display:flex;flex-direction:column;align-items:flex-start;justify-content:center;
  gap:14px;padding:48px 8px 64px;min-height:52vh;
}
.empty-page__code{
  font-family:var(--font-display);font-size:clamp(4rem,16vw,7.5rem);font-weight:700;
  letter-spacing:-.06em;line-height:.9;margin:0;color:var(--ink);
}
.empty-page__title{font-family:var(--font-display);font-size:1.45rem;font-weight:700;letter-spacing:-.03em;margin:0}
.empty-page__text{margin:0;color:var(--muted);max-width:36ch;font-size:.95rem}
.empty-page__actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:6px}
.path-chip{
  font-family:ui-monospace,Consolas,monospace;font-size:.82rem;padding:6px 10px;border-radius:8px;
  background:rgba(255,255,255,.65);border:1px solid var(--line);color:var(--ink-soft);overflow-wrap:anywhere;
}
@media(max-width:640px){
  .topbar,.workspace,.foot{padding-left:14px;padding-right:14px}
  .stage__frame{padding:6px;border-radius:12px}
  .composer{padding:12px}
  .actions .btn,.canvas-actions .btn{flex:1 1 auto}
}
@media(prefers-reduced-motion:reduce){*,*::before,*::after{animation:none!important;transition:none!important}}
`;

function documentShell({ title, headExtra = '', body }) {
  return `<!doctype html>
<html lang="id">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>${title}</title>
${FONT_LINKS}
${headExtra}
<style>${THEME_CSS}</style>
</head>
<body>
${body}
</body>
</html>`;
}

function topbar(statusHtml) {
  return `<header class="topbar">
  <a class="brand" href="/">
    <span class="brand__mark" aria-hidden="true"></span>
    <span class="brand__name">Drawing Agents</span>
  </a>
  <div class="topbar__status">${statusHtml}</div>
</header>`;
}

export function notFoundPage(pathname = '/') {
  const path = esc(pathname);
  const body = `<div class="shell">
  ${topbar('<span class="dot bad"></span><span>Tidak ditemukan</span>')}
  <main class="workspace">
    <div class="empty-page">
      <p class="empty-page__code">404</p>
      <h1 class="empty-page__title">Halaman tidak ditemukan</h1>
      <p class="empty-page__text">Tautan ini tidak mengarah ke kanvas atau gambar berbagi yang ada.</p>
      <span class="path-chip">${path}</span>
      <div class="empty-page__actions">
        <a class="btn btn--primary" href="/">Kembali ke kanvas</a>
      </div>
    </div>
  </main>
  <footer class="foot"><span>Hermes · Postgres · draw.corklab.xyz</span></footer>
</div>`;
  return documentShell({ title: '404 — Drawing Agents', body });
}

/** Independent share/replay page — same chrome as the SPA. */
export function sharePage({ id, title, og, origin, status, note }) {
  const safeId = esc(id);
  const shareUrl = `${esc(origin)}/r/${safeId}`;
  const body = `<div class="shell">
  ${topbar(`<span class="dot ok"></span><span>Pemutaran berbagi</span>`)}
  <main class="workspace">
    <section class="stage" aria-label="Kanvas berbagi">
      <div class="stage__bar">
        <div class="stage-line" id="stage">
          <span class="pulse" id="stagePulse" aria-hidden="true"></span>
          <span id="stageText">Memuat gambar…</span>
        </div>
        <div class="canvas-actions actions">
          <button class="btn btn--ghost" id="btnPause" disabled>Jeda</button>
          <button class="btn btn--ghost" id="btnReplay" disabled>Putar ulang</button>
          <button class="btn btn--ghost" id="btnDownload" disabled>Unduh PNG</button>
        </div>
      </div>
      <div class="stage__frame" id="frame">
        <canvas id="cv" class="draw replay" width="960" height="600" aria-label="replay canvas"></canvas>
      </div>
    </section>

    <section class="composer" aria-label="Detail berbagi">
      <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
        <span class="composer__label">Gambar berbagi</span>
        <span class="badge" id="badge">${esc(status || 'memuat…')}</span>
        <span class="composer__hint" id="rid">${safeId}</span>
      </div>
      <p class="meta" id="promptLine" style="display:none"></p>
      <div class="sharebar">
        <input id="shareInput" readonly value="${shareUrl}" aria-label="share link"/>
        <button class="btn btn--ghost" id="btnCopy">Salin tautan</button>
        <a class="btn btn--primary" href="/">Buka kanvas</a>
      </div>
      <p class="hint">Pemutaran pena demi pena — tanpa login. Hasil akhir sama dengan pratinjau tersimpan.</p>
      <div id="err" class="err" style="display:none"></div>
    </section>
  </main>
  <footer class="foot"><span>Drawing Agents</span> · <a href="/">draw.corklab.xyz</a></footer>
</div>
<script src="https://cdn.jsdelivr.net/npm/canvas-confetti@1.9.4/dist/confetti.browser.min.js"></script>
<script>
(function(){
  function celebrate(){
    if(window.matchMedia('(prefers-reduced-motion: reduce)').matches || !window.confetti) return;
    var colors=['#1ec8a5','#ffe650','#4aa3e8','#0a0a0a','#ffffff'];
    confetti({particleCount:70,spread:68,startVelocity:38,origin:{x:0.12,y:0.72},colors:colors,ticks:180});
    confetti({particleCount:70,spread:68,startVelocity:38,origin:{x:0.88,y:0.72},colors:colors,ticks:180});
    setTimeout(function(){ confetti({particleCount:90,spread:100,startVelocity:32,origin:{x:0.5,y:0.35},colors:colors,ticks:200}); },140);
  }
  function boom(){
    if(window.matchMedia('(prefers-reduced-motion: reduce)').matches || !window.confetti) return;
    var colors=['#d7263d','#8f1024','#ff6b6b','#2a2a2a','#f4a261'];
    confetti({particleCount:55,spread:360,startVelocity:48,decay:0.88,gravity:1.15,origin:{x:0.5,y:0.45},colors:colors,ticks:120,scalar:1.15});
    setTimeout(function(){ confetti({particleCount:35,spread:360,startVelocity:28,decay:0.9,origin:{x:0.5,y:0.48},colors:colors,ticks:90}); },90);
  }
  const CANVAS_W=960,CANVAS_H=600;
  const id=${JSON.stringify(id)};
  const cv=document.getElementById('cv');
  const ctx=cv.getContext('2d');
  const frame=document.getElementById('frame');
  const stageText=document.getElementById('stageText');
  const stagePulse=document.getElementById('stagePulse');
  const badge=document.getElementById('badge');
  const errBox=document.getElementById('err');
  const btnReplay=document.getElementById('btnReplay');
  const btnPause=document.getElementById('btnPause');
  const btnDownload=document.getElementById('btnDownload');
  const btnCopy=document.getElementById('btnCopy');
  const shareInput=document.getElementById('shareInput');
  const promptLine=document.getElementById('promptLine');
  let plan=null, imageReady=false;

  function setStage(t, spin){
    stageText.textContent=t;
    if(stagePulse) stagePulse.style.display = spin ? '' : 'none';
  }
  function setBadge(s){
    badge.textContent=s;
    badge.className='badge '+(s==='done'?'badge--done':s==='error'?'badge--error':(s==='running'||s==='rendering')?'badge--running':'');
  }
  function showErr(m){errBox.textContent=m; errBox.style.display='';}
  function clear(){ctx.fillStyle='#ffffff';ctx.fillRect(0,0,CANVAS_W,CANVAS_H)}
  function setActive(on){
    if(on){ frame.classList.add('active'); cv.classList.add('active'); }
    else { frame.classList.remove('active'); cv.classList.remove('active'); }
  }
  function strokeSegments(s){
    if(s.type==='line') return s.points.map(function(p){return Array.isArray(p)?{x:p[0],y:p[1]}:{x:p.x,y:p.y}});
    if(s.type==='circle'){var pts=[], steps=Math.max(12,Math.round((s.r*2*Math.PI)/9)); for(var i=0;i<=steps;i++){var a=(i/steps)*Math.PI*2; pts.push({x:s.cx+Math.cos(a)*s.r,y:s.cy+Math.sin(a)*s.r})} return pts}
    if(s.type==='rect') return [{x:s.x,y:s.y},{x:s.x+s.w,y:s.y},{x:s.x+s.w,y:s.y+s.h},{x:s.x,y:s.y+s.h},{x:s.x,y:s.y}];
    if(s.type==='text') return [{x:s.x,y:s.y}];
    return [];
  }
  function drawStrokeFull(s){
    ctx.strokeStyle=s.color; ctx.fillStyle=s.color; ctx.lineWidth=s.width||3; ctx.lineCap='round'; ctx.lineJoin='round';
    if(s.type==='line'){ctx.beginPath();ctx.moveTo(s.points[0][0],s.points[0][1]);for(var i=0;i<s.points.length;i++)ctx.lineTo(s.points[i][0],s.points[i][1]);ctx.stroke()}
    else if(s.type==='circle'){ctx.beginPath();ctx.arc(s.cx,s.cy,s.r,0,Math.PI*2); if(s.fill) ctx.fill(); else ctx.stroke()}
    else if(s.type==='rect'){ctx.beginPath();ctx.rect(s.x,s.y,s.w,s.h); if(s.fill) ctx.fill(); else ctx.stroke()}
    else if(s.type==='text'){ctx.font=(s.size||24)+'px system-ui,sans-serif'; ctx.fillText(s.text,s.x,s.y)}
  }
  function drawStrokePartial(s,pts,f){
    ctx.strokeStyle=s.color; ctx.lineWidth=s.width||3; ctx.lineCap='round'; ctx.lineJoin='round';
    if(!pts.length) return;
    if(s.type==='text'){ctx.fillStyle=s.color; ctx.font=(s.size||24)+'px system-ui,sans-serif'; ctx.fillText(s.text.slice(0,Math.round(s.text.length*f)),s.x,s.y); return}
    var n=Math.max(1,Math.round(pts.length*f)); if(n<2) return;
    ctx.beginPath(); ctx.moveTo(pts[0].x,pts[0].y); for(var i=1;i<n;i++) ctx.lineTo(pts[i].x,pts[i].y); ctx.stroke();
  }
  function finalizeStroke(s){
    if(s.type==='circle'||s.type==='rect'){
      ctx.strokeStyle=s.color; ctx.fillStyle=s.color; ctx.lineWidth=s.width||3; ctx.lineCap='round'; ctx.lineJoin='round';
      ctx.beginPath(); if(s.type==='circle') ctx.arc(s.cx,s.cy,s.r,0,Math.PI*2); else ctx.rect(s.x,s.y,s.w,s.h);
      if(s.fill) ctx.fill(); else ctx.stroke();
    }
  }
  function renderPlanFull(pl){ clear(); for(var i=0;i<pl.strokes.length;i++) drawStrokeFull(pl.strokes[i]); }

  var replaying=false, paused=false, strokeIdx=0, live=null, timer=null, lastT=0, done=false;

  function updateProgress(f){ setStage('Menggambar… '+Math.round(f*100)+'%', true); }
  function startReplay(){
    if(!plan) return;
    cancelAnimationFrame(timer);
    replaying=true; paused=false; strokeIdx=0; live=null; done=false;
    btnReplay.disabled=true; btnPause.disabled=false; btnPause.textContent='Jeda';
    setActive(true);
    clear(); setStage('Menggambar… 0%', true); setBadge('running');
    lastT=performance.now();
    timer=requestAnimationFrame(frame);
  }
  function frame(ts){
    if(!replaying) return;
    if(paused){ lastT=ts; timer=requestAnimationFrame(frame); return; }
    var strokes=plan.strokes;
    if(!live){
      while(strokeIdx<strokes.length){
        var s=strokes[strokeIdx]; var pts=strokeSegments(s);
        if(pts.length){ live={s:s,pts:pts,i:0,t:0}; break; }
        strokeIdx++;
      }
      if(!live){ finish(true); return; }
    }
    var dt=Math.min(50, ts-lastT); lastT=ts; live.t+=dt;
    var dur=Math.min(2200, Math.max(350, live.pts.length*12));
    var f=Math.min(1, live.t/dur);
    var headF=Math.min(1, f+0.12);
    if(live.s.type==='line'||live.s.type==='circle'||live.s.type==='rect'){
      drawStrokePartial(live.s, live.pts, f);
      var n=Math.max(1, Math.round(live.pts.length*headF));
      if(n < live.pts.length){
        var tip=live.pts[Math.min(live.pts.length-1,n)];
        ctx.fillStyle=live.s.color; ctx.beginPath(); ctx.arc(tip.x,tip.y, Math.max(2.5,(live.s.width||3)*0.9),0,Math.PI*2); ctx.fill();
      }
    } else if(live.s.type==='text'){
      ctx.fillStyle=live.s.color; ctx.font=(live.s.size||24)+'px system-ui,sans-serif';
      ctx.fillText(live.s.text.slice(0, Math.round(live.s.text.length*f)), live.s.x, live.s.y);
    }
    if(f>=1){
      finalizeStroke(live.s);
      strokeIdx++; live=null;
      updateProgress(strokeIdx/strokes.length);
    }
    timer=requestAnimationFrame(frame);
  }
  async function finish(ok){
    done=true; replaying=false; live=null; cancelAnimationFrame(timer); timer=null;
    setActive(false);
    if(ok && plan){
      try{ renderPlanFull(plan); }catch(e){}
      try{
        var img=new Image(); img.decoding='sync'; img.src='/p/'+id+'.png?'+Date.now();
        await img.decode();
        clear(); ctx.drawImage(img,0,0,CANVAS_W,CANVAS_H);
        setStage('Selesai — menampilkan pratinjau tersimpan yang identik.', false);
      }catch(e){
        setStage('Selesai — menampilkan hasil render penuh.', false);
      }
      setBadge('done');
      btnReplay.disabled=false; btnPause.disabled=true; btnPause.textContent='Jeda';
      btnDownload.disabled=false; imageReady=true;
      celebrate();
    } else {
      setStage('Replay dihentikan.', false);
      btnReplay.disabled=false; btnPause.disabled=true;
    }
  }

  btnReplay.addEventListener('click', startReplay);
  btnPause.addEventListener('click', function(){
    if(!replaying || done) return;
    paused=!paused; btnPause.textContent = paused ? 'Lanjut' : 'Jeda';
    setStage(paused ? 'Dijeda — klik Lanjut' : 'Menggambar…', !paused);
  });
  btnDownload.addEventListener('click', function(){
    var a=document.createElement('a'); a.href=cv.toDataURL('image/png'); a.download='drawing-'+id+'.png'; a.click();
  });
  btnCopy.addEventListener('click', async function(){
    try{ await navigator.clipboard.writeText(shareInput.value); btnCopy.textContent='Tersalin!'; setTimeout(function(){btnCopy.textContent='Salin tautan'},1500);}catch(e){ shareInput.select(); document.execCommand('copy');}
  });
  shareInput.addEventListener('click', function(){ this.select(); });

  clear();
  fetch('/api/r/'+id).then(function(r){
    if(!r.ok) throw new Error('Gambar tidak ditemukan ('+r.status+') — tautan salah atau sudah dihapus.');
    return r.json();
  }).then(function(j){
    if(j.note){ promptLine.textContent='Perintah: '+j.note; promptLine.style.display=''; document.title = j.note.slice(0,80)+' — Drawing Agents'; }
    setBadge(j.status||'');
    var ds=(j.stages||[]).find(function(s){return s.key==='draw'});
    if(!ds || !ds.plan || !ds.plan.strokes){ throw new Error('Run ini tidak punya rencana goresan yang bisa diputar ulang. Status: '+(j.status||'')); }
    if(j.status==='error'){ showErr('Run ini gagal: '+(j.error||'')); }
    plan=ds.plan;
    btnReplay.disabled=false; btnDownload.disabled=false;
    setStage('Memulai pemutaran…', true);
    startReplay();
  }).catch(function(e){
    setStage('Gagal memuat.', false);
    setBadge('error');
    showErr(e.message||String(e));
    btnReplay.disabled=true;
    boom();
  });
})();
</script>`;
  return documentShell({ title, headExtra: og, body });
}
