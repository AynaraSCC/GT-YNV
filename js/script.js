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
