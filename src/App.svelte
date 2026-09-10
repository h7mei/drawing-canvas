<script>
  import { onMount } from 'svelte'

  let canvas
  let ctx

  // ---- agent-only drawing ----
  // The human types a prompt; a Hermes agent plans vector strokes; this canvas
  // replays them with a pen that visibly draws itself. No manual drawing.
  const CANVAS_W = 960
  const CANVAS_H = 600

  let replaying = false
  let replayJob = null // current run { id, plan:{strokes}, status }
  let replayTimer = null
  let strokeIdx = 0
  let live = null // in-flight stroke animation state
  let lastT = 0
  let paused = false
  let replayDone = false

  // ---- Hermes pipeline (VITE_DRAW_API_KEY baked from .env at build time) ----
  let apiKey = import.meta.env.VITE_DRAW_API_KEY || ''
  let availableStages = []
  let analysisKeys = ['critique'] // stages that run after the drawing is rendered
  let drawingPrompt = ''
  let jobError = ''
  let jobMsg = ''
  let health = null

  function toggleStage(key) {
    analysisKeys = analysisKeys.includes(key)
      ? analysisKeys.filter((k) => k !== key)
      : [...analysisKeys, key]
  }

  // ---- run history (persisted in Postgres on this machine) ----
  let history = []
  let historyError = ''
  let expandedRun = null
  let deleting = ''
  // ---- share mode: arriving via /r/<id> auto-replays that run publicly ----
  let shareRunId = null
  let shareLoaded = false

  function shareUrl(id) {
    return `${location.origin}/r/${id}`
  }

  async function copyShare(id) {
    const u = shareUrl(id)
    try {
      await navigator.clipboard.writeText(u)
      jobMsg = 'Link disalin — bagikan tautannya, penerima bisa memutar ulang gambarnya.'
    } catch {
      jobMsg = `Salin tautan ini: ${u}`
    }
  }

  async function loadShare(id) {
    // public endpoint — no api key needed
    const r = await fetch(`/api/r/${id}`).catch(() => null)
    if (!r || !r.ok) {
      jobError = 'Gambar tidak ditemukan — tautan mungkin salah atau sudah dihapus.'
      shareLoaded = true
      return
    }
    const j = await r.json()
    const ds = (j.stages || []).find((s) => s.key === 'draw')
    if (ds && ds.plan && ds.plan.strokes) {
      jobMsg = 'Memutar ulang gambar dari tautan…'
      startReplay({ id: j.id, plan: ds.plan, replayOnly: true })
    } else {
      jobError = 'Run ini tidak punya rencana goresan yang bisa diputar ulang.'
    }
    shareLoaded = true
  }

  async function api(path, opts = {}) {
    const headers = { ...(opts.headers || {}), 'x-api-key': apiKey.trim() }
    return fetch(path, { ...opts, headers })
  }

  async function boot() {
    try {
      // API key must come from VITE_DRAW_API_KEY at build time — /api/config
      // no longer returns secrets.
      const h = await fetch('/api/health')
      if (h.ok) health = await h.json()
      const r = await fetch('/api/stages')
      if (r.ok) {
        const j = await r.json()
        availableStages = (j.stages || []).filter((s) => s.analysis)
      }
      await loadHistory()
    } catch {
      // backend unreachable — UI shows connecting state
    }
  }

  // ================= canvas =================

  function clearCanvas() {
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H)
  }

  function setupCanvas() {
    // Fixed internal resolution; CSS scales. Canvas is agent-driven only.
    if (canvas.width !== CANVAS_W || canvas.height !== CANVAS_H) {
      const img = ctx.getImageData(0, 0, canvas.width, canvas.height)
      canvas.width = CANVAS_W
      canvas.height = CANVAS_H
      ctx.putImageData(img, 0, 0)
    }
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
  }

  // One stroke's full geometry, split into incremental segments the replay
  // can draw progressively (so the pen visibly travels along the shape).
  function strokeSegments(s) {
    if (s.type === 'line') {
      // Server sends points as [x, y] arrays — normalize every point to {x, y}.
      // (Spreading an array into {...p} made {0:x,1:y}, silently dropping each
      // line's first segment in the animated render.)
      return s.points.map((p) => (Array.isArray(p) ? { x: p[0], y: p[1] } : { x: p.x, y: p.y }))
    }
    if (s.type === 'circle') {
      const pts = []
      const steps = Math.max(12, Math.round((s.r * 2 * Math.PI) / 9))
      for (let i = 0; i <= steps; i++) {
        const a = (i / steps) * Math.PI * 2
        pts.push({ x: s.cx + Math.cos(a) * s.r, y: s.cy + Math.sin(a) * s.r })
      }
      return pts
    }
    if (s.type === 'rect') {
      return [
        { x: s.x, y: s.y },
        { x: s.x + s.w, y: s.y },
        { x: s.x + s.w, y: s.y + s.h },
        { x: s.x, y: s.y + s.h },
        { x: s.x, y: s.y },
      ]
    }
    if (s.type === 'text') {
      // Text strokes in as a single small tick at its anchor.
      return [{ x: s.x, y: s.y }]
    }
    return []
  }

  function drawStrokeFull(s) {
    ctx.strokeStyle = s.color
    ctx.fillStyle = s.color
    ctx.lineWidth = s.width || 3
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    if (s.type === 'line') {
      ctx.beginPath()
      ctx.moveTo(s.points[0][0], s.points[0][1])
      for (const p of s.points) ctx.lineTo(p[0], p[1])
      ctx.stroke()
    } else if (s.type === 'circle') {
      ctx.beginPath()
      ctx.arc(s.cx, s.cy, s.r, 0, Math.PI * 2)
      if (s.fill) ctx.fill()
      else ctx.stroke()
    } else if (s.type === 'rect') {
      ctx.beginPath()
      ctx.rect(s.x, s.y, s.w, s.h)
      if (s.fill) ctx.fill()
      else ctx.stroke()
    } else if (s.type === 'text') {
      ctx.font = `${s.size || 24}px system-ui, sans-serif`
      ctx.fillText(s.text, s.x, s.y)
    }
  }

  // Progressive draw of one stroke up to fraction f of its path.
  function drawStrokePartial(s, pts, f) {
    ctx.strokeStyle = s.color
    ctx.lineWidth = s.width || 3
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    if (pts.length === 0) return
    if (s.type === 'text') {
      ctx.fillStyle = s.color
      ctx.font = `${s.size || 24}px system-ui, sans-serif`
      ctx.fillText(s.text, s.x, s.y)
      return
    }
    if (s.type === 'line' || s.type === 'circle' || s.type === 'rect') {
      const n = Math.max(1, Math.round(pts.length * f))
      if (n < 2) return
      ctx.beginPath()
      ctx.moveTo(pts[0].x, pts[0].y)
      for (let i = 1; i < n; i++) ctx.lineTo(pts[i].x, pts[i].y)
      ctx.stroke()
      return
    }
  }

  function finalizeStroke(s) {
    // Match drawStrokeFull exactly (fill vs outline) so the animated stroke
    // lands where the deterministic full render puts it.
    if (s.type === 'circle' || s.type === 'rect') {
      ctx.strokeStyle = s.color
      ctx.fillStyle = s.color
      ctx.lineWidth = s.width || 3
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'
      ctx.beginPath()
      if (s.type === 'circle') ctx.arc(s.cx, s.cy, s.r, 0, Math.PI * 2)
      else ctx.rect(s.x, s.y, s.w, s.h)
      if (s.fill) ctx.fill()
      else ctx.stroke()
    }
  }

  // Deterministic full render of a plan — the single source of truth for what
  // a finished drawing looks like. The upload and the post-replay canvas both
  // go through this, so the on-screen finished canvas always matches the
  // saved preview in the gallery.
  function renderPlanFull(plan) {
    clearCanvas()
    for (const s of plan.strokes || []) drawStrokeFull(s)
  }

  // ================= replay engine =================

  function replayFrame(ts) {
    if (!replayJob || !replaying) return
    if (paused) {
      lastT = ts
      replayTimer = requestAnimationFrame(replayFrame)
      return
    }
    const plan = replayJob.plan
    const strokes = plan.strokes
    if (!live) {
      // pick next stroke
      while (strokeIdx < strokes.length) {
        const s = strokes[strokeIdx]
        const pts = strokeSegments(s)
        if (pts.length) {
          live = { s, pts, i: 0, t: 0 }
          break
        }
        strokeIdx++ // skip malformed / empty
      }
      if (!live) {
        endReplay(true)
        return
      }
    }
    const dt = Math.min(50, ts - lastT)
    lastT = ts
    live.t += dt
    // speed: full stroke in 350-900ms scaled by segment count
    const dur = Math.min(2200, Math.max(350, live.pts.length * 12))
    const f = Math.min(1, live.t / dur)
    // progressive ink: pen tip visible ahead of the drawn path
    const headF = Math.min(1, f + 0.12)
    if (live.s.type === 'line' || live.s.type === 'circle' || live.s.type === 'rect') {
      drawStrokePartial(live.s, live.pts, f)
      const n = Math.max(1, Math.round(live.pts.length * headF))
      if (n < live.pts.length && n < live.pts.length) {
        const tip = live.pts[Math.min(live.pts.length - 1, n)]
        ctx.fillStyle = live.s.color
        ctx.beginPath()
        ctx.arc(tip.x, tip.y, Math.max(2.5, (live.s.width || 3) * 0.9), 0, Math.PI * 2)
        ctx.fill()
      }
    } else if (live.s.type === 'text') {
      ctx.fillStyle = live.s.color
      ctx.font = `${live.s.size || 24}px system-ui, sans-serif`
      const shown = live.s.text.slice(0, Math.round(live.s.text.length * f))
      ctx.fillText(shown, live.s.x, live.s.y)
    }
    if (f >= 1) {
      finalizeStroke(live.s) // close circle/rect outlines cleanly
      strokeIdx++
      live = null
      updateProgress(strokeIdx / strokes.length)
    }
    replayTimer = requestAnimationFrame(replayFrame)
  }

  function updateProgress(f) {
    jobMsg = `Agent drawing… ${Math.round(f * 100)}%`
  }

  function startReplay(run) {
    cancelAnimationFrame(replayTimer)
    replayJob = run
    replaying = true
    paused = false
    strokeIdx = 0
    live = null
    replayDone = false
    clearCanvas()
    jobMsg = 'Agent drawing… 0%'
    lastT = performance.now()
    replayTimer = requestAnimationFrame(replayFrame)
  }

  function stopReplay() {
    cancelAnimationFrame(replayTimer)
    replaying = false
    paused = false
    live = null
    replayTimer = null
  }

  function togglePause() {
    if (!replaying || replayDone) return
    paused = !paused
    jobMsg = paused ? 'Agent paused — click Resume' : 'Agent drawing…'
  }

  function endReplay(complete) {
    replayDone = true
    replaying = false
    live = null
    cancelAnimationFrame(replayTimer)
    replayTimer = null
    if (complete) {
      // Snap to the exact full render first: wipes pen-tip residue and any
      // animation approximations, so the canvas === the saved preview.
      try {
        if (replayJob && replayJob.plan) renderPlanFull(replayJob.plan)
      } catch {
        // keep the last animated frame if the snap fails
      }
      jobMsg = 'Agent finished drawing — sending to database…'
      // upload the finished agent-drawn PNG; server gates on this
      const png = canvas.toDataURL('image/png')
      submitRendered(png)
    } else {
      jobMsg = 'Replay stopped'
    }
  }

  async function submitRendered(png) {
    if (!replayJob || !apiKey.trim()) return
    // History replays just re-animate a saved plan — then pin the canvas to
    // the exact stored PNG so the finished canvas === the gallery preview.
    // (Old previews were rendered by an earlier engine, so a pure re-render
    // can differ by a few segments/fills — the database image is the truth.)
    if (replayJob.replayOnly) {
      jobMsg = 'Replay finished — loading the exact saved preview…'
      try {
        const img = new Image()
        img.decoding = 'sync'
        img.src = imgFor(replayJob.id) + `&t=${Date.now()}`
        await img.decode()
        clearCanvas()
        ctx.drawImage(img, 0, 0, CANVAS_W, CANVAS_H)
        jobMsg = 'Replay finished — now showing the exact saved preview from the database.'
      } catch {
        jobMsg = 'Replay finished — the saved drawing is untouched in the database.'
      }
      return
    }
    const r = await fetch(`/api/runs/${replayJob.id}/image`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': apiKey.trim() },
      body: JSON.stringify({ image: png }),
    }).catch(() => null)
    const j = r ? await r.json().catch(() => ({})) : {}
    if (!r || !r.ok) {
      jobError = `Upload failed: ${(j && j.error) || (r && r.status) || 'server unreachable'}`
      jobMsg = ''
      return
    }
    jobMsg = 'Agents analysing your drawing…'
    await pollRun(replayJob.id)
  }

  // ================= workflow =================

  async function runWorkflow() {
    jobError = ''
    jobMsg = ''
    const subject = drawingPrompt.trim()
    if (!subject) {
      jobError = 'Describe what you want the agent to draw first.'
      return
    }
    if (!apiKey.trim()) {
      jobError = 'API key not found in project env — check .env (VITE_DRAW_API_KEY).'
      return
    }
    const stages = [...new Set(['draw', ...analysisKeys])]
    jobMsg = 'Asking the drawing agent…'
    try {
      const r = await api('/api/draw', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ prompt: subject, stages: stages.filter((s) => s !== 'draw') }),
      })
      const j = await r.json().catch(() => ({}))
      if (!r.ok) {
        jobError = j.error || `Server error (${r.status})`
        jobMsg = ''
        return
      }
      await pollDraw(j.run_id)
    } catch (e) {
      jobError = 'Could not reach the server: ' + (e.message || e)
      jobMsg = ''
    }
  }

  async function pollDraw(id) {
    // wait for the draw stage to finish and the run to reach 'rendering'
    // (agent planning can take several minutes on the local model)
    for (let i = 0; i < 480; i++) {
      await new Promise((res) => setTimeout(res, 1500))
      const r = await api(`/api/runs/${id}`).catch(() => null)
      if (!r || !r.ok) continue
      const j = await r.json()
      if (j.status === 'error') {
        jobMsg = ''
        jobError = j.error || 'Drawing agent failed.'
        await loadHistory()
        return
      }
      if (j.status === 'rendering') {
        // plan ready — animate it on the canvas
        const drawStage = (j.stages || []).find((s) => s.key === 'draw')
        if (drawStage && drawStage.plan && drawStage.plan.strokes) {
          j.plan = drawStage.plan
          startReplay(j)
          return
        }
        jobMsg = ''
        jobError = 'Agent finished but no stroke plan came back.'
        await loadHistory()
        return
      }
      jobMsg = `Asking the drawing agent… (${Math.round((i + 1) * 1.5)}s elapsed)`
    }
    jobMsg = ''
    jobError = 'Drawing agent took too long — try again.'
  }

  async function pollRun(id) {
    // analysis stages are running server-side; live-update run status
    for (let i = 0; i < 120; i++) {
      await new Promise((res) => setTimeout(res, 3000))
      const r = await api(`/api/runs/${id}`).catch(() => null)
      if (!r || !r.ok) continue
      const j = await r.json()
      if (j.status === 'done' || j.status === 'error') {
        if (j.status === 'error') jobError = j.error || 'Analysis failed.'
        jobMsg = j.status === 'done' ? 'Done — saved to the database.' : ''
        await loadHistory()
        const rr = await api(`/api/runs/${id}`).catch(() => null)
        if (rr && rr.ok) expandedRun = await rr.json()
        return
      }
      const st = (j.stages || []).filter((s) => s.key !== 'draw')
      const nDone = st.filter((s) => s.status === 'done').length
      const nRun = st.filter((s) => s.status === 'running').length
      jobMsg = nRun
          ? `Agents analysing… (${st.find((s) => s.status === 'running')?.label || ''})`
          : `Agents analysing… (${nDone}/${st.length} done)`
    }
    jobMsg = ''
    jobError = 'Analysis took too long — the run is saved, check history.'
  }

  // ================= history / gallery =================

  async function loadHistory() {
    historyError = ''
    try {
      const r = await api('/api/runs?limit=24')
      const j = await r.json().catch(() => ({}))
      if (!r.ok) {
        historyError = j.error || `History failed (${r.status})`
        return
      }
      history = j.runs || []
    } catch (e) {
      historyError = 'Could not load history: ' + (e.message || e)
    }
  }

  async function openRun(id) {
    if (expandedRun && expandedRun.id === id) {
      expandedRun = null
      return
    }
    try {
      const r = await api(`/api/runs/${id}`)
      const j = await r.json().catch(() => ({}))
      if (r.ok) expandedRun = j
      else historyError = j.error || 'Could not open run.'
    } catch (e) {
      historyError = 'Could not open run: ' + (e.message || e)
    }
  }

  async function replayRun(id) {
    // replay a stored run's plan on the canvas from history
    const r = await api(`/api/runs/${id}`).catch(() => null)
    if (!r || !r.ok) return
    const j = await r.json()
    const ds = (j.stages || []).find((s) => s.key === 'draw')
    if (ds && ds.plan && ds.plan.strokes) {
      startReplay({ id: j.id, plan: ds.plan, replayOnly: true })
      jobMsg = 'Replaying saved run on the canvas…'
    } else {
      jobMsg = 'This run has no replayable plan.'
    }
  }

  async function deleteRun(id) {
    deleting = id
    try {
      const r = await api(`/api/runs/${id}`, { method: 'DELETE' })
      if (r.ok) {
        if (expandedRun && expandedRun.id === id) expandedRun = null
        await loadHistory()
      } else {
        const j = await r.json().catch(() => ({}))
        historyError = j.error || 'Delete failed.'
      }
    } catch (e) {
      historyError = 'Delete failed: ' + (e.message || e)
    }
    deleting = ''
  }

  function imgFor(id) {
    // Public PNG works for everyone (share recipients included); the authed
    // route is preferred when we have the project key.
    if (!apiKey.trim()) return `/p/${id}.png`
    return `/api/runs/${id}/image?api_key=${encodeURIComponent(apiKey.trim())}`
  }

  function timeAgo(iso) {
    const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
    if (s < 60) return `${s}s ago`
    if (s < 3600) return `${Math.floor(s / 60)}m ago`
    if (s < 86400) return `${Math.floor(s / 3600)}h ago`
    return `${Math.floor(s / 86400)}d ago`
  }

  function busy() {
    return replaying || (!!jobMsg && !replayDone && !paused)
  }

  function statusBadge(status) {
    // map run/stage status to IDDS badge modifiers
    switch (status) {
      case 'done':
        return 'ina-badge--soft ina-badge--success'
      case 'error':
        return 'ina-badge--soft ina-badge--error'
      case 'running':
        return 'ina-badge--soft ina-badge--warning'
      case 'rendering':
        return 'ina-badge--soft ina-badge--info'
      default:
        return 'ina-badge--soft ina-badge--neutral'
    }
  }

  onMount(() => {
    ctx = canvas.getContext('2d')
    setupCanvas()
    clearCanvas()
    boot()
    // Share mode: /r/<id> or /share/<id> — auto-replay that drawing publicly.
    const m = location.pathname.match(/^\/(?:r|share)\/([A-Za-z0-9]+)$/)
    if (m) {
      shareRunId = m[1]
      loadShare(shareRunId)
    }
    // protect the replay from accidental CSS-remounts
    window.addEventListener('resize', setupCanvas)
    return () => {
      window.removeEventListener('resize', setupCanvas)
      stopReplay()
    }
  })
