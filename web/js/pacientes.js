const pacientes = {
  lista: [],
  editando: null,

  async carregar() {
    const aba = document.getElementById('aba-pacientes');
    const [lista, ubs] = await Promise.all([
      api.get('/api/pacientes'),
      api.get('/api/dashboard/ubs')
    ]);
    this.lista = lista;

    aba.innerHTML = `
      <h2>Pacientes</h2>

      <form id="form-paciente">
        <input name="cns" placeholder="CNS" maxlength="15" required>
        <input name="cpf" placeholder="CPF" maxlength="11">
        <input name="nome" placeholder="Nome" required>
        <input name="data_nascimento" type="date" required>
        <select name="sexo" required>
          <option value="">Sexo</option>
          <option value="F">Feminino</option>
          <option value="M">Masculino</option>
        </select>
        <input name="nome_mae" placeholder="Nome da mãe" required>
        <input name="logradouro" placeholder="Logradouro" required>
        <input name="numero" placeholder="Número">
        <input name="bairro" placeholder="Bairro" required>
        <input name="cep" placeholder="CEP" maxlength="8" required>
        <select name="cnes" required>
          <option value="">UBS de referência</option>
          ${ui.opcoes(ubs, 'cnes', 'nome')}
        </select>
        <select name="cns_responsavel">
          <option value="">Responsável</option>
          ${ui.opcoes(lista, 'cns', 'nome')}
        </select>
        <input name="telefones" placeholder="Telefones separados por vírgula">
        <textarea name="observacoes" placeholder="Observações"></textarea>
        <button type="submit" id="salvar-paciente">Cadastrar</button>
        <button type="button" id="cancelar-paciente" class="secundario" hidden>Cancelar</button>
      </form>

      <div id="lista-pacientes"></div>`;

    const nascimento = aba.querySelector('[name="data_nascimento"]');
    nascimento.max = new Date().toISOString().slice(0, 10);

    document.getElementById('form-paciente').addEventListener('submit', e => this.salvar(e));
    document.getElementById('cancelar-paciente').addEventListener('click', () => this.limpar());
    this.mostrarLista();
  },

  mostrarLista() {
    const alvo = document.getElementById('lista-pacientes');
    if (!this.lista.length) {
      alvo.innerHTML = '<p class="vazio">Nenhum paciente.</p>';
      return;
    }

    alvo.innerHTML = `<table>
      <thead><tr><th>CNS</th><th>Nome</th><th>Ações</th></tr></thead>
      <tbody>${this.lista.map(p => `<tr>
        <td>${ui.esc(p.cns)}</td>
        <td>${ui.esc(p.nome)}</td>
        <td>
          <button class="secundario" data-editar="${ui.esc(p.cns)}">Alterar</button>
          <button class="perigo" data-excluir="${ui.esc(p.cns)}">Excluir</button>
        </td>
      </tr>`).join('')}</tbody>
    </table>`;

    alvo.querySelectorAll('[data-editar]').forEach(b => b.addEventListener('click', () => this.editar(b.dataset.editar)));
    alvo.querySelectorAll('[data-excluir]').forEach(b => b.addEventListener('click', () => this.excluir(b.dataset.excluir)));
  },

  async salvar(evento) {
    evento.preventDefault();
    const form = evento.currentTarget;
    const dados = ui.lerForm(form);

    if (dados.data_nascimento > new Date().toISOString().slice(0, 10)) {
      ui.toast('A data de nascimento não pode ser futura', true);
      return;
    }

    if (this.editando) {
      await api.put('/api/pacientes/' + this.editando, dados);
    } else {
      await api.post('/api/pacientes', dados);
    }

    ui.toast(this.editando ? 'Paciente alterado com sucesso' : 'Paciente cadastrado com sucesso');
    await this.carregar();
  },

  async editar(cns) {
    const paciente = await api.get('/api/pacientes/' + cns);
    const form = document.getElementById('form-paciente');
    this.editando = cns;

    for (const [campo, valor] of Object.entries(paciente)) {
      if (form.elements[campo]) form.elements[campo].value = valor ?? '';
    }

    form.elements.cns.readOnly = true;
    document.getElementById('salvar-paciente').textContent = 'Salvar';
    document.getElementById('cancelar-paciente').hidden = false;
  },

  async excluir(cns) {
    if (!confirm('Deseja excluir este paciente?')) return;
    const resposta = await api.delete('/api/pacientes/' + cns);
    ui.toast(resposta.mensagem);
    await this.carregar();
  },

  limpar() {
    this.editando = null;
    const form = document.getElementById('form-paciente');
    form.reset();
    form.elements.cns.readOnly = false;
    document.getElementById('salvar-paciente').textContent = 'Cadastrar';
    document.getElementById('cancelar-paciente').hidden = true;
  }
};
