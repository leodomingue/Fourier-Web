
// core/mascaraFourier.js 

// Gestiona la máscara booleana que el usuario utiliza para seleccionar frecuencias en el dominio de Fourier. 
// Permite alternar puntos, aplicar un radio circular, reconstruir la imagen a partir de las frecuencias seleccionadas, 
// y calcular estadísticas de energía.

import { fft2d } from './fft.js';

const HISTORIA_MAXIMA = 50;

/**
 * Crea un nuevo estado para la máscara de Fourier.
 * 
 * El estado contiene:
 * - reFourier/imFourier: coeficientes complejos de la FFT de la imagen cargada.
 * - logsReal: valores logarítmicos de la magnitud
 * - maxReal: máximo valor logarítmico
 * - mascara: array de N*N con 0 o 1, indicando frecuencias activas.
 * - historia: array de copias de la máscara para deshacer.
 *
 * @param {number} N - Tamaño de la imagen (alto = ancho).
 * @returns {Object} Estado inicial.
 */
export function crearEstadoMascara(N) {
  return {
    reFourier: null,
    imFourier: null,
    logsReal: null,
    maxReal: 0,
    mascara: new Float64Array(N * N),
    historia: [],
  };
}

/**
 * Carga los coeficientes de Fourier de una imagen en el estado, y resetea
 * la máscara y el historial.
 *
 * @param {Object} estado - El estado de la máscara (obtenido con crearEstadoMascara).
 * @param {Float64Array} grises - Array plano de N*N valores en [0, 255].
 * @param {number} N - Tamaño de la imagen.
 * @returns {void}
 */
export function cargarCoeficientes(estado, grises, N) {
  // Copia la imagen en la parte real; la imaginaria se inicializa a cero
  const parteReal = grises.slice();
  const parteImaginaria = new Float64Array(N * N);
  
  // Aplica FFT 2D directa (imagen → frecuencias)
  fft2d(parteReal, parteImaginaria, N, false);
  
  // Guarda los coeficientes en el estado
  estado.reFourier = parteReal;
  estado.imFourier = parteImaginaria;
  
  // Reinicia la máscara (todas las frecuencias desactivadas)
  estado.mascara = new Float64Array(N * N);
  // Limpia el historial de deshacer
  estado.historia = [];
}

/**
 * Guarda una copia de la máscara actual en el historial (para deshacer).
 * Si el historial excede el límite, elimina la más antigua.
 *
 * @param {Object} estado - El estado de la máscara.
 * @returns {void}
 */
export function guardarHistoria(estado) {
  estado.historia.push(estado.mascara.slice());
  if (estado.historia.length > HISTORIA_MAXIMA) estado.historia.shift();
}
/**
 * Deshace la última operación sobre la máscara, restaurando el estado anterior.
 *
 * @param {Object} estado - El estado de la máscara.
 * @returns {boolean} true si se pudo deshacer, false si no hay historial.
 */
export function deshacer(estado) {
  if (estado.historia.length === 0) return false;
  estado.mascara = estado.historia.pop();
  return true;
}

/**
 * Reinicia la máscara (desactiva todas las frecuencias) y guarda el estado actual en el historial para poder deshacer.
 *
 * @param {Object} estado - El estado de la máscara.
 * @param {number} N - Tamaño de la imagen.
 * @returns {void}
 */
export function reiniciar(estado, N) {
  guardarHistoria(estado); // Guarda el estado actual antes de resetear
  estado.mascara = new Float64Array(N * N);
}

/**
 * Convierte coordenadas del mapa centrado (FFT Shift) a coordenadas crudas en el array de Fourier (sin desplazar).
 *
 * @param {number} xShift - Coordenada X en el mapa centrado [0, N-1].
 * @param {number} yShift - Coordenada Y en el mapa centrado [0, N-1].
 * @param {number} N - Tamaño de la imagen.
 * @returns {{ xRaw: number, yRaw: number }} Coordenadas en el array crudo.
 */
function shiftedARaw(xShift, yShift, N) {
  const mitad = N / 2;
  return {
    xRaw: (xShift - mitad + N) % N,
    yRaw: (yShift - mitad + N) % N,
  };
}

