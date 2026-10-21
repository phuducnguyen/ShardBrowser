"""Extract recorded Firefox WebGL identities from the fpgen model into one JSON file.

Development tool: it is NOT part of the app. The app reads the file it writes
(`src-tauri/src/camoufox/data/webgl-devices.json`).

Why: Camoufox can present a full WebGL identity (vendor, renderer, every parameter, the extension
list, shader precisions) through its `webGl:*` / `webGl2:*` config keys. A GPU name without the
parameters of that GPU contradicts itself; a recorded set does not. The recordings come from
fpgen (scrapfly/fingerprint-generator, Apache-2.0).

The conversion of an fpgen record into Camoufox config keys follows `camoufox/webgl.py` from the
Camoufox Python package (MIT, Copyright (c) 2024-2026 daijro and the Camoufox contributors).

Run (inside an environment with `fpgen` and its pinned model installed):
    python tools/camoufox/extract-webgl.py src-tauri/src/camoufox/data/webgl-devices.json
"""

import json
import re
import sys

import fpgen
import fpgen.utils

OS_NAMES = {"windows": "Windows", "macos": "macOS", "linux": "Linux"}
SHORT = {"windows": "win", "macos": "mac", "linux": "lin"}
VARIANTS_PER_GPU = 2  # most likely WebGL records per GPU (the second one adds realistic spread)

# Extensions a release Firefox never exposes (draft or mobile-only), and one that depends on the
# host GL driver off Windows (see camoufox/webgl.py).
NEVER_EXPOSED = {"WEBGL_multi_draw", "WEBGL_clip_cull_distance", "EXT_texture_norm16", "WEBGL_compressed_texture_etc1"}
HOST_DEPENDENT = {"OVR_multiview2"}
# Extensions the claimed OS's backend adds on every GPU in Firefox 156+, which older recordings lack.
BACKEND = {"win": ("EXT_depth_clamp",)}
POLYGON_OFFSET_CLAMP = "EXT_polygon_offset_clamp"
ALIASED_LINE_WIDTH_RANGE = "33902"
SOFTWARE = re.compile(r"llvmpipe|softpipe|swiftshader|software|microsoft basic render|mozilla", re.I)


def compact(value):
    return json.dumps(value, separators=(",", ":"), ensure_ascii=False)


def trace(target, os_name, pinned=()):
    evidence = {node: {index} for node, index in pinned}
    return list(fpgen.trace(target=target, browser="Firefox", os=os_name, __evidence__=evidence))


_index_cache = {}


def pin(node, value):
    if node not in _index_cache:
        _index_cache[node] = fpgen.utils._lookup_possibilities(node, casefold=False)
    return node, _index_cache[node][compact(value)]


def context_config(prefix, webgl, short, backend):
    blocked = NEVER_EXPOSED if short == "win" else NEVER_EXPOSED | HOST_DEPENDENT
    extensions = [e for e in webgl["supportedExtensions"] if e not in blocked]
    for extension in backend:
        if extension not in extensions:
            at = next((i for i, other in enumerate(extensions) if other.casefold() > extension.casefold()), None)
            extensions.insert(len(extensions) if at is None else at, extension)
    return {
        f"{prefix}:supportedExtensions": extensions,
        f"{prefix}:parameters": {name: param["value"] for name, param in webgl["params"].items()},
        f"{prefix}:shaderPrecisionFormats": {
            f"{e['shaderType']},{e['precisionType']}": e["shaderPrecisionFormat"] for e in webgl["shaderPrecisionFormats"]
        },
    }


def to_config(webgl, webgl2, short):
    backend = BACKEND.get(short, ())
    if (short == "win" and webgl2) or (short == "lin" and "EXT_depth_clamp" in webgl["supportedExtensions"]):
        backend += (POLYGON_OFFSET_CLAMP,)
    config = {
        "webGl:vendor": webgl["vendor"],
        "webGl:renderer": webgl["renderer"],
        **context_config("webGl", webgl, short, backend),
        "webGl2Enabled": bool(webgl2),
    }
    if webgl2:
        config.update(context_config("webGl2", webgl2, short, backend))
        # Firefox creates WebGL1 on the same GL profile as WebGL2, so both report one line width range.
        config["webGl:parameters"][ALIASED_LINE_WIDTH_RANGE] = config["webGl2:parameters"][ALIASED_LINE_WIDTH_RANGE]
    return json.loads(json.dumps(config))


def main(out_path):
    devices = []
    for key, os_name in OS_NAMES.items():
        short = SHORT[key]
        for gpu in trace("gpu", os_name):
            renderer = gpu.value["renderer"]
            if SOFTWARE.search(renderer):
                continue
            gpu_pin = pin("gpu", gpu.value)
            webgls = sorted(trace("webgl", os_name, (gpu_pin,)), key=lambda r: -r.probability)[:VARIANTS_PER_GPU]
            for webgl in webgls:
                webgl2s = sorted(trace("webgl2", os_name, (gpu_pin, pin("webgl", webgl.value))), key=lambda r: -r.probability)
                webgl2 = webgl2s[0].value if webgl2s else []
                devices.append({
                    "os": key,
                    "vendor": gpu.value["vendor"],
                    "renderer": renderer,
                    "weight": round(gpu.probability * webgl.probability, 6),
                    "config": to_config(webgl.value, webgl2, short),
                })
    devices.sort(key=lambda d: (d["os"], -d["weight"]))
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump({"version": 1, "source": "fpgen model-2/2026 (scrapfly/fingerprint-generator, Apache-2.0)", "devices": devices}, f, separators=(",", ":"), ensure_ascii=False)
    by_os = {}
    for d in devices:
        by_os[d["os"]] = by_os.get(d["os"], 0) + 1
    print("wrote", out_path, len(devices), "devices", by_os)


if __name__ == "__main__":
    main(sys.argv[1])
