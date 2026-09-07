// modes/lienzo.js — Modo 4: pintar el mapa de frecuencias desde cero

import { fft2d } from '../core/fft.js';
import { pintarGrises } from '../ui/canvasRenderer.js';
import { habilitarPincel } from '../ui/controls.js';
import { coordenadasDesdeEvento } from '../core/mascaraFourier.js';

const N = 128;
const FACTOR_ESCALA = (N * N) / 2;
const HISTORIA_MAXIMA = 50;

function obtenerElementos() {
  return {
    canvasMapa: document.getElementById('lz-canvas-mapa'),
    canvasResultado: document.getElementById('lz-canvas-resultado'),
    sliderPeso: document.getElementById('lz-slider-peso'),
    sliderPesoValor: document.getElementById('lz-slider-peso-valor'),
    sliderPincel: document.getElementById('lz-slider-pincel'),
    sliderPincelValor: document.getElementById('lz-slider-pincel-valor'),
    botonDeshacer: document.getElementById('lz-boton-deshacer'),
    botonReiniciar: document.getElementById('lz-boton-reiniciar'),
  };
}

function crearEstado() {
  return { coeficientes: new Float64Array(N * N), historia: [] };
}

function guardarHistoria(estado) {
  estado.historia.push(estado.coeficientes.slice());
  if (estado.historia.length > HISTORIA_MAXIMA) estado.historia.shift();
}

function shiftedARaw(xShift, yShift) {
  const half = N / 2;
  return { xRaw: (xShift - half + N) % N, yRaw: (yShift - half + N) % N };
}

function obtenerValorEnPunto(estado, xShift, yShift) {
  const { xRaw, yRaw } = shiftedARaw(xShift, yShift);
  return estado.coeficientes[yRaw * N + xRaw];
}

function pintarPeso(estado, xShift, yShift, radio, valor) {
  const r2 = radio * radio;
  const xMin = Math.max(0, Math.floor(xShift - radio));
  const xMax = Math.min(N - 1, Math.ceil(xShift + radio));
  const yMin = Math.max(0, Math.floor(yShift - radio));
  const yMax = Math.min(N - 1, Math.ceil(yShift + radio));
  for (let ys = yMin; ys <= yMax; ys++) {
    for (let xs = xMin; xs <= xMax; xs++) {
      const dx = xs - xShift, dy = ys - yShift;
      if (dx * dx + dy * dy > r2) continue;
      const { xRaw, yRaw } = shiftedARaw(xs, ys);
      const indice = yRaw * N + xRaw;
      const indiceSimetrico = ((N - yRaw) % N) * N + ((N - xRaw) % N);
      estado.coeficientes[indice] = valor;
      estado.coeficientes[indiceSimetrico] = valor;
    }
  }
}

function dibujarMapa(el, estado) {
  const grises = new Float64Array(N * N);
  for (let yShift = 0; yShift < N; yShift++) {
    for (let xShift = 0; xShift < N; xShift++) {
      const { xRaw, yRaw } = shiftedARaw(xShift, yShift);
      const valor = estado.coeficientes[yRaw * N + xRaw];
      grises[yShift * N + xShift] = Math.min(255, Math.abs(valor) / FACTOR_ESCALA);
    }
  }
  pintarGrises(el.canvasMapa, grises, N);
}

function dibujarResultado(el, estado) {
  const re = estado.coeficientes.slice();
  const im = new Float64Array(N * N);
  fft2d(re, im, N, true);
  const grises = new Float64Array(N * N);
  for (let i = 0; i < N * N; i++) grises[i] = Math.min(255, Math.max(0, re[i]));
  pintarGrises(el.canvasResultado, grises, N);
}

function refrescarTodo(el, estado) {
  dibujarMapa(el, estado);
  dibujarResultado(el, estado);
}

export function iniciarLienzo() {
  const el = obtenerElementos();
  const estado = crearEstado();

  let valorTrazoActual = 0;
  let esInicioDeTrazo = true;

  habilitarPincel(
    el.canvasMapa,
    () => {
      guardarHistoria(estado);
      esInicioDeTrazo = true;
    },
    (puntero) => {
      const { xShift, yShift } = coordenadasDesdeEvento(puntero, el.canvasMapa, N);
      if (esInicioDeTrazo) {
        const yaTeniaValor = obtenerValorEnPunto(estado, xShift, yShift) !== 0;
        const pesoElegido = Number(el.sliderPeso.value) * FACTOR_ESCALA;
        valorTrazoActual = yaTeniaValor ? 0 : pesoElegido;
        esInicioDeTrazo = false;
      }
      const radio = Number(el.sliderPincel.value);
      pintarPeso(estado, xShift, yShift, radio, valorTrazoActual);
      refrescarTodo(el, estado);
    }
  );

  el.sliderPeso.addEventListener('input', () => {
    el.sliderPesoValor.textContent = el.sliderPeso.value;
  });
  el.sliderPincel.addEventListener('input', () => {
    el.sliderPincelValor.textContent = el.sliderPincel.value;
  });

  el.botonDeshacer.addEventListener('click', () => {
    if (estado.historia.length === 0) return;
    estado.coeficientes = estado.historia.pop();
    refrescarTodo(el, estado);
  });

  el.botonReiniciar.addEventListener('click', () => {
    guardarHistoria(estado);
    estado.coeficientes = new Float64Array(N * N);
    refrescarTodo(el, estado);
  });

  refrescarTodo(el, estado);
}