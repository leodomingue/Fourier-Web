
// modes/photoPattern.js — Modo 3: foto + patrón repetitivo

// Este modo permite cargar una foto y superponerle un patrón repetitivo con intensidad ajustable.
// Luego, el usuario puede "limpiar" el patrón activando/desactivando frecuencias en el mapa de Fourier, 
// eliminando selectivamente las componentes frecuenciales no deseadas.


import { prepararImagenParaFourier } from '../core/image.js';
import { desplazarEspectro } from '../core/fft.js';
import { generarRayas, generarTablero } from '../core/patterns.js';
import { pintarGrises, calcularEscalaLog, pintarLogEscalado } from '../ui/canvasRenderer.js';
import {crearEstadoMascara, cargarCoeficientes, alternarFrecuencia, reconstruirDesdeMascara,
  deshacer, reiniciar, coordenadasDesdeEvento} from '../core/mascaraFourier.js';



// Tamaño de la imagen
const TAMAÑO_IMAGEN = 128;



/**
 * Obtiene referencias a todos los elementos del DOM necesarios para este modo.
 * Los nombres de las propiedades son claros y descriptivos.
 *
 * @returns {Object} Objeto con propiedades:
 *   - inputFoto: input[type=file] para cargar la foto.
 *   - selectPatron: <select> para elegir el tipo de patrón.
 *   - sliderIntensidad: <input type=range> para controlar la mezcla.
 *   - canvasOriginal: canvas para la imagen original (foto + patrón).
 *   - canvasMapaReal: canvas para el espectro de Fourier real.
 *   - canvasReconstruccion: canvas para la imagen reconstruida.
 *   - canvasMapaUsuario: canvas para el mapa de frecuencias del usuario.
 *   - botonDeshacer: <button> para deshacer cambios.
 *   - botonReiniciar: <button> para reiniciar la máscara.
 */
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
  };
}

// GENERACIÓN DE PATRONES SINTÉTICOS


/**
 * Genera un patrón sintético según el tipo seleccionado en el <select>.
 * Opciones: 'rayas-v' (verticales), 'rayas-h' (horizontales) o 'tablero'.
 *
 * @param {string} tipo - Tipo de patrón ('rayas-v', 'rayas-h', 'tablero').
 * @returns {Float64Array} Array plano de TAMAÑO_IMAGEN*TAMAÑO_IMAGEN con valores en [0,255].
 */
function generarPatronElegido(tipo) {
  if (tipo === 'rayas-v') {
    return generarRayas(TAMAÑO_IMAGEN, 'vertical', 10);
  }
  if (tipo === 'rayas-h') {
    return generarRayas(TAMAÑO_IMAGEN, 'horizontal', 10);
  }
  return generarTablero(TAMAÑO_IMAGEN, 12);
}

// MEZCLA DE FOTO Y PATRÓN

/**
 * Mezcla la foto original con un patrón sintético según la intensidad.
 * 
 * La intensidad va de 0 a 100, pero se escala a un factor entre 0 y 0.5
 * para que el patrón no opaque completamente la foto (máximo 50% de patrón).
 *
 * @param {Float64Array} grisesFoto - Array plano con la foto en grises [0,255].
 * @param {Float64Array} patron - Array plano con el patrón sintético [0,255].
 * @param {number} intensidad0a100 - Valor del slider (0-100).
 * @returns {Float64Array} Array mezclado, recortado a [0,255].
 */
function mezclarFotoYPatron(grisesFoto, patron, intensidad0a100) {
  // Escala la intensidad: 0 → 0, 100 → 0.5
  const peso = (intensidad0a100 / 100) * 0.5;
  const mezcla = new Float64Array(TAMAÑO_IMAGEN * TAMAÑO_IMAGEN);

  for (let i = 0; i < TAMAÑO_IMAGEN * TAMAÑO_IMAGEN; i++) {
    // Mezcla ponderada
    mezcla[i] = Math.min(255, Math.max(0, grisesFoto[i] * (1 - peso) + patron[i] * peso));
  }
  return mezcla;
}

// FUNCIONES DE ACTUALIZACIÓN DE LA VISTA

/**
 * Refresca el mapa del usuario y la reconstrucción después de modificar la máscara.
 * No toca la imagen original ni el mapa real (que ya están fijos).
 *
 * @param {Object} elementos - Referencias a los canvas y elementos del DOM.
 * @param {Object} estado - Estado de la máscara (creado con crearEstadoMascara).
 * @returns {void}
 */
function refrescarTodo(elementos, estado) {
  // Pinta el mapa del usuario: mostrar las frecuencias activas
  const mascaraCentrada = desplazarEspectro(estado.mascara, TAMAÑO_IMAGEN);
  const logsUsuario = new Float64Array(TAMAÑO_IMAGEN * TAMAÑO_IMAGEN);
  for (let i = 0; i < TAMAÑO_IMAGEN * TAMAÑO_IMAGEN; i++) {
    // Si la frecuencia está activa, pintamos su valor logarítmico; si no, 0 (negro)
    logsUsuario[i] = mascaraCentrada[i] ? estado.logsReal[i] : 0;
  }
  pintarLogEscalado(elementos.canvasMapaUsuario, logsUsuario, estado.maxReal, TAMAÑO_IMAGEN);

  // Reconstruye y pinta la imagen con las frecuencias activas
  const imagenReconstruida = reconstruirDesdeMascara(estado, TAMAÑO_IMAGEN);
  pintarGrises(elementos.canvasReconstruccion, imagenReconstruida, TAMAÑO_IMAGEN);
}

