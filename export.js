/* On Record — export composition builder.
   Reads ?id=<callId|summary>&fmt=16x9|1x1|9x16&kind=still|motion, builds a full-bleed
   broadcast/social frame reusing the exact same chart engine (window.OR_ENGINE), and
   exposes window.OR_EXPORT.seek(t) so the Playwright driver can render frame-perfect MP4s. */
(function () {
  "use strict";
  const E = window.OR_ENGINE, D = E.D;
  const P = new URLSearchParams(location.search);
  const id = P.get("id") || "jan2026-cut100";
  const fmt = P.get("fmt") || "16x9";
  const kind = P.get("kind") || "still";
  const stage = document.getElementById("stage");
  stage.classList.add("f-" + fmt, "k-" + kind);
  if (id === "summary") stage.classList.add("k-summary");

  // chart viewBox tuned per format so it fills its mount with minimal letterboxing
  const VB = { "16x9": { w: 900, h: 700 }, "1x1": { w: 960, h: 540 }, "9x16": { w: 900, h: 720 }, "og": { w: 900, h: 540 } }[fmt];

  // Hand-crafted broadcast headlines for the showcase calls; template fallback otherwise.
  const HEAD = {
    "nov2020-hike15": `Faiz <span class="dim">%15 olur</span> dedi.<br><span class="hl">Tam %15 oldu.</span>`,
    "sep2021-cpi20": `Eylül enflasyonu <span class="dim">%20</span> dedi.<br><span class="hl">%19,6 geldi.</span>`,
    "sep2025-cut250": `<span class="dim">250 baz puan</span> iner dedi.<br><span class="hl">Tam 250 indi.</span>`,
    "jan2026-cut100": `Piyasa <span class="dim">150</span> dedi.<br>O <span class="hl">100</span> dedi.<br>TCMB 100 indirdi.`,
    "timing-11sep": `İlk indirim <span class="dim">11 Eylül'de</span><br>başlar dedi. <span class="hl">Gününe tuttu.</span>`,
    "ye2024-cpi45": `Yıl sonu <span class="dim">%45 üstü</span> dedi.<br><span class="hl">%44,4 geldi.</span>`,
    "ye2025-cpi28": `Dezenflasyon sürer,<br><span class="dim">%28</span> dedi. <span class="hl">Yön doğru.</span>`,
  };

  const wordmark = small => `<div class="wordmark${small ? " small" : ""}"><span>ON</span> RECORD</div>`;
  const el = (cls, html) => { const d = document.createElement("div"); d.className = cls; if (html != null) d.innerHTML = html; return d; };

  const top = el("ex-top");
  top.innerHTML = wordmark(false) + `<span class="ex-src mono">TÜİK · TCMB İLE DENETLENDİ</span>`;
  const foot = el("ex-foot");
  foot.innerHTML = wordmark(true) + `<span class="url">drinancsozer.com</span>`;

  const main = el("ex-main");
  stage.appendChild(top); stage.appendChild(main); stage.appendChild(foot);

  window.OR_EXPORT = { hasMotion: false, seek: () => {}, ready: false };

  if (id === "summary") {
    const maturedArr = D.calls.filter(c => !["pending", "na"].includes(c.verdict));
    const matured = maturedArr.length, dirRight = maturedArr.filter(c => c.verdict !== "off").length;
    main.innerHTML =
      `<div class="ex-eyebrow">SÖYLEM <span class="x">×</span> GERÇEKLEŞEN</div>` +
      `<h1 class="ex-head" style="margin:22px 0 20px">Söylediğini <span class="hl">kanıtlıyor.</span></h1>` +
      `<p class="ex-subhead" style="margin:0 0 40px">Dr. İnanç Sözer'in makro çağrıları, söylendiği tarihte kayda alındı ve resmî TÜİK/TCMB verisiyle tek tek denetlendi.</p>`;
    const board = el("ex-board");
    [[D.meta.bullseyes, "tam isabet", "c"], [dirRight + "/" + matured, "yönü doğru bildi", "g"], ["2", "kez piyasayı yendi", ""], [matured, "denetlenen çağrı", ""]]
      .forEach(([n, l, cl]) => board.appendChild(el("ex-tile", `<div class="n ${cl}">${n}</div><div class="l">${l}</div>`)));
    main.appendChild(board);
    window.OR_EXPORT.ready = true;
    return;
  }

  const call = E.byId(id);
  const said = call.forecast_num != null ? E.fmt(call.indicator, call.forecast_num) : call.forecast_label;
  const headHtml = HEAD[id] || `<span class="dim">${call.forecast_label}</span><br><span class="hl">${call.realised_label}</span>`;

  const copy = el("ex-copy");
  copy.innerHTML =
    `<div class="ex-eyebrow">SÖYLEM <span class="x">×</span> GERÇEKLEŞEN` +
    `<span class="chip ${call.verdict}">${E.VLABEL[call.verdict]}</span></div>` +
    `<h1 class="ex-head">${headHtml}</h1>` +
    `<blockquote class="ex-quote">“${call.quote.length > 150 ? call.quote.slice(0, 148) + "…" : call.quote}”</blockquote>` +
    `<div class="ex-attr"><b>Dr. İnanç Sözer</b> · ${call.outlet}, ${call.stated_date}</div>`;

  const figure = document.createElement("figure"); figure.className = "ex-chart";
  const mount = el("ex-mount");
  const prov = el("ex-prov",
    `<span><b>Söz:</b> ${call.outlet}, ${call.stated_date}</span>` +
    `<span><b>Gerçekleşen:</b> ${E.SRC[call.indicator]} — ${E.SERIES_LABEL[call.indicator]}, ${call.horizon_period}</span>`);
  figure.appendChild(mount); figure.appendChild(prov);

  main.appendChild(copy); main.appendChild(figure);

  const chartable = call.chartable && (D.series[call.indicator] || []).some(r => r.t <= call.horizon_period);
  if (chartable) {
    const built = E.chart(call, VB.w, VB.h, { broadcast: true });
    mount.appendChild(built.svg);
    window.OR_EXPORT.hasMotion = true;
    window.OR_EXPORT.seek = t => E.seek(built.parts, t);
    E.seek(built.parts, kind === "motion" ? 0 : 1);   // stills start fully revealed
  } else {
    // Non-chartable calls (rate-level or timing) → clean HTML "said → happened" panel.
    // (SVG bigNumbers() is built for short values and overflows on long date strings.)
    const said2 = call.forecast_num != null ? E.fmt(call.indicator, call.forecast_num) : call.forecast_label;
    const panel = el("ex-numbers");
    panel.innerHTML =
      `<div class="ex-col"><span class="k">İAS DEMİŞTİ</span><span class="v" style="color:var(--dir)">${said2}</span></div>` +
      `<div class="ex-arrow">→</div>` +
      `<div class="ex-col"><span class="k">GERÇEKLEŞEN</span><span class="v" style="color:${E.VCOLOR[call.verdict]}">${call.realised_label}</span></div>`;
    mount.appendChild(panel);
  }
  window.OR_EXPORT.ready = true;
})();
