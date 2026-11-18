const lotes = {
  editando: null,
  filtroVacina: '',

  async carregar() {
    const aba = document.getElementById('aba-lotes');
    const vacinas = await api.get('/api/vacinas');

    aba.innerHTML = `
      <h2>Lotes</h2>
      <p class="vazio">Cadastrar um lote com validade expirada é bloqueado no banco pelo trigger
        <code>trg_bloqueia_lote_vencido_entrada</code>. Lote com estoque ou dose aplicada não pode ser excluído (FK).</p>

      <form id="form-lote">
        <select name="codigo_vacina" required>
          <option value="">Vacina</option>
          ${ui.opcoes(vacinas, 'codigo_vacina', 'nome')}
        </select>
        <input name="numero_lote" placeholder="Número do lote" maxlength="30" required>
        <input name="fabricante" placeholder="Fabricante" maxlength="80" required>
        <label>Validade <input name="data_validade" type="date" required></label>
        <input name="quantidade_total" type="number" min="1" placeholder="Quantidade total" required>
        <button type="submit" id="salvar-lote">Cadastrar</button>
        <button type="button" id="cancelar-lote" class="secundario" hidden>Cancelar</button>
      </form>

      <form id="filtro-lotes">
        <label>Vacina
          <select name="codigo_vacina">
            <option value="">Todas</option>
            ${ui.opcoes(vacinas, 'codigo_vacina', 'nome')}
          </select>
        </label>
      </form>

      <div id="lista-lotes"></div>`;

    document.getElementById('form-lote').addEventListener('submit', e => this.salvar(e));
    document.getElementById('cancelar-lote').addEventListener('click', () => this.limpar());
    const filtro = document.querySelector('#filtro-lotes [name="codigo_vacina"]');
    filtro.value = this.filtroVacina;
    filtro.addEventListener('change', e => {
      this.filtroVacina = e.target.value;
      this.listar();
    });

    this.editando = null;
    await this.listar();
  },

  async listar() {
    const linhas = await api.get('/api/lotes', { codigo_vacina: this.filtroVacina || null });
    const alvo = document.getElementById('lista-lotes');

    if (!linhas.length) {
      alvo.innerHTML = '<p class="vazio">Nenhum lote encontrado.</p>';
      return;
    }

    alvo.innerHTML = `<table>
      <thead><tr>
        <th>Id</th><th>Vacina</th><th>Lote</th><th>Fabricante</th><th>Validade</th><th>Situação</th>
        <th>Total</th><th>Em estoque</th><th>Aplicadas</th><th>Ações</th>
      </tr></thead>
      <tbody>${linhas.map(l => `<tr>
        <td>${ui.esc(l.id_lote)}</td>
        <td>${ui.esc(l.vacina)}</td>
        <td>${ui.esc(l.numero_lote)}</td>
        <td>${ui.esc(l.fabricante)}</td>
        <td>${ui.esc(l.data_validade)}</td>
        <td>${ui.selo(l.situacao_validade)}</td>
        <td>${ui.esc(l.quantidade_total)}</td>
        <td>${ui.esc(l.em_estoque)}</td>
        <td>${ui.esc(l.aplicadas)}</td>
        <td>
          <button class="secundario" data-editar="${ui.esc(l.id_lote)}">Alterar</button>
          <button class="perigo" data-excluir="${ui.esc(l.id_lote)}">Excluir</button>
        </td>
      </tr>`).join('')}</tbody>
    </table>`;

    alvo.querySelectorAll('[data-editar]').forEach(b => b.addEventListener('click', () => this.editar(b.dataset.editar)));
    alvo.querySelectorAll('[data-excluir]').forEach(b => b.addEventListener('click', () => this.excluir(b.dataset.excluir)));
  },

  async salvar(evento) {
    evento.preventDefault();
    const dados = ui.lerForm(evento.currentTarget);

    const resposta = this.editando
      ? await api.put('/api/lotes/' + this.editando, dados)
      : await api.post('/api/lotes', dados);

    ui.toast(resposta.mensagem);
    this.limpar();
    await this.listar();
  },

  async editar(id) {
    const lote = await api.get('/api/lotes/' + id);
    const form = document.getElementById('form-lote');
    this.editando = id;

    for (const [campo, valor] of Object.entries(lote)) {
      if (form.elements[campo]) form.elements[campo].value = valor ?? '';
    }

    form.elements.codigo_vacina.disabled = true;
    document.getElementById('salvar-lote').textContent = 'Salvar';
    document.getElementById('cancelar-lote').hidden = false;
    modal.abrir('form-lote', 'Editar Lote');
  },

  async excluir(id) {
    if (!(await modal.confirmar('Deseja excluir este lote?'))) return;
    const resposta = await api.delete('/api/lotes/' + id);
    ui.toast(resposta.mensagem);
    await this.listar();
  },

  limpar() {
    modal.fechar();
    this.editando = null;
    const form = document.getElementById('form-lote');
    form.reset();
    form.elements.codigo_vacina.disabled = false;
    document.getElementById('salvar-lote').textContent = 'Cadastrar';
    document.getElementById('cancelar-lote').hidden = true;
  }
};
