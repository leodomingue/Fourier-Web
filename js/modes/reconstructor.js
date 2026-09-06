// modes/reconstructor.js — 
// conecta la entrada (foto o patrón) con los canvases de "Original" y "Mapa de Fourier real".
import { prepararImagenParaFourier } from '../core/image.js';
import { fft2d, desplazarEspectro } from '../core/fft.js';
import { generarRayas, generarTablero, generarCirculos } from '../core/patterns.js';
import { pintarGrises, pintarMagnitudEspectro } from '../ui/canvasRenderer.js';

const N = 128;

function obtenerElementos() {
  return {
    inputFoto: document.getElementById('rec-input-foto'),
    canvasOriginal: document.getElementById('rec-canvas-original'),
    canvasEspectro: document.getElementById('rec-canvas-mapa-real'),
    botonRayasV: document.getElementById('rec-patron-rayas-v'),
    botonRayasH: document.getElementById('rec-patron-rayas-h'),
    botonRayasD: document.getElementById('rec-patron-rayas-d'),
    botonTablero: document.getElementById('rec-patron-tablero'),
    botonCirculos: document.getElementById('rec-patron-circulos'),
  };
}

/**
 * Actualiza la vista principal del visualizador a partir de una imagen en escala de grises.
 *
 * Toma un array plano con los valores de gris (0-255) de una imagen de tamaño N×N,lo pinta en el canvas de la imagen original
 * y calcula su espectro de Fourier para mostrarlo en el canvas del mapa real.
 * 
 * La función hace:
 * Pinta la iamgen original
 * Aplica la FFT 2D 
 * Calcula la magnitud del espectro.
 * Desplaza el espectro para centrar la frecuencia cero.
 * Pinta el espectro con compresión logarítmica y corrección gamma.
 */
function actualizarDesdeGrises(grises, elementos) {
  pintarGrises(elementos.canvasOriginal, grises, N);

  const parteReal = grises.slice(); //Copia para no modificar el array original
  const parteImaginaria = new Float64Array(N * N);
  fft2d(parteReal, parteImaginaria, N, false);

  const magnitudes = new Float64Array(N * N);
  for (let i = 0; i < N * N; i++) {
    magnitudes[i] = Math.hypot(parteReal[i], parteImaginaria[i]);
  }

  const magnitudesCentradas = desplazarEspectro(magnitudes, N);

  pintarMagnitudEspectro(elementos.canvasEspectro, magnitudesCentradas, N);
}

/**
 * Inicializa el visualizador de Fourier.
 * asigna eventos a los elementos del DOM y muestra un patrón inicial (rayas verticales) al cargar la página.
 *
 * Esta función se encarga de conectar los botones de patrones sintéticos y lacarga de imágenes la FFT.
 * 
 * @returns {void}
 */
export function iniciarReconstructor() {
  const elementos = obtenerElementos();

  // Evento para cargar una imagen desde el dispositivo
  elementos.inputFoto.addEventListener('change', async (evento) => {
    const archivo = evento.target.files[0];
    if (!archivo) return;
    const imagenGrises = await prepararImagenParaFourier(archivo, N);
    actualizarDesdeGrises(imagenGrises, elementos);
  });

  // Evento para los botones
  elementos.botonRayasV.addEventListener('click', () => actualizarDesdeGrises(generarRayas(N, 'vertical', 8), elementos));
  elementos.botonRayasH.addEventListener('click', () => actualizarDesdeGrises(generarRayas(N, 'horizontal', 8), elementos));
  elementos.botonRayasD.addEventListener('click', () => actualizarDesdeGrises(generarRayas(N, 'diagonal', 8), elementos));
  elementos.botonTablero.addEventListener('click', () => actualizarDesdeGrises(generarTablero(N, 16), elementos));
  elementos.botonCirculos.addEventListener('click', () => actualizarDesdeGrises(generarCirculos(N, 6), elementos));

  // Imagen inicial
  actualizarDesdeGrises(generarRayas(N, 'vertical', 8), elementos);
}