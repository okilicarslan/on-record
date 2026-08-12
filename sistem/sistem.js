/* Harekât Masası — tek IO + tek rAF scroll + tek rAF pointermove; animasyon tamamen CSS'te.
   html.anim yoksa (JS kapalı) sayfa tamamlanmış son karesiyle statik okunur. */
(function () {
  var doc = document.documentElement;
  doc.classList.add("anim");

  // istasyonlar bir kez canlanır ve canlı kalır (hızlı scroll'da yarım sahne kalmaz)
  // uzun-hedef tuzağı: viewport'tan yüksek bölümler .35 orana asla ulaşamaz —
  // görünür yükseklik yarım ekranı geçtiyse de canlandır
  var io = new IntersectionObserver(function (ents) {
    ents.forEach(function (e) {
      if (!e.isIntersecting) return;
      if (e.intersectionRatio < 0.35 && e.intersectionRect.height < innerHeight * 0.5) return;
      e.target.classList.add("live");
      var id = e.target.id;
      if (id) document.querySelectorAll('.ray a[data-ray="' + id + '"], #yolcu [data-ray="' + id + '"]')
        .forEach(function (n) { n.classList.add("stamped"); });
      if (id === "plaka") doc.classList.add("dim");
      // sahne bitince will-change bütçesini bırak
      setTimeout(function () { e.target.classList.add("done"); }, 10000);
      io.unobserve(e.target);
    });
  }, { threshold: [0.1, 0.2, 0.35, 0.5] });
  document.querySelectorAll(".station").forEach(function (s) { io.observe(s); });

  // tek rAF scroll yazıcısı: --progress (mobil şerit) + istasyon başına --fill (omurga + mobil tilt)
  var stations = Array.prototype.slice.call(document.querySelectorAll(".s-ist"));
  var ticking = false;
  function paint() {
    ticking = false;
    var max = doc.scrollHeight - innerHeight;
    doc.style.setProperty("--progress", max > 0 ? (scrollY / max).toFixed(4) : 1);
    var mid = innerHeight * 0.6;
    stations.forEach(function (s) {
      var r = s.getBoundingClientRect();
      var fill = Math.min(1, Math.max(0, (mid - r.top) / r.height));
      s.style.setProperty("--fill", fill.toFixed(3));
    });
  }
  addEventListener("scroll", function () { if (!ticking) { ticking = true; requestAnimationFrame(paint); } }, { passive: true });
  paint();

  // cursor parallax — yalnız gerçek imleçli cihazlarda, rAF-throttled, ±3.5deg
  if (matchMedia("(hover: hover) and (pointer: fine)").matches &&
      !matchMedia("(prefers-reduced-motion: reduce)").matches) {
    var px = 0, py = 0, pending = false;
    addEventListener("pointermove", function (e) {
      px = Math.max(-3.5, Math.min(3.5, (e.clientX / innerWidth - 0.5) * 7));
      py = Math.max(-3.5, Math.min(3.5, (0.5 - e.clientY / innerHeight) * 5));
      if (!pending) { pending = true; requestAnimationFrame(function () {
        pending = false;
        doc.style.setProperty("--px", px.toFixed(2) + "deg");
        doc.style.setProperty("--py", py.toFixed(2) + "deg");
      }); }
    }, { passive: true });
  }
})();