/**
 * Carga una nueva imagen (mezcla de foto y patrón), calcula su FFT,
 * actualiza el mapa real y resetea la máscara (todas apagadas).
 *
 * @param {Float64Array} grises - Array plano de N*N valores en [0, 255].
 * @param {Object} elementos - Referencias a los elementos del DOM.
 * @param {Object} estado - Estado de la máscara.
 * @returns {void}
 */
function actualizarDesdeGrises(grises, elementos, estado) {
  // Pinta la imagen original (mezcla) en el canvas correspondiente
  pintarGrises(elementos.canvasOriginal, grises, TAMAÑO_IMAGEN);

  //Carga los coeficientes de Fourier en el estado
  cargarCoeficientes(estado, grises, TAMAÑO_IMAGEN);

  //Calcula la magnitud y centra para el mapa real
  const magnitudes = new Float64Array(TAMAÑO_IMAGEN * TAMAÑO_IMAGEN);
  for (let i = 0; i < TAMAÑO_IMAGEN * TAMAÑO_IMAGEN; i++) {
    magnitudes[i] = Math.hypot(estado.reFourier[i], estado.imFourier[i]);
  }
  const magnitudesCentradas = desplazarEspectro(magnitudes, TAMAÑO_IMAGEN);

  //Escala logarítmica para visualización
  const { logs, max } = calcularEscalaLog(magnitudesCentradas, TAMAÑO_IMAGEN);
  estado.logsReal = logs;
  estado.maxReal = max;

  //Pinta el mapa real
  pintarLogEscalado(elementos.canvasMapaReal, logs, max, TAMAÑO_IMAGEN);

  // Refresca todo lo que depende de la máscara
  refrescarTodo(elementos, estado);
}

// FUNCIÓN PRINCIPAL PARA INICIAR EL MODO

/**
 * Inicializa el modo Foto+Patrón:
 * - Carga una foto desde archivo.
 * - Permite elegir el tipo de patrón (rayas verticales, horizontales o tablero).
 * - Ajusta la intensidad de mezcla.
 * - Permite activar/desactivar frecuencias en el mapa para "limpiar" el patrón.
 *
 * @returns {void}
 */
export function iniciarFotoPatron() {
  //Obteniene referencias a los elementos del DOM con nombres descriptivos
  const elementos = obtenerElementos();

  //Crea el estado de la máscara (inicialmente vacío)
  const estado = crearEstadoMascara(TAMAÑO_IMAGEN);

  // Variable para guardar la última foto cargada
  let ultimaFotoGrises = null;

  // FUNCIÓN INTERNA: recalcula la entrada y actualiza todo
  /**
   * Recalcula la mezcla de la foto con el patrón actual y actualiza la vista.
   * Se ejecuta cuando se cambia el tipo de patrón, la intensidad o se carga una foto.
   */
  function recalcularEntrada() {
    if (!ultimaFotoGrises) return; // Aún no hay foto cargada

    //Genera el patrón según el <select>
    const patron = generarPatronElegido(elementos.selectPatron.value);

    //Mezcla foto y patrón con la intensidad actual del slider
    const intensidad = Number(elementos.sliderIntensidad.value);
    const mezcla = mezclarFotoYPatron(ultimaFotoGrises, patron, intensidad);

    //Actualiza toda la vista con la imagen mezclada
    actualizarDesdeGrises(mezcla, elementos, estado);
  }


  //Evento: cargar foto desde archivo
  elementos.inputFoto.addEventListener('change', async (evento) => {
    const archivo = evento.target.files[0];
    if (!archivo) return;

    // Convierte la imagen a grises y redimensiona a TAMAÑO_IMAGEN×TAMAÑO_IMAGEN
    ultimaFotoGrises = await prepararImagenParaFourier(archivo, TAMAÑO_IMAGEN);

    //Recalcula la entrada (mezcla) con los valores actuales de patrón e intensidad
    recalcularEntrada();
  });

  //Evento: cambio de tipo de patrón en el <select>
  elementos.selectPatron.addEventListener('change', recalcularEntrada);

  //Evento: cambio de intensidad en el slider
  elementos.sliderIntensidad.addEventListener('input', recalcularEntrada);

  // Evento: clic en el mapa del usuario para alternar frecuencias 
  elementos.canvasMapaUsuario.addEventListener('click', (evento) => {
    if (!estado.reFourier) return; 


    const { xShift, yShift } = coordenadasDesdeEvento(
      evento,
      elementos.canvasMapaUsuario,
      TAMAÑO_IMAGEN
    );

    // Alterna la frecuencia (encender/apagar) en la máscara
    alternarFrecuencia(estado, xShift, yShift, TAMAÑO_IMAGEN);

    // Refresca la vista (mapa usuario y reconstrucción)
    refrescarTodo(elementos, estado);
  });

  //Evento: botón Deshacer
  elementos.botonDeshacer.addEventListener('click', () => {
    if (deshacer(estado)) {
      refrescarTodo(elementos, estado);
    }
  });

  //Evento: botón Reiniciar (apagar todas las frecuencias)
  elementos.botonReiniciar.addEventListener('click', () => {
    if (!estado.reFourier) return;
    reiniciar(estado, TAMAÑO_IMAGEN);
    refrescarTodo(elementos, estado);
  });

}