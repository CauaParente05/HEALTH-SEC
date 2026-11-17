const rotinas = {
  ubs: [],
  vacinas: [],
  dosesAplicaveis: [],

  async carregar() {
    const aba = document.getElementById('aba-rotinas');
    [rotinas.ubs, rotinas.vacinas] = await Promise.all([api.get('/api/dashboard/ubs'), api.get('/api/vacinas')]);
    const ubsOpc = ui.opcoes(rotinas.ubs, 'cnes', 'nome');
    const vacOpc = ui.opcoes(rotinas.vacinas, 'codigo_vacina', 'nome');
    const hoje = new Date().toISOString().slice(0, 10);

    aba.innerHTML = `
      <h2>Funções, procedimentos e triggers</h2>
      <p class="vazio">Objetos criados na Etapa 05 (<code>db/funcoes.sql</code>, <code>db/procedimentos.sql</code>,
        <code>db/triggers.sql</code>), executados direto no banco. As ações que gravam rodam em transação.</p>

      <div class="rotinas">
        <article class="rotina">
          <div class="rotina-topo"><span class="tipo">Função</span><h3>fn_situacao_dose(status, data_prevista)</h3></div>
          <p class="pergunta">Devolve a situação real da dose: uma PENDENTE com data prevista vencida vira ATRASADA.</p>
          <form id="form-fn-situacao">
            <select name="status" required>
              <option value="PENDENTE">PENDENTE</option>
              <option value="APLICADA">APLICADA</option>
              <option value="CANCELADA">CANCELADA</option>
            </select>
            <label>Data prevista <input name="data_prevista" type="date" value="${hoje}" required></label>
            <button type="submit">Executar</button>
            <span id="res-fn-situacao" class="resultado-rotina"></span>
          </form>
          <h4>Aplicada a todas as doses registradas</h4>
          <form id="form-fn-situacao-ubs">
            <label>UBS do paciente <select name="cnes"><option value="">Todas</option>${ubsOpc}</select></label>
          </form>
          <div id="graf-fn-situacao"></div>
        </article>

        <article class="rotina">
          <div class="rotina-topo"><span class="tipo">Função</span><h3>fn_saldo_aplicavel(cnes, codigo_vacina)</h3></div>
          <p class="pergunta">Soma o estoque da vacina na UBS considerando só lotes dentro da validade.
            A diferença para o saldo total são doses em lotes vencidos.</p>
          <form id="form-fn-saldo">
            <label>UBS <select name="cnes" required>${ubsOpc}</select></label>
          </form>
          <div id="graf-fn-saldo"></div>
        </article>

        <article class="rotina larga">
          <div class="rotina-topo"><span class="tipo">Procedimento</span><h3>pr_registrar_aplicacao_dose(...)</h3></div>
          <p class="pergunta">Marca a dose pendente como APLICADA hoje e dá baixa de 1 dose no estoque do lote.
            A mudança de status dispara o trigger <code>trg_auditoria_status_dose</code>, que grava em <code>Log_Status_Dose</code>.</p>
          <form id="form-pr-aplicar">
            <label>UBS da aplicação <select name="cnes" required><option value="">Selecione</option>${ubsOpc}</select></label>
            <select name="dose" required disabled><option value="">Dose pendente (escolha a UBS)</option></select>
            <select name="id_lote" required disabled><option value="">Lote</option></select>
            <select name="id_profissional" required disabled><option value="">Profissional</option></select>
            <input name="local_anatomico" placeholder="Local anatômico" maxlength="30">
            <button type="submit">CALL pr_registrar_aplicacao_dose</button>
            <button type="button" id="btn-cancelar-dose" class="secundario">Cancelar a dose (UPDATE)</button>
          </form>
          <p class="vazio">Lista as doses pendentes dos pacientes da UBS cuja vacina tem saldo aplicável nela
            (<code>fn_saldo_aplicavel &gt; 0</code>). "Cancelar a dose" faz um UPDATE simples, que também dispara o trigger de auditoria.</p>
          <div id="res-pr-aplicar"></div>
        </article>

        <article class="rotina larga">
          <div class="rotina-topo"><span class="tipo">Procedimento com cursor</span><h3>pr_baixa_estoque_fifo(cnes, codigo_vacina, qtd)</h3></div>
          <p class="pergunta">Dá baixa de uma quantidade percorrendo os lotes da vacina na UBS do que vence primeiro
            para o que vence por último (FIFO por validade), lote a lote.</p>
          <form id="form-pr-fifo">
            <label>UBS <select name="cnes" required><option value="">Selecione</option>${ubsOpc}</select></label>
            <select name="codigo_vacina" required><option value="">Vacina</option>${vacOpc}</select>
            <input name="quantidade" type="number" min="1" placeholder="Quantidade" required>
            <button type="submit">CALL pr_baixa_estoque_fifo</button>
          </form>
          <div id="res-pr-fifo"></div>
        </article>

        <article class="rotina">
          <div class="rotina-topo"><span class="tipo">Trigger</span><h3>trg_bloqueia_lote_vencido_entrada</h3></div>
          <p class="pergunta">BEFORE INSERT em Lote: recusa lote com validade já expirada. O teste tenta o INSERT
            de verdade e sempre desfaz (ROLLBACK).</p>
          <form id="form-trg-lote">
            <select name="codigo_vacina" required>${vacOpc}</select>
            <label>Validade <input name="data_validade" type="date" required></label>
            <button type="submit">Testar INSERT</button>
          </form>
          <div id="res-trg-lote"></div>
        </article>

        <article class="rotina">
          <div class="rotina-topo"><span class="tipo">Trigger</span><h3>trg_auditoria_status_dose</h3></div>
          <p class="pergunta">AFTER UPDATE em Registro_Dose: toda mudança de status vira uma linha em
            <code>Log_Status_Dose</code>. Últimas 100 entradas:</p>
          <button type="button" id="btn-log" class="secundario">Atualizar log</button>
          <div id="res-log"></div>
        </article>
      </div>`;

    rotinas.ligar();
    await Promise.all([rotinas.situacaoRegistradas(), rotinas.saldo(), rotinas.log()]);
  },

  ligar() {
    const $ = id => document.getElementById(id);
    const enviar = (id, fn) => $(id).addEventListener('submit', e => { e.preventDefault(); fn(ui.lerForm(e.currentTarget)).catch(console.error); });

    enviar('form-fn-situacao', async d => {
      const r = await api.get('/api/rotinas/fn-situacao-dose', d);
      $('res-fn-situacao').innerHTML = `→ ${ui.selo(r.situacao)}`;
    });
    $('form-fn-situacao-ubs').addEventListener('change', () => rotinas.situacaoRegistradas());
    $('form-fn-saldo').addEventListener('change', () => rotinas.saldo());

    const fAplicar = $('form-pr-aplicar');
    fAplicar.elements.cnes.addEventListener('change', () => rotinas.carregarDoses());
    fAplicar.elements.dose.addEventListener('change', () => rotinas.carregarLotes());
    enviar('form-pr-aplicar', d => rotinas.aplicar(d));
    $('btn-cancelar-dose').addEventListener('click', () => rotinas.cancelar().catch(console.error));

    enviar('form-pr-fifo', async d => {
      if (!confirm(`Dar baixa de ${d.quantidade} dose(s) no estoque? A alteração é gravada no banco.`)) return;
      const r = await api.post('/api/rotinas/pr-baixa-estoque-fifo', d);
      $('res-pr-fifo').innerHTML = rotinas.mostrarFifo(r);
    });

    enviar('form-trg-lote', async d => {
      const r = await api.post('/api/rotinas/testar-lote-vencido', d);
      $('res-trg-lote').innerHTML = `<p class="consulta-mensagem ${r.bloqueado ? 'erro' : 'sucesso'}">
        <b>${r.bloqueado ? 'Bloqueado pelo trigger' : 'Aceito'}</b>: ${ui.esc(r.mensagem)}</p>`;
    });
    $('btn-log').addEventListener('click', () => rotinas.log().catch(console.error));
  },

  async situacaoRegistradas() {
    const cnes = document.querySelector('#form-fn-situacao-ubs [name="cnes"]').value || undefined;
    const linhas = await api.get('/api/rotinas/fn-situacao-dose/registradas', { cnes });
    const itens = linhas.map(l => ({
      rotulo: dashboard.SITUACOES[l.situacao]?.nome ?? l.situacao,
      cor: dashboard.SITUACOES[l.situacao]?.cor ?? 'var(--neutro)',
      valor: Number(l.doses), pct: Number(l.percentual),
    }));
    document.getElementById('graf-fn-situacao').innerHTML = itens.length
      ? `<figure class="sem-borda">${charts.barrasH({ itens, rotulo: 'Doses por fn_situacao_dose' })}</figure>`
      : '<p class="vazio">Sem doses.</p>';
  },

  async saldo() {
    const cnes = document.querySelector('#form-fn-saldo [name="cnes"]').value;
    const linhas = (await api.get('/api/rotinas/fn-saldo-aplicavel', { cnes }))
      .filter(l => Number(l.saldo_total) > 0);
    const alvo = document.getElementById('graf-fn-saldo');
    if (!linhas.length) { alvo.innerHTML = '<p class="vazio">Esta UBS não tem estoque.</p>'; return; }

    const aplicavel = linhas.reduce((s, l) => s + Number(l.saldo_aplicavel), 0);
    const total = linhas.reduce((s, l) => s + Number(l.saldo_total), 0);
    const itens = linhas.map(l => ({
      rotulo: l.vacina.length > 14 ? l.vacina.slice(0, 13) + '…' : l.vacina,
      cor: Number(l.saldo_aplicavel) < Number(l.saldo_total) ? 'var(--critico)' : 'var(--serie-1)',
      valor: Number(l.saldo_aplicavel),
      pct: aplicavel ? Number((100 * Number(l.saldo_aplicavel) / aplicavel).toFixed(1)) : 0,
    }));
    alvo.innerHTML = `
      <div class="cards mini">
        <div class="card"><span>Saldo aplicável</span><b>${charts.num(aplicavel)}</b></div>
        <div class="card"><span>Saldo total</span><b>${charts.num(total)}</b></div>
        <div class="card"><span>Em lotes vencidos</span><b>${charts.num(total - aplicavel)}</b></div>
      </div>
      <figure class="sem-borda">${charts.barrasH({ itens, rotulo: 'Saldo aplicável por vacina' })}
        ${charts.legenda([{ nome: 'Todo o estoque é aplicável', cor: 'var(--serie-1)' }, { nome: 'Parte do estoque está vencida', cor: 'var(--critico)' }])}
        <details><summary>Ver dados</summary>${ui.tabela(linhas.map(l => ({ Vacina: l.vacina, 'Saldo aplicável (função)': l.saldo_aplicavel, 'Saldo total': l.saldo_total })))}</details>
      </figure>`;
  },

  async carregarDoses() {
    const f = document.getElementById('form-pr-aplicar');
    const cnes = f.elements.cnes.value;
    for (const n of ['dose', 'id_lote', 'id_profissional']) f.elements[n].disabled = !cnes;
    if (!cnes) return;

    const [doses, profs] = await Promise.all([
      api.get('/api/rotinas/doses-aplicaveis', { cnes }),
      api.get('/api/profissionais', { cnes }),
    ]);
    rotinas.dosesAplicaveis = doses;
    f.elements.dose.innerHTML = `<option value="">${doses.length ? `Dose pendente (${doses.length})` : 'Nenhuma dose aplicável nesta UBS'}</option>` +
      doses.map((d, i) => `<option value="${i}">${ui.esc(d.paciente)} · ${ui.esc(d.vacina)} dose ${d.numero_dose} · prevista ${ui.esc(d.data_prevista)}${d.situacao === 'ATRASADA' ? ' (atrasada)' : ''}</option>`).join('');
    f.elements.id_profissional.innerHTML = '<option value="">Profissional</option>' +
      profs.map(p => `<option value="${ui.esc(p.id_profissional)}">${ui.esc(p.nome)} (${ui.esc(profissionais.CARGOS[p.cargo] ?? p.cargo)})</option>`).join('');
    f.elements.id_lote.innerHTML = '<option value="">Lote</option>';
  },

  async carregarLotes() {
    const f = document.getElementById('form-pr-aplicar');
    const d = rotinas.dosesAplicaveis[f.elements.dose.value];
    if (!d) { f.elements.id_lote.innerHTML = '<option value="">Lote</option>'; return; }
    const lotes = await api.get('/api/rotinas/lotes-aplicaveis', { cnes: f.elements.cnes.value, codigo_vacina: d.codigo_vacina });
    f.elements.id_lote.innerHTML = lotes.map(l =>
      `<option value="${ui.esc(l.id_lote)}">${ui.esc(l.numero_lote)} · vence ${ui.esc(l.data_validade)} · ${ui.esc(l.quantidade_disponivel)} em estoque</option>`).join('');
  },

  doseEscolhida() {
    const f = document.getElementById('form-pr-aplicar');
    const d = rotinas.dosesAplicaveis[f.elements.dose.value];
    if (!d) ui.toast('Escolha a UBS e uma dose pendente', true);
    return d;
  },

  async aplicar(dados) {
    const d = rotinas.doseEscolhida();
    if (!d) return;
    const r = await api.post('/api/rotinas/pr-registrar-aplicacao-dose', {
      ...dados, dose: undefined, cns: d.cns, codigo_vacina: d.codigo_vacina, numero_dose: d.numero_dose,
    });
    rotinas.mostrarAntesDepois(r, `${d.paciente} · ${d.vacina} dose ${d.numero_dose}`);
    ui.toast('Dose aplicada pela procedure');
    await Promise.all([rotinas.carregarDoses(), rotinas.log(), rotinas.situacaoRegistradas(), rotinas.saldo()]);
  },

  async cancelar() {
    const d = rotinas.doseEscolhida();
    if (!d || !confirm(`Cancelar a dose ${d.numero_dose} de ${d.vacina} de ${d.paciente}?`)) return;
    const r = await api.post('/api/rotinas/cancelar-dose', { cns: d.cns, codigo_vacina: d.codigo_vacina, numero_dose: d.numero_dose });
    rotinas.mostrarAntesDepois(r, `${d.paciente} · ${d.vacina} dose ${d.numero_dose}`);
    ui.toast('Dose cancelada');
    await Promise.all([rotinas.carregarDoses(), rotinas.log(), rotinas.situacaoRegistradas()]);
  },

  mostrarAntesDepois(r, titulo) {
    const campos = Object.keys(r.depois).filter(c => c !== 'estoque_do_lote' || r.antes[c] !== null);
    document.getElementById('res-pr-aplicar').innerHTML = `
      <h4>${ui.esc(titulo)}</h4>
      <table class="antes-depois">
        <thead><tr><th>Campo</th><th>Antes</th><th>Depois</th></tr></thead>
        <tbody>${campos.map(c => {
          const mudou = String(r.antes[c]) !== String(r.depois[c]);
          return `<tr class="${mudou ? 'mudou' : ''}"><td>${ui.esc(c)}</td><td>${ui.esc(r.antes[c] ?? '—')}</td><td>${ui.esc(r.depois[c] ?? '—')}</td></tr>`;
        }).join('')}</tbody>
      </table>
      <h4>Gravado pelo trigger em Log_Status_Dose</h4>
      ${ui.tabela(r.log)}`;
  },

  mostrarFifo(r) {
    const series = [
      { nome: 'Antes', cor: 'var(--neutro)', valores: r.lotes.map(l => l.antes) },
      { nome: 'Depois', cor: 'var(--serie-1)', valores: r.lotes.map(l => l.depois) },
    ];
    return `
      <div class="cards mini">
        <div class="card"><span>Solicitado</span><b>${charts.num(r.solicitado)}</b></div>
        <div class="card"><span>Baixado</span><b>${charts.num(r.baixado)}</b></div>
        <div class="card"><span>Não atendido (sem saldo)</span><b>${charts.num(r.nao_atendido)}</b></div>
      </div>
      <figure class="sem-borda">
        ${charts.barrasAgrupadas({ categorias: r.lotes.map(l => l.numero_lote), series, rotulo: 'Estoque por lote antes e depois da baixa' })}
        ${charts.legenda(series)}
      </figure>
      ${ui.tabela(r.lotes.map((l, i) => ({ Ordem: i + 1, Lote: l.numero_lote, Validade: l.data_validade, Antes: l.antes, Baixado: l.baixado, Depois: l.depois })))}`;
  },

  async log() {
    document.getElementById('res-log').innerHTML = ui.tabela(await api.get('/api/rotinas/log-status-dose'));
  },
};