/**
 * Alterna el estado (activar/desactivar) de una frecuencia en la máscara, incluyendo su simétria
 *
 * @param {Object} estado - El estado de la máscara.
 * @param {number} xShift - Coordenada X en el mapa centrado.
 * @param {number} yShift - Coordenada Y en el mapa centrado.
 * @param {number} N - Tamaño de la imagen.
 * @returns {void}
 */
export function alternarFrecuencia(estado, xShift, yShift, N) {
  guardarHistoria(estado);
  
  // Convertie a coordenadas crudas
  const { xRaw, yRaw } = shiftedARaw(xShift, yShift, N);
  const indice = yRaw * N + xRaw;
  
  // Calcula el índice simétrico (frecuencia negativa correspondiente)
  const indiceSimetrico = ((N - yRaw) % N) * N + ((N - xRaw) % N);
  
  // Alterna: si estaba activo (1) se desactiva (0)
  const nuevoValor = estado.mascara[indice] ? 0 : 1;
  estado.mascara[indice] = nuevoValor;
  estado.mascara[indiceSimetrico] = nuevoValor; // Mantener simetría
}

/**
 * Activa todas las frecuencias dentro de un círculo de radio dado en el mapa centrado. 
 * Las frecuencias fuera del círculo se desactivan.
 *
 * @param {Object} estado - El estado de la máscara.
 * @param {number} radio - Radio en píxeles (medido desde el centro).
 * @param {number} N - Tamaño de la imagen.
 * @returns {void}
 */
export function aplicarRadio(estado, radio, N) {
  guardarHistoria(estado);
  
  const mitad = N / 2;
  // Recorre el mapa centrado (xShift, yShift)
  for (let yShift = 0; yShift < N; yShift++) {
    for (let xShift = 0; xShift < N; xShift++) {
      // Calcula distancia desde el centro
      const u = xShift - mitad;
      const v = yShift - mitad;
      const distancia = Math.hypot(u, v);
      
      // Convertie a coordenadas crudas
      const { xRaw, yRaw } = shiftedARaw(xShift, yShift, N);
      // Activa (1) si está dentro del radio, sino desactivar (0)
      estado.mascara[yRaw * N + xRaw] = (distancia <= radio) ? 1 : 0;
    }
  }
}

/**
 * Reconstruye la imagen a partir de las frecuencias seleccionadas en la máscara.
 * Aplica la FFT inversa a los coeficientes filtrados por la máscara.
 *
 * @param {Object} estado - El estado de la máscara (debe contener reFourier/imFourier).
 * @param {number} N - Tamaño de la imagen.
 * @returns {Float64Array} Array plano de N*N con la imagen reconstruida (0-255).
 */
export function reconstruirDesdeMascara(estado, N) {
  // Crea copias de los coeficientes
  const parteReal = new Float64Array(N * N);
  const parteImaginaria = new Float64Array(N * N);
  
  // Multiplica los coeficientes por la máscara (0 o 1)
  for (let i = 0; i < N * N; i++) {
    parteReal[i] = estado.reFourier[i] * estado.mascara[i];
    parteImaginaria[i] = estado.imFourier[i] * estado.mascara[i];
  }
  
  // Aplica FFT inversa (frecuencias → imagen)
  fft2d(parteReal, parteImaginaria, N, true);
  
  // La parte real contiene la imagen reconstruida
  // Recorta valores fuera del rango [0, 255]
  const imagenReconstruida = new Float64Array(N * N);
  for (let i = 0; i < N * N; i++) {
    const valor = Math.round(parteReal[i]); // Redondear para valores enteros
    imagenReconstruida[i] = Math.min(255, Math.max(0, valor));
  }
  
  return imagenReconstruida;
}

/**
 * Calcula estadísticas de energía de las frecuencias seleccionadas en la máscara:
 * - Número de frecuencias activas.
 * - Porcentaje de energía total que representan.
 *
 * @param {Object} estado - El estado de la máscara.
 * @param {number} N - Tamaño de la imagen.
 * @returns {{ activos: number, porcentaje: number }}
 */
export function calcularContador(estado, N) {
  let frecuenciasActivas = 0;
  let energiaSeleccionada = 0;
  let energiaTotal = 0;
  
  for (let i = 0; i < N * N; i++) {
    // Energía = |coeficiente|² = real² + imag²
    const energia = estado.reFourier[i] ** 2 + estado.imFourier[i] ** 2;
    energiaTotal += energia;
    
    if (estado.mascara[i]) {
      frecuenciasActivas++;
      energiaSeleccionada += energia;
    }
  }
  
  const porcentaje = energiaTotal > 0 ? (energiaSeleccionada / energiaTotal) * 100 : 0;
  
  return {
    activos: frecuenciasActivas,
    porcentaje: porcentaje,
  };
}

