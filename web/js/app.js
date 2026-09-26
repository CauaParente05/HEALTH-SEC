// Troca de abas. Cada aba tem um objeto com carregar() no seu próprio arquivo JS.
const abas = { dashboard, consultas, pacientes, estoque };

document.querySelectorAll('nav button').forEach(btn =>
  btn.addEventListener('click', () => abrir(btn.dataset.aba)));

function abrir(aba) {
  document.querySelectorAll('nav button').forEach(b => b.classList.toggle('ativa', b.dataset.aba === aba));
  document.querySelectorAll('.aba').forEach(s => s.classList.toggle('ativa', s.id === 'aba-' + aba));
  abas[aba].carregar().catch(e => console.error(e));
}

abrir('dashboard');
