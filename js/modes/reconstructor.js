// modes/reconstructor.js
// - Carga de imágenes (fotos o patrones sintéticos)
// - Visualización del espectro de Fourier (mapa real)
// - Interacción: pincel para activar/desactivar frecuencias
// - Reconstrucción en vivo de la imagen a partir de frecuencias seleccionadas
// - Contador de energía, deshacer/reiniciar
import { habilitarPincel } from '../ui/controls.js';
import { prepararImagenParaFourier } from '../core/image.js';
import { fft2d, desplazarEspectro } from '../core/fft.js';
import { generarRayas, generarTablero, generarCirculos } from '../core/patterns.js';
import { pintarGrises, calcularEscalaLog, pintarLogEscalado } from '../ui/canvasRenderer.js';
import {
  crearEstadoMascara, cargarCoeficientes, alternarFrecuencia, aplicarRadio, reconstruirDesdeMascara,
  calcularContador, deshacer, reiniciar, coordenadasDesdeEvento, guardarHistoria, obtenerValorEnPunto, pintarConPincel,
  aplicarPasaAltos, aplicarAleatorio,
} from '../core/mascaraFourier.js';

const N = 128;

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
    sliderPincel: document.getElementById('rec-slider-pincel'),
    sliderPincelValor: document.getElementById('rec-slider-pincel-valor'),
    botonPasaAltos: document.getElementById('rec-boton-pasaaltos'),
    sliderAleatorio: document.getElementById('rec-slider-aleatorio'),
    sliderAleatorioValor: document.getElementById('rec-slider-aleatorio-valor'),
    botonAleatorio: document.getElementById('rec-boton-aleatorio'),
  };
}

function refrescarTodo(elementos, estado) {
  const mascaraCentrada = desplazarEspectro(estado.mascara, N);
  const logsUsuario = new Float64Array(N * N);
  for (let i = 0; i < N * N; i++) {
    logsUsuario[i] = mascaraCentrada[i] ? estado.logsReal[i] : 0;
  }
  pintarLogEscalado(elementos.canvasMapaUsuario, logsUsuario, estado.maxReal, N);

  const imagenReconstruida = reconstruirDesdeMascara(estado, N);
  pintarGrises(elementos.canvasReconstruccion, imagenReconstruida, N);

  const { activos, porcentaje } = calcularContador(estado, N);
  elementos.contadorEnergia.textContent =
    `${activos} de ${N * N} frecuencias activas — ${porcentaje.toFixed(1)}% de la energía capturada`;
}

function actualizarDesdeGrises(grises, elementos, estado) {
  pintarGrises(elementos.canvasOriginal, grises, N);
  cargarCoeficientes(estado, grises, N);

  const magnitudes = new Float64Array(N * N);
  for (let i = 0; i < N * N; i++) {
    magnitudes[i] = Math.hypot(estado.reFourier[i], estado.imFourier[i]);
  }
  const magnitudesCentradas = desplazarEspectro(magnitudes, N);

  const { logs, max } = calcularEscalaLog(magnitudesCentradas, N);
  estado.logsReal = logs;
  estado.maxReal = max;
  pintarLogEscalado(elementos.canvasMapaReal, logs, max, N);

  elementos.sliderRadio.value = 0;
  elementos.sliderRadioValor.textContent = '0';

  refrescarTodo(elementos, estado);
}

export function iniciarReconstructor() {
  const elementos = obtenerElementos();
  const estado = crearEstadoMascara(N);

  elementos.inputFoto.addEventListener('change', async (evento) => {
    const archivo = evento.target.files[0];
    if (!archivo) return;
    const grises = await prepararImagenParaFourier(archivo, N);
    actualizarDesdeGrises(grises, elementos, estado);
  });

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

  elementos.sliderRadio.addEventListener('input', (evento) => {
    if (!estado.reFourier) return;
    const radio = Number(evento.target.value);
    elementos.sliderRadioValor.textContent = radio;
    aplicarRadio(estado, radio, N);
    refrescarTodo(elementos, estado);
  });

  elementos.botonDeshacer.addEventListener('click', () => {
    if (deshacer(estado)) {
      refrescarTodo(elementos, estado);
    }
  });

  elementos.botonReiniciar.addEventListener('click', () => {
    if (!estado.reFourier) return;
    reiniciar(estado, N);
    refrescarTodo(elementos, estado);
  });

  elementos.botonPasaAltos.addEventListener('click', () => {
    if (!estado.reFourier) return;
    aplicarPasaAltos(estado, Number(elementos.sliderRadio.value), N);
    refrescarTodo(elementos, estado);
  });

  elementos.sliderAleatorio.addEventListener('input', () => {
    elementos.sliderAleatorioValor.textContent = `${elementos.sliderAleatorio.value}%`;
  });
  elementos.botonAleatorio.addEventListener('click', () => {
    if (!estado.reFourier) return;
    const porcentaje = Number(elementos.sliderAleatorio.value);
    const cantidadIteraciones = Math.round((porcentaje / 100) * N * N / 2);
    aplicarAleatorio(estado, cantidadIteraciones, N);
    refrescarTodo(elementos, estado);
  });

  actualizarDesdeGrises(generarRayas(N, 'vertical', 8), elementos, estado);
}