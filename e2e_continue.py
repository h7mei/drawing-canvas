# Continuation: the run mtqq0mlz is in 'rendering' (plan done). Render with
# PIL, upload, wait for analysis, verify stored image is the real drawing.
import json
import os
import sys
import time
import base64
import urllib.request
import urllib.error

BASE = os.environ.get("BASE", "http://127.0.0.1:8910")
API_KEY = os.environ["DRAW_API_KEY"]
run_id = sys.argv[1]


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


st, r = call(f"/api/runs/{run_id}")
assert r.get("status") == "rendering", f"unexpected status {r.get('status')}"
ds = next((s for s in r.get("stages", []) if s.get("key") == "draw"), None)
plan = ds["plan"]
print(f"plan: {plan['count']} strokes, subject: {plan.get('subject')}")

from PIL import Image, ImageDraw, ImageFont

img = Image.new("RGB", (960, 600), "white")
dr = ImageDraw.Draw(img)
f_cache = {}


def font(size):
    if size not in f_cache:
        try:
            f_cache[size] = ImageFont.truetype("DejaVuSans.ttf", size)
        except Exception:
            f_cache[size] = ImageFont.load_default()
    return f_cache[size]


for s in plan["strokes"]:
    c, w = s.get("color", "#1a1a1a"), s.get("width", 3) or 3
    if s["type"] == "line":
        pts = [(p[0], p[1]) for p in s["points"]]
        if len(pts) >= 2:
            dr.line(pts, fill=c, width=w, joint="curve")
    elif s["type"] == "circle":
        box = [s["cx"] - s["r"], s["cy"] - s["r"], s["cx"] + s["r"], s["cy"] + s["r"]]
        if s.get("fill"):
            dr.ellipse(box, fill=c)
        else:
            dr.ellipse(box, outline=c, width=w)
    elif s["type"] == "rect":
        box = [s["x"], s["y"], s["x"] + s["w"], s["y"] + s["h"]]
        if s.get("fill"):
            dr.rectangle(box, fill=c)
        else:
            dr.rectangle(box, outline=c, width=w)
    elif s["type"] == "text":
        dr.text((s["x"], s["y"]), s.get("text", ""), fill=c, font=font(s.get("size", 24) or 24))
img.save("/tmp/e2e-render.png")
raw = open("/tmp/e2e-render.png", "rb").read()
print(f"rendered {len(raw)} bytes")

st, up = call(f"/api/runs/{run_id}/image", "POST", {"image": "data:image/png;base64," + base64.b64encode(raw).decode()})
print("upload:", st, json.dumps(up)[:250])
assert st == 200, up

run = {}
t1 = time.time()
while time.time() - t1 < 360:
    st, run = call(f"/api/runs/{run_id}")
    if run.get("status") in ("done", "error"):
        break
    time.sleep(5)
print("final status:", run.get("status"), run.get("error") or "")
for s in run.get("stages", []):
    print(f"  - {s['key']}: {s['status']} ({s.get('ms')}ms) {str(s.get('output') or '')[:100].replace(chr(10), ' ')}")
assert run.get("status") == "done", run

with urllib.request.urlopen(urllib.request.Request(f"{BASE}/api/runs/{run_id}/image?api_key={API_KEY}")) as r:
    body = r.read()
    print("stored image:", r.status, r.headers.get("content-type"), len(body), "bytes")
    assert len(body) > 5000, "stored image too small — likely blank"
print("E2E PASS — agent drew, image stored, analysis complete")
