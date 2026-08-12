(function () {
  "use strict";
  const D = window.OR_DATA, SVGNS = "http://www.w3.org/2000/svg";
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const SERIES_LABEL = { cpi_yoy: "TÜFE (yıllık %)", usdtry: "USD/TRY", policy_rate: "Politika faizi (%)" };
  const SRC = { cpi_yoy: "TÜİK", usdtry: "TCMB", policy_rate: "TCMB" };
  const VLABEL = { bullseye: "TAM İSABET", strong: "İSABETLİ", near: "KIL PAYI", direction: "YÖN DOĞRU", off: "SAPMA", pending: "BEKLİYOR", na: "KOŞULLU" };
  const VCOLOR = { bullseye: "#00C08B", strong: "#37d6a6", near: "#F2B441", direction: "#5B9DFF", off: "#FF7A6B", pending: "#7C8CA5", na: "#4a5b78" };
  const MONTHS = ["Oca", "Şub", "Mar", "Nis", "May", "Haz", "Tem", "Ağu", "Eyl", "Eki", "Kas", "Ara"];

  const el = (n, a, kids) => { const e = document.createElementNS(SVGNS, n); for (const k in (a || {})) e.setAttribute(k, a[k]); (kids || []).forEach(c => e.appendChild(c)); return e; };
  const trNum = v => (v == null ? "" : String(v).replace(".", ","));
  const fmt = (ind, v) => v == null ? "" : (ind === "usdtry" ? trNum(v) + " TL" : "%" + trNum(v));
  const prd = p => { const [y, m] = p.split("-"); return MONTHS[+m - 1] + " " + y.slice(2); };
  const byId = id => D.calls.find(c => c.id === id);

  // window of a series up to horizon
  function windowOf(ind, horizon, back) {
    const rows = (D.series[ind] || []).filter(r => r.t <= horizon);
    return rows.slice(Math.max(0, rows.length - (back + 1)));
  }

  // Build an SVG chart element for a call. Returns {svg, animate}
  function chart(call, W, H, opts) {
    const bcast = !!(opts && opts.broadcast);   // broadcast export = bigger type + consolidated callout
    const ind = call.indicator, pts = windowOf(ind, call.horizon_period, 15);
    const padL = bcast ? 54 : 44, padT = bcast ? 40 : 34, padR = W * 0.30, padB = bcast ? 50 : 40;
    const plotW = W - padL - padR, plotH = H - padT - padB;
    const vals = pts.map(p => p.v).concat([call.forecast_num, call.realised_num, call.forecast_low, call.forecast_high, call.consensus].filter(v => v != null));
    let lo = Math.min(...vals), hi = Math.max(...vals); const pad = (hi - lo) * (bcast ? 0.13 : 0.28) || 2; lo -= pad; hi += pad;
    const n = pts.length;
    const X = i => padL + (n <= 1 ? 0 : i / (n - 1)) * plotW;
    const Y = v => padT + (1 - (v - lo) / (hi - lo)) * plotH;
    const hx = X(n - 1);
    const svg = el("svg", { class: bcast ? "or-svg bcast" : "or-svg", viewBox: `0 0 ${W} ${H}`, preserveAspectRatio: "xMidYMid meet" });

    // grid + y labels
    for (let g = 0; g <= 3; g++) { const yv = lo + (hi - lo) * g / 3, y = Y(yv);
      svg.appendChild(el("line", { class: "grid-line", x1: padL, x2: W - padR + 18, y1: y, y2: y }));
      const t = el("text", { class: "axis-lbl", x: padL - 8, y: y + 4, "text-anchor": "end" }); t.textContent = trNum(Math.round(yv)); svg.appendChild(t); }
    // x labels (first + last)
    [0, n - 1].forEach(i => { const t = el("text", { class: "axis-lbl", x: X(i), y: H - 14, "text-anchor": i ? "middle" : "start" }); t.textContent = prd(pts[i].t); svg.appendChild(t); });
    // title
    const ti = el("text", { class: "title-lbl", x: padL, y: 18 }); ti.textContent = SERIES_LABEL[ind]; svg.appendChild(ti);

    // forecast band (range)
    if (call.forecast_low != null) svg.appendChild(el("rect", { x: padL, y: Y(call.forecast_high), width: hx - padL, height: Y(call.forecast_low) - Y(call.forecast_high), fill: "#5B9DFF", opacity: .14 }));

    // series path
    const dpath = pts.map((p, i) => (i ? "L" : "M") + X(i).toFixed(1) + " " + Y(p.v).toFixed(1)).join(" ");
    const path = el("path", { class: "series-line", d: dpath });
    svg.appendChild(path);

    // ---- markers + annotations (broadcast callout vs. live inline labels) ----
    let consEls = [], fc, fcl = null, realEls = [], seal = null;
    const fY = Y(call.forecast_num != null ? call.forecast_num : (call.realised_num != null ? call.realised_num : lo));

    if (bcast) {
      // consensus diamond only — its value is folded into the callout below
      if (call.consensus != null) {
        const cm = el("rect", { class: "cons-mark", x: hx - 6, y: Y(call.consensus) - 6, width: 12, height: 12, transform: `rotate(45 ${hx} ${Y(call.consensus)})`, opacity: 0 });
        svg.appendChild(cm); consEls = [cm];
      }
      // his frozen call marker (star, on the line)
      fc = el("path", { class: "fc-star", d: starPath(hx, fY, 12), opacity: 0 });
      svg.appendChild(fc);
      // one consolidated callout in the right margin (no overlapping micro-labels)
      const rows = [{ k: "İAS DEMİŞTİ", v: call.forecast_num != null ? fmt(ind, call.forecast_num) : (call.forecast_label || ""), c: "#5B9DFF" }];
      if (call.realised_num != null) rows.push({ k: "GERÇEKLEŞEN", v: fmt(ind, call.realised_num), c: VCOLOR[call.verdict] });
      if (call.consensus != null) rows.push({ k: "PİYASA", v: fmt(ind, call.consensus), c: "#7C8CA5" });
      const cx0 = hx + 30, cw = Math.max(214, W - 14 - cx0), rowH = 52, coPad = 18, ch = rows.length * rowH + coPad;
      const convY = call.realised_num != null ? (fY + Y(call.realised_num)) / 2 : fY;
      const cyTop = Math.min(Math.max(convY - ch / 2, padT + 68), H - padB - ch - 6);
      const g = el("g", { opacity: 0 });
      g.appendChild(el("rect", { x: cx0, y: cyTop, width: cw, height: ch, rx: 12, fill: "rgba(10,23,48,.92)", stroke: "#26406e" }));
      rows.forEach((r, i) => {
        const ry = cyTop + coPad / 2 + i * rowH;
        const kt = el("text", { x: cx0 + 18, y: ry + 19, style: "font-family:var(--mono);font-size:14px;letter-spacing:.08em;fill:#8ea0bd" }); kt.textContent = r.k;
        const vt = el("text", { x: cx0 + 18, y: ry + 46, style: "font-family:var(--display);font-weight:900;font-size:28px;fill:" + r.c }); vt.textContent = r.v;
        g.appendChild(kt); g.appendChild(vt);
      });
      svg.appendChild(g);
      // realised dot + leader line to the callout + gap
      let rc = null, gap = null, leader = null;
      if (call.realised_num != null) {
        leader = el("line", { x1: hx + 9, y1: Y(call.realised_num), x2: cx0, y2: cyTop + ch / 2, stroke: "#26406e", "stroke-width": 1.5, opacity: 0 });
        if (call.forecast_num != null && Math.abs(call.realised_num - call.forecast_num) > 0.2)
          gap = el("line", { class: "gap-line", x1: hx, x2: hx, y1: fY, y2: Y(call.realised_num), stroke: VCOLOR[call.verdict], opacity: 0 });
        rc = el("circle", { cx: hx, cy: Y(call.realised_num), r: 8, fill: VCOLOR[call.verdict], stroke: "#0A1730", "stroke-width": 2.5, opacity: 0 });
        if (gap) svg.appendChild(gap);
        svg.appendChild(leader); svg.appendChild(rc);
      }
      realEls = [leader, gap, rc, g].filter(Boolean);
      // notary seal — DOĞRULANDI only on true bullseyes, with its own clear space above the callout
      if (call.verdict === "bullseye" && call.realised_num != null) {
        const sx = cx0 + cw * 0.5, sy = Math.max(padT + 46, cyTop - 54);
        seal = makeSeal(sx + 48, sy + 54); svg.appendChild(seal);
      }
    } else {
      // consensus ghost
      if (call.consensus != null) {
        const cm = el("rect", { class: "cons-mark", x: hx - 5, y: Y(call.consensus) - 5, width: 10, height: 10, transform: `rotate(45 ${hx} ${Y(call.consensus)})`, opacity: .0 });
        const cl = el("text", { class: "cons-lbl", x: hx - 12, y: Y(call.consensus) + 4, "text-anchor": "end", opacity: 0 }); cl.textContent = call.consensus_label || "Piyasa";
        svg.appendChild(cm); svg.appendChild(cl); consEls = [cm, cl];
      }
      // forecast star (his frozen call) + label (left)
      fc = el("path", { class: "fc-star", d: starPath(hx, fY, 9), opacity: 0 });
      fcl = el("text", { class: "fc-lbl", x: hx - 14, y: fY - 12, "text-anchor": "end", opacity: 0 });
      fcl.textContent = "İAS demişti: " + (call.forecast_num != null ? fmt(ind, call.forecast_num) : (call.forecast_label || ""));
      svg.appendChild(fc); svg.appendChild(fcl);
      // realised dot + label (right)
      if (call.realised_num != null) {
        const rc = el("circle", { cx: hx, cy: Y(call.realised_num), r: 6.5, fill: VCOLOR[call.verdict], stroke: "#0A1730", "stroke-width": 2, opacity: 0 });
        const rl = el("text", { class: "real-lbl", x: hx + 14, y: Y(call.realised_num) + 4, fill: VCOLOR[call.verdict], opacity: 0 }); rl.textContent = "Gerçekleşen: " + fmt(ind, call.realised_num);
        let gap = null;
        if (call.forecast_num != null && Math.abs(call.realised_num - call.forecast_num) > 0.2)
          gap = el("line", { class: "gap-line", x1: hx, x2: hx, y1: Y(call.forecast_num), y2: Y(call.realised_num), stroke: VCOLOR[call.verdict], opacity: 0 });
        if (gap) svg.appendChild(gap);
        svg.appendChild(rc); svg.appendChild(rl); realEls = [rc, rl, gap].filter(Boolean);
      }
      // seal — bullseye only (honest: DOĞRULANDI only where he nailed it exactly)
      if (call.verdict === "bullseye" && call.realised_num != null)
        { seal = makeSeal(hx, Y(call.realised_num)); svg.appendChild(seal); }
    }

    function animate() {
      if (reduce) { fc.style.opacity = fcl.style.opacity = 1; realEls.forEach(e => e.style.opacity = 1); consEls.forEach(e => e.style.opacity = .85); if (seal) seal._inner.style.opacity = 1; return; }
      // 1) his frozen call appears
      fc.animate([{ opacity: 0, transform: "scale(0)" }, { opacity: 1, transform: "scale(1)" }], { duration: 420, fill: "forwards", easing: "cubic-bezier(.2,1.4,.3,1)" });
      fcl.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 500, delay: 150, fill: "forwards" });
      consEls.forEach(e => e.animate([{ opacity: 0 }, { opacity: .85 }], { duration: 500, delay: 250, fill: "forwards" }));
      // 2) official line draws across time
      const L = path.getTotalLength(); path.style.strokeDasharray = L; path.style.strokeDashoffset = L;
      path.animate([{ strokeDashoffset: L }, { strokeDashoffset: 0 }], { duration: 1500, delay: 500, fill: "forwards", easing: "cubic-bezier(.5,0,.2,1)" });
      // 3) reality lands + seal thunks
      realEls.forEach(e => e.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 400, delay: 1950, fill: "forwards" }));
      if (seal) seal._inner.animate([{ opacity: 0, transform: "scale(1.7) rotate(-14deg)" }, { opacity: 1, transform: "scale(.95) rotate(3deg)" }, { opacity: 1, transform: "scale(1) rotate(0)" }],
        { duration: 620, delay: 2080, fill: "forwards", easing: "cubic-bezier(.3,1.5,.4,1)" });
    }
    const parts = { fc, fcl, consEls, path, realEls, seal, L: 0 };
    return { svg, animate, parts };
  }

  // Deterministic replay of the reveal as a pure function of normalized time t∈[0,1].
  // Used by the export studio so each captured frame is frame-perfect regardless of
  // screenshot latency (a still is simply seek(parts, 1)).
  const easeOutBack = x => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2); };
  const easeInOutCubic = x => x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
  function seek(parts, t) {
    const { fc, fcl, consEls, path, realEls, seal } = parts;
    const cl = x => Math.max(0, Math.min(1, x)), seg = (a, b) => cl((t - a) / (b - a));
    const p1 = seg(0, 0.14);
    fc.style.transformBox = "fill-box"; fc.style.transformOrigin = "center";
    fc.style.opacity = cl(p1 * 1.4); fc.style.transform = "scale(" + easeOutBack(p1).toFixed(3) + ")";
    if (fcl) fcl.style.opacity = seg(0.05, 0.20);
    consEls.forEach(e => e.style.opacity = (0.85 * seg(0.08, 0.22)).toFixed(3));
    const L = parts.L || (parts.L = path.getTotalLength());
    path.style.strokeDasharray = L; path.style.strokeDashoffset = (L * (1 - easeInOutCubic(seg(0.18, 0.66)))).toFixed(2);
    realEls.forEach(e => e.style.opacity = seg(0.66, 0.82));
    if (seal) {
      const ps = seg(0.72, 1.0), eb = easeOutBack(ps);
      seal._inner.style.opacity = cl(ps * 2);
      seal._inner.style.transform = "scale(" + (1.7 - 0.7 * eb).toFixed(3) + ") rotate(" + (-14 + 14 * eb).toFixed(2) + "deg)";
    }
  }

  function starPath(cx, cy, r) {
    let d = ""; for (let i = 0; i < 10; i++) { const ang = -Math.PI / 2 + i * Math.PI / 5, rad = i % 2 ? r * .45 : r; d += (i ? "L" : "M") + (cx + rad * Math.cos(ang)).toFixed(1) + " " + (cy + rad * Math.sin(ang)).toFixed(1); } return d + "Z";
  }
  function makeSeal(cx, cy) {
    // outer holds the position; inner is what we animate (so the thunk can't wipe the translate)
    const outer = el("g", { transform: `translate(${cx - 48} ${cy - 54})` });
    const inner = el("g", { class: "seal-inner", style: "opacity:0;transform-box:fill-box;transform-origin:center" });
    const R = 27;
    inner.appendChild(el("circle", { class: "seal-ring", cx: 0, cy: 0, r: R }));
    inner.appendChild(el("circle", { class: "seal-ring two", cx: 0, cy: 0, r: R - 4 }));
    const t = el("text", { class: "seal-txt", x: 0, y: 4, "text-anchor": "middle", "font-size": 10.5 }); t.textContent = "DOĞRULANDI"; inner.appendChild(t);
    const s = el("text", { class: "seal-arc", x: 0, y: -13, "text-anchor": "middle" }); s.textContent = "· TÜİK / TCMB ·"; inner.appendChild(s);
    outer.appendChild(inner); outer._inner = inner;
    return outer;
  }

  // ---- populate hero ----
  // how many calls beat the market: his forecast strictly closer to the realised value than consensus
  function beatCount() {
    return D.calls.filter(c => c.consensus != null && c.forecast_num != null && c.realised_num != null &&
      Math.abs(c.forecast_num - c.realised_num) < Math.abs(c.consensus - c.realised_num)).length;
  }

  function hero() {
    // flagship = sep2025-cut250: receipt dated 04.09.2025, decision 11.09.2025 — airtight precedence
    const call = byId("sep2025-cut250");
    const q = document.getElementById("heroQuote");
    q.innerHTML = `<span style="color:var(--steel)">Bazıları 300 dedi.</span><br><span class="hl">O 250 dedi.</span><br>TCMB tam 250 indirdi.`;
    document.getElementById("heroSaid").innerHTML = `<b>4 Eylül 2025</b>, PPK'dan bir hafta önce: “${call.quote}” Bir hafta sonra faiz tam <b>%40,5</b>'e indi — baz puanına kadar öngördüğü gibi.`;
    const mat = D.calls.filter(c => !["pending", "na"].includes(c.verdict)), dr = mat.filter(c => c.verdict !== "off").length;
    document.getElementById("heroMeta").innerHTML = `<span><span class="dot">●</span> ${D.meta.bullseyes} tam isabet</span><span>${dr}/${mat.length} yönü doğru</span><span>2020–2026</span><span>TÜİK · TCMB verisiyle denetlendi</span>`;
    document.getElementById("heroProv").innerHTML = `<b>Söz:</b> ${call.outlet}, ${call.stated_date} &nbsp;·&nbsp; <b>Gerçekleşen:</b> ${SRC[call.indicator]} — ${SERIES_LABEL[call.indicator]}, ${call.horizon_period}`;
    const c = chart(call, 800, 550);
    document.getElementById("heroChart").appendChild(c.svg);
    window.__heroAnimate = c.animate;   // fired once the gift-gate hands off (or immediately if skipped)
  }

  function stats() {
    const matured = D.calls.filter(c => !["pending", "na"].includes(c.verdict));
    const dirRight = matured.filter(c => c.verdict !== "off").length;
    const items = [
      { to: D.meta.bullseyes, tmpl: "{n}", l: "tam isabet", cl: "c" },
      { to: dirRight, tmpl: "{n}/" + matured.length, l: "yönü doğru bildi", cl: "g" },
      { to: beatCount(), tmpl: "{n}", l: "kez piyasayı yendi", cl: "" },
      { to: matured.length, tmpl: "{n}", l: "denetlenen çağrı", cl: "" },
    ];
    document.getElementById("stats").innerHTML = items.map(it =>
      `<div class="stat"><div class="n ${it.cl}" data-to="${it.to}" data-tmpl="${it.tmpl}">${it.tmpl.replace("{n}", reduce ? it.to : 0)}</div><div class="l">${it.l}</div></div>`).join("");
  }

  function showcase() {
    const wrap = document.getElementById("showcase");
    const picks = D.calls.filter(c => c.showcase);
    picks.forEach(call => {
      const card = document.createElement("div"); card.className = "card";
      card.innerHTML = `<div class="card-top"><span class="who">Dr. İnanç Sözer · ${SERIES_LABEL[call.indicator]}</span><span class="chip ${call.verdict}">${VLABEL[call.verdict]}</span></div>`;
      const mount = document.createElement("div"); mount.className = "card-chart"; card.appendChild(mount);
      const body = document.createElement("div"); body.className = "card-body";
      body.innerHTML = `<p class="card-q">“${call.quote.length > 130 ? call.quote.slice(0, 128) + "…" : call.quote}”</p><div class="card-note">${call.note || ""}</div><div class="card-prov">Söz: ${call.outlet}, ${call.stated_date} · Gerçekleşen: ${SRC[call.indicator]}, ${call.horizon_period}</div>`;
      card.appendChild(body); wrap.appendChild(card);
      let built = null;
      const chartable = call.chartable && (D.series[call.indicator] || []).some(r => r.t <= call.horizon_period);
      if (chartable) { built = chart(call, 800, 450); mount.appendChild(built.svg); }
      else mount.appendChild(bigNumbers(call));
      const io = new IntersectionObserver((ents) => ents.forEach(e => { if (e.isIntersecting) { card.classList.add("in"); if (built) setTimeout(built.animate, 250); io.disconnect(); } }), { threshold: .3 });
      io.observe(card);
    });
  }
  function bigNumbers(call) {
    const svg = el("svg", { class: "or-svg", viewBox: "0 0 800 450" });
    const said = call.forecast_num != null ? fmt(call.indicator, call.forecast_num) : call.forecast_label;
    const mk = (x, lbl, val, col) => {
      const size = val.length > 9 ? 30 : (val.length > 5 ? 40 : 56);
      const a = el("text", { x, y: 188, "text-anchor": "middle", fill: "#8698b4", "font-family": "var(--mono)", "font-size": 16 }); a.textContent = lbl;
      const b = el("text", { x, y: 250, "text-anchor": "middle", fill: col, "font-family": "var(--display)", "font-weight": 900, "font-size": size }); b.textContent = val;
      svg.appendChild(a); svg.appendChild(b);
    };
    mk(210, "Dediği", said, "#5B9DFF");
    const ar = el("text", { x: 400, y: 240, "text-anchor": "middle", fill: "#EAF0F6", "font-size": 40 }); ar.textContent = "→"; svg.appendChild(ar);
    mk(600, "Gerçekleşen", call.realised_label, VCOLOR[call.verdict]);
    // small full-forecast caption under
    const cap = el("text", { x: 400, y: 330, "text-anchor": "middle", fill: "#8698b4", "font-family": "var(--mono)", "font-size": 13 });
    cap.textContent = call.forecast_label.length > 46 ? call.forecast_label.slice(0, 44) + "…" : call.forecast_label;
    svg.appendChild(cap);
    return svg;
  }

  function ledger() {
    const t = document.getElementById("ledger");
    t.innerHTML = `<div class="lrow head"><div>TARİH</div><div>GÖSTERGE</div><div>İAS DEMİŞTİ → GERÇEKLEŞEN</div><div>SONUÇ</div></div>`;
    D.calls.slice().sort((a, b) => b.stated_date < a.stated_date ? -1 : 1).forEach(c => {
      const row = document.createElement("div"); row.className = "lrow" + (c.weakest ? " weakest" : "");
      row.innerHTML = `<div class="date">${c.stated_date}${c.weakest ? '<div class="weak-tag">en zayıf çağrı · yönü yine doğruydu</div>' : ""}</div>
        <div class="ind">${SERIES_LABEL[c.indicator]}</div>
        <div class="fr"><b>${c.forecast_label}</b> → ${c.realised_label}</div>
        <div><span class="chip ${c.verdict}">${VLABEL[c.verdict]}</span></div>`;
      t.appendChild(row);
    });
  }

  // ---- animate-everything: count-up + scroll reveals ----
  function animateCount(tile) {
    const n = tile.querySelector(".n[data-to]"); if (!n) return;
    const to = +n.dataset.to, tmpl = n.dataset.tmpl, dur = 950, t0 = performance.now();
    (function tick(now) {
      const p = Math.min(1, (now - t0) / dur), v = Math.round(to * (1 - Math.pow(1 - p, 3)));
      n.textContent = tmpl.replace("{n}", v); if (p < 1) requestAnimationFrame(tick);
    })(t0);
  }
  function markReveal(el, delay) { el.classList.add("reveal"); if (delay) el.style.transitionDelay = delay + "ms"; }
  function setupReveals() {
    if (reduce) return;   // reduced motion: leave everything visible, no reveal hiding
    document.querySelectorAll(".thesis-lead,.thesis-note,.section-head,.m-card").forEach(el => markReveal(el, 0));
    document.querySelectorAll("#stats .stat").forEach((el, i) => markReveal(el, i * 80));
    document.querySelectorAll("#ledger .lrow:not(.head)").forEach((el, i) => markReveal(el, Math.min(i, 10) * 45));
    const io = new IntersectionObserver((ents) => ents.forEach(e => {
      if (e.isIntersecting) { e.target.classList.add("in"); if (e.target.matches(".stat")) animateCount(e.target); io.unobserve(e.target); }
    }), { threshold: .2, rootMargin: "0px 0px -6% 0px" });
    document.querySelectorAll(".reveal").forEach(el => io.observe(el));
  }

  // ---- gift-opening overlay: "Makbuz — Ben Sakladım" ----
  const DED = "İnanç,\nBunu yıllardır sen söylüyordun. Ben sadece kayda geçirdim.\nPiyasa şaştı, sen şaşmadın.\n— Ömer";
  function sealSVG(px) {
    return `<svg viewBox="0 0 100 100" width="${px}" height="${px}" aria-hidden="true">
      <circle cx="50" cy="50" r="34" fill="none" stroke="#00C08B" stroke-width="2.4"/>
      <circle cx="50" cy="50" r="29" fill="none" stroke="#00C08B" stroke-width="1" stroke-dasharray="2 4" opacity=".55"/>
      <text x="50" y="30" text-anchor="middle" font-family="var(--mono)" font-size="6" letter-spacing="2" fill="#00C08B">· TÜİK · TCMB ·</text>
      <text x="50" y="55" text-anchor="middle" font-family="var(--display)" font-weight="900" font-size="11.5" letter-spacing=".5" fill="#00C08B">DOĞRULANDI</text>
      <path d="M40 63 l6 6 l14 -15" fill="none" stroke="#00C08B" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>`;
  }
  function sparkSVG() {
    return `<svg viewBox="0 0 92 30" width="92" height="30" aria-hidden="true"><polyline points="2,24 18,20 34,22 50,12 66,15 82,4"
      fill="none" stroke="#C79A3A" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/><circle cx="82" cy="4" r="2.6" fill="#00A277"/></svg>`;
  }
  function receiptsHTML() {
    const cards = [["Kas 2020", "%15"], ["Eyl 2021", "%19,6"], ["Ara 2024", "%44,4"], ["Eyl 2025", "−250bp"], ["Oca 2026", "%37"]];
    return cards.map((c, i) => `<div class="rc" style="--tx:${(i - 2) * 52}px;--rot:${-10 + i * 5}deg;--tz:${-44 + i * 24}px;--d:${i * 90}ms">
      <div class="rc-date">${c[0]}</div><div class="rc-spark">${sparkSVG()}</div><div class="rc-val">${c[1]}</div></div>`).join("");
  }
  function typeOn(node, text, cps) {
    const lines = text.split("\n"); node.innerHTML = ""; let i = 0; const flat = text;
    const caret = document.createElement("span"); caret.className = "caret"; caret.textContent = "▍";
    node.appendChild(caret);
    const timer = setInterval(() => {
      i++;
      const shown = flat.slice(0, i);
      node.innerHTML = shown.replace(/\n/g, "<br>").replace("— Ömer", '<span class="sig">— Ömer</span>') + '<span class="caret">▍</span>';
      if (i >= flat.length) { clearInterval(timer); node.querySelector(".caret") && node.querySelector(".caret").remove(); }
    }, cps);
    return timer;
  }
  function gateCountUp(o) {
    o.querySelectorAll(".gg-caption [data-to]").forEach(s => {
      const to = +s.dataset.to, t0 = performance.now();
      (function tk(now) { const p = Math.min(1, (now - t0) / 700); s.textContent = Math.round(to * (1 - Math.pow(1 - p, 3))); if (p < 1) requestAnimationFrame(tk); })(t0);
    });
  }
  function runGiftGate(done) {
    const matured = D.calls.filter(c => !["pending", "na"].includes(c.verdict)).length;
    const dirRight = D.calls.filter(c => !["pending", "na"].includes(c.verdict) && c.verdict !== "off").length;
    document.body.classList.add("gate-lock");
    const o = document.createElement("div"); o.id = "giftgate"; o.setAttribute("role", "dialog"); o.setAttribute("aria-label", "Açılış");
    o.innerHTML = `
      <div class="gg-grid"></div><div class="gg-aura"></div><div class="gg-scan"></div>
      <div class="gg-live"><span class="gg-dot"></span>ARŞİV · <span class="gg-tc">00:00:00</span></div>
      <button class="gg-skip" type="button">Geç ↦</button>
      <div class="gg-stage">
        <div class="gg-forwho wipe">İnanç için</div>
        <div class="gg-rule"></div>
        <div class="gg-reason">
          <span class="l wipe">Yıllardır söylüyordun.</span>
          <span class="l wipe">Her sözün kayda geçti.</span>
          <span class="l wipe hot">Resmî veri <b>seni doğruladı.</b></span>
        </div>
        <div class="gg-proof">
          <div class="gg-receipts">${receiptsHTML()}</div>
          <div class="gg-seal">${sealSVG(120)}</div>
          <div class="gg-caption"><span data-to="${D.meta.bullseyes}">0</span> tam isabet&nbsp;&nbsp;·&nbsp;&nbsp;piyasayı <span data-to="${beatCount()}">0</span> kez geçti&nbsp;&nbsp;·&nbsp;&nbsp;<span data-to="${dirRight}">0</span>/${matured} çağrıda yön doğru</div>
        </div>
        <div class="gg-ded"></div>
        <div class="gg-title wipe">
          <span class="wordmark"><span>ON</span> RECORD</span>
          <div class="gg-tag">SÖYLEM <span>×</span> GERÇEKLEŞEN</div>
          <div class="gg-by">Dr. İnanç Sözer · TÜİK · TCMB verisiyle denetlendi</div>
        </div>
      </div>`;
    document.body.appendChild(o);
    const q = s => o.querySelector(s);
    // cursor parallax — the scene tilts like a hologram you look around
    const stage = q(".gg-stage");
    o.addEventListener("mousemove", e => {
      const r = o.getBoundingClientRect();
      stage.style.setProperty("--px", ((e.clientX / r.width - .5) * 12).toFixed(2) + "deg");
      stage.style.setProperty("--py", ((.5 - e.clientY / r.height) * 8).toFixed(2) + "deg");
    });
    const tcEl = q(".gg-tc"), t0 = performance.now();
    const tcTimer = setInterval(() => { const s = Math.floor((performance.now() - t0) / 1000); tcEl.textContent = "00:00:" + String(s).padStart(2, "0"); }, 250);
    const timers = []; let done_ = false;
    const at = (ms, fn) => timers.push(setTimeout(fn, ms));

    // pacing: each line gets real reading time (~1.2s); the dedication is the longest hold
    at(40, () => o.classList.add("in"));
    at(120, () => q(".gg-live").classList.add("show"));
    at(220, () => q(".gg-rule").classList.add("draw"));
    at(700, () => q(".gg-forwho").classList.add("show"));
    at(1400, () => o.querySelectorAll(".gg-reason .l")[0].classList.add("show"));
    at(2600, () => o.querySelectorAll(".gg-reason .l")[1].classList.add("show"));
    at(3800, () => o.querySelectorAll(".gg-reason .l")[2].classList.add("show"));
    at(5400, () => { q(".gg-reason").classList.add("mini"); q(".gg-forwho").classList.add("mini"); q(".gg-proof").classList.add("show"); o.querySelectorAll(".rc").forEach(c => c.classList.add("in")); });
    at(6100, () => { q(".gg-caption").classList.add("show"); gateCountUp(o); });
    at(6900, () => { q(".gg-seal").classList.add("thunk"); o.classList.add("bloom", "shake"); });
    at(7150, () => o.classList.remove("bloom", "shake"));
    at(8000, () => { q(".gg-reason").classList.add("gone"); q(".gg-forwho").classList.add("gone"); q(".gg-proof").classList.add("gone"); q(".gg-rule").classList.add("fade"); });
    at(8600, () => { const d = q(".gg-ded"); d.classList.add("show"); typeOn(d, DED, 34); });
    at(13000, () => q(".gg-ded").classList.add("gone"));
    at(13700, () => q(".gg-title").classList.add("show"));
    at(15100, finish);

    function finish() {
      if (done_) return; done_ = true;
      timers.forEach(clearTimeout); clearInterval(tcTimer);
      document.removeEventListener("keydown", onKey);
      o.classList.add("out"); try { sessionStorage.setItem("onrecord_opened", "1"); } catch (e) {}
      setTimeout(() => { o.remove(); done && done(); }, 600);
    }
    function onKey(e) { if (e.key === "Escape") finish(); }
    q(".gg-skip").addEventListener("click", finish);
    document.addEventListener("keydown", onKey);
  }
  function startHero() { document.body.classList.remove("gate-lock"); if (window.__heroAnimate) window.__heroAnimate(); }

  // Expose the engine so the export studio reuses the exact same chart/seal code (no drift).
  window.OR_ENGINE = { chart, seek, makeSeal, bigNumbers, byId, fmt, prd, windowOf, VLABEL, VCOLOR, SERIES_LABEL, SRC, D };

  // Only auto-populate when we're on the main page (export.html has no #heroChart).
  if (document.getElementById("heroChart")) {
    hero(); stats(); showcase(); ledger(); setupReveals();
    let opened = false; try { opened = sessionStorage.getItem("onrecord_opened"); } catch (e) {}
    // gift opening runs only from the private #hediye entry (Ömer's WhatsApp link);
    // public visits go straight to the credential page — the dedication stays personal
    const wantGate = location.hash === "#hediye";
    if (wantGate && !reduce && !opened) runGiftGate(startHero);
    else startHero();
    const replay = document.getElementById("replayOpen");
    if (replay) replay.addEventListener("click", () => runGiftGate(startHero));
  }
})();
