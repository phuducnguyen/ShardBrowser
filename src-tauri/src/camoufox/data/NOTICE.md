# Third-party data in this folder

`fingerprint-presets.json` and `font-bases.json` come from the Python package of
[Camoufox](https://github.com/daijro/camoufox) (`python/src/camoufox/`), which is
distributed under the MIT licence reproduced below. `known-keys.txt` is the list of
configuration property names found in the `properties.json` that ships inside the
Camoufox browser build the launcher installs; it is used only to check that the
launcher writes valid keys.

The Camoufox browser itself is licensed under the Mozilla Public License 2.0 and is
downloaded unmodified from its GitHub releases; HeroV does not change or redistribute it.
Source: https://github.com/daijro/camoufox

---

MIT License

Copyright (c) 2024-2026 daijro and the Camoufox contributors

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.


---

# WebGL identities (`webgl-devices.json`)

`webgl-devices.json` is derived from the model of **fpgen**
([scrapfly/fingerprint-generator](https://github.com/scrapfly/fingerprint-generator),
Apache License 2.0, full text in `LICENSE-fpgen-Apache-2.0.txt`), release `model-2/2026`,
SHA-256 `6530b8322cdaa4ec042921c8d9a0369a0e6e0269ba636c01a7203e4a2f109936`. It holds, for each
recorded Firefox device, the WebGL vendor, renderer, parameters, extension list and shader
precisions, converted to Camoufox config keys by `tools/camoufox/extract-webgl.py`. That conversion
follows `camoufox/webgl.py` of the Camoufox Python package (MIT, reproduced above). The data was
filtered (software renderers removed) and reduced to the most likely records per GPU; it is not the
whole model. To regenerate it, install `fpgen`, place the pinned model, and run the script.

---

# Phones (`phones.json`)

The `android` list holds device tuples (name, screen, pixel ratio, Android version, GPU, cores)
taken from the ManyFaces project (`antidetect/fingerprint.py`).

The `generated` list is derived from the fingerprint network of **Apify fingerprint-suite**
([apify/fingerprint-suite](https://github.com/apify/fingerprint-suite), Apache License 2.0, same
licence text as `LICENSE-fpgen-Apache-2.0.txt`), file
`packages/fingerprint-generator/src/data_files/fingerprint-network-definition.zip`. Android screens
and GPU names were filtered (desktop GPUs, emulators, software renderers, landscape and tablet
screens removed), rewritten the way Firefox for Android prints them, and paired by GPU class by
`tools/camoufox/extract-phones.py`. Copyright (c) Apify Technologies s.r.o. and contributors.
