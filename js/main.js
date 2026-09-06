import { iniciarReconstructor } from './modes/reconstructor.js';
import { iniciarDiccionario } from './modes/dictionary.js';
import { iniciarFotoPatron } from './modes/photoPattern.js';

const MODOS = ['reconstructor', 'diccionario', 'foto-patron'];

function mostrarModo(nombreModo) {
  for (const modo of MODOS) {
    document.getElementById(`modo-${modo}`).hidden = modo !== nombreModo;
  }
  document.querySelectorAll('.boton-modo').forEach((boton) => {
    boton.classList.toggle('activo', boton.dataset.modo === nombreModo);
  });
}

document.getElementById('selector-modo').addEventListener('click', (evento) => {
  const boton = evento.target.closest('.boton-modo');
  if (!boton) return;
  mostrarModo(boton.dataset.modo);
});

iniciarReconstructor();
iniciarDiccionario();
iniciarFotoPatron();
mostrarModo('reconstructor');