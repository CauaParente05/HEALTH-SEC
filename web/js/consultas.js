// Aba Consultas: as 14 consultas (Etapa 03) e as views (Etapa 04).
// O resultado vem do banco; indicadores, gráficos e filtros da tela são calculados sobre as linhas recebidas.

const agg = {
  n: v => Number(v ?? 0),
  contar: ls => ls.length,
  soma: (ls, c) => ls.reduce((s, l) => s + agg.n(l[c]), 0),
  media: (ls, c) => {
    const v = ls.map(l => l[c]).filter(x => x !== null && x !== undefined);
    return v.length ? v.reduce((s, x) => s + Number(x), 0) / v.length : null;
  },
  max: (ls, c) => ls.length ? Math.max(...ls.map(l => agg.n(l[c]))) : null,
  distintos: (ls, c) => new Set(ls.map(l => l[c])).size,
  pct: (ls, pred) => ls.length ? (100 * ls.filter(pred).length) / ls.length : null,
  moda: (ls, c) => {
    const cont = {};
    ls.forEach(l => cont[l[c]] = (cont[l[c]] ?? 0) + 1);
    return Object.entries(cont).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
  },
};

// Indicadores (kpis: [rótulo, função, sufixo]), gráficos e colunas com filtro na tela, por consulta/view.
const VISUAL = {
  c1: {
    kpis: [['Doses atrasadas', agg.contar], ['Pacientes', ls => agg.distintos(ls, 'paciente')],
           ['Atraso médio', ls => agg.media(ls, 'dias_de_atraso'), ' dias'], ['Maior atraso', ls => agg.max(ls, 'dias_de_atraso'), ' dias']],
    graficos: [{ titulo: 'Doses atrasadas por UBS', tipo: 'barras', cat: 'ubs' },
               { titulo: 'Doses atrasadas por vacina', tipo: 'barras', cat: 'vacina' }],
    filtros: ['ubs', 'vacina'],
  },
  c2: {
    kpis: [['Vacina × UBS', agg.contar], ['Cobertura média', ls => agg.media(ls, 'cobertura_pct'), '%'],
           ['Cobertura geral', ls => 100 * agg.soma(ls, 'esquema_completo') / (agg.soma(ls, 'pacientes_com_doses_devidas') || 1), '%'],
           ['Pacientes avaliados', ls => agg.soma(ls, 'pacientes_com_doses_devidas')]],
    graficos: [{ titulo: 'Cobertura média por vacina (%)', tipo: 'barras', cat: 'vacina', val: 'cobertura_pct', agg: 'media' },
               { titulo: 'Cobertura média por UBS (%)', tipo: 'barras', cat: 'ubs', val: 'cobertura_pct', agg: 'media' }],
    filtros: ['vacina', 'ubs'],
  },
  c3: {
    kpis: [['Doses no calendário', agg.contar], ['Aplicadas', ls => ls.filter(l => l.status === 'APLICADA').length],
           ['Pendentes', ls => ls.filter(l => l.status === 'PENDENTE').length],
           ['% aplicadas', ls => agg.pct(ls, l => l.status === 'APLICADA'), '%']],
    graficos: [{ titulo: 'Doses por status', tipo: 'barras', cat: 'status' },
               { titulo: 'Doses por vacina', tipo: 'barras', cat: 'vacina' }],
    filtros: ['vacina', 'status'],
  },
  c4: {
    kpis: [['Lote × UBS', agg.contar], ['Saldo em risco', ls => agg.soma(ls, 'saldo'), ' doses'],
           ['Saldo vencido', ls => agg.soma(ls.filter(l => l.situacao === 'VENCIDO'), 'saldo'), ' doses'],
           ['Lotes distintos', ls => agg.distintos(ls, 'lote')]],
    graficos: [{ titulo: 'Saldo por situação', tipo: 'barras', cat: 'situacao', val: 'saldo', agg: 'soma' },
               { titulo: 'Saldo em risco por UBS', tipo: 'barras', cat: 'ubs', val: 'saldo', agg: 'soma' }],
    filtros: ['situacao', 'ubs', 'vacina'],
  },
  c5: {
    kpis: [['Doses disponíveis', ls => agg.soma(ls, 'doses_disponiveis')], ['Vacinas', ls => agg.distintos(ls, 'vacina')],
           ['UBS', ls => agg.distintos(ls, 'ubs')], ['Média por vacina × UBS', ls => agg.media(ls, 'doses_disponiveis')]],
    graficos: [{ titulo: 'Doses disponíveis por vacina', tipo: 'barras', cat: 'vacina', val: 'doses_disponiveis', agg: 'soma' },
               { titulo: 'Doses disponíveis por UBS', tipo: 'barras', cat: 'ubs', val: 'doses_disponiveis', agg: 'soma' }],
    filtros: ['vacina', 'ubs'],
  },
  c6: {
    kpis: [['Pacientes vacinados', agg.contar], ['UBS', ls => agg.distintos(ls, 'ubs_aplicacao')],
           ['Profissionais', ls => agg.distintos(ls, 'profissional')]],
    graficos: [{ titulo: 'Aplicações do lote por UBS', tipo: 'barras', cat: 'ubs_aplicacao' },
               { titulo: 'Aplicações do lote por mês', tipo: 'linha', cat: l => String(l.data_aplicacao).slice(0, 7) }],
    filtros: ['ubs_aplicacao', 'profissional'],
  },
  c7: {
    kpis: [['Doses aplicadas', ls => agg.soma(ls, 'doses_aplicadas')], ['Profissionais', ls => agg.distintos(ls, 'profissional')],
           ['Meses', ls => agg.distintos(ls, 'mes')], ['Média por profissional/mês', ls => agg.media(ls, 'doses_aplicadas')]],
    graficos: [{ titulo: 'Doses aplicadas por mês', tipo: 'linha', cat: 'mes', val: 'doses_aplicadas' },
               { titulo: 'Profissionais que mais aplicaram', tipo: 'barras', cat: 'profissional', val: 'doses_aplicadas', agg: 'soma' }],
    filtros: ['cargo', 'profissional'],
  },
  c8: {
    kpis: [['Crianças', agg.contar], ['Doses não aplicadas', ls => agg.soma(ls, 'doses_nao_aplicadas')],
           ['Média por criança', ls => agg.media(ls, 'doses_nao_aplicadas')],
           ['Sem responsável', ls => ls.filter(l => !l.responsavel).length]],
    graficos: [{ titulo: 'Doses não aplicadas por idade (anos)', tipo: 'barras', cat: 'idade_anos', val: 'doses_nao_aplicadas', agg: 'soma', ordenarPorRotulo: true },
               { titulo: 'Crianças com mais doses pendentes', tipo: 'barras', cat: 'crianca', val: 'doses_nao_aplicadas', agg: 'soma' }],
    filtros: ['idade_anos'],
  },
  c9: {
    kpis: [['Vínculos de supervisão', agg.contar], ['Coordenadores', ls => agg.distintos(ls, 'coordenador')],
           ['Supervisionados por coordenador', ls => ls.length / (agg.distintos(ls, 'coordenador') || 1)]],
    graficos: [{ titulo: 'Supervisionados por coordenador', tipo: 'barras', cat: 'coordenador' },
               { titulo: 'Supervisionados por cargo', tipo: 'barras', cat: 'cargo' }],
    filtros: ['coordenador', 'cargo', 'ubs_do_supervisionado'],
  },
  c10: {
    kpis: [['Doses aplicadas', ls => agg.soma(ls, 'doses_aplicadas')],
           ['% sexo feminino', ls => 100 * agg.soma(ls.filter(l => l.sexo === 'F'), 'doses_aplicadas') / (agg.soma(ls, 'doses_aplicadas') || 1), '%'],
           ['Faixa com mais doses', ls => consultas.agrupar(ls, { cat: 'faixa_etaria', val: 'doses_aplicadas', agg: 'soma' })[0]?.rotulo ?? '—']],
    graficos: [{ titulo: 'Doses por faixa etária e sexo', tipo: 'agrupadas', cat: 'faixa_etaria', serie: 'sexo', val: 'doses_aplicadas' },
               { titulo: 'Doses por sexo', tipo: 'barras', cat: 'sexo', val: 'doses_aplicadas', agg: 'soma' }],
    filtros: ['sexo'],
  },
  c11: {
    kpis: [['Doses sem estoque', agg.contar], ['Pacientes', ls => agg.distintos(ls, 'paciente')],
           ['UBS', ls => agg.distintos(ls, 'ubs')], ['Vacina mais afetada', ls => agg.moda(ls, 'vacina') ?? '—']],
    graficos: [{ titulo: 'Doses sem estoque por vacina', tipo: 'barras', cat: 'vacina' },
               { titulo: 'Doses sem estoque por UBS', tipo: 'barras', cat: 'ubs' }],
    filtros: ['ubs', 'vacina'],
  },
  c12: {
    kpis: [['UBS × vacina', agg.contar], ['Estoque válido', ls => agg.soma(ls, 'estoque_valido')],
           ['Doses aplicadas', ls => agg.soma(ls, 'doses_aplicadas')],
           ['Só estoque (sem uso)', ls => ls.filter(l => l.situacao === 'SÓ ESTOQUE').length]],
    graficos: [{ titulo: 'Combinações por situação', tipo: 'barras', cat: 'situacao' },
               { titulo: 'Estoque válido x doses aplicadas por vacina', tipo: 'agrupadas', cat: 'vacina',
                 colunas: [['estoque_valido', 'Estoque válido'], ['doses_aplicadas', 'Doses aplicadas']], top: 8 }],
    filtros: ['ubs', 'vacina', 'situacao'],
  },
  c13: {
    kpis: [['UBS acima da média', agg.contar], ['Média por UBS', ls => ls[0]?.media_por_ubs ?? null, ' doses'],
           ['Maior total', ls => agg.max(ls, 'doses_aplicadas'), ' doses']],
    graficos: [{ titulo: 'Doses aplicadas (UBS acima da média)', tipo: 'barras', cat: 'ubs', val: 'doses_aplicadas', agg: 'soma' }],
    filtros: [],
  },
  c14: {
    kpis: [['Doses para busca ativa', agg.contar], ['Pacientes', ls => agg.distintos(ls, 'paciente')],
           ['Atraso médio', ls => agg.media(ls, 'dias_de_atraso'), ' dias'], ['Maior atraso', ls => agg.max(ls, 'dias_de_atraso'), ' dias']],
    graficos: [{ titulo: 'Busca ativa por UBS', tipo: 'barras', cat: 'ubs' },
               { titulo: 'Busca ativa por vacina', tipo: 'barras', cat: 'vacina' }],
    filtros: ['ubs', 'vacina'],
  },
  'v-carteira': {
    kpis: [['Doses', agg.contar], ['% aplicadas', ls => agg.pct(ls, l => l.situacao === 'APLICADA'), '%'],
           ['Atrasadas', ls => ls.filter(l => l.situacao === 'ATRASADA').length],
           ['Atraso médio', ls => agg.media(ls, 'dias_de_atraso'), ' dias']],
    graficos: [{ titulo: 'Doses por situação', tipo: 'barras', cat: 'situacao' },
               { titulo: 'Doses atrasadas por vacina', tipo: 'barras', cat: 'vacina', onde: l => l.situacao === 'ATRASADA' }],
    filtros: ['ubs_aplicacao', 'profissional'],
  },
  'v-estoque': {
    kpis: [['Saldo total', ls => agg.soma(ls, 'saldo'), ' doses'],
           ['Saldo vencido', ls => agg.soma(ls.filter(l => l.situacao_validade === 'VENCIDO'), 'saldo'), ' doses'],
           ['Vence em 30 dias', ls => agg.soma(ls.filter(l => l.situacao_validade === 'VENCE EM 30 DIAS'), 'saldo'), ' doses'],
           ['Lotes parados (sem uso na UBS)', ls => ls.filter(l => agg.n(l.saldo) > 0 && agg.n(l.doses_aplicadas_na_ubs) === 0).length]],
    graficos: [{ titulo: 'Saldo por situação da validade', tipo: 'barras', cat: 'situacao_validade', val: 'saldo', agg: 'soma' },
               { titulo: 'Saldo por vacina', tipo: 'barras', cat: 'vacina', val: 'saldo', agg: 'soma' }],
    filtros: ['fabricante'],
  },
};

