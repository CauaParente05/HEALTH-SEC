const estoque = {
  ubs: [],
  lotes: [],
  filtroCnes: '',

  async carregar() {
    const aba = document.getElementById('aba-estoque');
    const [ubs, lotes] = await Promise.all([
      api.get('/api/dashboard/ubs'),
      api.get('/api/lotes')
    ]);
    this.ubs = ubs;
    this.lotes = lotes;

    aba.innerHTML = `
      <h2>Estoque</h2>

      <form id="form-entrada-estoque">
        <select name="cnes" required>
          <option value="">UBS</option>
          ${ui.opcoes(ubs, 'cnes', 'nome')}
        </select>
        <select name="id_lote" required>
          <option value="">Lote</option>
          ${lotes.map(l => `<option value="${ui.esc(l.id_lote)}">${ui.esc(l.fabricante)} · ${ui.esc(l.numero_lote)}</option>`).join('')}
        </select>
        <input name="quantidade" type="number" min="1" placeholder="Quantidade" required>
        <button type="submit">Registrar entrada</button>
      </form>

      <form id="filtro-estoque">
        <label>UBS
          <select name="cnes">
            <option value="">Todas</option>
            ${ui.opcoes(ubs, 'cnes', 'nome')}
          </select>
        </label>
      </form>

      <div id="lista-estoque"></div>`;

    document.getElementById('form-entrada-estoque').addEventListener('submit', e => this.entrada(e));
    document.querySelector('#filtro-estoque [name="cnes"]').addEventListener('change', e => {
      this.filtroCnes = e.target.value;
      this.listar();
    });

    await this.listar();
  },

  async listar() {
    const linhas = await api.get('/api/estoque', { cnes: this.filtroCnes || null });
    const alvo = document.getElementById('lista-estoque');

    if (!linhas.length) {
      alvo.innerHTML = '<p class="vazio">Nenhum estoque encontrado.</p>';
      return;
    }

    alvo.innerHTML = `<table>
      <thead><tr>
        <th>UBS</th><th>Lote</th><th>Fabricante</th><th>Vacina</th><th>Validade</th>
        <th>Quantidade</th><th>Atualização</th><th>Ações</th>
      </tr></thead>
      <tbody>${linhas.map(e => `<tr>
        <td>${ui.esc(e.ubs)}</td>
        <td>${ui.esc(e.numero_lote)}</td>
        <td>${ui.esc(e.fabricante)}</td>
        <td>${ui.esc(e.vacina)}</td>
        <td>${ui.esc(e.data_validade)}</td>
        <td>${ui.esc(e.quantidade_disponivel)}</td>
        <td>${ui.esc(e.data_atualizacao)}</td>
        <td>
          <button class="secundario" data-ajustar="${ui.esc(e.id_lote)}" data-cnes="${ui.esc(e.cnes)}" data-qtd="${ui.esc(e.quantidade_disponivel)}">Ajustar</button>
          <button class="perigo" data-remover="${ui.esc(e.id_lote)}" data-cnes="${ui.esc(e.cnes)}">Remover</button>
        </td>
      </tr>`).join('')}</tbody>
    </table>`;

    alvo.querySelectorAll('[data-ajustar]').forEach(b => b.addEventListener('click', () => this.ajustar(b)));
    alvo.querySelectorAll('[data-remover]').forEach(b => b.addEventListener('click', () => this.remover(b)));
  },

  async entrada(evento) {
    evento.preventDefault();
    const dados = ui.lerForm(evento.currentTarget);
    await api.post('/api/estoque', dados);
    ui.toast('Entrada registrada com sucesso');
    evento.currentTarget.reset();
    await this.listar();
  },

  async ajustar(botao) {
    const valor = prompt('Nova quantidade disponível:', botao.dataset.qtd);
    if (valor === null) return;
    if (!/^\d+$/.test(valor)) {
      ui.toast('Informe uma quantidade inteira maior ou igual a zero', true);
      return;
    }

    const resposta = await api.put(`/api/estoque/${botao.dataset.cnes}/${botao.dataset.ajustar}`, { quantidade: valor });
    ui.toast(resposta.mensagem);
    await this.listar();
  },

  async remover(botao) {
    if (!confirm('Deseja remover este lote do estoque da UBS?')) return;
    const resposta = await api.delete(`/api/estoque/${botao.dataset.cnes}/${botao.dataset.remover}`);
    ui.toast(resposta.mensagem);
    await this.listar();
  }
};
