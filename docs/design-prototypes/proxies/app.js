/* HeroV Browser — Proxies window prototype. Vanilla JS, no deps.
   ALL network behavior (check, free pool, ProxyShard orders) is SIMULATED with timers and synthetic data
   (documentation-range IPs: 203.0.113.x, 198.51.100.x, 192.0.2.x). Real calls go through the launcher backend. */
(() => {
  "use strict";
  const $ = (s, el = document) => el.querySelector(s);
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const icon = (id, size) => `<svg class="ico"${size ? ` style="width:${size}px;height:${size}px"` : ""}><use href="#i-${id}"/></svg>`;

  /* ---------- data ---------- */
  const COUNTRIES = [["DE", "Germany"], ["US", "United States"], ["GB", "United Kingdom"], ["FR", "France"], ["VN", "Vietnam"], ["SG", "Singapore"], ["JP", "Japan"]];
  const cname = (cc) => (COUNTRIES.find((c) => c[0] === cc) || [cc, "Unknown"])[1];
  const SOURCES = [["all", "All sources"], ["free", "Free pool"], ["proxyshard", "ProxyShard"], ["imported", "Imported"], ["manual", "Manual"]];
  const SRC_LABEL = { free: "Free pool", proxyshard: "ProxyShard", imported: "Imported", manual: "Manual" };
  const TYPES = ["HTTP", "HTTPS", "SOCKS4", "SOCKS5"];

  let nextId = 1;
  const probe = (p) => (p.port % 7 === 0 ? { status: "dead", latency: null } : { status: "alive", latency: 40 + ((p.port * 13) % 300) });
  const mk = (name, type, host, port, user, cc, source, used = 0, checked = true) => {
    const p = { id: nextId++, name, type, host, port: +port, user: user || "", pass: user ? "secret" : "", cc, source, used, status: "new", latency: null };
    if (checked) Object.assign(p, probe(p));
    return p;
  };
  const proxies = [
    mk("US residential 1", "SOCKS5", "203.0.113.18", 1080, "u1", "US", "proxyshard", 3),
    mk("DE residential 1", "SOCKS5", "203.0.113.41", 1080, "u1", "DE", "proxyshard", 2),
    mk("Static IPv4 · 01", "HTTP", "198.51.100.12", 8080, "u2", "GB", "proxyshard", 1),
    mk("Static IPv4 · 02", "HTTP", "198.51.100.13", 8081, "u2", "GB", "proxyshard", 0),
    mk("Office proxy", "HTTPS", "192.0.2.50", 3128, "", "VN", "manual", 4),
    mk("SG datacenter", "SOCKS5", "192.0.2.77", 7000, "u3", "SG", "imported", 0),
    mk("FR free 1", "HTTP", "198.51.100.88", 8888, "", "FR", "free", 0),
    mk("JP free 1", "SOCKS5", "198.51.100.91", 4500, "", "JP", "free", 0, false),
    mk("US datacenter", "HTTP", "203.0.113.200", 9001, "u4", "US", "imported", 1, false),
  ];

  let source = "all", status = "all", query = "";
  const selected = new Set();
  let tab = "Free";
  const form = {
    free: { cc: "DE", type: "HTTP", qty: 5 },
    imp: { text: "", type: "HTTP" },
    man: { type: "HTTP", quick: "", host: "", port: "", user: "", pass: "" },
    ps: { connected: false, key: "" },
  };
  const byId = (id) => proxies.find((p) => p.id === id);
  const addr = (p) => `${p.host}:${p.port}`;

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
  window.__parseProxy = parseProxy;
  const typeFromScheme = (sc, def) => ({ http: "HTTP", https: "HTTPS", socks4: "SOCKS4", socks5: "SOCKS5" }[sc] || def);

  let toastTimer;
  function toast(msg) {
    const t = $("#toast"); t.textContent = msg; t.classList.add("show");
    clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove("show"), 2800);
  }
  function setTheme(t) { document.documentElement.dataset.theme = t; try { localStorage.setItem("herov-proto-theme", t); } catch (_) { /* blocked */ } }
  try { const t = localStorage.getItem("herov-proto-theme"); if (t === "dark" || t === "light") setTheme(t); } catch (_) { /* ignore */ }
  $("#btn-theme").addEventListener("click", () => setTheme(document.documentElement.dataset.theme === "dark" ? "light" : "dark"));
  $("#nav-profiles").addEventListener("click", () => { location.href = "../new-profile-flow/index.html"; });
  $("#btn-new").addEventListener("click", () => { location.href = "../new-profile-flow/index.html#new"; });
  $("#btn-quick").addEventListener("click", () => { location.href = "../new-profile-flow/index.html#new"; });

  /* ---------- list ---------- */
  const matches = (p, src, st) => (src === "all" || p.source === src) && (st === "all" || p.status === st) &&
    (!query || (p.name + " " + p.host + " " + cname(p.cc)).toLowerCase().includes(query));

  function renderPanel() {
    $("#source-list").innerHTML = SOURCES.map(([id, label]) => {
      const n = proxies.filter((p) => id === "all" || p.source === id).length;
      return `<button type="button" class="nav-item${id === source ? " is-active" : ""}" data-source="${id}" ${id === source ? 'aria-current="true"' : ""}>${esc(label)}<span class="count">${n}</span></button>`;
    }).join("");
  }
  function renderSeg() {
    const opts = [["all", "All"], ["alive", "Alive"], ["dead", "Dead"], ["new", "Unchecked"]];
    $("#status-seg").innerHTML = opts.map(([id, label]) => {
      const n = proxies.filter((p) => matches(p, source, id)).length;
      return `<label><span>${label}<span style="margin-left:6px;opacity:.7">${n}</span></span><input type="radio" name="status" value="${id}" ${id === status ? "checked" : ""}><span class="rd"></span></label>`;
    }).join("");
  }
  const pill = (p) => ({
    alive: '<span class="status">Alive</span>',
    dead: '<span class="status is-error">Dead</span>',
    checking: '<span class="status is-warn"><span class="spin" style="width:10px;height:10px;display:inline-block;vertical-align:-1px;margin-right:6px;border-width:1.5px"></span>Checking</span>',
    new: '<span class="status is-idle">Unchecked</span>',
  })[p.status];
  function meter(p) {
    if (p.status !== "alive" || p.latency == null) return '<span class="meter none">—</span>';
    const cls = p.latency < 120 ? "good" : p.latency < 250 ? "mid" : "bad";
    const fill = Math.max(8, Math.min(100, 100 - p.latency / 4));
    return `<span class="meter ${cls}"><span><i style="width:${fill}%"></i></span>${p.latency} ms</span>`;
  }
  function renderRows() {
    const list = proxies.filter((p) => matches(p, source, status));
    $("#rows").innerHTML = list.length ? list.map((p) => `
      <tr data-id="${p.id}">
        <td><input class="chk row-chk" type="checkbox" aria-label="Select ${esc(p.name)}" ${selected.has(p.id) ? "checked" : ""}></td>
        <td><span class="name">${esc(p.name)}${p.user ? `<span title="Requires login" style="color:var(--on-surface-3)">${icon("lock", 14)}<span class="sr-only">Requires login</span></span>` : ""}</span><span class="sub">${esc(p.type)} · ${esc(addr(p))}</span></td>
        <td><span class="flag" aria-hidden="true">${esc(p.cc)}</span>${esc(cname(p.cc))}</td>
        <td>${pill(p)}</td>
        <td>${meter(p)}</td>
        <td>${p.used ? `${p.used} profile${p.used > 1 ? "s" : ""}` : '<span style="color:var(--on-surface-3)">—</span>'}</td>
        <td style="text-align:right">
          <button type="button" class="tool-btn" data-check="${p.id}" aria-label="Check ${esc(p.name)}" title="Check" style="display:inline-grid;vertical-align:middle">${icon("refresh", 20)}</button>
          <span class="kebab-wrap"><button type="button" class="icon-btn" aria-haspopup="menu" aria-expanded="false" aria-label="Actions for ${esc(p.name)}" data-kebab="${p.id}">${icon("more")}</button></span>
        </td>
      </tr>`).join("")
      : `<tr class="empty-row"><td colspan="7">${proxies.length ? "No proxies match these filters." : "No proxies yet. Use <b>Get proxies</b> to add some."}</td></tr>`;
    updateBulk();
  }
  function updateBulk() {
    const visible = proxies.filter((p) => matches(p, source, status)).map((p) => p.id);
    const n = [...selected].filter((id) => byId(id)).length;
    $("#bulkbar").hidden = n === 0;
    $("#bulk-count").textContent = `${n} selected`;
    const all = $("#chk-all");
    const inView = visible.filter((id) => selected.has(id)).length;
    all.checked = visible.length > 0 && inView === visible.length;
    all.indeterminate = inView > 0 && inView < visible.length;
  }
  function render() { renderPanel(); renderSeg(); renderRows(); }

  $("#source-list").addEventListener("click", (e) => { const b = e.target.closest("[data-source]"); if (b) { source = b.dataset.source; render(); } });
  $("#status-seg").addEventListener("change", (e) => { status = e.target.value; render(); });
  $("#search").addEventListener("input", (e) => { query = e.target.value.trim().toLowerCase(); render(); });
  $("#chk-all").addEventListener("change", (e) => {
    proxies.filter((p) => matches(p, source, status)).forEach((p) => (e.target.checked ? selected.add(p.id) : selected.delete(p.id)));
    renderRows();
  });
  $("#rows").addEventListener("change", (e) => {
    if (!e.target.classList.contains("row-chk")) return;
    const id = +e.target.closest("tr").dataset.id;
    e.target.checked ? selected.add(id) : selected.delete(id);
    updateBulk();
  });

  /* ---------- check (simulated) ---------- */
  function check(ids) {
    ids.forEach((id, i) => {
      const p = byId(id); if (!p || p.status === "checking") return;
      p.status = "checking"; p.latency = null;
      setTimeout(() => { Object.assign(p, probe(p)); render(); }, 600 + i * 120);
    });
    render();
  }
  $("#btn-check-all").addEventListener("click", () => { const ids = proxies.filter((p) => matches(p, source, status)).map((p) => p.id); if (ids.length) { check(ids); toast(`Checking ${ids.length} prox${ids.length > 1 ? "ies" : "y"}…`); } });
  $("#rows").addEventListener("click", (e) => {
    const c = e.target.closest("[data-check]"); if (c) { check([+c.dataset.check]); return; }
    const k = e.target.closest("[data-kebab]"); if (k) openMenu(k);
  });

  /* ---------- row menu ---------- */
  let opened = null;
  function closeMenu(focus) {
    if (!opened) return; const { menu, btn } = opened; menu.remove(); btn.setAttribute("aria-expanded", "false"); opened = null;
    if (focus && btn.isConnected) btn.focus();
  }
  function openMenu(btn) {
    if (opened && opened.btn === btn) { closeMenu(true); return; }
    closeMenu();
    const id = +btn.dataset.kebab; const menu = document.createElement("div"); menu.className = "menu"; menu.setAttribute("role", "menu");
    [["Check"], ["Edit"], ["Copy address"], ["Assign to profiles"], ["Delete", "danger"]].forEach(([label, cls]) => {
      const b = document.createElement("button"); b.type = "button"; b.setAttribute("role", "menuitem"); b.textContent = label; if (cls) b.className = cls;
      b.addEventListener("click", () => { closeMenu(true); act(label, id); }); menu.appendChild(b);
    });
    btn.parentElement.appendChild(menu); btn.setAttribute("aria-expanded", "true"); opened = { menu, btn }; menu.querySelector("button").focus();
    menu.addEventListener("keydown", (e) => {
      const items = [...menu.querySelectorAll("button")]; const i = items.indexOf(document.activeElement);
      if (e.key === "ArrowDown") { e.preventDefault(); items[(i + 1) % items.length].focus(); }
      if (e.key === "ArrowUp") { e.preventDefault(); items[(i - 1 + items.length) % items.length].focus(); }
      if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); closeMenu(true); }
      if (e.key === "Tab") closeMenu();
    });
  }
  document.addEventListener("click", (e) => { if (opened && !opened.menu.contains(e.target) && !opened.btn.contains(e.target)) closeMenu(); });
  function copy(text, okMsg) {
    try { navigator.clipboard.writeText(text).then(() => toast(okMsg), () => toast("Copy isn't available here")); } catch (_) { toast("Copy isn't available here"); }
  }
  function act(label, id) {
    const p = byId(id); if (!p) return;
    if (label === "Check") check([id]);
    else if (label === "Copy address") copy(addr(p), "Address copied");
    else if (label === "Delete") askDelete([id]);
    else toast(`${label} — not part of this prototype`);
  }

  /* ---------- bulk ---------- */
  $("#bulkbar").addEventListener("click", (e) => {
    const b = e.target.closest("[data-bulk]"); if (!b) return; const ids = [...selected].filter((id) => byId(id));
    if (b.dataset.bulk === "check") { check(ids); toast(`Checking ${ids.length}…`); }
    else if (b.dataset.bulk === "copy") copy(ids.map((id) => addr(byId(id))).join("\n"), `${ids.length} addresses copied`);
    else if (b.dataset.bulk === "assign") toast("Assign to profiles — not part of this prototype");
    else if (b.dataset.bulk === "delete") askDelete(ids);
    else if (b.dataset.bulk === "clear") { selected.clear(); renderRows(); }
  });

  /* ---------- confirm delete ---------- */
  let pendingDelete = [];
  function askDelete(ids) {
    const items = ids.map(byId).filter(Boolean); if (!items.length) return;
    const used = items.reduce((n, p) => n + p.used, 0);
    $("#confirm-title").textContent = items.length === 1 ? `Delete “${items[0].name}”?` : `Delete ${items.length} proxies?`;
    $("#confirm-desc").textContent = (used ? `${used} profile${used > 1 ? "s" : ""} use ${items.length > 1 ? "these proxies" : "this proxy"} and will need another one. ` : "") + "This can't be undone.";
    pendingDelete = items.map((p) => p.id); $("#confirm").showModal(); $("#confirm-cancel").focus();
  }
  $("#confirm-cancel").addEventListener("click", () => $("#confirm").close());
  $("#confirm-ok").addEventListener("click", () => {
    pendingDelete.forEach((id) => { const i = proxies.findIndex((p) => p.id === id); if (i > -1) proxies.splice(i, 1); selected.delete(id); });
    $("#confirm").close(); render(); toast(`Deleted ${pendingDelete.length} prox${pendingDelete.length > 1 ? "ies" : "y"}`);
  });

  /* ---------- Get proxies sheet ---------- */
  const TABS = ["Free", "ProxyShard", "Import", "Manual"];
  const sheet = $("#sheet");
  const sel = (id, opts, cur, label) => `<select class="select" id="${id}" aria-label="${label}">${opts.map(([v, t]) => `<option value="${esc(v)}" ${v === cur ? "selected" : ""}>${esc(t)}</option>`).join("")}</select>`;
  const typeSeg = (name, cur, opts = ["HTTP", "SOCKS5"]) => `<div class="seg" role="radiogroup" aria-label="Connection type">${opts.map((o) => `<label><span>${o}</span><input type="radio" name="${name}" value="${o}" ${o === cur ? "checked" : ""}><span class="rd"></span></label>`).join("")}</div>`;
  const noteInfo = (html, warn) => `<div class="note${warn ? " warn" : ""}">${icon("info", 20)}<span>${html}</span></div>`;
  const ORDERS = [
    { id: "o1", title: "Residential · 5 GB", sub: "Pay-as-you-go pool · SOCKS5", count: 1, type: "SOCKS5", cc: "US", host: "192.0.2.", port: 1080 },
    { id: "o2", title: "Static IPv4 · 10 IPs", sub: "Dedicated · HTTP/SOCKS5", count: 10, type: "HTTP", cc: "GB", host: "192.0.2.", port: 8080 },
    { id: "o3", title: "Mobile · 2 ports", sub: "Rotating · SOCKS5", count: 2, type: "SOCKS5", cc: "VN", host: "192.0.2.", port: 1081 },
  ];

  const BODY = {
    Free: () => `
      ${noteInfo("Free proxies are shared and public. Expect lower speed and no guarantee — don't use them for account logins.", true)}
      <div class="group"><p class="label">Country</p>${sel("f-cc", COUNTRIES.map(([c, n]) => [c, `${c} · ${n}`]), form.free.cc, "Country")}</div>
      <div class="group"><p class="label">Connection type</p>${typeSeg("ftype", form.free.type)}</div>
      <div class="group"><p class="label" id="qty-label">How many</p>
        <div class="stepper" role="group" aria-labelledby="qty-label">
          <button type="button" id="qty-minus" aria-label="Fewer" ${form.free.qty <= 1 ? "disabled" : ""}>${icon("minus", 20)}</button>
          <output id="qty" aria-live="polite">${form.free.qty}</output>
          <button type="button" id="qty-plus" aria-label="More" ${form.free.qty >= 20 ? "disabled" : ""}>${icon("plus", 20)}</button>
        </div></div>`,
    ProxyShard: () => form.ps.connected ? `
      ${noteInfo("Demo data — real orders load from your ProxyShard account through the launcher.")}
      <div class="list">${ORDERS.map((o) => `<div class="list-row"><div class="grow"><b>${esc(o.title)}</b><small>${esc(o.sub)}</small></div><button type="button" class="btn btn-secondary btn-sm" data-import-order="${o.id}">Import</button></div>`).join("")}</div>`
      : `
      <p class="hint">Connect your ProxyShard account to import the proxies you already own.</p>
      <div class="group"><p class="label" id="ps-label">API key</p>
        <input class="field" id="ps-key" type="password" autocomplete="off" spellcheck="false" aria-labelledby="ps-label" aria-describedby="ps-err" placeholder="Paste your API key" value="${esc(form.ps.key)}">
        <p id="ps-err" class="hint" role="alert" style="color:var(--error);margin:8px 0 0"></p></div>
      ${noteInfo('New to ProxyShard? <a class="link" href="https://proxyshard.com" target="_blank" rel="noopener noreferrer">Buy proxies</a> — SOCKS5 with UDP relay. You can find your API key in the dashboard.')}`,
    Import: () => `
      <p class="hint">Paste one proxy per line: <span class="mono">host:port</span>, <span class="mono">host:port:user:pass</span>, <span class="mono">user:pass@host:port</span> or <span class="mono">socks5://…</span></p>
      <div class="group"><textarea class="field" id="imp-text" aria-label="Proxy list" spellcheck="false" placeholder="203.0.113.10:8080:user:pass&#10;socks5://user:pass@203.0.113.11:1080">${esc(form.imp.text)}</textarea></div>
      <div class="group"><p class="label">Default type (when a line has none)</p>${typeSeg("itype", form.imp.type, TYPES)}</div>
      <div id="imp-report" aria-live="polite"></div>`,
    Manual: () => `
      <div class="group"><p class="label">Connection type</p>${typeSeg("mtype", form.man.type, TYPES)}</div>
      <div class="group"><p class="label" id="mq-label">Quick add</p><input class="field" id="m-quick" aria-labelledby="mq-label" placeholder="host:port:user:pass" value="${esc(form.man.quick)}" autocomplete="off" spellcheck="false"></div>
      <div class="group"><p class="label">Or enter details</p><div class="fields">
        <div class="row2 wide-left"><input class="field" id="m-host" placeholder="IP address / host" aria-label="Host" value="${esc(form.man.host)}" spellcheck="false"><input class="field" id="m-port" placeholder="Port" aria-label="Port" inputmode="numeric" value="${esc(form.man.port)}"></div>
        <input class="field" id="m-user" placeholder="Username" aria-label="Username" value="${esc(form.man.user)}" autocomplete="off">
        <input class="field" id="m-pass" type="password" placeholder="Password" aria-label="Password" value="${esc(form.man.pass)}" autocomplete="off"></div></div>
      <p id="man-err" class="hint" role="alert" style="color:var(--error)"></p>`,
  };
  const FOOT = {
    Free: () => `<span class="grow" id="free-sum">${form.free.qty} · ${esc(cname(form.free.cc))}</span><button type="button" class="btn btn-primary btn-sm" id="free-go">Get ${form.free.qty} prox${form.free.qty > 1 ? "ies" : "y"}</button>`,
    ProxyShard: () => form.ps.connected
      ? `<span class="grow">${ORDERS.length} orders</span><button type="button" class="btn btn-text" id="ps-disc">Disconnect</button>`
      : `<span class="grow"></span><button type="button" class="btn btn-primary btn-sm" id="ps-go">Connect</button>`,
    Import: () => `<span class="grow" id="imp-sum">Nothing to import</span><button type="button" class="btn btn-primary btn-sm" id="imp-go" disabled>Import</button>`,
    Manual: () => `<span class="grow"></span><button type="button" class="btn btn-primary btn-sm" id="man-go">Add proxy</button>`,
  };

  function renderSheet() {
    $("#sheet-tabs").innerHTML = TABS.map((t) => `<button type="button" class="tab" role="tab" id="tab-${t}" aria-controls="sheet-body" aria-selected="${t === tab}" tabindex="${t === tab ? 0 : -1}" data-tab="${t}">${t}</button>`).join("");
    const body = $("#sheet-body"); body.setAttribute("role", "tabpanel"); body.setAttribute("aria-labelledby", `tab-${tab}`);
    body.innerHTML = BODY[tab](); $("#sheet-foot").innerHTML = FOOT[tab]();
    if (tab === "Import") updateImport();
  }
  function openSheet(t) { if (t) tab = t; renderSheet(); if (!sheet.open) sheet.showModal(); $(`#tab-${tab}`).focus({ focusVisible: false }); }
  $("#btn-get").addEventListener("click", () => openSheet());
  $("#sheet-close").addEventListener("click", () => sheet.close());
  sheet.addEventListener("click", (e) => { if (e.target === sheet) sheet.close(); });
  $("#sheet-tabs").addEventListener("click", (e) => { const b = e.target.closest("[data-tab]"); if (b) { tab = b.dataset.tab; renderSheet(); } });
  $("#sheet-tabs").addEventListener("keydown", (e) => {
    const i = TABS.indexOf(tab); let n = null;
    if (e.key === "ArrowRight") n = (i + 1) % TABS.length; if (e.key === "ArrowLeft") n = (i - 1 + TABS.length) % TABS.length;
    if (e.key === "Home") n = 0; if (e.key === "End") n = TABS.length - 1;
    if (n !== null) { e.preventDefault(); tab = TABS[n]; renderSheet(); $(`#tab-${tab}`).focus(); }
  });

  function addProxies(list, msg) {
    list.forEach((p) => { proxies.unshift(p); p.status = "new"; });
    source = "all"; status = "all"; query = ""; $("#search").value = "";
    sheet.close(); render(); check(list.map((p) => p.id)); toast(msg);
  }

  /* Free */
  $("#sheet-body").addEventListener("change", (e) => {
    const t = e.target;
    if (t.id === "f-cc") { form.free.cc = t.value; $("#free-sum").textContent = `${form.free.qty} · ${cname(t.value)}`; }
    else if (t.name === "ftype") form.free.type = t.value;
    else if (t.name === "itype") form.imp.type = t.value;
    else if (t.name === "mtype") form.man.type = t.value;
  });
  $("#sheet-body").addEventListener("click", (e) => {
    if (e.target.closest("#qty-minus")) { form.free.qty = Math.max(1, form.free.qty - 1); renderSheet(); $("#qty-minus").focus(); }
    else if (e.target.closest("#qty-plus")) { form.free.qty = Math.min(20, form.free.qty + 1); renderSheet(); $("#qty-plus").focus(); }
    const o = e.target.closest("[data-import-order]");
    if (o) {
      const ord = ORDERS.find((x) => x.id === o.dataset.importOrder);
      const list = Array.from({ length: ord.count }, (_, i) => mk(`${ord.title.split(" · ")[0]} ${String(i + 1).padStart(2, "0")}`, ord.type, ord.host + (20 + i), ord.port, "ps", ord.cc, "proxyshard", 0, false));
      addProxies(list, `Imported ${list.length} from ProxyShard — checking…`);
    }
  });
  $("#sheet-foot").addEventListener("click", (e) => {
    const id = e.target.closest("button") && e.target.closest("button").id;
    if (id === "free-go") {
      const btn = e.target.closest("button"); btn.disabled = true; btn.innerHTML = '<span class="spin"></span>Fetching…';
      setTimeout(() => {
        const { cc, type, qty } = form.free; const base = nextId;
        const list = Array.from({ length: qty }, (_, i) => mk(`${cc} free ${i + 1}`, type, `198.51.100.${(10 + (base + i) * 7) % 230 + 10}`, 3000 + ((base + i) * 37) % 6000, "", cc, "free", 0, false));
        addProxies(list, `${qty} free prox${qty > 1 ? "ies" : "y"} added — checking…`);
      }, 800);
    } else if (id === "ps-go") {
      const key = $("#ps-key").value.trim(); form.ps.key = key;
      if (key.length < 8) { $("#ps-err").textContent = "That API key looks too short."; $("#ps-key").setAttribute("aria-invalid", "true"); $("#ps-key").focus(); return; }
      const btn = e.target.closest("button"); btn.disabled = true; btn.innerHTML = '<span class="spin"></span>Connecting…';
      setTimeout(() => { form.ps.connected = true; renderSheet(); }, 700);
    } else if (id === "ps-disc") { form.ps = { connected: false, key: "" }; renderSheet(); }
    else if (id === "imp-go") {
      const { good } = parseList(form.imp.text);
      addProxies(good.map((g) => mk(g.host, typeFromScheme(g.scheme, form.imp.type), g.host, g.port, g.user, "—", "imported", 0, false)), `Imported ${good.length} prox${good.length > 1 ? "ies" : "y"} — checking…`);
      form.imp.text = "";
    } else if (id === "man-go") {
      const m = form.man;
      if (!m.host.trim() || !/^\d+$/.test(m.port) || +m.port < 1 || +m.port > 65535) { $("#man-err").textContent = "Enter a valid host and port."; $("#m-host").focus(); return; }
      addProxies([mk(m.host.trim(), m.type, m.host.trim(), m.port, m.user, "—", "manual", 0, false)], "Proxy added — checking…");
      Object.assign(form.man, { quick: "", host: "", port: "", user: "", pass: "" });
    }
  });
  $("#sheet-body").addEventListener("input", (e) => {
    const t = e.target;
    if (t.id === "ps-key") { t.removeAttribute("aria-invalid"); $("#ps-err").textContent = ""; }
    else if (t.id === "imp-text") { form.imp.text = t.value; updateImport(); }
    else if (t.id === "m-quick") {
      form.man.quick = t.value; const p = parseProxy(t.value);
      if (p) { Object.assign(form.man, { host: p.host, port: p.port, user: p.user, pass: p.pass }); ["host", "port", "user", "pass"].forEach((k) => { $("#m-" + k).value = form.man[k]; }); if (p.scheme && typeFromScheme(p.scheme)) { form.man.type = typeFromScheme(p.scheme); const r = $(`input[name=mtype][value="${form.man.type}"]`); if (r) r.checked = true; } }
    } else if (["m-host", "m-port", "m-user", "m-pass"].includes(t.id)) { form.man[t.id.slice(2)] = t.value; $("#man-err").textContent = ""; }
  });

  /* Import parsing */
  function parseList(text) {
    const good = [], bad = [];
    text.split(/\r?\n/).forEach((raw, i) => { const line = raw.trim(); if (!line) return; const p = parseProxy(line); p ? good.push(p) : bad.push({ n: i + 1, line }); });
    return { good, bad };
  }
  function updateImport() {
    const { good, bad } = parseList(form.imp.text);
    const report = $("#imp-report"); if (!report) return;
    report.innerHTML = (good.length || bad.length) ? `<p class="label" style="margin-bottom:4px"><span style="color:var(--success)">${good.length} valid</span> · <span${bad.length ? ' style="color:var(--error)"' : ""}>${bad.length} invalid</span></p>` +
      (bad.length ? `<div class="invalid" role="alert">${bad.slice(0, 5).map((b) => `Line ${b.n}: ${esc(b.line)}`).join("<br>")}${bad.length > 5 ? `<br>…and ${bad.length - 5} more` : ""}</div>` : "") : "";
    $("#imp-sum").textContent = good.length ? `${good.length} ready to import` : "Nothing to import";
    const go = $("#imp-go"); go.disabled = good.length === 0; go.textContent = good.length ? `Import ${good.length}` : "Import";
  }

  document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeMenu(true); });
  render();
})();
