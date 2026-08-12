/* Mühür Hattı — tek observer + tek rAF listener; animasyon tamamen CSS'te.
   html.anim yoksa (JS kapalı) sayfa tamamlanmış son karesiyle statik okunur. */
(function () {
  document.documentElement.classList.add("anim");

  // stations come alive once and stay alive (fast scroll = no half-played scenes)
  const io = new IntersectionObserver((ents) => ents.forEach((e) => {
    if (!e.isIntersecting) return;
    e.target.classList.add("live");
    const id = e.target.id;
    const node = id && document.querySelector('.ray a[data-ray="' + id + '"]');
    if (node) node.classList.add("stamped");
    io.unobserve(e.target);
  }), { threshold: 0.35 });
  document.querySelectorAll(".station").forEach((s) => io.observe(s));

  // one rAF-throttled scroll writer: global --progress + per-station --fill
  const doc = document.documentElement;
  const stations = Array.from(document.querySelectorAll(".s-ist"));
  let ticking = false;
  function paint() {
    ticking = false;
    const max = doc.scrollHeight - innerHeight;
    doc.style.setProperty("--progress", max > 0 ? (scrollY / max).toFixed(4) : 1);
    const mid = innerHeight * 0.6;
    stations.forEach((s) => {
      const r = s.getBoundingClientRect();
      const fill = Math.min(1, Math.max(0, (mid - r.top) / r.height));
      s.style.setProperty("--fill", fill.toFixed(3));
    });
  }
  addEventListener("scroll", () => { if (!ticking) { ticking = true; requestAnimationFrame(paint); } }, { passive: true });
  paint();

  // ray clicks: smooth-scroll handled by CSS scroll-behavior; nothing else to do
})();
