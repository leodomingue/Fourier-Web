
// modes/reconstructor.js 
// - Carga de imágenes (fotos o patrones sintéticos)
// - Visualización del espectro de Fourier (mapa real)
// - Interacción: click para activar/desactivar frecuencias
// - Reconstrucción en vivo de la imagen a partir de frecuencias seleccionadas
// - Contador de energía, deshacer/reiniciar, tooltip con la onda pura

import { prepararImagenParaFourier } from '../core/image.js';
import { fft2d, desplazarEspectro } from '../core/fft.js';
import {generarRayas, generarTablero, generarCirculos, generarPatronDeFrecuencia, describirFrecuencia} from '../core/patterns.js';
import {pintarGrises, pintarGrisesEscalado, calcularEscalaLog, pintarLogEscalado} from '../ui/canvasRenderer.js';
import { mostrarTooltip, ocultarTooltip } from '../ui/tooltip.js';


const N = 128;
const HISTORIA_MAXIMA = 50;


/**
 * Obtiene referencias a todos los elementos del DOM necesarios para este modo.
 * @returns {Object} Objeto con propiedades descriptivas para cada elemento.
 */
function obtenerElementos() {
  return {
    inputFoto: document.getElementById('rec-input-foto'),
    canvasOriginal: document.getElementById('rec-canvas-original'),
    canvasMapaReal: document.getElementById('rec-canvas-mapa-real'),
    canvasReconstruccion: document.getElementById('rec-canvas-reconstruccion'),
    canvasMapaUsuario: document.getElementById('rec-canvas-mapa-usuario'),
    botonRayasV: document.getElementById('rec-patron-rayas-v'),
    botonRayasH: document.getElementById('rec-patron-rayas-h'),
    botonRayasD: document.getElementById('rec-patron-rayas-d'),
    botonTablero: document.getElementById('rec-patron-tablero'),
    botonCirculos: document.getElementById('rec-patron-circulos'),
    sliderRadio: document.getElementById('rec-slider-radio'),
    sliderRadioValor: document.getElementById('rec-slider-radio-valor'),
    contadorEnergia: document.getElementById('rec-contador-energia'),
    botonDeshacer: document.getElementById('rec-boton-deshacer'),
    botonReiniciar: document.getElementById('rec-boton-reiniciar'),
    tooltip: document.getElementById('rec-tooltip'),
    tooltipCanvas: document.getElementById('rec-tooltip-canvas'),
    tooltipTexto: document.getElementById('rec-tooltip-texto'),
  };
}


/**
 * Crea el estado inicial del modo reconstructor.
 * @returns {Object} Estado con todos los arrays y variables necesarias.
 */
function estadoInicial() {
  return {
    reFourier: null,
    imFourier: null,
    logsReal: null,
    maxReal: 0, 
    mascara: new Float64Array(N * N),
    historia: [],
  };
}

// UTILIDADES: COORDENADAS PANTALLA ↔ GRID DE PÍXELES

/**
 * Obtiene las coordenadas (x, y) en la grilla N×N a partir de un evento del ratón.
 * @param {MouseEvent} evento - Evento del ratón (mousemove o click).
 * @param {HTMLCanvasElement} canvas - Canvas donde ocurrió el evento.
 * @returns {{xShift: number, yShift: number}} Coordenadas en la grilla centrada.
 */
function coordenadasDesdeEvento(evento, canvas) {
  const rect = canvas.getBoundingClientRect();
  const xCss = evento.clientX - rect.left;
  const yCss = evento.clientY - rect.top;
  const x = Math.min(N - 1, Math.max(0, Math.floor((xCss / rect.width) * N)));
  const y = Math.min(N - 1, Math.max(0, Math.floor((yCss / rect.height) * N)));
  return { xShift: x, yShift: y };
}

/**
 * Convierte coordenadas del mapa centrado (FFT Shift) a las coordenadas
 * originales del espectro (sin desplazar).
 * @param {number} xShift - Coordenada X en el mapa centrado.
 * @param {number} yShift - Coordenada Y en el mapa centrado.
 * @returns {{xRaw: number, yRaw: number}} Coordenadas en el espectro crudo.
 */
function shiftedARaw(xShift, yShift) {
  const half = N / 2;
  return {
    xRaw: (xShift - half + N) % N,
    yRaw: (yShift - half + N) % N,
  };
}


// HISTORIAL (DESHACER / REINICIAR)


/**
 * Guarda una copia de la máscara actual en el historial.
 * @param {Object} estado - Estado del modo.
 */
function guardarHistoria(estado) {
  estado.historia.push(estado.mascara.slice());
  if (estado.historia.length > HISTORIA_MAXIMA) estado.historia.shift();
}


// LÓGICA PRINCIPAL: ALTERNAR FRECUENCIAS, APLICAR RADIO, RECONSTRUIR


/**
 * Alterna el estado (activado/desactivado) de una frecuencia y su simétrica.
 * @param {number} xShift - Coordenada X en el mapa centrado.
 * @param {number} yShift - Coordenada Y en el mapa centrado.
 * @param {Object} estado - Estado del modo.
 */
