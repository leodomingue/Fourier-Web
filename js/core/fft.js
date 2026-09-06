// - fft(vector) : vector de números reales → espectro complejo (array de pares [re, im])
// - ifft(vector) : espectro complejo → señal original (array de pares [re, im])
import fftjs from "https://esm.sh/fft-js@0.0.12";
const { fft, ifft } = fftjs;

/**
 * Convierte dos arrays planos (parte real e imaginaria) en una matrizde filas, donde cada elemento es un par [real, imaginario].
 *
 * @param {Float64Array} real - Array plano con la parte real (largo N*N).
 * @param {Float64Array} imag - Array plano con la parte imaginaria (largo N*N).
 * @param {number} N - Tamaño de la imagen (alto = ancho = N).
 * @returns {Array<Array<[number, number]>>} Matriz de N filas × N columnas.
 */
function convertirFilasAPares(real, imag, N) {
  const filas = new Array(N);
  for (let y = 0; y < N; y++) {
    const fila = new Array(N);
    for (let x = 0; x < N; x++) {
      const indice = y * N + x;
      fila[x] = [real[indice], imag[indice]];
    }
    filas[y] = fila;
  }
  return filas;
}

/**
 * Transpone una matriz cuadrada
 *
 * @param {Array<Array>} matriz - Matriz de tamaño N×N.
 * @param {number} N - Tamaño.
 * @returns {Array<Array>} Matriz transpuesta.
 */
function transponerMatriz(matriz, N) {
  const transpuesta = new Array(N);
  for (let y = 0; y < N; y++) {
    transpuesta[y] = new Array(N);
    for (let x = 0; x < N; x++) {
      transpuesta[y][x] = matriz[x][y];
    }
  }
  return transpuesta;
}

/**
 * Convierte una matriz de pares complejos de vuelta a dos arrays planos.
 *
 * @param {Array<Array<[number, number]>>} filas - Matriz de N×N con pares [re, im].
 * @param {Float64Array} real - Array plano de salida (parte real).
 * @param {Float64Array} imag - Array plano de salida (parte imaginaria).
 * @param {number} N - Tamaño.
 */
function convertirParesAFilasPlanas(filas, real, imag, N) {
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      const indice = y * N + x;
      real[indice] = filas[y][x][0];
      imag[indice] = filas[y][x][1];
    }
  }
}

/**
 * Aplica la FFT 2D (directa o inversa) a una imagen representada por dos arrays planos (parte real e imaginaria).
 *
 * La transformada se hace en dos pasos:
 *   1. Aplicar FFT 1D a cada fila.
 *   2. Transponer, aplicar FFT 1D a cada columna, y transponer de vuelta.
 *
 * @param {Float64Array} real - Parte real de la imagen 
 * @param {Float64Array} imag - Parte imaginaria
 * @param {number} N - Tamaño de la imagen
 * @param {boolean} invertir - false = FFT directa (imagen → frecuencias),
 *                             true  = FFT inversa (frecuencias → imagen).
 */
export function fft2d(real, imag, N, invertir) {
  //Convertimos arrays planos a matriz de filas
  let filas = convertirFilasAPares(real, imag, N);

  // Elegimos la función de transformación 1D según si es inversa o no.
  const transformar1D = invertir ? ifft : fft;

  //Aplicamos FFT 1D por fila
  filas = filas.map((fila) => {
    if (invertir) {
      return transformar1D(fila);
    } else {
      const soloReal = fila.map((par) => par[0]);
      return transformar1D(soloReal);
    }
  });

  //Transponemos para trabnajar con columnas
  let columnas = transponerMatriz(filas, N);

  //Aplicamos FFT a la columnas
  columnas = columnas.map((columna) => transformar1D(columna));

  //Transponemos para la iamgen original
  filas = transponerMatriz(columnas, N);

  //Aplanamos
  convertirParesAFilasPlanas(filas, real, imag, N);
}

/**
 * Desplaza circularmente las mitades de un array plano (N×N) para que la frecuencia ceroquede en el centro de la imagen
 *
 *
 * @param {Float64Array} arrayOriginal - Array plano de N*N
 * @param {number} N - Tamaño de la imagen.
 * @returns {Float64Array} Nuevo array con el desplazamiento aplicado.
 */
export function desplazarEspectro(arrayOriginal, N) {
  const arrayDesplazado = new Float64Array(N * N);
  const mitad = N / 2;

  for (let fila = 0; fila < N; fila++) {
    for (let columna = 0; columna < N; columna++) {
      const nuevaFila = (fila + mitad) % N;
      const nuevaColumna = (columna + mitad) % N;

      const indiceOriginal = fila * N + columna;
      const indiceDesplazado = nuevaFila * N + nuevaColumna;

      arrayDesplazado[indiceDesplazado] = arrayOriginal[indiceOriginal];
    }
  }

  return arrayDesplazado;
}