</script>

<svelte:head>
  <title>Drawing Agents · INA Digital</title>
</svelte:head>

<div class="govbar">
  <div class="govbar__inner">
    <div class="govbar__mark" aria-hidden="true">IA</div>
    <div>
      <h1 class="govbar__title">Drawing Agents</h1>
      <p class="govbar__sub">Layanan gambar berbasis agen · INA Digital Design System</p>
    </div>
    <div class="govbar__status">
      {#if health}
        <span class="dot ok"></span>
        <span>{health.running} running · {health.queued} queued</span>
      {:else}
        <span class="dot bad"></span>
        <span>connecting…</span>
      {/if}
    </div>
  </div>
</div>

<main class="page">
  {#if shareRunId}
    <div class="ina-alert ina-alert--info" style="margin-bottom:12px">
      <div class="ina-alert__text-section">
        <p class="ina-alert__title">Tautan berbagi: {shareRunId}</p>
        <p class="ina-alert__description">Gambar ini bisa diputar ulang — kanvas akan menggambarnya kembali pena demi pena untuk siapa pun yang membuka tautan · <a href="/" style="text-decoration:underline">Kembali ke kanvas</a></p>
      </div>
    </div>
  {/if}
  <div class="page-head">
    <h1>Kanvas Agen</h1>
    <p>
      Anda menulis perintah, agen Hermes menyusun rencana goresan vektor, dan kanvas menggambarnya
      sendiri seperti pena yang bergerak. Setiap hasil tersimpan di database di mesin ini.
    </p>
  </div>

  <div class="grid">
    <!-- Canvas (agent-driven) -->
    <section class="ina-card">
      <div class="ina-card__content">
        <h2 class="ina-card__title">Kanvas <span class="ina-badge ina-badge--sm ina-badge--soft ina-badge--info">agen</span></h2>
        <div class="stage-line">
          {#if replaying}
            <span class="ina-spinner"><span class="ina-spinner__element ina-spinner__element--size-xs ina-spinner__element--border-thin ina-spinner__element--color-primary"></span></span>
            <span>{paused ? 'Dijeda — klik Lanjut' : 'Agen sedang menggambar…'}</span>
          {:else if replayDone}
            <span class="dot ok"></span>
            <span>Selesai — tersimpan ke database</span>
          {:else}
            <span class="dot"></span>
            <span>Menunggu perintah — agen yang menggambar, bukan Anda</span>
          {/if}
        </div>
        <canvas bind:this={canvas} class="draw" class:active={replaying}></canvas>
        <div class="canvas-actions">
          <button class="ina-button ina-button--secondary ina-button--sm" onclick={togglePause} disabled={!replaying || replayDone}>
            {paused ? 'Lanjut' : 'Jeda'}
          </button>
          <button class="ina-button ina-button--secondary ina-button--sm" onclick={() => stopReplay()} disabled={!replaying}>
            Hentikan
          </button>
          <button class="ina-button ina-button--secondary ina-button--sm" onclick={() => startReplay(replayJob)} disabled={!replayJob || !replayDone}>
            Putar ulang
          </button>
        </div>
        <p class="hint">Selama agen menggambar Anda bisa menjeda dan melihat pena bergerak. Tidak ada goresan manual — perintah masuk, gambar keluar.</p>
      </div>
    </section>

    <!-- Agent prompt side -->
    <section class="ina-card">
      <div class="ina-card__content">
        <h2 class="ina-card__title">Perintah menggambar</h2>
        <p class="ina-card__description">
          Deskripsikan gambar. Agen Hermes menyusun 30–70 goresan vektor, kanvas memutarnya
          seperti pena yang menggambar sendiri, lalu agen analisis meninjau hasilnya.
        </p>

        <div class="ina-text-area">
          <label class="ina-text-area__label" for="prompt">Apa yang harus digambar agen?</label>
          <div class="ina-text-area__wrapper ina-text-area__wrapper--status-neutral">
            <textarea
              id="prompt"
              class="ina-text-area__input"
              rows="3"
              placeholder="mis. perahu layar kecil di air tenang saat matahari terbenam…"
              bind:value={drawingPrompt}
            ></textarea>
          </div>
        </div>

        <div>
          <span class="f-label" id="stages-label">Setelah menggambar, jalankan juga:</span>
          <div class="stage-picks" role="group" aria-labelledby="stages-label">
            {#each availableStages as s}
              <button
                class="ina-chip__item ina-chip__item--variant-outline ina-chip__item--size-small"
                class:ina-chip__item--selected={analysisKeys.includes(s.key)}
                onclick={() => toggleStage(s.key)}
              >
                {s.label}
              </button>
            {:else}
              <span class="hint">Memuat agen…</span>
            {/each}
          </div>
        </div>

        <div>
          <button class="ina-button ina-button--primary ina-button--md" onclick={runWorkflow} disabled={replaying || (!replayDone && busy())}>
            {replaying ? (paused ? 'Dijeda…' : 'Agen menggambar…') : 'Minta agen menggambar'}
          </button>
        </div>

        {#if jobMsg}
          <div class="ina-alert ina-alert--info">
            <div class="ina-alert__text-section">
              <p class="ina-alert__title">Status</p>
              <p class="ina-alert__description">{jobMsg}</p>
            </div>
          </div>
        {/if}
        {#if jobError}
          <div class="ina-alert ina-alert--critical">
            <div class="ina-alert__text-section">
              <p class="ina-alert__title">Kesalahan</p>
              <p class="ina-alert__description">{jobError}</p>
            </div>
          </div>
        {/if}

        {#if expandedRun}
          <div class="ina-divider ina-divider--horizontal ina-divider--light"></div>
          {#each expandedRun.stages as st}
            <div class="result">
              <div class="result__head">
                <strong>{st.label}</strong>
                <span class="ina-badge ina-badge--sm {statusBadge(st.status)}">{st.status}</span>
              </div>
              {#if st.key === 'draw' && st.plan}
                <pre class="plan">planned {st.plan.count} strokes · subject: {st.plan.subject || '—'}</pre>
              {:else if st.output}
                <pre>{st.output}</pre>
              {/if}
            </div>
          {/each}
        {/if}
      </div>
    </section>
  </div>

  <!-- Run history, persisted on this machine -->
  <section class="ina-card history">
    <div class="ina-card__content">
      <div class="history__head">
        <h2 class="ina-card__title">Riwayat <span class="ina-badge ina-badge--sm ina-badge--soft ina-badge--neutral">{history.length}</span></h2>
        <button class="ina-button ina-button--secondary ina-button--sm" onclick={loadHistory}>Muat ulang</button>
      </div>
      <p class="ina-card__description">
        Tersimpan di Postgres di mesin ini (database <code>drawing_canvas</code>) — gambar PNG akhir
        plus semua keluaran agen. Klik satu untuk membukanya.
      </p>
      {#if historyError}
        <div class="ina-alert ina-alert--critical">
          <div class="ina-alert__text-section">
            <p class="ina-alert__title">Kesalahan</p>
            <p class="ina-alert__description">{historyError}</p>
          </div>
        </div>
      {/if}
      {#if history.length === 0}
        <p class="ina-card__description">Belum ada riwayat — deskripsikan sesuatu dan biarkan agen menggambarnya.</p>
      {:else}
        <div class="gallery">
          {#each history as h}
            <div class="thumb" class:open={expandedRun && expandedRun.id === h.id}>
              <button class="thumb__img" onclick={() => openRun(h.id)} aria-label="open run {h.id}">
                <img src={imgFor(h.id)} alt="drawing for run {h.id}" loading="lazy" />
                <span class="ina-badge ina-badge--sm {statusBadge(h.status)}">{h.status}</span>
              </button>
              <div class="thumb__meta">
                <span>{timeAgo(h.created_at)}</span>
                <span class="thumb__actions">
                  <button class="linklike" onclick={() => replayRun(h.id)} disabled={replaying}>Putar ulang</button>
                  <button class="linklike" onclick={() => copyShare(h.id)} title={shareUrl(h.id)}>Bagikan</button>
                </span>
              </div>
              {#if h.note}
                <p class="thumb__note">{h.note}</p>
              {/if}
            </div>
          {/each}
        </div>

        {#if expandedRun}
          <div class="expanded">
            <div class="result__head">
              <strong>Run {expandedRun.id}</strong>
              <span class="ina-badge ina-badge--sm {statusBadge(expandedRun.status)}">{expandedRun.status}</span>
              <button class="linklike" onclick={() => copyShare(expandedRun.id)} title={shareUrl(expandedRun.id)}>Bagikan</button>
              <button class="linklike danger" onclick={() => deleteRun(expandedRun.id)} disabled={deleting === expandedRun.id}>
                {deleting === expandedRun.id ? '…' : 'Hapus'}
              </button>
            </div>
            <img class="big" src={imgFor(expandedRun.id)} alt="drawing for run {expandedRun.id}" />
            {#if expandedRun.note}
              <p class="ina-card__description">Perintah: {expandedRun.note}</p>
            {/if}
            {#each expandedRun.stages as st}
              <div class="result">
                <div class="result__head">
                  <strong>{st.label}</strong>
                  <span class="ina-badge ina-badge--sm {statusBadge(st.status)}">{st.status}</span>
                </div>
                {#if st.key === 'draw' && st.plan}
                  <pre class="plan">planned {st.plan.count} strokes · {st.plan.subject || ''}</pre>
                {:else if st.output}
                  <pre>{st.output}</pre>
                {/if}
              </div>
            {/each}
          </div>
        {/if}
      {/if}
    </div>
  </section>
</main>

<footer class="govfoot">
  <div class="govfoot__inner">
    <p><strong>Drawing Agents</strong> · dibangun dengan INA Digital Design System</p>
    <p>Backend Hermes · Postgres <code>drawing_canvas</code> · draw.corklab.xyz</p>
  </div>
</footer>
