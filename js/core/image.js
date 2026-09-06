// core/image.js — carga una foto y la deja lista para Fourier
// recorte central cuadrado + escala de grises + redimensión a N x N.

/**
 * Lee un archivo de imagen (el que sube el usuario con <input type="file">) y lo carga como HTMLImageElement, listo para dibujar en un canvas.
 * @param {File} archivo
 * @returns {Promise<HTMLImageElement>}
 */
export function cargarImagenDesdeArchivo(archivo) {
  return new Promise((resolve, reject) => {
    const lector = new FileReader();
    lector.onload = (evento) => {
      const imagen = new Image();
      imagen.onload = () => resolve(imagen);
      imagen.onerror = () => reject(new Error('No se pudo decodificar la imagen.'));
      imagen.src = evento.target.result;
    };
    lector.onerror = () => reject(new Error('No se pudo leer el archivo.'));
    lector.readAsDataURL(archivo);
  });
}

/**
 * Recorta la imagen al cuadrado central más grande posible y la redimensiona a N x N, 
 * devolviendo un array plano de grises y largo N*N.
 * @param {HTMLImageElement} imagen
 * @param {number} N
 * @returns {Float64Array}
 */
export function convertirAGrisesYRedimensionar(imagen, N) {
  const canvas = document.createElement('canvas');
  canvas.width = N;
  canvas.height = N;
  const contexto = canvas.getContext('2d');

  const lado = Math.min(imagen.width, imagen.height);
  const origenX = (imagen.width - lado) / 2;
  const origenY = (imagen.height - lado) / 2;

  contexto.drawImage(imagen, origenX, origenY, lado, lado, 0, 0, N, N);

  const datos = contexto.getImageData(0, 0, N, N).data;
  const grises = new Float64Array(N * N);

  for (let i = 0; i < N * N; i++) {
    const r = datos[i * 4];
    const g = datos[i * 4 + 1];
    const b = datos[i * 4 + 2];
    grises[i] = 0.299 * r + 0.587 * g + 0.114 * b;
  }

  return grises;
}

/**
 * Atajo: de un File a un array de grises N x N, en un solo paso.
 * @param {File} archivo
 * @param {number} N
 * @returns {Promise<Float64Array>}
 */
export async function prepararImagenParaFourier(archivo, N) {
  const imagen = await cargarImagenDesdeArchivo(archivo);
  return convertirAGrisesYRedimensionar(imagen, N);
}