// ui/controls.js — pincel por arrastre
export function habilitarPincel(canvas, alEmpezarTrazo, alTocarPunto) {
  let dibujando = false;

  function puntoDelEvento(evento) {
    return evento.touches ? evento.touches[0] : evento;
  }

  canvas.addEventListener('mousedown', (evento) => {
    dibujando = true;
    alEmpezarTrazo();
    alTocarPunto(puntoDelEvento(evento));
  });
  canvas.addEventListener('mousemove', (evento) => {
    if (!dibujando) return;
    alTocarPunto(puntoDelEvento(evento));
  });
  window.addEventListener('mouseup', () => { dibujando = false; });

  canvas.addEventListener('touchstart', (evento) => {
    evento.preventDefault();
    dibujando = true;
    alEmpezarTrazo();
    alTocarPunto(puntoDelEvento(evento));
  }, { passive: false });
  canvas.addEventListener('touchmove', (evento) => {
    evento.preventDefault();
    if (!dibujando) return;
    alTocarPunto(puntoDelEvento(evento));
  }, { passive: false });
  canvas.addEventListener('touchend', () => { dibujando = false; });
}