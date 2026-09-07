
// modes/reconstructor.js 
// - Carga de imágenes (fotos o patrones sintéticos)
// - Visualización del espectro de Fourier (mapa real)
// - Interacción: click para activar/desactivar frecuencias
// - Reconstrucción en vivo de la imagen a partir de frecuencias seleccionadas
// - Contador de energía, deshacer/reiniciar, tooltip con la onda pura
import { habilitarPincel } from '../ui/controls.js';
import { prepararImagenParaFourier } from '../core/image.js';
import { fft2d, desplazarEspectro } from '../core/fft.js';
import {generarRayas, generarTablero, generarCirculos, generarPatronDeFrecuencia, describirFrecuencia} from '../core/patterns.js';
import {pintarGrises, pintarGrisesEscalado, calcularEscalaLog, pintarLogEscalado} from '../ui/canvasRenderer.js';
import { mostrarTooltip, ocultarTooltip } from '../ui/tooltip.js';
import {crearEstadoMascara, cargarCoeficientes,alternarFrecuencia, aplicarRadio, reconstruirDesdeMascara,
  calcularContador, deshacer, reiniciar, coordenadasDesdeEvento, guardarHistoria, obtenerValorEnPunto, pintarConPincel} 
  from '../core/mascaraFourier.js';


// Tamaño de la imagen (potencia de 2 para la FFT)
const N = 128;

/**
 * Obtiene referencias a todos los elementos del DOM necesarios para este modo.
 *
 * @returns {Object} Objeto con propiedades:
 *   - inputFoto: input[type=file]
 *   - canvasOriginal: canvas para la imagen original
 *   - canvasMapaReal: canvas para el espectro real
 *   - canvasReconstruccion: canvas para la imagen reconstruida
 *   - canvasMapaUsuario: canvas para el mapa de frecuencias del usuario
 *   - botonRayasV, botonRayasH, botonRayasD, botonTablero, botonCirculos: botones de patrones
 *   - sliderRadio, sliderRadioValor: control de radio circular
 *   - contadorEnergia: elemento para mostrar estadísticas
 *   - botonDeshacer, botonReiniciar: botones de control
 *   - tooltip, tooltipCanvas, tooltipTexto: elementos del tooltip
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
    sliderPincel: document.getElementById('rec-slider-pincel'),
    sliderPincelValor: document.getElementById('rec-slider-pincel-valor'),
  };
}

/**
 * Actualiza todos los elementos visuales que dependen de la máscara actual:
 * - El mapa del usuario (frecuencias activas resaltadas)
 * - La imagen reconstruida
 * - El contador de energía
 *
 * @param {Object} elementos - Objeto con referencias a los canvas y elementos de texto.
 * @param {Object} estado - Estado de la máscara
 * @returns {void}
 */
function refrescarTodo(elementos, estado) {
  // Pinta el mapa del usuario
  const mascaraCentrada = desplazarEspectro(estado.mascara, N);
  const logsUsuario = new Float64Array(N * N);
  for (let i = 0; i < N * N; i++) {
    // Si la frecuencia está activa, pintamos su valor logarítmico; si no, 0 (negro)
    logsUsuario[i] = mascaraCentrada[i] ? estado.logsReal[i] : 0;
  }
  pintarLogEscalado(elementos.canvasMapaUsuario, logsUsuario, estado.maxReal, N);

  // Recontruye y pinta la imagen con las frecuencias activas
  const imagenReconstruida = reconstruirDesdeMascara(estado, N);
  pintarGrises(elementos.canvasReconstruccion, imagenReconstruida, N);

  //Actualiza el contador de energía
  const { activos, porcentaje } = calcularContador(estado, N);
  elementos.contadorEnergia.textContent =
    `${activos} de ${N * N} frecuencias activas — ${porcentaje.toFixed(1)}% de la energía capturada`;
}

/**
 * Carga una nueva imagen (en grises), calcula su FFT, actualiza el mapa real y resetea la máscara
 *
 * @param {Float64Array} grises - Array plano de N*N valores en [0, 255].
 * @param {Object} elementos - Referencias a los elementos del DOM.
 * @param {Object} estado - Estado de la máscara.
 * @returns {void}
 */