function alternarFrecuencia(xShift, yShift, estado) {
  guardarHistoria(estado);
  const { xRaw, yRaw } = shiftedARaw(xShift, yShift);
  const indice = yRaw * N + xRaw;
  const indiceSimetrico = ((N - yRaw) % N) * N + ((N - xRaw) % N);

  const nuevoValor = estado.mascara[indice] ? 0 : 1;
  estado.mascara[indice] = nuevoValor;
  estado.mascara[indiceSimetrico] = nuevoValor;
}

/**
 * Activa todas las frecuencias dentro de un radio dado desde el centro.
 * @param {Object} estado - Estado del modo.
 * @param {number} radio - Radio en píxeles desde el centro.
 */
function aplicarRadio(estado, radio) {
  guardarHistoria(estado);
  const half = N / 2;
  for (let yShift = 0; yShift < N; yShift++) {
    for (let xShift = 0; xShift < N; xShift++) {
      const u = xShift - half;
      const v = yShift - half;
      const { xRaw, yRaw } = shiftedARaw(xShift, yShift);
      estado.mascara[yRaw * N + xRaw] = Math.hypot(u, v) <= radio ? 1 : 0;
    }
  }
}

/**
 * Reconstruye la imagen a partir de las frecuencias activas en la máscara.
 * @param {Object} estado - Estado del modo.
 * @returns {Float64Array} Imagen reconstruida (valores de gris 0-255).
 */
function reconstruirDesdeMascara(estado) {
  const re = new Float64Array(N * N);
  const im = new Float64Array(N * N);
  for (let i = 0; i < N * N; i++) {
    re[i] = estado.reFourier[i] * estado.mascara[i];
    im[i] = estado.imFourier[i] * estado.mascara[i];
  }
  fft2d(re, im, N, true);

  const grises = new Float64Array(N * N);
  for (let i = 0; i < N * N; i++) {
    grises[i] = Math.min(255, Math.max(0, re[i]));
  }
  return grises;
}

/**
 * Calcula cuántas frecuencias están activas y qué porcentaje de energía representan.
 * @param {Object} estado - Estado del modo.
 * @returns {{activos: number, porcentaje: number}} Número de frecuencias activas y porcentaje de energía.
 */
function calcularContador(estado) {
  let activos = 0;
  let energiaActiva = 0;
  let energiaTotal = 0;
  for (let i = 0; i < N * N; i++) {
    const energia = estado.reFourier[i] ** 2 + estado.imFourier[i] ** 2;
    energiaTotal += energia;
    if (estado.mascara[i]) {
      activos++;
      energiaActiva += energia;
    }
  }
  const porcentaje = energiaTotal > 0 ? (energiaActiva / energiaTotal) * 100 : 0;
  return { activos, porcentaje };
}

// REFRESCAR TODAS LAS VISTAS DEPENDIENTES DE LA MÁSCARA

/**
 * Actualiza el mapa del usuario, la reconstrucción y el contador de energía.
 * @param {Object} elementos - Objeto con referencias a elementos del DOM.
 * @param {Object} estado - Estado del modo.
 */
function refrescarTodo(elementos, estado) {
  // Actualiza el mapa del usuario (frecuencias activas)
  const mascaraCentrada = desplazarEspectro(estado.mascara, N);
  const logsUsuario = new Float64Array(N * N);
  for (let i = 0; i < N * N; i++) {
    logsUsuario[i] = mascaraCentrada[i] ? estado.logsReal[i] : 0;
  }
  pintarLogEscalado(elementos.canvasMapaUsuario, logsUsuario, estado.maxReal, N);

  //Reconstruiye y pinta la imagen
  pintarGrises(elementos.canvasReconstruccion, reconstruirDesdeMascara(estado), N);

  //Actualiza el contador de energía
  const { activos, porcentaje } = calcularContador(estado);
  elementos.contadorEnergia.textContent =
    `${activos} de ${N * N} frecuencias activas — ${porcentaje.toFixed(1)}% de la energía capturada`;
}

// CARGAR UNA IMAGEN NUEVA (FOTO O PATRÓN)


/**
 * Carga una imagen en el visualizador, calcula su FFT y reinicia el estado.
 * @param {Float64Array} grises - Array de N*N valores en [0, 255].
 * @param {Object} elementos - Objeto con referencias a elementos del DOM.
 * @param {Object} estado - Estado del modo.
 */
