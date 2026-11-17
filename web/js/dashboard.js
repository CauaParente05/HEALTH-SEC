const dashboard = {
  montado: false,
  pedido: 0,

  PERIODOS: [['12', 'Últimos 12 meses'], ['24', 'Últimos 24 meses'], ['60', 'Últimos 5 anos'], ['', 'Todo o histórico'], ['personalizado', 'Personalizado']],

  async carregar() {
    if (!dashboard.montado) {
      const [ubs, vacinas] = await Promise.all([api.get('/api/dashboard/ubs'), api.get('/api/vacinas')]);
      document.getElementById('aba-dashboard').innerHTML = `
        <div class="filtro-topo">
          <h2>Dashboard</h2>
        </div>
        <form id="dash-filtros" class="dash-filtros">
          <label>UBS
            <select name="cnes"><option value="">Todas as UBS</option>${ui.opcoes(ubs, 'cnes', 'nome')}</select>
          </label>
          <label>Período
            <select name="periodo">${dashboard.PERIODOS.map(([v, t]) => `<option value="${v}" ${v === '24' ? 'selected' : ''}>${t}</option>`).join('')}</select>
          </label>
          <label class="dash-datas" hidden>de <input type="date" name="de"></label>
          <label class="dash-datas" hidden>até <input type="date" name="ate"></label>
          <label>Vacina
            <select name="codigo_vacina"><option value="">Todas</option>${ui.opcoes(vacinas, 'codigo_vacina', 'nome')}</select>
          </label>
          <label>Sexo
            <select name="sexo"><option value="">Ambos</option><option value="F">Feminino</option><option value="M">Masculino</option></select>
          </label>
          <button type="reset" class="secundario">Limpar filtros</button>
        </form>
        <p class="vazio" id="dash-resumo-filtro"></p>
        <div class="cards dash-kpis" id="dash-kpis"></div>
        <section class="secao">
          <h2>Estatística</h2>
          <p class="vazio">Tudo calculado no banco a partir dos registros atuais. A UBS é a de referência do paciente
            (exceto no estoque e na correlação, onde é a UBS do estoque/da aplicação). Cada gráfico informa a quais filtros responde.</p>
          <div class="graficos" id="dash-estatistica"></div>
        </section>`;

      const form = document.getElementById('dash-filtros');
      form.addEventListener('change', e => {
        if (e.target.name === 'periodo') {
          const custom = e.target.value === 'personalizado';
          form.querySelectorAll('.dash-datas').forEach(l => l.hidden = !custom);
          if (custom && !form.elements.de.value) {
            const p = dashboard.periodo('24');
            form.elements.de.value = p.de;
            form.elements.ate.value = p.ate;
          }
        }
        dashboard.atualizar().catch(console.error);
      });
      form.addEventListener('reset', () => setTimeout(() => {
        form.querySelectorAll('.dash-datas').forEach(l => l.hidden = true);
        dashboard.atualizar().catch(console.error);
      }));
      dashboard.montado = true;
    }
    await dashboard.atualizar();
  },

  // Data local em AAAA-MM-DD (toISOString usaria UTC e viraria o dia à noite).
  iso(d) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; },

  // Últimos n meses: do 1º dia do mês (n-1) meses atrás até hoje.
  periodo(n) {
    if (!n) return {};
    const d = new Date();
    d.setDate(1);
    d.setMonth(d.getMonth() - (Number(n) - 1));
    return { de: dashboard.iso(d), ate: dashboard.iso(new Date()) };
  },

  filtros() {
    const f = ui.lerForm(document.getElementById('dash-filtros'));
    const p = f.periodo === 'personalizado' ? { de: f.de || undefined, ate: f.ate || undefined } : dashboard.periodo(f.periodo);
    return { cnes: f.cnes || undefined, codigo_vacina: f.codigo_vacina || undefined, sexo: f.sexo || undefined, ...p };
  },

  async atualizar() {
    const pedido = ++dashboard.pedido;
    const f = dashboard.filtros();
    const base = '/api/dashboard/estatistica/';
    const [kpis, meses, situacao, top, faixas, idades, atrasos, semana, correlacao] = await Promise.all([
      api.get('/api/dashboard/indicadores', f),
      api.get(base + 'doses-por-mes', f),
      api.get(base + 'situacao-doses', f),
      api.get(base + 'top-vacinas', f),
      api.get(base + 'faixa-etaria-sexo', f),
      api.get(base + 'idade-pacientes', f),
      api.get(base + 'atrasos', f),
      api.get(base + 'dia-semana', f),
      api.get(base + 'correlacao-ubs', f),
    ]);
    if (pedido !== dashboard.pedido) return; // filtros mudaram enquanto carregava

    dashboard.descreverFiltro(f);
    dashboard.indicadores(kpis, f);
    document.getElementById('dash-estatistica').innerHTML = [
      dashboard.graficoMeses(meses),
      dashboard.graficoSituacao(situacao),
      dashboard.graficoTopVacinas(top),
      dashboard.graficoFaixaSexo(faixas),
      dashboard.graficoIdade(idades),
      dashboard.graficoAtrasos(atrasos),
      dashboard.graficoSemana(semana),
      dashboard.graficoCorrelacao(correlacao, f.cnes),
    ].join('');
  },

  data(iso) { return iso ? iso.split('-').reverse().join('/') : ''; },

  descreverFiltro(f) {
    const form = document.getElementById('dash-filtros');
    const texto = s => s.options[s.selectedIndex].text;
    const partes = [
      f.de || f.ate ? `período ${f.de ? dashboard.data(f.de) : 'início'} a ${f.ate ? dashboard.data(f.ate) : 'hoje'}` : 'todo o histórico',
      f.cnes ? texto(form.elements.cnes) : 'todas as UBS',
      f.codigo_vacina ? texto(form.elements.codigo_vacina) : 'todas as vacinas',
      f.sexo ? texto(form.elements.sexo).toLowerCase() : 'ambos os sexos',
    ];
    document.getElementById('dash-resumo-filtro').textContent = 'Mostrando: ' + partes.join(' · ');
  },

  /* ---------- indicadores ---------- */

  indicadores(k, f) {
    const n = v => v === null || v === undefined ? '—' : charts.num(v);
    const estoqueTotal = Number(k.estoque_valido) + Number(k.estoque_vencido);
    let delta = '';
    if (k.variacao_pct !== undefined) {
      delta = k.variacao_pct === null
        ? '<small class="delta">sem doses no período anterior</small>'
        : `<small class="delta ${k.variacao_pct >= 0 ? 'sobe' : 'desce'}">${k.variacao_pct >= 0 ? '▲' : '▼'} ${charts.num(Math.abs(k.variacao_pct))}% vs. período anterior (${n(k.doses_periodo_anterior)})</small>`;
    }
    const cards = [
      ['Pacientes cadastrados', n(k.pacientes), 'filtros: UBS e sexo'],
      ['Doses aplicadas no período', n(k.doses_aplicadas), delta || 'todo o histórico'],
      ['Média mensal de doses', n(k.media_mensal), `em ${n(k.meses_no_periodo)} mês(es)`],
      ['Doses em dia', k.pct_em_dia === null ? '—' : n(k.pct_em_dia) + '%', 'aplicadas ÷ (aplicadas + já devidas)'],
      ['Doses atrasadas', n(k.doses_atrasadas), `de ${n(k.doses_registradas)} registradas (fn_situacao_dose)`],
      ['Estoque válido', n(k.estoque_valido), 'doses em lotes dentro da validade'],
      ['Estoque vencido', n(k.estoque_vencido), estoqueTotal ? `${charts.num((100 * k.estoque_vencido / estoqueTotal).toFixed(1))}% do estoque` : 'sem estoque'],
      ['Vacina mais aplicada', k.vacina_mais_aplicada ?? '—', 'moda das doses do período'],
    ];
    document.getElementById('dash-kpis').innerHTML = cards.map(([rotulo, valor, nota]) => `
      <div class="card"><span>${ui.esc(rotulo)}</span><b class="${String(valor).length > 12 ? 'texto' : ''}">${ui.esc(valor)}</b>
        ${nota.startsWith('<small') ? nota : `<small>${ui.esc(nota)}</small>`}</div>`).join('');
  },

  /* ---------- moldura comum ---------- */

  figura({ titulo, pergunta, filtros, variaveis, grafico, legenda = '', linhas, extra = '' }) {
    return `<figure>
      <figcaption>${ui.esc(titulo)}</figcaption>
      <p class="pergunta">${ui.esc(pergunta)}</p>
      ${linhas.length ? grafico + legenda + extra : '<p class="vazio">Sem dados para os filtros escolhidos.</p>'}
      <p class="variaveis">${ui.esc(variaveis)}</p>
      <p class="variaveis filtros-graf">Responde a: ${ui.esc(filtros)}</p>
      <details><summary>Ver dados</summary>${ui.tabela(linhas)}</details>
    </figure>`;
  },

  // Tabela de medidas resumo (média, mediana, moda, variância, desvio, CV, amplitude).
  medidas(s, unidade) {
    if (!s || !s.n) return '';
    const cv = s.media && s.desvio_padrao !== null ? (100 * s.desvio_padrao / s.media).toFixed(1) : null;
    const itens = [
      ['n', s.n], ['Média', s.media], ['Mediana', s.mediana], ['Moda', s.moda],
      ['Variância', s.variancia], ['Desvio padrão', s.desvio_padrao],
      ['Coef. de variação', cv === null ? null : cv + '%'], ['Mín · máx', `${s.minimo} · ${s.maximo}`],
    ];
    return `<dl class="medidas">${itens.map(([k, v]) => `<div><dt>${k}</dt><dd>${v === null || v === undefined ? '—'
      : typeof v === 'number' ? charts.num(v) : ui.esc(v)}</dd></div>`).join('')}</dl>
      <p class="variaveis">Unidade: ${ui.esc(unidade)}. Variância e desvio padrão amostrais (VAR_SAMP, STDDEV_SAMP).</p>`;
  },

  /* ---------- 1. tendência temporal ---------- */

  MESES: ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'],

  graficoMeses(r) {
    const todos = [];
    if (r.primeiro && r.ultimo) {
      let [ano, mes] = r.primeiro.split('-').map(Number);
      for (let k = `${ano}-${String(mes).padStart(2, '0')}`; k <= r.ultimo; k = `${ano}-${String(mes).padStart(2, '0')}`) {
        todos.push(k);
        if (++mes > 12) { mes = 1; ano++; }
      }
    }
    const doses = Object.fromEntries(r.meses.map(m => [m.mes, Number(m.doses)]));
    const valores = todos.map(k => doses[k] ?? 0);
    const rotulo = k => `${dashboard.MESES[Number(k.slice(5)) - 1]}/${k.slice(2, 4)}`;

    // Reta de mínimos quadrados sobre a série mensal (x = índice do mês).
    const n = valores.length, mx = (n - 1) / 2, my = valores.reduce((s, v) => s + v, 0) / (n || 1);
    const sxx = valores.reduce((s, _, i) => s + (i - mx) ** 2, 0);
    const b = sxx ? valores.reduce((s, v, i) => s + (i - mx) * (v - my), 0) / sxx : 0;
    const tendencia = valores.map((_, i) => my + b * (i - mx));
    const direcao = Math.abs(b) < 0.05 ? 'estável' : b > 0 ? 'de alta' : 'de queda';

    return dashboard.figura({
      titulo: 'Tendência mensal das doses aplicadas',
      pergunta: 'O número de doses aplicadas está subindo, caindo ou estável?',
      filtros: 'período · UBS · vacina · sexo',
      variaveis: `Doses por mês (quantitativa discreta) no tempo. Média ${charts.num(my.toFixed(1))}/mês; tendência linear ${direcao} (${b >= 0 ? '+' : ''}${charts.num(b.toFixed(2))} dose a cada mês).`,
      grafico: charts.linha({ rotulos: todos.map(rotulo), valores, rotulo: 'Doses aplicadas por mês', cadaN: Math.max(1, Math.ceil(n / 8)), tendencia: n > 1 ? tendencia : null }),
      legenda: charts.legenda([{ nome: 'Doses no mês', cor: 'var(--serie-1)' }, { nome: 'Tendência linear (mínimos quadrados)', classe: 'tendencia' }]),
      linhas: r.meses.length ? todos.map((k, i) => ({ Mês: rotulo(k), Doses: valores[i], Tendência: Number(tendencia[i].toFixed(1)) })) : [],
    });
  },

  /* ---------- 2. situação (pizza) ---------- */

  SITUACOES: {
    APLICADA:  { nome: 'Aplicada',  cor: 'var(--bom)' },
    PENDENTE:  { nome: 'Pendente',  cor: 'var(--serie-1)' },
    ATRASADA:  { nome: 'Atrasada',  cor: 'var(--critico)' },
    CANCELADA: { nome: 'Cancelada', cor: 'var(--neutro)' },
  },

  graficoSituacao(linhas) {
    const itens = linhas.map(l => ({
      rotulo: dashboard.SITUACOES[l.situacao]?.nome ?? l.situacao,
      cor: dashboard.SITUACOES[l.situacao]?.cor ?? 'var(--neutro)',
      valor: Number(l.doses),
    }));
    return dashboard.figura({
      titulo: 'Situação das doses registradas',
      pergunta: 'Qual a proporção de doses aplicadas, pendentes, atrasadas e canceladas?',
      filtros: 'UBS · vacina · sexo (situação é a de hoje, sem período)',
      variaveis: 'Situação da dose (qualitativa nominal) pela função fn_situacao_dose: frequência absoluta e relativa.',
      grafico: charts.pizza({ itens, rotulo: 'Situação das doses registradas', centro: 'doses' }),
      linhas: linhas.map(l => ({ Situação: dashboard.SITUACOES[l.situacao]?.nome ?? l.situacao, Doses: l.doses, '%': l.percentual })),
    });
  },

  /* ---------- 3. vacinas mais aplicadas ---------- */

  graficoTopVacinas(linhas) {
    const top = linhas.slice(0, 10);
    return dashboard.figura({
      titulo: 'Vacinas mais aplicadas',
      pergunta: 'Quais vacinas concentram as aplicações no período?',
      filtros: 'período · UBS · vacina · sexo',
      variaveis: `Vacina (qualitativa nominal): frequência das doses aplicadas. ${linhas.length > 10 ? `Mostrando as 10 mais frequentes de ${linhas.length}.` : ''} A primeira barra é a moda.`,
      grafico: charts.barrasH({
        esq: 150, rotulo: 'Vacinas mais aplicadas',
        itens: top.map(l => ({
          rotulo: l.vacina.length > 22 ? l.vacina.slice(0, 21) + '…' : l.vacina, dica: l.vacina,
          valor: Number(l.doses), pct: Number(l.percentual), cor: 'var(--serie-1)',
        })),
      }),
      linhas: linhas.map(l => ({ Vacina: l.vacina, Doses: l.doses, '%': l.percentual })),
    });
  },

  /* ---------- 4. faixa etária × sexo ---------- */

  FAIXAS: ['Menos de 1', '1 a 4', '5 a 9', '10 a 19', '20 a 59', '60 ou mais'],
  SEXOS: [{ sigla: 'F', nome: 'Feminino', cor: 'var(--serie-1)' }, { sigla: 'M', nome: 'Masculino', cor: 'var(--serie-2)' }],

  graficoFaixaSexo(linhas) {
    const valor = (faixa, sexo) => Number(linhas.find(l => l.faixa === faixa && l.sexo === sexo)?.doses ?? 0);
    const series = dashboard.SEXOS
      .map(s => ({ ...s, valores: dashboard.FAIXAS.map(f => valor(f, s.sigla)) }))
      .filter(s => s.valores.some(v => v > 0));
    return dashboard.figura({
      titulo: 'Doses aplicadas por faixa etária e sexo',
      pergunta: 'Em quais faixas etárias e em qual sexo se concentram as doses aplicadas?',
      filtros: 'período · UBS · vacina · sexo',
      variaveis: 'Faixa etária em anos, idade na data da aplicação (qualitativa ordinal) × sexo (qualitativa nominal). Comparativo de frequências.',
      grafico: charts.barrasAgrupadas({ categorias: dashboard.FAIXAS, series, rotulo: 'Doses aplicadas por faixa etária e sexo' }),
      legenda: charts.legenda(series),
      linhas: linhas.map(l => ({ 'Faixa etária': l.faixa, Sexo: l.sexo, Doses: l.doses })),
    });
  },

  /* ---------- 5 e 6. histogramas com medidas resumo ---------- */

  histograma(r, { titulo, pergunta, filtros, variaveis, unidade, rotuloClasse }) {
    const largura = r.largura, s = r.resumo;
    const cont = Object.fromEntries(r.classes.map(c => [Number(c.inicio), Number(c.n)]));
    const inicios = r.classes.map(c => Number(c.inicio));
    const classes = [];
    for (let i = Math.min(...inicios); i <= Math.max(...inicios); i += largura) classes.push({ inicio: i, valor: cont[i] ?? 0 });
    const marcas = s.n > 0 ? [
      { valor: Number(s.media), nome: 'Média', classe: 'media' },
      { valor: Number(s.mediana), nome: 'Mediana', classe: 'mediana' },
      { valor: Number(s.moda), nome: 'Moda', classe: 'moda' },
    ] : [];
    return dashboard.figura({
      titulo, pergunta, filtros, variaveis,
      grafico: classes.length ? charts.histograma({ classes, largura, marcas, unidade: ' ' + unidade, rotulo: titulo }) : '',
      legenda: charts.legenda([{ nome: rotuloClasse, cor: 'var(--serie-1)' }, ...marcas]),
      extra: dashboard.medidas(s, unidade),
      linhas: classes.map(c => ({ Classe: `${c.inicio} a ${c.inicio + largura - 1} ${unidade}`, Frequência: c.valor })),
    });
  },

  graficoIdade(r) {
    return dashboard.histograma(r, {
      titulo: 'Distribuição da idade dos pacientes',
      pergunta: 'Qual o perfil de idade dos pacientes atendidos?',
      filtros: 'UBS · sexo',
      variaveis: 'Idade atual em anos (quantitativa contínua), classes de 10 anos.',
      unidade: 'anos', rotuloClasse: 'Pacientes na classe',
    });
  },

  graficoAtrasos(r) {
    return dashboard.histograma(r, {
      titulo: 'Distribuição dos dias de atraso',
      pergunta: 'Quanto tempo as doses atrasadas estão esperando? O atraso é concentrado ou disperso?',
      filtros: 'UBS · vacina · sexo (atraso medido hoje)',
      variaveis: 'Dias desde a data prevista das doses atrasadas (quantitativa discreta), classes de 60 dias. Média acima da mediana indica assimetria à direita.',
      unidade: 'dias', rotuloClasse: 'Doses na classe',
    });
  },

  /* ---------- 7. radar por dia da semana ---------- */

  DIAS: ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'],

  graficoSemana(linhas) {
    const valores = dashboard.DIAS.map((_, i) => Number(linhas.find(l => Number(l.dia) === i + 1)?.doses ?? 0));
    const total = valores.reduce((s, v) => s + v, 0);
    const iMax = valores.indexOf(Math.max(...valores));
    const uteis = valores.slice(1, 6).reduce((s, v) => s + v, 0);
    return dashboard.figura({
      titulo: 'Doses aplicadas por dia da semana',
      pergunta: 'Em quais dias da semana a sala de vacina tem mais movimento?',
      filtros: 'período · UBS · vacina · sexo',
      variaveis: total ? `Dia da semana (qualitativa ordinal, cíclica). Moda: ${dashboard.DIAS[iMax]}. Dias úteis concentram ${charts.num((100 * uteis / total).toFixed(1))}% das doses.` : 'Dia da semana (qualitativa ordinal, cíclica).',
      grafico: charts.radar({ eixos: dashboard.DIAS, series: [{ nome: 'Doses', cor: 'var(--serie-1)', valores }], rotulo: 'Doses por dia da semana' }),
      linhas: total ? dashboard.DIAS.map((d, i) => ({ Dia: d, Doses: valores[i], '%': Number((100 * valores[i] / total).toFixed(1)) })) : [],
    });
  },

  /* ---------- 8. correlação ---------- */

  graficoCorrelacao(r, cnes) {
    const e = r.estatistica ?? {};
    const pontos = r.pontos.map(p => ({ x: Number(p.x), y: Number(p.y), rotulo: p.nome, destaque: p.cnes === cnes }));
    const rr = e.pearson === null || e.pearson === undefined ? null : Number(e.pearson);
    const forca = rr === null ? '' : Math.abs(rr) < 0.3 ? 'fraca' : Math.abs(rr) < 0.7 ? 'moderada' : 'forte';
    const sentido = rr === null ? '' : rr >= 0 ? 'positiva' : 'negativa';
    return dashboard.figura({
      titulo: 'Correlação: pacientes cadastrados × doses aplicadas, por UBS',
      pergunta: 'UBS com mais pacientes cadastrados aplicam mais doses?',
      filtros: 'período · vacina · sexo (todas as UBS aparecem; a escolhida no filtro fica destacada)',
      variaveis: rr === null
        ? 'Duas variáveis quantitativas por UBS. Sem variação suficiente para calcular a correlação.'
        : `Coeficiente de Pearson r = ${charts.num(rr)} (correlação ${forca} ${sentido}; r² = ${charts.num((rr * rr).toFixed(3))}). Reta: doses = ${charts.num(Number(e.intercepto).toFixed(2))} + ${charts.num(Number(e.inclinacao).toFixed(3))} × pacientes. Calculado no SQL.`,
      grafico: charts.dispersao({
        pontos, rotulo: 'Pacientes cadastrados × doses aplicadas por UBS',
        rotuloX: 'Pacientes cadastrados na UBS', rotuloY: 'Doses aplicadas',
        reta: rr === null ? null : { a: Number(e.intercepto), b: Number(e.inclinacao) },
      }),
      legenda: charts.legenda([{ nome: 'UBS', cor: 'var(--serie-1)' }, { nome: 'Reta de regressão', classe: 'tendencia' }]
        .concat(cnes ? [{ nome: 'UBS escolhida no filtro', cor: 'var(--serie-2)' }] : [])),
      linhas: r.pontos.map(p => ({ UBS: p.nome, 'Pacientes (x)': p.x, 'Doses aplicadas (y)': p.y })),
    });
  },
};
