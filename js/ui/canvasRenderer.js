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

export function pintarMagnitudEspectro(canvas, magnitudes, N, gamma = 0.8) {
   //Aplicamos compresión logarítmica 
  const logs = new Float64Array(N * N);
  let max = 0;
  for (let i = 0; i < N * N; i++) {
    logs[i] = Math.log1p(magnitudes[i]); // log(1+x)
    if (logs[i] > max) max = logs[i];
  }

  // Normalizamos y aplicamos gamma ---
  const grises = new Float64Array(N * N);
  for (let i = 0; i < N * N; i++) {
    const normalizado = max > 0 ? logs[i] / max : 0;
    grises[i] = Math.pow(normalizado, gamma) * 255;
  }

  pintarGrises(canvas, grises, N);
}