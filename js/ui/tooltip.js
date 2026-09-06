export function mostrarTooltip(elementos, xPagina, yPagina) {
  elementos.tooltip.hidden = false;
  elementos.tooltip.style.left = `${xPagina + 14}px`;
  elementos.tooltip.style.top = `${yPagina + 14}px`;
}

export function ocultarTooltip(elementos) {
  elementos.tooltip.hidden = true;
}