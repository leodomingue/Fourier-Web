// ui/canvasRenderer.js — pintar arrays de números como imágenes en un <canvas>

/**
 * Pinta una imagen en escala de grises en un elemento <canvas> a partir de
 * un array plano de valores numéricos.
 * 
 * La función toma un array `datos` de longitud N*N, donde cada elemento representa el nivel de gris de un píxel (0 = negro, 255 = blanco).
 * Dibuja la imagen en el canvas pasado como argumento, ajustando su tamaño a N×N píxeles.
 * 
 * @param {HTMLCanvasElement} canvas - El elemento canvas donde se dibujará.
 * @param {Float64Array|Array<number>} datos - Array plano con los valores de gris para cada píxel
 * @param {number} N - Tamaño de la imagen (alto = ancho = N)
 *
 * @returns {void} No devuelve nada modifica el canvas in-place.
 */
export function pintarGrises(canvas, datos, N) {
  canvas.width = N;
  canvas.height = N;

  // Obtenemos el contexto 2D del canvas
  const ctx = canvas.getContext('2d');

  // Creamos un objeto ImageData vacío de tamaño N×N píxeles
  const imgData = ctx.createImageData(N, N);
  for (let i = 0; i < N * N; i++) {
    const v = datos[i];
    // Asignamos el mismo valor a los canales Rojo, Verde y Azul (escala de grises)
    imgData.data[i * 4] = v;
    imgData.data[i * 4 + 1] = v;
    imgData.data[i * 4 + 2] = v;
    // Canal alfa: 255 = completamente opaco
    imgData.data[i * 4 + 3] = 255;
  }
  ctx.putImageData(imgData, 0, 0);
}

/**
 * Dibuja un array de N×N en un canvas de tamaño diferente 
 * escalando la imagen sin interpolación para mantener los bordes nítidos.
 *
 *
 * @param {HTMLCanvasElement} canvasDestino - Canvas donde se dibuja
 * @param {Float64Array} datos - Array de N*N valores en [0, 255].
 * @param {number} N - Tamaño original de la imagen.
 * @returns {void}
 */
export function pintarGrisesEscalado(canvasDestino, datos, N) {
  // Crea un canvas offscreen invisible
  const offscreen = document.createElement('canvas');
  offscreen.width = N;
  offscreen.height = N;

  //Pinta la imagen a tamaño real en el offscreen usando pintarGrises
  pintarGrises(offscreen, datos, N);

  //Dibuja el offscreen en el canvas destino, escalándolo al tamaño de este
  const ctx = canvasDestino.getContext('2d');
  ctx.imageSmoothingEnabled = false; 
  ctx.drawImage(offscreen, 0, 0, canvasDestino.width, canvasDestino.height);
}

/**
 * Calcula la escala logarítmica de un array de magnitudes
 *
 * Aplica log(1 + x) a cada valor para comprimir el rango dinámico, y devuelve tanto los valores transformados como el máximo,
 * para que dos mapas diferentes puedan compartir la misma escala y ser comparables.
 *
 * @param {Float64Array} magnitudes - Array de N*N valores no negativos
 * @param {number} N - Tamaño de la imagen.
 * @returns {{ logs: Float64Array, max: number }} - Objeto con los valores logarítmicos y el máximo.
 */
export function calcularEscalaLog(magnitudes, N) {
  const logs = new Float64Array(N * N);
  let max = 0;

  //Recorre todos los elementos, aplica log(1+x) y busca el máximo
  for (let i = 0; i < N * N; i++) {
    logs[i] = Math.log1p(magnitudes[i]); 
    if (logs[i] > max) max = logs[i];
  }

  return { logs, max };
}

/**
 * Pinta valores ya en escala logarítmica usando un máximo dado
 *
 * Normaliza dividiendo por max, aplica corrección gamma y convierte a [0,255].
 *
 * @param {HTMLCanvasElement} canvas - Canvas donde dibujar.
 * @param {Float64Array} logs - Array de N*N valores logarítmicos (de calcularEscalaLog).
 * @param {number} max - Valor máximo de la escala logarítmica (para normalizar).
 * @param {number} N - Tamaño de la imagen.
 * @param {number} [gamma=0.8] - Factor de corrección gamma (<1 aclara sombras).
 * @returns {void}
 */
export function pintarLogEscalado(canvas, logs, max, N, gamma = 0.8) {
  // Crea un array de valores de gris (0-255)
  const grises = new Float64Array(N * N);

  for (let i = 0; i < N * N; i++) {
    // Normaliza entre 0 y 1 (si max > 0)
    const normalizado = max > 0 ? logs[i] / max : 0;
    // Aplica gamma: elevar a la potencia gamma
    grises[i] = Math.pow(normalizado, gamma) * 255;
  }
  pintarGrises(canvas, grises, N);
}

/**
 * Pinta un mapa de magnitudes de Fourier (ya centrado con desplazarEspectro) usando escala logarítmica + gamma, 
 * para que se vean tanto el pico central como el detalle fino alrededor.
 * 
 * @param {HTMLCanvasElement} canvas - Canvas donde se pintará el espectro.
 * @param {Float64Array|Array<number>} magnitudes - Array plano de N*N con las magnitudes (sin escalar) del espectro, ya centrado 
 * @param {number} N - Tamaño de la imagen (alto = ancho = N).
 * @param {number} [gamma=0.8] - Factor de corrección gamma
 *
 * @returns {void} No devuelve nada; modifica el canvas in-place.
 */

/**
 * Atajo para pintar directamente un array de magnitudes aplicando su propia  escala logarítmica
 *
 * @param {HTMLCanvasElement} canvas - Canvas donde dibujar.
 * @param {Float64Array} magnitudes - Array de N*N magnitudes (espectro sin procesar).
 * @param {number} N - Tamaño de la imagen.
 * @param {number} [gamma=0.8] - Factor de corrección gamma.
 * @returns {void}
 */
export function pintarMagnitudEspectro(canvas, magnitudes, N, gamma = 0.8) {
  const { logs, max } = calcularEscalaLog(magnitudes, N);

  pintarLogEscalado(canvas, logs, max, N, gamma);
}