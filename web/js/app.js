const abas = { dashboard, consultas, pacientes, estoque, lotes, profissionais, rotinas };

document.querySelectorAll('nav button').forEach(btn =>
  btn.addEventListener('click', () => abrir(btn.dataset.aba)));

function abrir(aba) {
  document.querySelectorAll('nav button').forEach(b => b.classList.toggle('ativa', b.dataset.aba === aba));
  document.querySelectorAll('.aba').forEach(s => s.classList.toggle('ativa', s.id === 'aba-' + aba));
  abas[aba].carregar().catch(e => console.error(e));
}

abrir('dashboard');

const modal = {
  abrir(formId, titulo) {
    const form = document.getElementById(formId);
    document.getElementById('modal-titulo').textContent = titulo;
    
    if (!form.dataset.cloneId) {
      const clone = form.cloneNode(true);
      clone.id = 'clone-' + formId;
      clone.style.opacity = '0.4'; 
      clone.style.pointerEvents = 'none';

      clone.querySelectorAll('input, select, textarea').forEach(el => {
        if (el.type !== 'submit' && el.type !== 'button') el.value = '';
      });
      const btnSubmit = clone.querySelector('button[type="submit"]');
      if (btnSubmit) btnSubmit.textContent = 'Cadastrar';
      const btnCancel = clone.querySelector('button.secundario');
      if (btnCancel) btnCancel.hidden = true;
      
      clone.querySelectorAll('[data-cargo]').forEach(el => el.hidden = true);
      
      clone.querySelectorAll('[id]').forEach(el => el.removeAttribute('id'));
      form.parentNode.insertBefore(clone, form);
      form.dataset.cloneId = clone.id;
    }
    
    document.getElementById('modal-conteudo').appendChild(form);
    document.getElementById('modal-fundo').classList.remove('modal-oculto');
  },
  
  fechar() {
    const form = document.querySelector('#modal-conteudo form');
    const fundo = document.getElementById('modal-fundo');

    if (form && form.dataset.cloneId) {
      const snapshot = form.cloneNode(true);
      snapshot.removeAttribute('id');
      snapshot.querySelectorAll('[id]').forEach(el => el.removeAttribute('id'));
      
      const origInputs = form.querySelectorAll('input, select, textarea');
      snapshot.querySelectorAll('input, select, textarea').forEach((el, i) => {
        el.value = origInputs[i].value; 
      });
      document.getElementById('modal-conteudo').appendChild(snapshot);

      const bgClone = document.getElementById(form.dataset.cloneId);
      if (bgClone) {
        bgClone.parentNode.insertBefore(form, bgClone);
        bgClone.remove(); 
      }
      delete form.dataset.cloneId;

      fundo.classList.add('modal-oculto');

      setTimeout(() => snapshot.remove(), 200);
    } else {
      fundo.classList.add('modal-oculto');
    }
  },

  confirmar(mensagem) {
    return new Promise(resolve => {
      const form = document.getElementById('form-excluir');
      document.getElementById('msg-excluir').textContent = mensagem;
      
      form.onsubmit = (e) => {
        e.preventDefault();
        modal.fechar();
        resolve(true);
      };
      
      document.getElementById('cancelar-excluir').onclick = () => {
        modal.fechar();
        resolve(false);
      };
      
      modal.abrir('form-excluir', 'Atenção');
    });
  }
};

document.getElementById('modal-fechar')?.addEventListener('click', () => {
  const form = document.querySelector('#modal-conteudo form');
  const btnCancelar = form ? form.querySelector('[id^="cancelar-"]') : null;
  
  if (btnCancelar && !btnCancelar.hidden) {
    btnCancelar.click();
  } else {
    modal.fechar();
  }
});