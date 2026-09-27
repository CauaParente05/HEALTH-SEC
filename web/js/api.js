const api = {
  async get(caminho, params = {}) {
    const qs = new URLSearchParams(limpar(params)).toString();
    return tratar(await fetch(caminho + (qs ? '?' + qs : '')));
  },
  async post(caminho, dados = {}) {
    return tratar(await fetch(caminho, { method: 'POST', body: new URLSearchParams(limpar(dados)) }));
  },
  async put(caminho, dados = {}) {
    return tratar(await fetch(caminho, { method: 'PUT', body: new URLSearchParams(limpar(dados)) }));
  },
  async delete(caminho) {
    return tratar(await fetch(caminho, { method: 'DELETE' }));
  },
};

function limpar(obj) {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined && v !== null));
}

async function tratar(resp) {
  const json = await resp.json();
  if (!resp.ok) {
    ui.toast(json.erro || 'Erro inesperado', true);
    throw new Error(json.erro);
  }
  return json;
}

const ui = {
  toast(msg, erro = false) {
    const t = document.getElementById('toast');
    t.textContent = msg;
    t.className = erro ? 'mostrar erro' : 'mostrar';
    clearTimeout(ui._timer);
    ui._timer = setTimeout(() => (t.className = ''), 4000);
  },
  esc(v) {
    return String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  },
  tabela(linhas) {
    if (!linhas.length) return '<p class="vazio">Nenhum resultado.</p>';
    const cols = Object.keys(linhas[0]);
    return `<table><thead><tr>${cols.map(c => `<th>${ui.esc(c)}</th>`).join('')}</tr></thead><tbody>${
      linhas.map(l => `<tr>${cols.map(c => `<td>${ui.esc(l[c])}</td>`).join('')}</tr>`).join('')
    }</tbody></table>`;
  },
  opcoes(lista, valor, texto) {
    return lista.map(x => `<option value="${ui.esc(x[valor])}">${ui.esc(x[texto])}</option>`).join('');
  },
  lerForm(form) { return Object.fromEntries(new FormData(form)); },
};
