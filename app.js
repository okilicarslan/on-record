(function () {
  "use strict";
  const D = window.OR_DATA, SVGNS = "http://www.w3.org/2000/svg";
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const SERIES_LABEL = { cpi_yoy: "TÜFE (yıllık %)", usdtry: "USD/TRY", policy_rate: "Politika faizi (%)" };
  const SRC = { cpi_yoy: "TÜİK", usdtry: "TCMB", policy_rate: "TCMB" };
  const VLABEL = { bullseye: "TAM İSABET", strong: "İSABETLİ", near: "KIL PAYI", direction: "YÖN DOĞRU", off: "SAPTI", pending: "BEKLİYOR", na: "KOŞULLU" };
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
  function chart(call, W, H) {
    const ind = call.indicator, pts = windowOf(ind, call.horizon_period, 15);
    const padL = 44, padT = 34, padR = W * 0.30, padB = 40;
    const plotW = W - padL - padR, plotH = H - padT - padB;
    const vals = pts.map(p => p.v).concat([call.forecast_num, call.realised_num, call.forecast_low, call.forecast_high, call.consensus].filter(v => v != null));
    let lo = Math.min(...vals), hi = Math.max(...vals); const pad = (hi - lo) * 0.28 || 2; lo -= pad; hi += pad;
    const n = pts.length;
    const X = i => padL + (n <= 1 ? 0 : i / (n - 1)) * plotW;
    const Y = v => padT + (1 - (v - lo) / (hi - lo)) * plotH;
    const hx = X(n - 1);
    const svg = el("svg", { class: "or-svg", viewBox: `0 0 ${W} ${H}`, preserveAspectRatio: "xMidYMid meet" });

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

    // consensus ghost
    let consEls = [];
    if (call.consensus != null) {
      const cm = el("rect", { class: "cons-mark", x: hx - 5, y: Y(call.consensus) - 5, width: 10, height: 10, transform: `rotate(45 ${hx} ${Y(call.consensus)})`, opacity: .0 });
      const cl = el("text", { class: "cons-lbl", x: hx - 12, y: Y(call.consensus) + 4, "text-anchor": "end", opacity: 0 }); cl.textContent = call.consensus_label || "Piyasa";
      svg.appendChild(cm); svg.appendChild(cl); consEls = [cm, cl];
    }
    // forecast star (his frozen call) + label (left)
    const star = starPath(hx, Y(call.forecast_num != null ? call.forecast_num : call.realised_num), 9);
    const fc = el("path", { class: "fc-star", d: star, opacity: 0 });
    const fcl = el("text", { class: "fc-lbl", x: hx - 14, y: Y(call.forecast_num != null ? call.forecast_num : (call.realised_num || lo)) - 12, "text-anchor": "end", opacity: 0 });
    fcl.textContent = "İ.S. dedi: " + (call.forecast_num != null ? fmt(ind, call.forecast_num) : (call.forecast_label || ""));
    svg.appendChild(fc); svg.appendChild(fcl);
    // realised dot + label (right)
    let realEls = [];
    if (call.realised_num != null) {
      const rc = el("circle", { cx: hx, cy: Y(call.realised_num), r: 6.5, fill: VCOLOR[call.verdict], stroke: "#0A1730", "stroke-width": 2, opacity: 0 });
      const rl = el("text", { class: "real-lbl", x: hx + 14, y: Y(call.realised_num) + 4, fill: VCOLOR[call.verdict], opacity: 0 }); rl.textContent = "Gerçekleşen: " + fmt(ind, call.realised_num);
      // gap
      let gap = null;
      if (call.forecast_num != null && Math.abs(call.realised_num - call.forecast_num) > 0.2)
        gap = el("line", { class: "gap-line", x1: hx, x2: hx, y1: Y(call.forecast_num), y2: Y(call.realised_num), stroke: VCOLOR[call.verdict], opacity: 0 });
      if (gap) svg.appendChild(gap);
      svg.appendChild(rc); svg.appendChild(rl); realEls = [rc, rl, gap].filter(Boolean);
    }
    // seal (only for confirmed-ish)
    let seal = null;
    if (["bullseye", "strong", "near"].includes(call.verdict) && call.realised_num != null)
      { seal = makeSeal(hx, Y(call.realised_num)); svg.appendChild(seal); }

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
    return { svg, animate };
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
  function hero() {
    const call = byId("jan2026-cut100");
    const q = document.getElementById("heroQuote");
    q.innerHTML = `<span style="color:var(--steel)">Piyasa 150 dedi.</span><br><span class="hl">O 100 dedi.</span><br>TCMB 100 indirdi.`;
    document.getElementById("heroSaid").innerHTML = `<b>23 Ocak 2026</b>, PPK öncesi: “${call.quote}” Faiz tam <b>%37</b>'ye indi — konsensüsün altında, onun dediği gibi.`;
    document.getElementById("heroMeta").innerHTML = `<span><span class="dot">●</span> ${D.meta.bullseyes} tam isabet</span><span>%85 yön isabeti</span><span>2020–2026</span><span>TÜİK · TCMB denetimli</span>`;
    document.getElementById("heroProv").innerHTML = `<b>Söz:</b> ${call.outlet}, ${call.stated_date} &nbsp;·&nbsp; <b>Gerçekleşen:</b> ${SRC[call.indicator]} — ${SERIES_LABEL[call.indicator]}, ${call.horizon_period}`;
    const c = chart(call, 800, 550);
    document.getElementById("heroChart").appendChild(c.svg);
    setTimeout(c.animate, 300);
  }

  function stats() {
    const matured = D.calls.filter(c => !["pending", "na"].includes(c.verdict));
    const items = [[D.meta.bullseyes, "tam isabet", "c"], ["%85", "yön isabeti", "g"], ["2", "kez piyasayı yendi", ""], [matured.length, "denetlenen çağrı", ""]];
    document.getElementById("stats").innerHTML = items.map(([n, l, cl]) => `<div class="stat"><div class="n ${cl}">${n}</div><div class="l">${l}</div></div>`).join("");
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
    t.innerHTML = `<div class="lrow head"><div>TARİH</div><div>GÖSTERGE</div><div>DEDİĞİ → GERÇEKLEŞEN</div><div>SONUÇ</div></div>`;
    D.calls.slice().sort((a, b) => b.stated_date < a.stated_date ? -1 : 1).forEach(c => {
      const row = document.createElement("div"); row.className = "lrow" + (c.weakest ? " weakest" : "");
      row.innerHTML = `<div class="date">${c.stated_date}${c.weakest ? '<div class="weak-tag">★ en zayıf</div>' : ""}</div>
        <div class="ind">${SERIES_LABEL[c.indicator]}</div>
        <div class="fr"><b>${c.forecast_label}</b> → ${c.realised_label}</div>
        <div><span class="chip ${c.verdict}">${VLABEL[c.verdict]}</span></div>`;
      t.appendChild(row);
    });
  }

  hero(); stats(); showcase(); ledger();
})();
