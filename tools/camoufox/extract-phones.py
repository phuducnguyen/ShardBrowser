#!/usr/bin/env python3
"""Rebuild the generated Android phones in src-tauri/src/camoufox/data/phones.json.

Source: Apify fingerprint-suite (Apache-2.0), packages/fingerprint-generator/src/data_files/
fingerprint-network-definition.zip. Usage:

    python tools/camoufox/extract-phones.py path/to/fingerprint-network-definition.zip [--per-screen 3]

The data gives, per Android user agent, a distribution of screens and a distribution of GPU names.
They are independent in the source, so pairing them blindly would make impossible phones (an
entry-level GPU behind a flagship screen). Each GPU gets a tier and a range of Android versions, each
screen a tier by pixel ratio, and only compatible pairs are kept. Rows that are not phones (desktop
GPUs, emulators, software renderers, landscape or tablet-sized screens, pixel ratio 1) are dropped.
The named phones under "android" are kept as they are.
"""
import collections
import hashlib
import json
import re
import sys
import zipfile
from pathlib import Path

OUT = Path(__file__).resolve().parents[2] / "src-tauri" / "src" / "camoufox" / "data" / "phones.json"
STRINGIFIED = "*STRINGIFIED*"
MIN_SCREEN_WEIGHT = 0.03  # sum of probabilities over Android user agents; below this a screen is a one-off


def load(zip_path):
    d = json.loads(zipfile.ZipFile(zip_path).read("network.json"))
    return {n["name"]: n for n in d["nodes"]}


def normalise_gpu(vendor, renderer):
    """(vendor, renderer) as Firefox for Android reports them, or None if this is not a phone GPU."""
    r = renderer.replace(", or similar", "").strip()
    m = re.match(r"ANGLE \((ARM|Qualcomm), ((?:Mali|Adreno)[^,]*), OpenGL ES [\d.]+\)", r)
    if m:  # Chrome's wrapper; Firefox prints the bare name
        return ("ARM" if m.group(1) == "ARM" else "Qualcomm"), m.group(2)
    if r.startswith(("Mali-", "Adreno")) and vendor in ("ARM", "Qualcomm"):
        return vendor, r
    if r.startswith("PowerVR") and vendor == "Imagination Technologies" and "SGX" not in r and "D-Series" not in r:
        return vendor, r
    return None


def gpu_tier(renderer):
    m = re.search(r"Adreno \(TM\) (\d+)", renderer)
    if m:
        n = int(m.group(1))
        return "low" if n < 615 else "mid" if n < 700 else "high"
    m = re.search(r"Mali-([GT])(\d+)", renderer)
    if m:
        if m.group(1) == "T":
            return "low"
        n = int(m.group(2))
        return "low" if n <= 52 else "mid" if n <= 78 else "high"
    return "low"  # PowerVR entries seen are entry-level


VERSIONS = {"low": (10, 13), "mid": (11, 15), "high": (13, 16)}
SCREEN_OK = {"low": lambda dpr: dpr <= 2.75, "mid": lambda dpr: 2.5 <= dpr <= 3.5, "high": lambda dpr: dpr >= 2.5}


def short(renderer):
    return re.sub(r"\s*\(TM\)", "", renderer)


def main():
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    per_screen = int(sys.argv[sys.argv.index("--per-screen") + 1]) if "--per-screen" in sys.argv else 3
    nodes = load(sys.argv[1])
    uas = [u for u in nodes["userAgent"]["possibleValues"] if "Android" in u]
    screens, gpus = collections.Counter(), collections.Counter()
    for u in uas:
        for k, p in nodes["screen"]["conditionalProbabilities"]["deeper"].get(u, {}).items():
            j = json.loads(k.split(STRINGIFIED)[1])
            w, h, dpr = j["width"], j["height"], round(j["devicePixelRatio"], 4)
            if 340 <= w <= 460 and 1.6 <= h / w <= 2.4 and dpr >= 1.75:
                screens[(w, h, dpr)] += p
        for k, p in nodes["videoCard"]["conditionalProbabilities"]["deeper"].get(u, {}).items():
            j = json.loads(k.split(STRINGIFIED)[1])
            g = normalise_gpu(j["vendor"], j["renderer"])
            if g:
                gpus[g] += p

    # Every screen seen often enough, each with its most common compatible GPUs, so the pool covers
    # many screens instead of repeating the few most common ones.
    kept = [(k, v) for k, v in screens.items() if v >= MIN_SCREEN_WEIGHT]
    generated = []
    for (w, h, dpr), _ in sorted(kept, key=lambda kv: (-kv[1], kv[0])):
        compatible = sorted(
            ((gp, vendor, renderer) for (vendor, renderer), gp in gpus.items() if SCREEN_OK[gpu_tier(renderer)](dpr)),
            key=lambda c: (-c[0], c[2]),
        )
        # The most common GPU, then others spread by a stable hash so the pool covers every GPU.
        chosen = compatible[:1]
        rest = compatible[1:]
        for i in range(1, per_screen):
            if not rest:
                break
            h8 = int.from_bytes(hashlib.sha256(f"{w}x{h}x{dpr}#{i}".encode()).digest()[:4], "big")
            chosen.append(rest.pop(h8 % len(rest)))
        for _, vendor, renderer in chosen:
            lo, hi = VERSIONS[gpu_tier(renderer)]
            key = hashlib.sha256(f"{w}x{h}x{dpr}x{renderer}".encode()).digest()[0]
            generated.append({
                "name": f"{short(renderer)} · ×{dpr:g}",
                "width": w, "height": h, "dpr": dpr,
                "version": str(lo + key % (hi - lo + 1)),
                "gpuVendor": vendor, "gpuRenderer": renderer,
                "cores": 8,
            })

    data = json.loads(OUT.read_text(encoding="utf-8"))
    data["generated"] = generated
    data["source"] = (
        "Named phones: tuples from ManyFaces antidetect/fingerprint.py. Generated: Apify fingerprint-suite "
        "network definition (Apache-2.0), filtered and paired by tools/camoufox/extract-phones.py."
    )
    OUT.write_text(json.dumps(data, indent=1, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"{len(screens)} screens seen, {len(kept)} kept, {len(gpus)} phone GPUs; wrote {len(generated)} phones to {OUT}")


if __name__ == "__main__":
    main()
