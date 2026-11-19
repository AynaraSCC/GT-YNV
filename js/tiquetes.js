// Golden Ticket — cuadrícula de números y compra.
// Con js/config.js vacío funciona en modo demostración (no vende nada).
(() => {
  const cfg = window.GT_CONFIG || {};
  const live = Boolean(cfg.supabaseUrl && cfg.supabaseAnonKey);
  const grid = document.getElementById("ticket-grid");
  if (!grid) return;

  const status = document.getElementById("ticket-status");
  const note = document.getElementById("ticket-note");
  const search = document.getElementById("ticket-search");
  const dialog = document.getElementById("buy-dialog");
  const form = document.getElementById("buy-form");
  const errorBox = document.getElementById("buy-error");
  const pad = (n) => String(n).padStart(3, "0");
  const cells = [];

  // Pintar los 1000 números
  const frag = document.createDocumentFragment();
  for (let n = 1; n <= 1000; n += 1) {
    const el = document.createElement(live ? "button" : "div");
    el.className = "ticket-number";
    el.textContent = pad(n);
    el.dataset.n = n;
    if (live) { el.type = "button"; el.setAttribute("aria-label", `Número ${pad(n)} disponible`); }
    cells.push(el);
    frag.appendChild(el);
  }
  grid.appendChild(frag);
  grid.classList.toggle("is-live", live);

  // Buscar un número
  search?.addEventListener("input", () => {
    const n = Number(search.value);
    cells.forEach((c) => c.classList.remove("is-found"));
    if (n >= 1 && n <= 1000) {
      const c = cells[n - 1];
      c.classList.add("is-found");
      c.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  });

  if (!live) return; // ---- desde aquí, solo con la venta habilitada ----

  note.innerHTML = "<span>ⓘ</span> Toca un número dorado para comprarlo. Los números en gris ya fueron vendidos y los punteados están en proceso de pago.";
  const api = cfg.supabaseUrl.replace(/\/$/, "");
  const headers = { apikey: cfg.supabaseAnonKey, Authorization: `Bearer ${cfg.supabaseAnonKey}` };
  let states = {};

  async function refresh() {
    try {
      const r = await fetch(`${api}/rest/v1/estado_tiquetes?select=numero,estado&estado=neq.disponible`, { headers });
      if (!r.ok) throw new Error(r.status);
      const rows = await r.json();
      states = {};
      rows.forEach((row) => { states[row.numero] = row.estado; });
      cells.forEach((c, i) => {
        const st = states[i + 1] || "disponible";
        c.classList.toggle("is-sold", st === "vendido");
        c.classList.toggle("is-held", st === "reservado");
        c.disabled = st !== "disponible";
        c.setAttribute("aria-label", `Número ${pad(i + 1)} ${st === "vendido" ? "vendido" : st === "reservado" ? "en proceso de pago" : "disponible"}`);
      });
      const libres = 1000 - rows.length;
      status.textContent = `${libres} DE 1000`;
    } catch (e) {
      status.textContent = "SIN CONEXIÓN";
    }
  }
  refresh();
  setInterval(() => { if (!document.hidden) refresh(); }, 20000);
  document.addEventListener("visibilitychange", () => { if (!document.hidden) refresh(); });

  // Abrir el formulario
  let chosen = null;
  grid.addEventListener("click", (e) => {
    const c = e.target.closest(".ticket-number");
    if (!c || c.disabled) return;
    chosen = Number(c.dataset.n);
    document.getElementById("buy-number").textContent = pad(chosen);
    errorBox.hidden = true;
    dialog.showModal();
  });
  dialog.addEventListener("click", (e) => { if (e.target === dialog || e.target.closest("[data-close]")) dialog.close(); });

  // Enviar: apartar número y saltar a Wompi
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    errorBox.hidden = true;
    if (!form.reportValidity()) return;
    const fd = new FormData(form);
    const btn = form.querySelector(".buy-submit");
    btn.disabled = true; btn.firstChild.textContent = "Apartando tu número… ";
    try {
      const r = await fetch(`${api}/functions/v1/reservar`, {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({
          numero: chosen,
          nombre: fd.get("nombre"), cedula: fd.get("cedula"), telefono: fd.get("telefono"),
          email: fd.get("email"), celebracion: fd.get("celebracion"), acepta: fd.get("acepta") === "on",
        }),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data.error || "No se pudo apartar el número.");
      try { sessionStorage.setItem("gt-compra", JSON.stringify({ numero: chosen, referencia: data.referencia })); } catch (_) {}
      // Formulario oculto hacia el checkout de Wompi
      const go = document.createElement("form");
      go.method = "GET"; go.action = "https://checkout.wompi.co/p/";
      Object.entries(data.checkout).forEach(([k, v]) => {
        const i = document.createElement("input"); i.type = "hidden"; i.name = k; i.value = v; go.appendChild(i);
      });
      document.body.appendChild(go);
      go.submit();
    } catch (err) {
      errorBox.textContent = err.message;
      errorBox.hidden = false;
      btn.disabled = false; btn.firstChild.textContent = "Continuar al pago ";
      refresh();
    }
  });
})();