function actualizarDesdeGrises(grises, elementos, estado) {
  pintarGrises(elementos.canvasOriginal, grises, N);

  const re = grises.slice();
  const im = new Float64Array(N * N);
  fft2d(re, im, N, false);
  estado.reFourier = re;
  estado.imFourier = im;

  const magnitudes = new Float64Array(N * N);
  for (let i = 0; i < N * N; i++) {
    magnitudes[i] = Math.hypot(re[i], im[i]);
  }
  const magnitudesCentradas = desplazarEspectro(magnitudes, N);

  const { logs, max } = calcularEscalaLog(magnitudesCentradas, N);
  estado.logsReal = logs;
  estado.maxReal = max;
  pintarLogEscalado(elementos.canvasMapaReal, logs, max, N);

  estado.mascara = new Float64Array(N * N);
  estado.historia = [];
  elementos.sliderRadio.value = 0;
  elementos.sliderRadioValor.textContent = '0';

  refrescarTodo(elementos, estado);
}

// TOOLTIP: MOSTRAR ONDA PURA Y DESCRIPCIÓN DE LA FRECUENCIA


/**
 * Maneja el evento de hover sobre los mapas: muestra un tooltip con la onda pura.
 * @param {MouseEvent} evento - Evento del ratón (mousemove).
 * @param {HTMLCanvasElement} canvas - Canvas donde ocurrió el evento.
 * @param {Object} elementos - Objeto con referencias a elementos del DOM.
 */
function manejarHover(evento, canvas, elementos) {
  const { xShift, yShift } = coordenadasDesdeEvento(evento, canvas);
  const u = xShift - N / 2;
  const v = yShift - N / 2;

  //Genera la onda pura para esta frecuencia
  const patron = generarPatronDeFrecuencia(u, v, N);
  pintarGrisesEscalado(elementos.tooltipCanvas, patron, N);

  //Actualiza el texto del tooltip
  elementos.tooltipTexto.textContent =
    `(u=${u}, v=${v}) — ${describirFrecuencia(u, v, N)}`;

  //Muestra el tooltip en la posición del ratón
  mostrarTooltip(elementos, evento.pageX, evento.pageY);
}

// ----------------------------------------------------------------
// INICIALIZACIÓN DEL MODO
// ----------------------------------------------------------------

/**
 * Inicializa el modo reconstructor: asigna eventos, configura el estado
 * y carga un patrón inicial.
 */
export function iniciarReconstructor() {
  // Obteniene referencias a los elementos del DOM
  const elementos = obtenerElementos();
  const estado = estadoInicial();

  //cargamos imagen
  elementos.inputFoto.addEventListener('change', async (evento) => {
    const archivo = evento.target.files[0];
    if (!archivo) return;
    const grises = await prepararImagenParaFourier(archivo, N);
    actualizarDesdeGrises(grises, elementos, estado);
  });

  //Botones de patrones
  elementos.botonRayasV.addEventListener('click', () =>
    actualizarDesdeGrises(generarRayas(N, 'vertical', 8), elementos, estado)
  );
  elementos.botonRayasH.addEventListener('click', () =>
    actualizarDesdeGrises(generarRayas(N, 'horizontal', 8), elementos, estado)
  );
  elementos.botonRayasD.addEventListener('click', () =>
    actualizarDesdeGrises(generarRayas(N, 'diagonal', 8), elementos, estado)
  );
  elementos.botonTablero.addEventListener('click', () =>
    actualizarDesdeGrises(generarTablero(N, 16), elementos, estado)
  );
  elementos.botonCirculos.addEventListener('click', () =>
    actualizarDesdeGrises(generarCirculos(N, 6), elementos, estado)
  );

  // Click en el mapa del usuario: activar/desactivar frecuencias
  elementos.canvasMapaUsuario.addEventListener('click', (evento) => {
    if (!estado.reFourier) return;
    const { xShift, yShift } = coordenadasDesdeEvento(evento, elementos.canvasMapaUsuario);
    alternarFrecuencia(xShift, yShift, estado);
    refrescarTodo(elementos, estado);
  });

  //Slider de radio: activar frecuencias por radio
  elementos.sliderRadio.addEventListener('input', (evento) => {
    if (!estado.reFourier) return;
    const radio = Number(evento.target.value);
    elementos.sliderRadioValor.textContent = radio;
    aplicarRadio(estado, radio);
    refrescarTodo(elementos, estado);
  });

  //Botón deshacer
  elementos.botonDeshacer.addEventListener('click', () => {
    if (estado.historia.length === 0) return;
    estado.mascara = estado.historia.pop();
    refrescarTodo(elementos, estado);
  });

  //Botón reiniciar
  elementos.botonReiniciar.addEventListener('click', () => {
    if (!estado.reFourier) return;
    guardarHistoria(estado);
    estado.mascara = new Float64Array(N * N);
    refrescarTodo(elementos, estado);
  });

  //Tooltips en los mapas (real y usuario)
  [elementos.canvasMapaReal, elementos.canvasMapaUsuario].forEach((canvas) => {
    canvas.addEventListener('mousemove', (evento) =>
      manejarHover(evento, canvas, elementos)
    );
    canvas.addEventListener('mouseleave', () => ocultarTooltip(elementos));
  });

  //Carga un patrón inicial (rayas verticales) para no empezar en negro
  actualizarDesdeGrises(generarRayas(N, 'vertical', 8), elementos, estado);
}