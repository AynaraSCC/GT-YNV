// Golden Ticket — maqueta visual. Esta cuadrícula no reserva ni vende números.
const grid = document.getElementById("ticket-grid");
if (grid) {
  const fragment = document.createDocumentFragment();
  for (let number = 1; number <= 1000; number += 1) {
    const item = document.createElement("div");
    item.className = "ticket-number";
    item.textContent = String(number).padStart(3, "0");
    item.setAttribute("aria-label", `Número ${String(number).padStart(3, "0")} — muestra visual`);
    fragment.appendChild(item);
  }
  grid.appendChild(fragment);
}

// Carrusel "Lo hacemos parte de tu historia": 3 fotos de quince, 3 de boda y 3 de grado.
const reel = document.getElementById("story-reel");
if (reel) {
  const slides = [...reel.querySelectorAll(".reel-slide")];
  const bars = [...reel.querySelectorAll(".reel-progress i")];
  const catLabel = reel.querySelector(".reel-cat");
  const options = [...document.querySelectorAll(".prize-option")];
  const DURATION = 3800;
  let index = 0;
  let timer = null;
  let visible = false;

  reel.style.setProperty("--reel-duration", `${DURATION}ms`);

  // Solo se muestra la foto si existe el archivo; si no, queda el fondo elegante de respaldo.
  slides.forEach((slide) => {
    const img = new Image();
    img.onload = () => {
      slide.style.backgroundImage = `url("${slide.dataset.src}")`;
      slide.classList.add("has-photo");
    };
    img.src = slide.dataset.src;
  });

  const show = (next) => {
    index = (next + slides.length) % slides.length;
    slides.forEach((s, i) => s.classList.toggle("is-active", i === index));
    bars.forEach((b, i) => {
      b.classList.toggle("is-done", i < index);
      b.classList.remove("is-active");
    });
    void reel.offsetWidth; // reinicia la animación de la barra activa
    bars[index].classList.add("is-active");
    const slide = slides[index];
    catLabel.textContent = slide.dataset.label;
    options.forEach((o) => o.classList.toggle("is-active", o.dataset.cat === slide.dataset.cat));
    schedule();
  };

  const schedule = () => {
    clearTimeout(timer);
    if (visible && !document.hidden) timer = setTimeout(() => show(index + 1), DURATION);
  };

  reel.querySelector(".reel-next").addEventListener("click", () => show(index + 1));
  reel.querySelector(".reel-prev").addEventListener("click", () => show(index - 1));
  options.forEach((o) => o.addEventListener("click", () => {
    show(Number(o.dataset.jump));
    if (window.innerWidth < 800) reel.scrollIntoView({ behavior: "smooth", block: "center" });
  }));

  let startX = null;
  reel.addEventListener("touchstart", (e) => { startX = e.touches[0].clientX; }, { passive: true });
  reel.addEventListener("touchend", (e) => {
    if (startX === null) return;
    const dx = e.changedTouches[0].clientX - startX;
    if (Math.abs(dx) > 40) show(index + (dx < 0 ? 1 : -1));
    startX = null;
  });

  new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    reel.classList.toggle("is-paused", !visible);
    if (visible) show(index); else clearTimeout(timer);
  }, { threshold: 0.25 }).observe(reel);
  document.addEventListener("visibilitychange", () => (document.hidden ? clearTimeout(timer) : show(index)));
  show(0);
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
