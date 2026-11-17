const profissionais = {
  editando: null,
  filtroCnes: '',

  CARGOS: {
    ENFERMEIRO: 'Enfermeiro(a)',
    TECNICO_ENFERMAGEM: 'Técnico(a) de enfermagem',
    MEDICO: 'Médico(a)',
  },

  async carregar() {
    const aba = document.getElementById('aba-profissionais');
    const [ubs, todos] = await Promise.all([
      api.get('/api/dashboard/ubs'),
      api.get('/api/profissionais')
    ]);

    aba.innerHTML = `
      <h2>Profissionais</h2>
      <p class="vazio">Especialização disjunta em tabela única: só o campo do cargo escolhido é gravado
        (CHECK <code>ck_prof_subtipo</code>). Supervisionar a si mesmo é bloqueado pelo trigger
        <code>trg_profissional_bu</code>; quem já aplicou dose não pode ser excluído (FK).</p>

      <form id="form-profissional">
        <input name="nome" placeholder="Nome" maxlength="100" required>
        <select name="cargo" required>
          <option value="">Cargo</option>
          ${Object.entries(this.CARGOS).map(([v, t]) => `<option value="${v}">${t}</option>`).join('')}
        </select>
        <input name="registro_conselho" placeholder="COREN / CRM" maxlength="20" required>
        <select name="cnes" required>
          <option value="">UBS de lotação</option>
          ${ui.opcoes(ubs, 'cnes', 'nome')}
        </select>
        <select name="id_supervisor">
          <option value="">Sem supervisor</option>
          ${ui.opcoes(todos, 'id_profissional', 'nome')}
        </select>
        <select name="coordena_sala_vacina" data-cargo="ENFERMEIRO" hidden>
          <option value="">Coordena a sala de vacina?</option>
          <option value="1">Coordena a sala</option>
          <option value="0">Não coordena</option>
        </select>
        <input name="especialidade" placeholder="Especialidade" maxlength="60" data-cargo="MEDICO" hidden>
        <label data-cargo="TECNICO_ENFERMAGEM" hidden>Última capacitação
          <input name="data_ultima_capacitacao" type="date">
        </label>
        <button type="submit" id="salvar-profissional">Cadastrar</button>
        <button type="button" id="cancelar-profissional" class="secundario" hidden>Cancelar</button>
      </form>

      <form id="filtro-profissionais">
        <label>UBS
          <select name="cnes">
            <option value="">Todas</option>
            ${ui.opcoes(ubs, 'cnes', 'nome')}
          </select>
        </label>
      </form>

      <div id="lista-profissionais"></div>`;

    const form = document.getElementById('form-profissional');
    form.addEventListener('submit', e => this.salvar(e));
    form.elements.cargo.addEventListener('change', () => this.mostrarSubtipo());
    document.getElementById('cancelar-profissional').addEventListener('click', () => this.limpar());
    const filtro = document.querySelector('#filtro-profissionais [name="cnes"]');
    filtro.value = this.filtroCnes;
    filtro.addEventListener('change', e => {
      this.filtroCnes = e.target.value;
      this.listar();
    });

    this.editando = null;
    await this.listar();
  },

  mostrarSubtipo() {
    const cargo = document.getElementById('form-profissional').elements.cargo.value;
    document.querySelectorAll('#form-profissional [data-cargo]').forEach(el => el.hidden = el.dataset.cargo !== cargo);
  },

  async listar() {
    const linhas = await api.get('/api/profissionais', { cnes: this.filtroCnes || null });
    const alvo = document.getElementById('lista-profissionais');

    if (!linhas.length) {
      alvo.innerHTML = '<p class="vazio">Nenhum profissional encontrado.</p>';
      return;
    }

    const detalhe = p => p.cargo === 'ENFERMEIRO'
      ? (p.coordena_sala_vacina == null ? '' : Number(p.coordena_sala_vacina) ? 'Coordena a sala de vacina' : 'Não coordena')
      : p.cargo === 'MEDICO' ? (p.especialidade ?? '')
      : p.data_ultima_capacitacao ? 'Capacitação: ' + p.data_ultima_capacitacao : '';

    alvo.innerHTML = `<table>
      <thead><tr>
        <th>Nome</th><th>Cargo</th><th>Registro</th><th>UBS</th><th>Supervisor</th>
        <th>Detalhe do cargo</th><th>Doses aplicadas</th><th>Ações</th>
      </tr></thead>
      <tbody>${linhas.map(p => `<tr>
        <td>${ui.esc(p.nome)}</td>
        <td>${ui.esc(this.CARGOS[p.cargo] ?? p.cargo)}</td>
        <td>${ui.esc(p.registro_conselho)}</td>
        <td>${ui.esc(p.ubs)}</td>
        <td>${ui.esc(p.supervisor ?? '—')}</td>
        <td>${ui.esc(detalhe(p))}</td>
        <td>${ui.esc(p.doses_aplicadas)}</td>
        <td>
          <button class="secundario" data-editar="${ui.esc(p.id_profissional)}">Alterar</button>
          <button class="perigo" data-excluir="${ui.esc(p.id_profissional)}">Excluir</button>
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
      ? await api.put('/api/profissionais/' + this.editando, dados)
      : await api.post('/api/profissionais', dados);

    ui.toast(resposta.mensagem);
    await this.carregar();
  },

  async editar(id) {
    const p = await api.get('/api/profissionais/' + id);
    const form = document.getElementById('form-profissional');
    this.editando = id;

    for (const [campo, valor] of Object.entries(p)) {
      if (!form.elements[campo]) continue;
      form.elements[campo].value = typeof valor === 'boolean' ? (valor ? '1' : '0') : valor ?? '';
    }

    this.mostrarSubtipo();
    document.getElementById('salvar-profissional').textContent = 'Salvar';
    document.getElementById('cancelar-profissional').hidden = false;
  },

  async excluir(id) {
    if (!confirm('Deseja excluir este profissional?')) return;
    const resposta = await api.delete('/api/profissionais/' + id);
    ui.toast(resposta.mensagem);
    await this.carregar();
  },

  limpar() {
    this.editando = null;
    document.getElementById('form-profissional').reset();
    this.mostrarSubtipo();
    document.getElementById('salvar-profissional').textContent = 'Cadastrar';
    document.getElementById('cancelar-profissional').hidden = true;
  }
};
