// modes/dictionary.js — Modo 2: un mapa de frecuencias interactivo, sin
// depender de ninguna foto. Al pasar el mouse (o tocar) sobre el mapa,
// se arma en vivo el patrón puro de ese (u,v) + su descripción.
import { generarPatronDeFrecuencia, describirFrecuencia } from '../core/patterns.js';
import { pintarGrises, pintarGrisesEscalado } from '../ui/canvasRenderer.js';
import { coordenadasDesdeEvento } from '../core/mascaraFourier.js';

const N = 128;

function obtenerElementos() {
  return {
    canvasMapa: document.getElementById('dic-canvas-mapa'),
    canvasPatron: document.getElementById('dic-canvas-patron'),
    texto: document.getElementById('dic-texto-descripcion'),
  };
}

/** Fondo de referencia (no es la FFT de nada real): más claro en el
 * centro, más oscuro hacia los bordes — para ubicarse: centro = bajas
 * frecuencias, bordes = altas frecuencias. */
function generarFondoMapa() {
  const datos = new Float64Array(N * N);
  const centro = N / 2;
  const distMax = Math.hypot(centro, centro);
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      const d = Math.hypot(x - centro, y - centro) / distMax;
      datos[y * N + x] = (1 - d) * 170 + 25;
    }
  }
  return datos;
}

/** Cruz en el centro, para ver a simple vista dónde está u=0 y v=0. */
function dibujarEjes(canvas) {
  const ctx = canvas.getContext('2d');
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(N / 2, 0);
  ctx.lineTo(N / 2, N);
  ctx.moveTo(0, N / 2);
  ctx.lineTo(N, N / 2);
  ctx.stroke();
}

function mostrarPunto(xShift, yShift, el) {
  const u = xShift - N / 2;
  const v = yShift - N / 2;
  const patron = generarPatronDeFrecuencia(u, v, N);
  pintarGrisesEscalado(el.canvasPatron, patron, N);
  el.texto.textContent = `(u=${u}, v=${v}) — ${describirFrecuencia(u, v, N)}`;
}

export function iniciarDiccionario() {
  const el = obtenerElementos();

  pintarGrises(el.canvasMapa, generarFondoMapa(), N);
  dibujarEjes(el.canvasMapa);

  el.canvasMapa.addEventListener('mousemove', (evento) => {
    const { xShift, yShift } = coordenadasDesdeEvento(evento, el.canvasMapa, N);
    mostrarPunto(xShift, yShift, el);
  });

  el.canvasMapa.addEventListener('touchstart', (evento) => {
    const { xShift, yShift } = coordenadasDesdeEvento(evento.touches[0], el.canvasMapa, N);
    mostrarPunto(xShift, yShift, el);
  });
  el.canvasMapa.addEventListener('touchmove', (evento) => {
    evento.preventDefault(); 
    const { xShift, yShift } = coordenadasDesdeEvento(evento.touches[0], el.canvasMapa, N);
    mostrarPunto(xShift, yShift, el);
  }, { passive: false });

  mostrarPunto(N / 2, N / 2, el); 
}