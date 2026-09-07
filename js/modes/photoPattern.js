// modes/photoPattern.js — Modo 3: foto + patrón repetitivo

import { habilitarPincel } from '../ui/controls.js';
import { prepararImagenParaFourier } from '../core/image.js';
import { desplazarEspectro } from '../core/fft.js';
import { generarRayas, generarTablero } from '../core/patterns.js';
import { pintarGrises, calcularEscalaLog, pintarLogEscalado } from '../ui/canvasRenderer.js';
import {
  crearEstadoMascara, cargarCoeficientes, alternarFrecuencia, reconstruirDesdeMascara,
  deshacer, reiniciar, coordenadasDesdeEvento, guardarHistoria, obtenerValorEnPunto, pintarConPincel,
} from '../core/mascaraFourier.js';

const N = 128;
const TAMAÑO_IMAGEN = 128;

const CICLOS_RAYAS = 10;
const CELDA_TABLERO = 8;

function obtenerElementos() {
  return {
    inputFoto: document.getElementById('fp-input-foto'),
    selectPatron: document.getElementById('fp-select-patron'),
    sliderIntensidad: document.getElementById('fp-slider-intensidad'),
    canvasOriginal: document.getElementById('fp-canvas-original'),
    canvasMapaReal: document.getElementById('fp-canvas-mapa-real'),
    canvasReconstruccion: document.getElementById('fp-canvas-reconstruccion'),
    canvasMapaUsuario: document.getElementById('fp-canvas-mapa-usuario'),
    botonDeshacer: document.getElementById('fp-boton-deshacer'),
    botonReiniciar: document.getElementById('fp-boton-reiniciar'),
    sliderPincel: document.getElementById('fp-slider-pincel'),
    sliderPincelValor: document.getElementById('fp-slider-pincel-valor'),
    botonQuitarPatron: document.getElementById('fp-boton-quitar-patron'),
  };
}

function generarPatronElegido(tipo) {
  if (tipo === 'rayas-v') return generarRayas(N, 'vertical', CICLOS_RAYAS);
  if (tipo === 'rayas-h') return generarRayas(N, 'horizontal', CICLOS_RAYAS);
  return generarTablero(N, CELDA_TABLERO);
}

function mezclarFotoYPatron(grisesFoto, patron, intensidad0a100) {
  const peso = (intensidad0a100 / 100) * 0.5;
  const mezcla = new Float64Array(TAMAÑO_IMAGEN * TAMAÑO_IMAGEN);
  for (let i = 0; i < TAMAÑO_IMAGEN * TAMAÑO_IMAGEN; i++) {
    mezcla[i] = Math.min(255, Math.max(0, grisesFoto[i] * (1 - peso) + patron[i] * peso));
  }
  return mezcla;
}

function refrescarTodo(elementos, estado) {
  const mascaraCentrada = desplazarEspectro(estado.mascara, TAMAÑO_IMAGEN);
  const logsUsuario = new Float64Array(TAMAÑO_IMAGEN * TAMAÑO_IMAGEN);
  for (let i = 0; i < TAMAÑO_IMAGEN * TAMAÑO_IMAGEN; i++) {
    logsUsuario[i] = mascaraCentrada[i] ? estado.logsReal[i] : 0;
  }
  pintarLogEscalado(elementos.canvasMapaUsuario, logsUsuario, estado.maxReal, TAMAÑO_IMAGEN);

  const imagenReconstruida = reconstruirDesdeMascara(estado, TAMAÑO_IMAGEN);
  pintarGrises(elementos.canvasReconstruccion, imagenReconstruida, TAMAÑO_IMAGEN);
}

