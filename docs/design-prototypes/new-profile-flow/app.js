/* Purple New-Profile flow — prototype logic. Vanilla JS, no deps. Check Proxy is SIMULATED. */
(() => {
  "use strict";
  const $ = (s, el = document) => el.querySelector(s);
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const icon = (id, size) => `<svg class="ico"${size ? ` style="width:${size}px;height:${size}px"` : ""}><use href="#i-${id}"/></svg>`;

  /* ---------- data ---------- */
  const FOLDERS = [
    { id: "amazon", name: "Amazon · Alice", color: "#ef4444" },
    { id: "facebook", name: "Facebook · John", color: "#f59e0b" },
    { id: "mail1", name: "Mail 1 · Alice", color: "#22c55e" },
    { id: "mail2", name: "Mail 2 · Bruno", color: "#8b5cf6" },
  ];
  const profiles = [
    ["Facebook", "Chrome", "Http", "US", "103.80.10.185:6463", "facebook"],
    ["Google", "Opera", "Socks5", "US", "171.22.251.213:5743", "mail1"],
    ["Amazon", "Edge", "Http", "US", "45.43.81.120:5743", "amazon"],
    ["Etsy 1", "Yandex", "Socks5", "DE", "154.30.242.19:9210", "amazon"],
    ["Instagram", "Chrome", "Http", "US", "103.152.112.41:9001", "facebook"],
    ["Tiktok 2", "Chrome", "Socks5", "US", "185.199.228.220:7300", "mail2"],
    ["Tiktok 3", "Chrome", "Http", "US", "72.10.164.178:3128", "mail2"],
    ["Ebay 3", "Chrome", "Http", "US", "173.208.239.66:7777", "mail1"],
  ].map(([name, browser, ptype, cc, proxy, folder], i) => ({ id: i + 1, name, browser, ptype, cc, proxy, folder, status: "Ready" }));
  let nextId = profiles.length + 1;
  let activeFolder = "all";
  let query = "";
  let lastCreatedId = null;

  const OS = {
    Windows: { versions: ["Windows 11", "Windows 10"], ua: () => "Windows NT 10.0; Win64; x64" },
    MacOS: { versions: ["macOS 15", "macOS 14"], ua: () => "Macintosh; Intel Mac OS X 10_15_7" },
    Linux: { versions: ["Ubuntu 24.04", "Ubuntu 22.04"], ua: () => "X11; Linux x86_64" },
    Android: { versions: ["Android 15", "Android 14"], ua: () => "Linux; Android 14; Pixel 8" },
    iOS: { versions: ["iOS 18", "iOS 17"], ua: () => "iPhone; CPU iPhone OS 17_5 like Mac OS X" },
  };
  const BROWSERS = ["Chrome", "Brave", "Opera", "Edge", "Yandex"];
  const VERSIONS = ["148.0.0.0", "147.0.0.0", "146.0.0.0"];
  const COUNTRIES = ["DE (Germany)", "US (United States)", "GB (United Kingdom)", "FR (France)", "VN (Vietnam)", "SG (Singapore)", "JP (Japan)"];
  const TABS = ["Overview", "Proxy", "Extensions", "Timezone", "WebRTC", "Geolocation", "Advanced", "Cookies", "Bookmarks"];

  const form = {
    os: "Windows", osVersion: "Windows 11", browser: "Chrome", version: VERSIONS[0], customUA: false,
    proxyMode: "free", country: COUNTRIES[0], ptype: "HTTP", host: "", port: "", user: "", pass: "", quick: "",
    tzAuto: true, webrtc: "altered", geo: "ask", geoAuto: true, canvas: true, webgl: true, audio: true, cores: "8", memory: "8",
  };
  let activeTab = "Overview";

  /* ---------- helpers ---------- */
  function parseProxy(raw) {
    let s = String(raw || "").trim();
    if (!s) return null;
    let scheme = null;
    const m = s.match(/^([a-z0-9]+):\/\/(.*)$/i);
    if (m) { scheme = m[1].toLowerCase(); s = m[2]; }
    let host, port, user = "", pass = "";
    const at = s.lastIndexOf("@");
    if (at > -1) {
      const cred = s.slice(0, at); const hp = s.slice(at + 1).split(":");
      const i = cred.indexOf(":"); user = i < 0 ? cred : cred.slice(0, i); pass = i < 0 ? "" : cred.slice(i + 1);
      [host, port] = hp;
    } else {
      const p = s.split(":");
      if (p.length !== 2 && p.length !== 4) return null;
      [host, port, user = "", pass = ""] = p;
    }
    if (!host || !/^\d+$/.test(port || "") || +port < 1 || +port > 65535) return null;
    return { scheme, host, port, user, pass };
  }
  window.__parseProxy = parseProxy; // exposed for manual/automated checks

  let toastTimer;
  function toast(msg) {
    const t = $("#toast"); t.textContent = msg; t.classList.add("show");
    clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove("show"), 2600);
  }

  /* ---------- theme ---------- */
  function setTheme(t) {
    document.documentElement.dataset.theme = t;
    try { localStorage.setItem("herov-proto-theme", t); } catch (_) { /* storage may be blocked */ }
  }
  try { const t = localStorage.getItem("herov-proto-theme"); if (t === "dark" || t === "light") setTheme(t); } catch (_) { /* ignore */ }
  $("#btn-theme").addEventListener("click", () => setTheme(document.documentElement.dataset.theme === "dark" ? "light" : "dark"));

  /* ---------- views ---------- */
  function showView(v) {
    const isNew = v === "new";
    $("#view-profiles").hidden = isNew; $("#view-new").hidden = !isNew;
    $("#page-title").textContent = isNew ? "New profile" : "Profiles";
    $("#nav-profiles").classList.toggle("is-active", !isNew);
    if (isNew) { renderTabs(); renderPanel(); $("#f-name").focus(); } else { renderProfiles(); }
  }
  $("#btn-new").addEventListener("click", () => showView("new"));
  $("#btn-quick").addEventListener("click", () => { showView("new"); $("#f-name").value = `Profile ${nextId}`; });
  $("#nav-profiles").addEventListener("click", () => showView("profiles"));
  $("#nav-proxies").addEventListener("click", () => { location.href = "../proxies/index.html"; });
  $("#btn-reload").addEventListener("click", () => { renderProfiles(); toast("List refreshed"); });

  /* ---------- profiles list ---------- */
  function renderFolders() {
    const items = [{ id: "all", name: "All", color: null }, ...FOLDERS];
    $("#folder-list").innerHTML = items.map((f) => `
      <button type="button" class="nav-item${f.id === activeFolder ? " is-active" : ""}" data-folder="${f.id}" ${f.id === activeFolder ? 'aria-current="true"' : ""}>
        ${f.color ? `<span class="dot" style="background:${f.color}"></span>` : ""}${esc(f.name)}
      </button>`).join("");
  }
  $("#folder-list").addEventListener("click", (e) => {
    const b = e.target.closest("[data-folder]"); if (!b) return;
    activeFolder = b.dataset.folder; renderProfiles();
  });
  $("#search").addEventListener("input", (e) => { query = e.target.value.trim().toLowerCase(); renderProfiles(); });

  function renderProfiles() {
    renderFolders();
    const list = profiles.filter((p) => (activeFolder === "all" || p.folder === activeFolder) && (!query || p.name.toLowerCase().includes(query)));
    $("#rows").innerHTML = list.length ? list.map((p, i) => `
      <tr data-id="${p.id}" class="${p.id === lastCreatedId ? "is-new" : ""}">
        <td><input class="chk row-chk" type="checkbox" aria-label="Select ${esc(p.name)}"></td>
        <td class="num">${i + 1}</td>
        <td><span class="name">${esc(p.name)}<span class="os" aria-hidden="true"><i></i><i></i><i></i><i></i></span></span></td>
        <td>${esc(p.browser)}</td>
        <td><span class="status">${esc(p.status)}</span></td>
        <td>${esc(p.ptype)}</td>
        <td class="mono"><span class="flag" aria-hidden="true">${esc(p.cc)}</span>${esc(p.proxy)}</td>
        <td style="white-space:nowrap;text-align:right">
          <button type="button" class="btn-run" data-run="${p.id}">Run</button>
          <span class="kebab-wrap"><button type="button" class="icon-btn" aria-haspopup="menu" aria-expanded="false" aria-label="Actions for ${esc(p.name)}" data-kebab="${p.id}">${icon("more")}</button></span>
        </td>
      </tr>`).join("") : `<tr class="empty-row"><td colspan="8">No profiles match.</td></tr>`;
    lastCreatedId = null;
    $("#chk-all").checked = false;
  }
  $("#chk-all").addEventListener("change", (e) => document.querySelectorAll(".row-chk").forEach((c) => (c.checked = e.target.checked)));
  $("#rows").addEventListener("click", (e) => {
    const run = e.target.closest("[data-run]");
    if (run) { const p = profiles.find((x) => x.id === +run.dataset.run); toast(`Launching “${p.name}” (prototype)`); return; }
    const k = e.target.closest("[data-kebab]");
    if (k) { openMenu(k); }
  });

  /* kebab menu */
  let openedMenu = null;
  function closeMenu(returnFocus) {
    if (!openedMenu) return;
    const { menu, btn } = openedMenu; menu.remove(); btn.setAttribute("aria-expanded", "false"); openedMenu = null;
    if (returnFocus && btn.isConnected) btn.focus();
  }
  function openMenu(btn) {
    if (openedMenu && openedMenu.btn === btn) { closeMenu(true); return; }
    closeMenu();
    const menu = document.createElement("div"); menu.className = "menu"; menu.setAttribute("role", "menu");
    const id = +btn.dataset.kebab;
    [["Edit"], ["Sharing"], ["Manage in folder"], ["Duplicate"], ["Delete", "danger"]].forEach(([label, cls]) => {
      const b = document.createElement("button"); b.type = "button"; b.setAttribute("role", "menuitem"); b.textContent = label; if (cls) b.className = cls;
      b.addEventListener("click", () => { closeMenu(true); doAction(label, id); });
      menu.appendChild(b);
    });
    btn.parentElement.appendChild(menu); btn.setAttribute("aria-expanded", "true"); openedMenu = { menu, btn };
    menu.querySelector("button").focus();
    menu.addEventListener("keydown", (e) => {
      const items = [...menu.querySelectorAll("button")]; const i = items.indexOf(document.activeElement);
      if (e.key === "ArrowDown") { e.preventDefault(); items[(i + 1) % items.length].focus(); }
      if (e.key === "ArrowUp") { e.preventDefault(); items[(i - 1 + items.length) % items.length].focus(); }
      if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); closeMenu(true); }
      if (e.key === "Tab") closeMenu();
    });
  }
  document.addEventListener("click", (e) => { if (openedMenu && !openedMenu.menu.contains(e.target) && !openedMenu.btn.contains(e.target)) closeMenu(); });
  function doAction(label, id) {
    const i = profiles.findIndex((p) => p.id === id); if (i < 0) return;
    if (label === "Duplicate") { const c = { ...profiles[i], id: nextId++, name: profiles[i].name + " (copy)" }; profiles.splice(i + 1, 0, c); lastCreatedId = c.id; renderProfiles(); toast("Profile duplicated"); }
    else if (label === "Delete") { const [d] = profiles.splice(i, 1); renderProfiles(); toast(`Moved “${d.name}” to trash (prototype)`); }
    else toast(`${label} — not part of this prototype`);
  }

  /* ---------- new profile: tabs ---------- */
  function renderTabs() {
    $("#tablist").innerHTML = TABS.map((t) => `
      <button type="button" class="nav-item" role="tab" id="tab-${t}" aria-controls="panel-${t}" aria-selected="${t === activeTab}" tabindex="${t === activeTab ? 0 : -1}" data-tab="${t}">${t}</button>`).join("");
  }
  $("#tablist").addEventListener("click", (e) => { const b = e.target.closest("[data-tab]"); if (b) selectTab(b.dataset.tab); });
  $("#tablist").addEventListener("keydown", (e) => {
    const i = TABS.indexOf(activeTab); let n = null;
    if (e.key === "ArrowDown") n = (i + 1) % TABS.length;
    if (e.key === "ArrowUp") n = (i - 1 + TABS.length) % TABS.length;
    if (e.key === "Home") n = 0;
    if (e.key === "End") n = TABS.length - 1;
    if (n !== null) { e.preventDefault(); selectTab(TABS[n], true); }
  });
  function selectTab(t, focus) { activeTab = t; renderTabs(); renderPanel(); if (focus) $(`#tab-${t}`).focus(); }

  const seg = (name, opts, cur, badge) => `<div class="seg" role="radiogroup" aria-label="${name}">${opts.map((o) =>
    `<label><span>${esc(o)}${badge && badge[o] ? ` <span class="badge">${badge[o]}</span>` : ""}</span><input type="radio" name="${name}" value="${esc(o)}" ${o === cur ? "checked" : ""}><span class="rd"></span></label>`).join("")}</div>`;
  const sel = (id, opts, cur, label) => `<select class="select" id="${id}" aria-label="${label}">${opts.map((o) => `<option ${o === cur ? "selected" : ""}>${esc(o)}</option>`).join("")}</select>`;
  const toggle = (id, on, title, desc) => `<label class="toggle"><input type="checkbox" id="${id}" ${on ? "checked" : ""}><span><b>${title}</b><span>${desc}</span></span></label>`;
  const MODE_LABEL = { free: "Free proxy", own: "Your proxy", none: "Without proxy" };

  const PANELS = {
    Overview: () => `
      <div class="group"><h2 class="sect">Operating system (OS)</h2>
        <p class="hint">Use the same operating system as this machine for the best performance.</p>
        ${seg("os", Object.keys(OS), form.os)}
        <div class="row2">${sel("osVersion", OS[form.os].versions, form.osVersion, "OS version")}<input class="field" readonly aria-label="Platform string" value="${esc(OS[form.os].ua(form.osVersion))}"></div></div>
      <div class="group"><h2 class="sect">Browser</h2>
        ${seg("browser", BROWSERS, form.browser)}
        ${sel("version", VERSIONS, form.version, "Browser version")}</div>
      <div class="group">${toggle("customUA", form.customUA, "Customize user agent", "Not recommended — the default keeps the profile consistent with its fingerprint.")}</div>`,
    Proxy: () => `
      <div class="group" style="max-width:none"><h2 class="sect">Proxy information</h2>
        <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap">
          ${seg("proxyMode", Object.values(MODE_LABEL), MODE_LABEL[form.proxyMode], { "Free proxy": "Use now" }).replace('class="seg"', 'class="seg" style="margin:0"')}
          <button type="button" class="icon-btn" aria-label="Open proxy manager" title="Proxy manager">${icon("server")}</button>
        </div></div>
      ${form.proxyMode === "free" ? `<div class="group"><p class="label">Country</p>${sel("country", COUNTRIES, form.country, "Country")}</div>` : ""}
      ${form.proxyMode === "own" ? `
      <div class="group"><p class="label">Connection type</p>${sel("ptype", ["HTTP", "HTTPS", "SOCKS4", "SOCKS5"], form.ptype, "Connection type")}</div>
      <div class="group"><p class="label" id="qa-label">Quick add <span class="help" title="Paste host:port:user:pass, user:pass@host:port or scheme://… — fields below fill automatically." aria-label="Quick add help">?</span></p>
        <input class="field" id="quick" aria-labelledby="qa-label" placeholder="host:port:user:pass" value="${esc(form.quick)}" autocomplete="off" spellcheck="false"></div>
      <div class="group"><p class="label">Or enter proxy information below</p>
        <div class="fields">
          <div class="row2 wide-left"><input class="field" id="host" placeholder="IP address / host" aria-label="Host" value="${esc(form.host)}" spellcheck="false"><input class="field" id="port" placeholder="Port" aria-label="Port" inputmode="numeric" value="${esc(form.port)}"></div>
          <input class="field" id="user" placeholder="Username" aria-label="Username" value="${esc(form.user)}" autocomplete="off">
          <input class="field" id="pass" type="password" placeholder="Password" aria-label="Password" value="${esc(form.pass)}" autocomplete="off">
        </div></div>
      <div class="group" style="display:flex;align-items:center"><button type="button" class="btn btn-secondary" id="btn-check">${icon("search-check", 18)}Check proxy</button><span id="check-result" class="check-result" role="status" aria-live="polite"></span></div>` : ""}
      ${form.proxyMode === "none" ? `<div class="group"><p class="hint">This profile connects directly. Your real IP is visible to websites.</p></div>` : ""}`,
    Extensions: () => `<div class="group"><h2 class="sect">Extensions</h2><div class="empty"><span>No extensions added to this profile.</span><button type="button" class="btn btn-secondary">Add extension</button></div></div>`,
    Timezone: () => `<div class="group"><h2 class="sect">Timezone</h2>${toggle("tzAuto", form.tzAuto, "Based on IP", "Match the timezone to the proxy's location.")}</div>`,
    WebRTC: () => `<div class="group"><h2 class="sect">WebRTC</h2>${seg("webrtc", ["Altered", "Real", "Disabled"], cap(form.webrtc))}<p class="hint">Altered replaces your local and public IP in WebRTC with the proxy's.</p></div>`,
    Geolocation: () => `<div class="group"><h2 class="sect">Geolocation</h2>${seg("geo", ["Ask", "Allow", "Block"], cap(form.geo))}${toggle("geoAuto", form.geoAuto, "Based on IP", "Use coordinates that match the proxy's location.")}</div>`,
    Advanced: () => `<div class="group"><h2 class="sect">Fingerprint</h2>
      ${toggle("canvas", form.canvas, "Canvas noise", "Adds stable per-profile noise to canvas readouts.")}
      ${toggle("webgl", form.webgl, "WebGL noise", "Randomizes WebGL image output consistently.")}
      ${toggle("audio", form.audio, "Audio context noise", "Perturbs AudioContext fingerprints.")}</div>
      <div class="group row2"><div><p class="label">CPU cores</p>${sel("cores", ["2", "4", "8", "12", "16"], form.cores, "CPU cores")}</div><div><p class="label">Device memory (GB)</p>${sel("memory", ["2", "4", "8", "16"], form.memory, "Device memory")}</div></div>`,
    Cookies: () => `<div class="group"><h2 class="sect">Cookies</h2><p class="hint">Paste cookies (JSON) to import into this profile.</p><textarea class="field" aria-label="Cookies JSON" placeholder='[{"name":"…","value":"…","domain":"…"}]' spellcheck="false"></textarea></div>`,
    Bookmarks: () => `<div class="group"><h2 class="sect">Bookmarks</h2><div class="empty"><span>No bookmarks yet.</span><button type="button" class="btn btn-secondary">Add bookmark</button></div></div>`,
  };
  function cap(s) { return s[0].toUpperCase() + s.slice(1); }

  function renderPanel() {
    $("#tabpanels").innerHTML = `<div class="tabpanel" role="tabpanel" id="panel-${activeTab}" aria-labelledby="tab-${activeTab}">${PANELS[activeTab]()}</div>`;
  }

  /* delegated form state */
  $("#tabpanels").addEventListener("change", (e) => {
    const t = e.target, n = t.name || t.id;
    if (t.type === "radio") {
      if (n === "os") { form.os = t.value; form.osVersion = OS[t.value].versions[0]; renderPanel(); $(`input[name=os][value="${t.value}"]`).focus(); }
      else if (n === "browser") form.browser = t.value;
      else if (n === "proxyMode") { form.proxyMode = Object.keys(MODE_LABEL).find((k) => MODE_LABEL[k] === t.value); renderPanel(); $(`input[name=proxyMode][value="${t.value}"]`).focus(); }
      else if (n === "webrtc") form.webrtc = t.value.toLowerCase();
      else if (n === "geo") form.geo = t.value.toLowerCase();
    } else if (t.type === "checkbox") form[n] = t.checked;
    else if (t.tagName === "SELECT") { form[n] = t.value; if (n === "osVersion") renderPanel(); }
  });
  $("#tabpanels").addEventListener("input", (e) => {
    const t = e.target;
    if (t.id === "quick") {
      form.quick = t.value; const p = parseProxy(t.value);
      if (p) {
        Object.assign(form, { host: p.host, port: p.port, user: p.user, pass: p.pass });
        if (p.scheme) { const m = { http: "HTTP", https: "HTTPS", socks4: "SOCKS4", socks5: "SOCKS5" }[p.scheme]; if (m) { form.ptype = m; $("#ptype").value = m; } }
        ["host", "port", "user", "pass"].forEach((k) => { $("#" + k).value = form[k]; });
      }
    } else if (["host", "port", "user", "pass"].includes(t.id)) form[t.id] = t.value;
  });
  $("#tabpanels").addEventListener("click", (e) => {
    if (!e.target.closest("#btn-check")) return;
    const out = $("#check-result"), btn = $("#btn-check");
    const okHost = form.host.trim() && /^\d+$/.test(form.port) && +form.port > 0 && +form.port < 65536;
    if (!okHost) { out.className = "check-result err"; out.textContent = "Enter a valid host and port first."; return; }
    btn.disabled = true; out.className = "check-result"; out.innerHTML = '<span class="spin" style="display:inline-block;vertical-align:-3px"></span> Checking…';
    setTimeout(() => {
      btn.disabled = false; out.className = "check-result ok";
      out.textContent = `Reachable · ${80 + Math.floor(Math.random() * 120)} ms (simulated)`;
    }, 900);
  });

  /* ---------- create ---------- */
  $("#f-folder").innerHTML = `<option value="">Choose folder</option>` + FOLDERS.map((f) => `<option value="${f.id}">${esc(f.name)}</option>`).join("");
  $("#f-name").addEventListener("input", (e) => { e.target.removeAttribute("aria-invalid"); $("#name-err").textContent = ""; });
  $("#btn-create").addEventListener("click", () => {
    const nameEl = $("#f-name"); const name = nameEl.value.trim();
    if (!name) { nameEl.setAttribute("aria-invalid", "true"); $("#name-err").textContent = "Profile name is required"; nameEl.focus(); toast("Give the profile a name"); return; }
    const own = form.proxyMode === "own" && form.host && form.port;
    const p = {
      id: nextId++, name, browser: form.browser, status: "Ready",
      ptype: own ? (form.ptype[0] + form.ptype.slice(1).toLowerCase()) : form.proxyMode === "free" ? "Http" : "—",
      cc: form.proxyMode === "free" ? form.country.slice(0, 2) : "—",
      proxy: own ? `${form.host}:${form.port}` : form.proxyMode === "free" ? "auto · free pool" : "direct",
      folder: $("#f-folder").value || "",
    };
    profiles.unshift(p); lastCreatedId = p.id;
    nameEl.value = ""; Object.assign(form, { host: "", port: "", user: "", pass: "", quick: "" }); activeTab = "Overview";
    activeFolder = "all"; showView("profiles"); toast(`Profile “${p.name}” created`);
  });

  document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeMenu(true); });
  renderProfiles();
  if (location.hash === "#new") showView("new"); // deep link from other windows' "+" button
})();