function actualizarDesdeGrises(grises, elementos, estado) {
  //Pinta la imagen original
  pintarGrises(elementos.canvasOriginal, grises, N);

  //Carga los coeficientes de Fourier en el estado
  cargarCoeficientes(estado, grises, N);

  //Calcula la magnitud y la centra
  const magnitudes = new Float64Array(N * N);
  for (let i = 0; i < N * N; i++) {
    magnitudes[i] = Math.hypot(estado.reFourier[i], estado.imFourier[i]);
  }
  const magnitudesCentradas = desplazarEspectro(magnitudes, N);

  //Escala logarítmica para visualización
  const { logs, max } = calcularEscalaLog(magnitudesCentradas, N);
  estado.logsReal = logs;
  estado.maxReal = max;

  // Pinta el mapa real
  pintarLogEscalado(elementos.canvasMapaReal, logs, max, N);

  //Resetea el slider de radio a 0
  elementos.sliderRadio.value = 0;
  elementos.sliderRadioValor.textContent = '0';

  //Refresca todo lo que depende de la máscara (reconstrucción, mapa usuario, contador)
  refrescarTodo(elementos, estado);
}

/**
 * Maneja el evento hover sobre el mapa de frecuencias: muestra un tooltip
 * con la forma de onda de la frecuencia señalada y su descripción.
 *
 * @param {MouseEvent} evento - Evento del ratón.
 * @param {HTMLCanvasElement} canvas - Canvas donde ocurrió el evento.
 * @param {Object} elementos - Referencias a los elementos del tooltip.
 * @returns {void}
 */
function manejarHover(evento, canvas, elementos) {
  // Obteniene coordenadas en el mapa centrado
  const { xShift, yShift } = coordenadasDesdeEvento(evento, canvas, N);
  const u = xShift - N / 2;
  const v = yShift - N / 2;

  // Genera el patrón de frecuencia pura para esta coordenada
  const patron = generarPatronDeFrecuencia(u, v, N);
  pintarGrisesEscalado(elementos.tooltipCanvas, patron, N);

  // Actualiza el texto del tooltip
  elementos.tooltipTexto.textContent = `(u=${u}, v=${v}) — ${describirFrecuencia(u, v, N)}`;

  // Muestra el tooltip en la posición del cursor
  mostrarTooltip(elementos, evento.pageX, evento.pageY);
}

/**
 * Inicializa el modo Reconstructor: asigna eventos a todos los elementos y carga un patrón inicial
 *
 * @returns {void}
 */
export function iniciarReconstructor() {
  //Obteniene referencias a los elementos del DOM con nombres descriptivos
  const elementos = obtenerElementos();

  //Crea el estado de la máscara (inicialmente vacío)
  const estado = crearEstadoMascara(N);

  //Evento: cargar imagen desde archivo
  elementos.inputFoto.addEventListener('change', async (evento) => {
    const archivo = evento.target.files[0];
    if (!archivo) return;
    const grises = await prepararImagenParaFourier(archivo, N);
    actualizarDesdeGrises(grises, elementos, estado);
  });

  // Eventos: botones de patrones
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

  // Evento: slider de radio circular
  elementos.sliderRadio.addEventListener('input', (evento) => {
    if (!estado.reFourier) return;
    const radio = Number(evento.target.value);
    elementos.sliderRadioValor.textContent = radio;
    aplicarRadio(estado, radio, N);
    refrescarTodo(elementos, estado);
  });

  //Evento: botón Deshacer
  elementos.botonDeshacer.addEventListener('click', () => {
    if (deshacer(estado)) {
      refrescarTodo(elementos, estado);
    }
  });

  // Evento: botón Reiniciar
  elementos.botonReiniciar.addEventListener('click', () => {
    if (!estado.reFourier) return;
    reiniciar(estado, N);
    refrescarTodo(elementos, estado);
  });

  //Eventos de tooltip en ambos mapas (real y usuario)
  [elementos.canvasMapaReal, elementos.canvasMapaUsuario].forEach((canvas) => {
    canvas.addEventListener('mousemove', (evento) => manejarHover(evento, canvas, elementos));
    canvas.addEventListener('mouseleave', () => ocultarTooltip(elementos));
  });

  //Carga un patrón inicial (rayas verticales) para que no aparezca todo negro
  actualizarDesdeGrises(generarRayas(N, 'vertical', 8), elementos, estado);
}