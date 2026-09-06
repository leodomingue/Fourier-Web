// core/patterns.js 
//  1) Genera imágenes de entrada sintéticas (rayas, tablero, círculos)
//  2) La onda pura de una frecuencia (u,v) y su descripción en palabras,
// usadas por el Diccionario y por el tooltip del Reconstructor.

/**
 * Rayas rectas. orientacion: 'vertical' | 'horizontal' | 'diagonal'.
 * Cada una con una transicion dependiendo del largo
 * ciclos = cuántas veces se repite la raya a lo largo de la imagen
 */
export function generarRayas(N, orientacion = 'vertical', ciclos = 8) {
  const datos = new Float64Array(N * N);
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      let fase;
      if (orientacion === 'vertical') fase = x / N;
      else if (orientacion === 'horizontal') fase = y / N;
      else fase = (x + y) / (2 * N);
      const valor = Math.cos(2 * Math.PI * ciclos * fase);
      datos[y * N + x] = (valor + 1) * 0.5 * 255;
    }
  }
  return datos;
}

/** Tablero de ajedrez, con celdas de "tamanoCelda" píxeles de lado. */
export function generarTablero(N, tamanoCelda = 16) {
  const datos = new Float64Array(N * N);
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      const celdaX = Math.floor(x / tamanoCelda);
      const celdaY = Math.floor(y / tamanoCelda);
      datos[y * N + x] = (celdaX + celdaY) % 2 === 0 ? 255 : 0;
    }
  }
  return datos;
}

/** Círculos */
export function generarCirculos(N, anillos = 6) {
  const datos = new Float64Array(N * N);
  const centro = N / 2;
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      const radio = Math.hypot(x - centro, y - centro) / centro;
      const valor = Math.cos(2 * Math.PI * anillos * radio);
      datos[y * N + x] = (valor + 1) * 0.5 * 255;
    }
  }
  return datos;
}

/**
 * La onda pura que representa la frecuencia (u,v). lo que hay que "sumar"
 * para reconstruir la imagen si ese punto del mapa de Fourier está prendido
 */
export function generarPatronDeFrecuencia(u, v, N, fase = 0) {
  const datos = new Float64Array(N * N);
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      const valor = Math.cos(2 * Math.PI * (u * x / N + v * y / N) + fase);
      datos[y * N + x] = (valor + 1) * 0.5 * 255;
    }
  }
  return datos;
}

/**
 * Describe en palabras qué pinta tiene la frecuencia (u,v): orientación
 * (vertical/horizontal/diagonal) y finura (ancha/fina)
 */
export function describirFrecuencia(u, v, N) {
  const magnitud = Math.hypot(u, v);
  if (magnitud < 0.5) return 'Brillo general (sin textura)';

  let angulo = (Math.atan2(v, u) * 180) / Math.PI;
  angulo = ((angulo % 180) + 180) % 180;

  let orientacion;
  if (angulo < 22.5 || angulo >= 157.5) orientacion = 'rayas verticales';
  else if (angulo >= 67.5 && angulo < 112.5) orientacion = 'rayas horizontales';
  else if (angulo >= 22.5 && angulo < 67.5) orientacion = 'rayas diagonales ( / )';
  else orientacion = 'rayas diagonales ( \\ )';

  const proporcion = magnitud / (N / 2);
  let finura;
  if (proporcion < 0.15) finura = 'muy anchas';
  else if (proporcion < 0.4) finura = 'anchas';
  else if (proporcion < 0.7) finura = 'finas';
  else finura = 'muy finas';

  return `${orientacion}, ${finura}`;
}