const CORES_CATEGORIA = {
  APLICADA: 'var(--bom)', PENDENTE: 'var(--serie-1)', ATRASADA: 'var(--critico)', CANCELADA: 'var(--neutro)',
  VENCIDO: 'var(--critico)', 'VENCE EM 30 DIAS': '#d9a300', 'VENCE EM ATÉ 30 DIAS': '#d9a300', 'VÁLIDO': 'var(--bom)',
  'SÓ ESTOQUE': 'var(--neutro)', 'SÓ APLICAÇÕES': 'var(--serie-2)', 'ESTOQUE E APLICAÇÕES': 'var(--serie-1)',
  F: 'var(--serie-1)', M: 'var(--serie-2)',
};
const CORES_SERIE = ['var(--serie-1)', 'var(--serie-2)', 'var(--bom)', 'var(--neutro)'];

const consultas = {
  itens: [],
  atual: null,
  linhas: [],
  ordem: { coluna: null, desc: false },
  catalogos: {},

  async carregar() {
    const aba = document.getElementById('aba-consultas');
    if (aba.dataset.montada) return;

    const [lista, views] = await Promise.all([api.get('/api/consultas'), api.get('/api/views')]);
    consultas.itens = [
      ...lista.map(c => ({
        chave: 'c' + c.id, rotulo: `${c.id} · ${c.titulo}${[2, 6, 8, 10].includes(Number(c.id)) ? ' ★' : ''}`,
        titulo: c.titulo, pergunta: c.pergunta, recursos: c.recursos, sql: c.sql, url: '/api/consultas/' + c.id,
        filtros: c.parametro ? [{ nome: c.parametro.nome, rotulo: c.parametro.rotulo,
          tipo: c.parametro.nome === 'cns' ? 'paciente' : 'lote', obrigatorio: true }] : [],
      })),
      ...views.map(v => ({
        chave: 'v-' + v.id, rotulo: `${v.nome} · ${v.titulo}`, titulo: v.titulo, pergunta: v.pergunta,
        recursos: `View ${v.nome} (Etapa 04), com filtros aplicados no WHERE`, sql: v.sql, url: '/api/views/' + v.id,
        filtros: v.filtros,
      })),
    ];

    aba.innerHTML = `
      <div class="filtro-topo">
        <h2>Consultas e views</h2>
        <label>Consulta
          <select id="select-consulta">
            <option value="">Selecione</option>
            <optgroup label="Consultas (Etapa 03)">${consultas.opcoes('c')}</optgroup>
            <optgroup label="Views (Etapa 04)">${consultas.opcoes('v-')}</optgroup>
          </select>
        </label>
      </div>
      <div id="consulta-detalhes" hidden>
        <article class="rotina">
          <h3 id="consulta-titulo"></h3>
          <p class="pergunta" id="consulta-pergunta"></p>
          <p class="variaveis" id="consulta-recursos"></p>
          <details><summary>Ver SQL</summary><pre id="consulta-sql"></pre></details>
          <form id="consulta-parametros"></form>
        </article>
        <div id="consulta-resultado"></div>
      </div>`;
    aba.dataset.montada = '1';

    document.getElementById('select-consulta').addEventListener('change', e => consultas.selecionar(e.target.value).catch(console.error));
    document.getElementById('consulta-parametros').addEventListener('submit', e => {
      e.preventDefault();
      consultas.executar().catch(console.error);
    });
  },

  opcoes(prefixo) {
    return consultas.itens.filter(i => i.chave.startsWith(prefixo))
      .map(i => `<option value="${ui.esc(i.chave)}">${ui.esc(i.rotulo)}</option>`).join('');
  },

  async selecionar(chave) {
    consultas.atual = consultas.itens.find(i => i.chave === chave) ?? null;
    document.getElementById('consulta-detalhes').hidden = !consultas.atual;
    document.getElementById('consulta-resultado').innerHTML = '';
    if (!consultas.atual) return;

    const c = consultas.atual;
    document.getElementById('consulta-titulo').textContent = c.titulo;
    document.getElementById('consulta-pergunta').textContent = c.pergunta;
    document.getElementById('consulta-recursos').textContent = 'Recursos: ' + c.recursos;
    document.getElementById('consulta-sql').textContent = c.sql;

    const campos = await Promise.all(c.filtros.map(f => consultas.campo(f)));
    document.getElementById('consulta-parametros').innerHTML =
      campos.join('') + `<button type="submit">Executar</button>`;

    // Sem parâmetro obrigatório, já executa ao escolher.
    if (!c.filtros.some(f => f.obrigatorio)) await consultas.executar();
  },

  async catalogo(tipo) {
    const url = { paciente: '/api/pacientes', lote: '/api/lotes', ubs: '/api/dashboard/ubs', vacina: '/api/vacinas' }[tipo];
    consultas.catalogos[tipo] ??= await api.get(url);
    return consultas.catalogos[tipo];
  },

  async campo(f) {
    const vazio = `<option value="">${f.obrigatorio ? 'Selecione' : 'Todos'}</option>`;
    let opcoes;
    switch (f.tipo) {
      case 'paciente':
        opcoes = (await consultas.catalogo('paciente')).map(p => `<option value="${ui.esc(p.cns)}">${ui.esc(p.nome)} · ${ui.esc(p.cns)}</option>`).join('');
        break;
      case 'lote':
        opcoes = (await consultas.catalogo('lote')).map(l => `<option value="${ui.esc(l.id_lote)}">${ui.esc(l.numero_lote)} · ${ui.esc(l.fabricante)} · ${ui.esc(l.vacina)}</option>`).join('');
        break;
      case 'ubs':
        opcoes = ui.opcoes(await consultas.catalogo('ubs'), 'cnes', 'nome');
        break;
      case 'vacina':
        opcoes = ui.opcoes(await consultas.catalogo('vacina'), 'codigo_vacina', 'nome');
        break;
      case 'marcar':
        return `<label><input type="checkbox" name="${ui.esc(f.nome)}" value="1"> ${ui.esc(f.rotulo)}</label>`;
      default:
        opcoes = (f.opcoes ?? []).map(o => `<option value="${ui.esc(o)}">${ui.esc(o)}</option>`).join('');
    }
    return `<label>${ui.esc(f.rotulo)}
      <select name="${ui.esc(f.nome)}" ${f.obrigatorio ? 'required' : ''}>${vazio}${opcoes}</select></label>`;
  },

  async executar() {
    const c = consultas.atual;
    const params = ui.lerForm(document.getElementById('consulta-parametros'));
    const alvo = document.getElementById('consulta-resultado');
    alvo.innerHTML = '<p class="vazio">Executando...</p>';

    const r = await api.get(c.url, Object.fromEntries(Object.entries(params).filter(([, v]) => v !== '')));
    consultas.linhas = r.linhas.map(l => Object.fromEntries(r.colunas.map((col, i) => [col, l[i]])));
    consultas.colunas = r.colunas;
    consultas.ordem = { coluna: null, desc: false };

    const visual = VISUAL[c.chave] ?? { kpis: [], graficos: [], filtros: [] };
    const filtros = visual.filtros.filter(col => r.colunas.includes(col));
    alvo.innerHTML = `
      <div class="cards" id="consulta-kpis"></div>
      <div class="graficos" id="consulta-graficos"></div>
      <div class="filtros-tela">
        <input type="search" id="consulta-busca" placeholder="Buscar no resultado">
        ${filtros.map(col => `<label>${ui.esc(consultas.nomeColuna(col))}
          <select data-filtro="${ui.esc(col)}"><option value="">Todos</option>${
            [...new Set(consultas.linhas.map(l => l[col]))].sort((a, b) => String(a).localeCompare(String(b), 'pt-BR', { numeric: true }))
              .map(v => `<option value="${ui.esc(v)}">${ui.esc(v ?? '—')}</option>`).join('')}</select></label>`).join('')}
        <span id="consulta-contagem" class="vazio"></span>
      </div>
      <div id="consulta-tabela" class="tabela-rolavel"></div>`;

    alvo.querySelectorAll('[data-filtro], #consulta-busca').forEach(el => el.addEventListener('input', () => consultas.mostrar()));
    consultas.mostrar();
  },

  filtradas() {
    const busca = document.getElementById('consulta-busca').value.trim().toLowerCase();
    const sel = [...document.querySelectorAll('[data-filtro]')].filter(s => s.value !== '');
    return consultas.linhas.filter(l =>
      sel.every(s => String(l[s.dataset.filtro]) === s.value) &&
      (!busca || Object.values(l).some(v => String(v ?? '').toLowerCase().includes(busca))));
  },

  mostrar() {
    const visual = VISUAL[consultas.atual.chave] ?? { kpis: [], graficos: [] };
    const ls = consultas.filtradas();
    document.getElementById('consulta-contagem').textContent =
      `${ls.length} de ${consultas.linhas.length} linha(s)`;

    document.getElementById('consulta-kpis').innerHTML = visual.kpis.map(([rotulo, fn, sufixo = '']) => {
      const v = fn(ls);
      const texto = v === null || v === undefined || Number.isNaN(v) ? '—'
        : typeof v === 'number' ? charts.num(Math.round(v * 10) / 10) + sufixo : String(v);
      return `<div class="card"><span>${ui.esc(rotulo)}</span><b>${ui.esc(texto)}</b></div>`;
    }).join('');

    document.getElementById('consulta-graficos').innerHTML = ls.length
      ? visual.graficos.map(g => consultas.grafico(g, g.onde ? ls.filter(g.onde) : ls)).join('')
      : '';
    consultas.tabela(ls);
  },

  // Agrupa as linhas por categoria: contagem (padrão), soma ou média de uma coluna.
  agrupar(ls, { cat, val, agg: tipo = val ? 'soma' : 'contar' }) {
    const chave = typeof cat === 'function' ? cat : l => l[cat];
    const grupos = new Map();
    ls.forEach(l => {
      const k = String(chave(l) ?? '—');
      const g = grupos.get(k) ?? { soma: 0, n: 0 };
      g.soma += val ? agg.n(l[val]) : 1;
      g.n += 1;
      grupos.set(k, g);
    });
    return [...grupos].map(([rotulo, g]) => ({ rotulo, valor: tipo === 'media' ? g.soma / g.n : g.soma }))
      .sort((a, b) => b.valor - a.valor);
  },

  grafico(g, ls) {
    let svg, legenda = '';
    if (g.tipo === 'barras') {
      let grupos = consultas.agrupar(ls, g);
      if (g.ordenarPorRotulo) grupos.sort((a, b) => a.rotulo.localeCompare(b.rotulo, 'pt-BR', { numeric: true }));
      const total = grupos.reduce((s, x) => s + x.valor, 0);
      const top = g.top ?? 10;
      const resto = grupos.length - top;
      grupos = grupos.slice(0, top);
      svg = charts.barrasH({
        esq: 150, rotulo: g.titulo,
        itens: grupos.map(x => ({
          rotulo: x.rotulo.length > 22 ? x.rotulo.slice(0, 21) + '…' : x.rotulo, dica: x.rotulo,
          valor: Math.round(x.valor * 10) / 10, cor: CORES_CATEGORIA[x.rotulo] ?? 'var(--serie-1)',
          pct: g.agg === 'media' || !total ? undefined : Math.round((1000 * x.valor) / total) / 10,
        })),
      });
      if (resto > 0) legenda = `<p class="variaveis">Mostrando as ${top} maiores de ${top + resto} categorias.</p>`;
    } else if (g.tipo === 'linha') {
      const grupos = consultas.agrupar(ls, g).sort((a, b) => a.rotulo.localeCompare(b.rotulo));
      svg = charts.linha({
        rotulos: grupos.map(x => x.rotulo), valores: grupos.map(x => x.valor), rotulo: g.titulo,
        cadaN: Math.max(1, Math.ceil(grupos.length / 8)),
      });
    } else {
      // agrupadas: uma série por valor de g.serie, ou uma série por coluna de g.colunas
      let categorias = [...new Set(ls.map(l => String(l[g.cat])))];
      const series = g.colunas
        ? g.colunas.map(([col, nome], i) => ({ nome, col, cor: CORES_SERIE[i] }))
        : [...new Set(ls.map(l => String(l[g.serie])))].map((s, i) => ({ nome: s, filtro: s, cor: CORES_CATEGORIA[s] ?? CORES_SERIE[i % 4] }));
      const valor = (cat, s) => ls.filter(l => String(l[g.cat]) === cat && (!s.filtro || String(l[g.serie]) === s.filtro))
        .reduce((t, l) => t + agg.n(l[s.col ?? g.val]), 0);
      if (g.top) {
        categorias = categorias.map(c => [c, series.reduce((t, s) => t + valor(c, s), 0)])
          .sort((a, b) => b[1] - a[1]).slice(0, g.top).map(([c]) => c);
      }
      const ss = series.map(s => ({ ...s, valores: categorias.map(c => valor(c, s)) }));
      svg = charts.barrasAgrupadas({
        categorias: categorias.map(c => c.length > 12 ? c.slice(0, 11) + '…' : c), series: ss, rotulo: g.titulo,
      });
      legenda = charts.legenda(ss);
    }
    return `<figure><figcaption>${ui.esc(g.titulo)}</figcaption>${svg}${legenda}</figure>`;
  },

  nomeColuna(c) {
    const t = c.replace(/_/g, ' ');
    return t.charAt(0).toUpperCase() + t.slice(1);
  },

  tabela(ls) {
    const alvo = document.getElementById('consulta-tabela');
    if (!ls.length) { alvo.innerHTML = '<p class="vazio">Nenhuma linha.</p>'; return; }

    const { coluna, desc } = consultas.ordem;
    if (coluna) {
      ls = [...ls].sort((a, b) => {
        const x = a[coluna], y = b[coluna];
        const r = typeof x === 'number' && typeof y === 'number' ? x - y
          : String(x ?? '').localeCompare(String(y ?? ''), 'pt-BR', { numeric: true });
        return desc ? -r : r;
      });
    }
    const seta = c => c === coluna ? (desc ? ' ▼' : ' ▲') : '';
    alvo.innerHTML = `<table class="tabela-consulta"><thead><tr>${consultas.colunas.map(c =>
      `<th data-ordenar="${ui.esc(c)}">${ui.esc(consultas.nomeColuna(c))}${seta(c)}</th>`).join('')}</tr></thead>
      <tbody>${ls.map(l => `<tr>${consultas.colunas.map(c => {
        const v = l[c];
        const ehSituacao = ['situacao', 'status', 'situacao_validade'].includes(c);
        return `<td>${v === null ? '—' : ehSituacao ? ui.selo(v) : ui.esc(v)}</td>`;
      }).join('')}</tr>`).join('')}</tbody></table>`;

    alvo.querySelectorAll('[data-ordenar]').forEach(th => th.addEventListener('click', () => {
      const c = th.dataset.ordenar;
      consultas.ordem = { coluna: c, desc: consultas.ordem.coluna === c ? !consultas.ordem.desc : false };
      consultas.mostrar();
    }));
  },
};
