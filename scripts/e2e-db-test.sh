#!/usr/bin/env bash
# End-to-end verification: real workflow run -> stored in Postgres -> gallery API.
set -u
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BASE="${BASE:-http://127.0.0.1:8910}"
API_ENV="${DRAW_API_ENV:-${HOME}/.config/drawing-canvas/api.env}"
if [ -z "${DRAW_API_KEY:-}" ]; then
  if [ -f "$API_ENV" ]; then
    DRAW_API_KEY="$(grep '^DRAW_API_KEY=' "$API_ENV" | cut -d= -f2-)"
  elif [ -f "$ROOT/.env" ]; then
    DRAW_API_KEY="$(grep '^DRAW_API_KEY=' "$ROOT/.env" | cut -d= -f2-)"
  fi
fi
: "${DRAW_API_KEY:?Set DRAW_API_KEY or provide $API_ENV / $ROOT/.env}"
PSQL="${PSQL:-psql}"
DB="${DATABASE_URL:-postgres://ai@127.0.0.1:5433/drawing_canvas}"

echo "== auth: reject without key =="
curl -s -o /dev/null -w "no-key jobs -> %{http_code}\n" -X POST "$BASE/api/jobs" -H content-type:application/json --data '{"stages":["describe"],"image":"x"}'
curl -s -o /dev/null -w "no-key runs  -> %{http_code}\n" "$BASE/api/runs"

echo "== generate test PNG =="
IMG_B64="$(node "$ROOT/scripts/gen-test-png.mjs")"
echo "image data-url length: ${#IMG_B64}"

echo "== submit describe job =="
RESP="$(curl -s -X POST "$BASE/api/jobs" -H "x-api-key: $DRAW_API_KEY" -H content-type:application/json \
  -d "{\"stages\":[\"describe\"],\"prompt\":\"gallery db test\",\"image\":\"$IMG_B64\"}")"
echo "create: $RESP"
ID="$(printf '%s' "$RESP" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>console.log(JSON.parse(s).job_id))')"
echo "job id: $ID"

echo "== poll until done =="
for i in $(seq 1 15); do
  sleep 6
  J="$(curl -s "$BASE/api/jobs/$ID" -H "x-api-key: $DRAW_API_KEY")"
  ST="$(printf '%s' "$J" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>console.log(JSON.parse(s).status))')"
  echo "poll $i: status=$ST"
  if [ "$ST" = "done" ] || [ "$ST" = "error" ]; then
    printf '%s' "$J" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const j=JSON.parse(s);for(const st of j.stages||[]){console.log(`- ${st.label} [${st.status}] ${st.ms}ms`);console.log((st.output||"").slice(0,400))}})'
    break
  fi
done

echo "== DB: runs table =="
"$PSQL" "$DB" -c "SELECT id, status, left(note,24) AS note, length(image_png) AS img_bytes, (SELECT count(*) FROM stages s WHERE s.run_id=r.id) AS stages FROM runs r ORDER BY created_at DESC LIMIT 5;"

echo "== DB: stages table =="
"$PSQL" "$DB" -c "SELECT run_id, seq, key, status, ms, left(output, 90) AS output_head FROM stages ORDER BY created_at DESC, run_id DESC LIMIT 5;" 2>/dev/null || "$PSQL" "$DB" -c "SELECT run_id, seq, key, status, ms, left(output, 90) AS output_head FROM stages s ORDER BY run_id DESC, seq ASC LIMIT 5;"

echo "== gallery API =="
curl -s "$BASE/api/runs?limit=5" -H "x-api-key: $DRAW_API_KEY" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const j=JSON.parse(s);for(const r of j.runs||[])console.log(`${r.id} ${r.status} ${r.stage_count}st ${r.created_at}`)})'

echo "== run detail + image =="
curl -s "$BASE/api/runs/$ID" -H "x-api-key: $DRAW_API_KEY" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const j=JSON.parse(s);console.log(`detail: ${j.id} ${j.status} stages=${(j.stages||[]).length} note=${j.note}`)})'
curl -s -o /tmp/run-img.png -w "image -> %{http_code} type=%{content_type} size=%{size_download}\n" "$BASE/api/runs/$ID/image" -H "x-api-key: $DRAW_API_KEY"
