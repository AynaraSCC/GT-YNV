// Carrusel "Lo hacemos parte de tu historia": 3 de quince, 3 de boda y 3 de grado.
// Cada espacio puede ser VIDEO (assets/video/quince-1.mp4) o FOTO (assets/images/quince-1.jpg).
// Si existen los dos, se usa el video. Los espacios vacíos se saltan.
const reel = document.getElementById("story-reel");
if (reel) {
  const slides = [...reel.querySelectorAll(".reel-slide")];
  const bars = [...reel.querySelectorAll(".reel-progress i")];
  const catLabel = reel.querySelector(".reel-cat");
  const soundBtn = document.getElementById("reel-sound");
  const options = [...document.querySelectorAll(".prize-option")];
  const PHOTO_MS = 4000;
  const MAX_VIDEO_MS = 20000;
  let order = slides.map((_, i) => i); // índices que se muestran
  let pos = 0;
  let timer = null;
  let visible = false;
  let muted = true;

  const exists = (url) => fetch(url, { method: "HEAD" }).then((r) => r.ok && !/text\/html/.test(r.headers.get("content-type") || "")).catch(() => false);
  const loadImage = (url) => new Promise((res) => { const img = new Image(); img.onload = () => res(true); img.onerror = () => res(false); img.src = url; });

  async function detect(slide) {
    const base = slide.dataset.base;
    const videoUrl = `assets/video/${base}.mp4`;
    if (await exists(videoUrl)) {
      const v = document.createElement("video");
      v.src = videoUrl; v.muted = true; v.playsInline = true; v.preload = "metadata";
      v.setAttribute("playsinline", ""); v.setAttribute("muted", "");
      slide.prepend(v);
      slide.classList.add("has-photo", "has-video");
      return true;
    }
    const imgUrl = `assets/images/${base}.jpg`;
    if (await loadImage(imgUrl)) {
      slide.style.backgroundImage = `url("${imgUrl}")`;
      slide.classList.add("has-photo");
      return true;
    }
    return false;
  }

  Promise.all(slides.map(detect)).then((found) => {
    if (found.some(Boolean)) {
      order = slides.map((_, i) => i).filter((i) => found[i]);
      slides.forEach((s, i) => { if (!found[i]) { s.hidden = true; bars[i].hidden = true; } });
      // los botones de opción saltan al primer espacio con contenido de su celebración
      options.forEach((o) => {
        const first = order.findIndex((i) => slides[i].dataset.cat === o.dataset.cat);
        o.dataset.pos = first;
      });
    }
    if (soundBtn) soundBtn.hidden = !slides.some((s) => s.classList.contains("has-video"));
    show(Math.min(pos, order.length - 1));
  });

  function show(next) {
    clearTimeout(timer);
    pos = (next + order.length) % order.length;
    const index = order[pos];
    slides.forEach((s, i) => {
      s.classList.toggle("is-active", i === index);
      const v = s.querySelector("video");
      if (v && i !== index) v.pause();
    });
    bars.forEach((b, i) => {
      b.classList.toggle("is-done", order.indexOf(i) > -1 && order.indexOf(i) < pos);
      b.classList.remove("is-active");
    });
    const slide = slides[index];
    catLabel.textContent = slide.dataset.label;
    options.forEach((o) => o.classList.toggle("is-active", o.dataset.cat === slide.dataset.cat));
    const video = slide.querySelector("video");
    const start = (ms) => {
      reel.style.setProperty("--reel-duration", `${ms}ms`);
      void reel.offsetWidth; // reinicia la barra
      bars[index].classList.add("is-active");
      if (visible && !document.hidden) timer = setTimeout(() => show(pos + 1), ms);
    };
    if (video) {
      video.muted = muted;
      video.currentTime = 0;
      if (visible && !document.hidden) video.play().catch(() => {});
      const go = () => start(Math.min((video.duration || 6) * 1000, MAX_VIDEO_MS));
      if (video.readyState >= 1) go(); else video.addEventListener("loadedmetadata", go, { once: true });
    } else {
      start(PHOTO_MS);
    }
  }

  soundBtn?.addEventListener("click", () => {
    muted = !muted;
    slides.forEach((s) => { const v = s.querySelector("video"); if (v) v.muted = muted; });
    soundBtn.setAttribute("aria-pressed", String(!muted));
    soundBtn.setAttribute("aria-label", muted ? "Activar sonido" : "Silenciar");
  });
  reel.querySelector(".reel-next").addEventListener("click", () => show(pos + 1));
  reel.querySelector(".reel-prev").addEventListener("click", () => show(pos - 1));
  options.forEach((o) => o.addEventListener("click", () => {
    const target = o.dataset.pos !== undefined ? Number(o.dataset.pos) : order.indexOf(Number(o.dataset.jump));
    if (target >= 0) show(target);
    if (window.innerWidth < 800) reel.scrollIntoView({ behavior: "smooth", block: "center" });
  }));

  let startX = null;
  reel.addEventListener("touchstart", (e) => { startX = e.touches[0].clientX; }, { passive: true });
  reel.addEventListener("touchend", (e) => {
    if (startX === null) return;
    const dx = e.changedTouches[0].clientX - startX;
    if (Math.abs(dx) > 40) show(pos + (dx < 0 ? 1 : -1));
    startX = null;
  });

  const pauseAll = () => { clearTimeout(timer); slides.forEach((s) => s.querySelector("video")?.pause()); };
  new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    reel.classList.toggle("is-paused", !visible);
    if (visible) show(pos); else pauseAll();
  }, { threshold: 0.25 }).observe(reel);
  document.addEventListener("visibilitychange", () => (document.hidden ? pauseAll() : visible && show(pos)));
}

// Desglose "¿Qué incluye?" por celebración
const inclTabs = [...document.querySelectorAll(".incl-tab")];
const inclPanels = [...document.querySelectorAll(".incl-panel")];
function showIncluded(cat) {
  inclTabs.forEach((t) => {
    const on = t.dataset.cat === cat;
    t.classList.toggle("is-active", on);
    t.setAttribute("aria-selected", String(on));
  });
  inclPanels.forEach((p) => { p.hidden = p.dataset.cat !== cat; });
}
inclTabs.forEach((t) => t.addEventListener("click", () => showIncluded(t.dataset.cat)));
document.querySelectorAll(".prize-option").forEach((o) => o.addEventListener("click", () => showIncluded(o.dataset.cat)));

// Video de la portada: botón de sonido y pausa cuando no se ve (ahorra batería)
const heroVideo = document.getElementById("hero-video");
const heroSound = document.getElementById("hero-sound");
if (heroVideo && heroSound) {
  heroSound.addEventListener("click", () => {
    heroVideo.muted = !heroVideo.muted;
    if (!heroVideo.muted) { heroVideo.currentTime = 0; heroVideo.play().catch(() => {}); }
    heroSound.setAttribute("aria-pressed", String(!heroVideo.muted));
    heroSound.setAttribute("aria-label", heroVideo.muted ? "Activar sonido" : "Silenciar");
  });
  new IntersectionObserver(([e]) => {
    if (e.isIntersecting) heroVideo.play().catch(() => {}); else heroVideo.pause();
  }, { threshold: 0.2 }).observe(heroVideo);
}