/**
 * Convierte las coordenadas de un evento del mouse (click/mousemove) en el canvas a coordenadas discretas (xShift, yShift) en el mapa centrado de N×N.
 *
 * @param {MouseEvent} evento - Evento del mouse.
 * @param {HTMLCanvasElement} canvas - El canvas donde ocurrió el evento.
 * @param {number} N - Tamaño de la imagen.
 * @returns {{ xShift: number, yShift: number }} Coordenadas en [0, N-1].
 */
export function coordenadasDesdeEvento(evento, canvas, N) {
  const rect = canvas.getBoundingClientRect();
  // Posición del mouse relativa al canvas en píxeles CSS
  const xCSS = evento.clientX - rect.left;
  const yCSS = evento.clientY - rect.top;
  
  // Escala al tamaño N×N y redondear al píxel más cercano
  const xShift = Math.floor((xCSS / rect.width) * N);
  const yShift = Math.floor((yCSS / rect.height) * N);
  
  return {
    xShift: Math.min(N - 1, Math.max(0, xShift)),
    yShift: Math.min(N - 1, Math.max(0, yShift)),
  };
}

export function obtenerValorEnPunto(estado, xShift, yShift, N) {
  const { xRaw, yRaw } = shiftedARaw(xShift, yShift, N);
  return estado.mascara[yRaw * N + xRaw];
}

export function pintarConPincel(estado, xShift, yShift, radio, valor, N) {
  const r2 = radio * radio;
  const xMin = Math.max(0, Math.floor(xShift - radio));
  const xMax = Math.min(N - 1, Math.ceil(xShift + radio));
  const yMin = Math.max(0, Math.floor(yShift - radio));
  const yMax = Math.min(N - 1, Math.ceil(yShift + radio));

  for (let ys = yMin; ys <= yMax; ys++) {
    for (let xs = xMin; xs <= xMax; xs++) {
      const dx = xs - xShift, dy = ys - yShift;
      if (dx * dx + dy * dy > r2) continue;
      const { xRaw, yRaw } = shiftedARaw(xs, ys, N);
      const indice = yRaw * N + xRaw;
      const indiceSimetrico = ((N - yRaw) % N) * N + ((N - xRaw) % N);
      estado.mascara[indice] = valor;
      estado.mascara[indiceSimetrico] = valor;
    }
  }
}

export function aplicarPasaAltos(estado, radioInterior, N) {
  guardarHistoria(estado);
  const half = N / 2;
  for (let yShift = 0; yShift < N; yShift++) {
    for (let xShift = 0; xShift < N; xShift++) {
      const u = xShift - half, v = yShift - half;
      const { xRaw, yRaw } = shiftedARaw(xShift, yShift, N);
      estado.mascara[yRaw * N + xRaw] = Math.hypot(u, v) >= radioInterior ? 1 : 0;
    }
  }
}

export function aplicarAnillo(estado, radioInterior, radioExterior, N) {
  guardarHistoria(estado);
  const half = N / 2;
  for (let yShift = 0; yShift < N; yShift++) {
    for (let xShift = 0; xShift < N; xShift++) {
      const u = xShift - half, v = yShift - half;
      const d = Math.hypot(u, v);
      const { xRaw, yRaw } = shiftedARaw(xShift, yShift, N);
      estado.mascara[yRaw * N + xRaw] = (d >= radioInterior && d <= radioExterior) ? 1 : 0;
    }
  }
}

export function aplicarAleatorio(estado, cantidad, N) {
  guardarHistoria(estado);
  estado.mascara = new Float64Array(N * N);
  let activados = 0;
  let intentos = 0;
  while (activados < cantidad && intentos < cantidad * 50) {
    intentos++;
    const xRaw = Math.floor(Math.random() * N);
    const yRaw = Math.floor(Math.random() * N);
    const indice = yRaw * N + xRaw;
    if (estado.mascara[indice]) continue;
    const indiceSimetrico = ((N - yRaw) % N) * N + ((N - xRaw) % N);
    estado.mascara[indice] = 1;
    estado.mascara[indiceSimetrico] = 1;
    activados++;
  }
}