# E2E test: agent draw -> render plan with PIL (same semantics as the
# browser replay) -> upload -> analysis -> verify stored image is real.
# Usage: DRAW_API_KEY=... python3 e2e_test.py "a small sailboat at sunset"
import json
import os
import sys
import time
import urllib.request
import urllib.error

BASE = os.environ.get("BASE", "http://127.0.0.1:8910")
API_KEY = os.environ["DRAW_API_KEY"]
subject = sys.argv[1] if len(sys.argv) > 1 else "a small sailboat on calm water at sunset"


def call(path, method="GET", data=None):
    req = urllib.request.Request(
        BASE + path,
        method=method,
        data=json.dumps(data).encode() if data is not None else None,
        headers={"content-type": "application/json", "x-api-key": API_KEY},
    )
    try:
        with urllib.request.urlopen(req, timeout=120) as r:
            return r.status, json.loads(r.read().decode() or "{}")
    except urllib.error.HTTPError as e:
        try:
            return e.code, json.loads(e.read().decode() or "{}")
        except Exception:
            return e.code, {}


st, create = call("/api/draw", "POST", {"prompt": subject, "stages": ["describe", "critique"]})
print("1. create:", st, create)
assert st == 200, create
run_id = create["run_id"]

plan = None
t0 = time.time()
while time.time() - t0 < 360:
    st, r = call(f"/api/runs/{run_id}")
    if r.get("status") == "error":
        print("PLAN ERROR:", r.get("error"))
        sys.exit(1)
    if r.get("status") == "rendering":
        ds = next((s for s in r.get("stages", []) if s.get("key") == "draw"), None)
        if ds and ds.get("plan"):
            plan = ds["plan"]
            break
    time.sleep(4)
assert plan, "no plan after 6 min"
print(f"2. plan ready in {time.time()-t0:.0f}s: {plan['count']} strokes, subject: {plan.get('subject')}")

# --- render the plan (same geometry the browser replays)
from PIL import Image, ImageDraw, ImageFont

W, H = 960, 600
img = Image.new("RGB", (W, H), "white")
dr = ImageDraw.Draw(img)
try:
    font_cache = {}
    def font(size):
        if size not in font_cache:
            try:
                font_cache[size] = ImageFont.truetype("DejaVuSans.ttf", size)
            except Exception:
                font_cache[size] = ImageFont.load_default()
        return font_cache[size]
except Exception:
    font = lambda s: ImageFont.load_default()

for s in plan["strokes"]:
    c, w = s.get("color", "#1a1a1a"), s.get("width", 3) or 3
    if s["type"] == "line":
        pts = [(p[0], p[1]) for p in s["points"]]
        if len(pts) >= 2:
            dr.line(pts, fill=c, width=w, joint="curve")
    elif s["type"] == "circle":
        x0, y0 = s["cx"] - s["r"], s["cy"] - s["r"]
        x1, y1 = s["cx"] + s["r"], s["cy"] + s["r"]
        if s.get("fill"):
            dr.ellipse([x0, y0, x1, y1], fill=c)
        else:
            dr.ellipse([x0, y0, x1, y1], outline=c, width=w)
    elif s["type"] == "rect":
        box = [s["x"], s["y"], s["x"] + s["w"], s["y"] + s["h"]]
        if s.get("fill"):
            dr.rectangle(box, fill=c)
        else:
            dr.rectangle(box, outline=c, width=w)
    elif s["type"] == "text":
        dr.text((s["x"], s["y"]), s.get("text", ""), fill=c, font=font(s.get("size", 24) or 24))
img.save("/tmp/e2e-render.png")

import base64
raw = open("/tmp/e2e-render.png", "rb").read()
png = "data:image/png;base64," + base64.b64encode(raw).decode()
print(f"3. rendered {len(raw)} bytes")

st, up = call(f"/api/runs/{run_id}/image", "POST", {"image": png})
print("4. upload:", st, json.dumps(up)[:200])
assert st == 200, up

run = None
t1 = time.time()
while time.time() - t1 < 360:
    st, run = call(f"/api/runs/{run_id}")
    if run.get("status") in ("done", "error"):
        break
    time.sleep(5)
print("5. final status:", run.get("status"), run.get("error") or "")
for s in run.get("stages", []):
    print(f"   - {s['key']}: {s['status']} ({s.get('ms')}ms) {str(s.get('output') or '')[:90].replace(chr(10), ' ')}")
assert run.get("status") == "done", run

imgreq = urllib.request.Request(f"{BASE}/api/runs/{run_id}/image?api_key={API_KEY}")
with urllib.request.urlopen(imgreq) as r:
    body = r.read()
    print("6. stored image:", r.status, r.headers.get("content-type"), len(body), "bytes")
    assert len(body) > 5000, "stored image too small — likely blank"
print("E2E PASS")