function actualizarDesdeGrises(grises, elementos, estado) {
  pintarGrises(elementos.canvasOriginal, grises, TAMAÑO_IMAGEN);
  cargarCoeficientes(estado, grises, TAMAÑO_IMAGEN);
  estado.mascara.fill(1);

  const magnitudes = new Float64Array(TAMAÑO_IMAGEN * TAMAÑO_IMAGEN);
  for (let i = 0; i < TAMAÑO_IMAGEN * TAMAÑO_IMAGEN; i++) {
    magnitudes[i] = Math.hypot(estado.reFourier[i], estado.imFourier[i]);
  }
  const magnitudesCentradas = desplazarEspectro(magnitudes, TAMAÑO_IMAGEN);

  const { logs, max } = calcularEscalaLog(magnitudesCentradas, TAMAÑO_IMAGEN);
  estado.logsReal = logs;
  estado.maxReal = max;
  pintarLogEscalado(elementos.canvasMapaReal, logs, max, TAMAÑO_IMAGEN);

  refrescarTodo(elementos, estado);
}


function frecuenciasEsperadasDelPatron(tipo) {
  if (tipo === 'rayas-v') return [[CICLOS_RAYAS, 0]];
  if (tipo === 'rayas-h') return [[0, CICLOS_RAYAS]];

  const fTablero = N / (2 * CELDA_TABLERO);
  const multiplosImpares = [1, 3, 5, 7].filter((k) => k * fTablero < N / 2);
  const puntos = [];
  for (const k1 of multiplosImpares) {
    for (const k2 of multiplosImpares) {
      puntos.push([k1 * fTablero, k2 * fTablero]);
      puntos.push([k1 * fTablero, -k2 * fTablero]);
    }
  }
  return puntos;
}


function quitarPatron(elementos, estado) {
  if (!estado.reFourier) return;
  guardarHistoria(estado);
  const RADIO_LIMPIEZA = 0;
  for (const [u, v] of frecuenciasEsperadasDelPatron(elementos.selectPatron.value)) {
    pintarConPincel(estado, u + N / 2, v + N / 2, RADIO_LIMPIEZA, 0, N);
  }
  refrescarTodo(elementos, estado);
}

export function iniciarFotoPatron() {
  const elementos = obtenerElementos();
  const estado = crearEstadoMascara(TAMAÑO_IMAGEN);
  let ultimaFotoGrises = null;

  function recalcularEntrada() {
    if (!ultimaFotoGrises) return;
    const patron = generarPatronElegido(elementos.selectPatron.value);
    const intensidad = Number(elementos.sliderIntensidad.value);
    const mezcla = mezclarFotoYPatron(ultimaFotoGrises, patron, intensidad);
    actualizarDesdeGrises(mezcla, elementos, estado);
  }

  elementos.inputFoto.addEventListener('change', async (evento) => {
    const archivo = evento.target.files[0];
    if (!archivo) return;
    ultimaFotoGrises = await prepararImagenParaFourier(archivo, TAMAÑO_IMAGEN);
    recalcularEntrada();
  });

  elementos.selectPatron.addEventListener('change', recalcularEntrada);
  elementos.sliderIntensidad.addEventListener('input', recalcularEntrada);

  let valorTrazoActual = 1;
  let esInicioDeTrazo = true;

  habilitarPincel(
    elementos.canvasMapaUsuario,
    () => {
      if (!estado.reFourier) return;
      guardarHistoria(estado);
      esInicioDeTrazo = true;
    },
    (puntero) => {
      if (!estado.reFourier) return;
      const { xShift, yShift } = coordenadasDesdeEvento(puntero, elementos.canvasMapaUsuario, N);
      if (esInicioDeTrazo) {
        valorTrazoActual = obtenerValorEnPunto(estado, xShift, yShift, N) ? 0 : 1;
        esInicioDeTrazo = false;
      }
      const radio = Number(elementos.sliderPincel.value);
      pintarConPincel(estado, xShift, yShift, radio, valorTrazoActual, N);
      refrescarTodo(elementos, estado);
    }
  );

  elementos.sliderPincel.addEventListener('input', () => {
    elementos.sliderPincelValor.textContent = elementos.sliderPincel.value;
  });

  elementos.botonDeshacer.addEventListener('click', () => {
    if (deshacer(estado)) refrescarTodo(elementos, estado);
  });

  elementos.botonQuitarPatron.addEventListener('click', () => quitarPatron(elementos, estado));

  elementos.botonReiniciar.addEventListener('click', () => {
    if (!estado.reFourier) return;
    reiniciar(estado, TAMAÑO_IMAGEN);
    refrescarTodo(elementos, estado);
  });
}