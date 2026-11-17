const charts = {
  L: 520, A: 260,
  M: { top: 22, right: 12, bottom: 40, left: 44 },

  escala(max) {
    if (!(max > 0)) return { max: 1, passo: 1 };
    const bruto = max / 4, pot = 10 ** Math.floor(Math.log10(bruto));
    const passo = [1, 2, 5, 10].map(m => m * pot).find(p => p >= bruto);
    return { max: Math.ceil(max / passo) * passo, passo: Math.max(1, passo) };
  },

  num(v) { return Number(v).toLocaleString('pt-BR'); },

  eixoY(maxDados) {
    const { L, A, M } = charts, e = charts.escala(maxDados);
    const y = v => A - M.bottom - (v / e.max) * (A - M.top - M.bottom);
    let svg = '';
    for (let v = 0; v <= e.max; v += e.passo) {
      svg += `<line class="grade" x1="${M.left}" x2="${L - M.right}" y1="${y(v)}" y2="${y(v)}"/>
              <text class="eixo" x="${M.left - 6}" y="${y(v) + 4}" text-anchor="end">${charts.num(v)}</text>`;
    }
    return { svg, y };
  },

  svg(corpo, rotulo) {
    return `<svg viewBox="0 0 ${charts.L} ${charts.A}" role="img" aria-label="${ui.esc(rotulo)}">${corpo}</svg>`;
  },

  barra(x, larg, yTopo, yBase, cor, tip) {
    const h = yBase - yTopo;
    if (h <= 0) return '';
    const r = Math.min(4, larg / 2, h);
    return `<path class="marca" fill="${cor}" data-tip="${ui.esc(tip)}"
      d="M${x},${yBase} V${yTopo + r} Q${x},${yTopo} ${x + r},${yTopo} H${x + larg - r}
         Q${x + larg},${yTopo} ${x + larg},${yTopo + r} V${yBase} Z"/>`;
  },

  barrasAgrupadas({ categorias, series, rotulo }) {
    const { L, A, M } = charts;
    const max = Math.max(0, ...series.flatMap(s => s.valores));
    const { svg: grade, y } = charts.eixoY(max);
    const faixa = (L - M.left - M.right) / categorias.length;
    const larg = Math.min(26, (faixa * 0.7) / series.length), gap = 2;
    let corpo = grade;
    categorias.forEach((cat, i) => {
      const grupo = series.length * larg + (series.length - 1) * gap;
      const x0 = M.left + i * faixa + (faixa - grupo) / 2;
      series.forEach((s, j) => {
        const v = s.valores[i], x = x0 + j * (larg + gap);
        corpo += charts.barra(x, larg, y(v), y(0), s.cor, `${cat} · ${s.nome}: ${charts.num(v)}`);
        if (v > 0) corpo += `<text class="valor" x="${x + larg / 2}" y="${y(v) - 4}" text-anchor="middle">${charts.num(v)}</text>`;
      });
      corpo += `<text class="eixo" x="${M.left + i * faixa + faixa / 2}" y="${A - M.bottom + 16}" text-anchor="middle">${ui.esc(cat)}</text>`;
    });
    corpo += `<line class="base" x1="${M.left}" x2="${L - M.right}" y1="${y(0)}" y2="${y(0)}"/>`;
    return charts.svg(corpo, rotulo);
  },

  // tendencia (opcional): valores de uma reta/curva de referência, desenhada tracejada sob a série.
  linha({ rotulos, valores, rotulo, cadaN = 3, tendencia = null }) {
    const { L, A, M } = charts;
    const { svg: grade, y } = charts.eixoY(Math.max(0, ...valores, ...(tendencia ?? [])));
    const passo = (L - M.left - M.right) / Math.max(1, valores.length - 1);
    const x = i => M.left + i * passo;
    const iMax = valores.indexOf(Math.max(...valores));
    let corpo = grade + `<line class="base" x1="${M.left}" x2="${L - M.right}" y1="${y(0)}" y2="${y(0)}"/>`;
    if (tendencia) {
      corpo += `<polyline class="tendencia" points="${tendencia.map((v, i) => `${x(i)},${y(Math.max(0, v))}`).join(' ')}"/>`;
    }
    corpo += `<polyline class="traco" points="${valores.map((v, i) => `${x(i)},${y(v)}`).join(' ')}"/>`;
    valores.forEach((v, i) => {
      corpo += `<circle class="ponto" cx="${x(i)}" cy="${y(v)}" r="3.5"/>`;
      corpo += `<rect class="alvo" x="${x(i) - passo / 2}" y="${M.top}" width="${passo}" height="${A - M.top - M.bottom}"
                 data-tip="${ui.esc(rotulos[i])}: ${charts.num(v)} dose(s)"/>`;
      if (i % cadaN === 0 || i === valores.length - 1) {
        corpo += `<text class="eixo" x="${x(i)}" y="${A - M.bottom + 16}" text-anchor="middle">${ui.esc(rotulos[i])}</text>`;
      }
      if ((i === iMax || i === valores.length - 1) && v > 0) {
        corpo += `<text class="valor" x="${x(i)}" y="${y(v) - 8}" text-anchor="middle">${charts.num(v)}</text>`;
      }
    });
    return charts.svg(corpo, rotulo);
  },

  // itens: [{rotulo, valor, cor, pct?, dica?}]; sem pct mostra só o valor; dica = nome completo no tooltip.
  barrasH({ itens, rotulo, esq = 96 }) {
    const { L } = charts, dir = 90, alt = 26, gap = 12, topo = 8;
    const A = topo * 2 + itens.length * (alt + gap) - gap;
    const max = Math.max(1, ...itens.map(i => i.valor));
    let corpo = '';
    itens.forEach((it, k) => {
      const y = topo + k * (alt + gap), w = (it.valor / max) * (L - esq - dir);
      const texto = charts.num(it.valor) + (it.pct === undefined ? '' : ` (${charts.num(it.pct)}%)`);
      corpo += `<text class="rotulo" x="${esq - 8}" y="${y + alt / 2 + 4}" text-anchor="end">${ui.esc(it.rotulo)}</text>`;
      if (w > 0) {
        const r = Math.min(4, w);
        corpo += `<path class="marca" fill="${it.cor}" data-tip="${ui.esc(it.dica ?? it.rotulo)}: ${ui.esc(texto)}"
          d="M${esq},${y} H${esq + w - r} Q${esq + w},${y} ${esq + w},${y + r} V${y + alt - r}
             Q${esq + w},${y + alt} ${esq + w - r},${y + alt} H${esq} Z"/>`;
      }
      corpo += `<text class="valor" x="${esq + w + 6}" y="${y + alt / 2 + 4}">${ui.esc(texto)}</text>`;
    });
    corpo += `<line class="base" x1="${esq}" x2="${esq}" y1="0" y2="${A}"/>`;
    return `<svg viewBox="0 0 ${L} ${A}" role="img" aria-label="${ui.esc(rotulo)}">${corpo}</svg>`;
  },

  histograma({ classes, largura, marcas = [], rotulo, unidade = '' }) {
    const { L, A, M } = charts;
    const { svg: grade, y } = charts.eixoY(Math.max(0, ...classes.map(c => c.valor)));
    const xMin = classes[0].inicio, xMax = classes.at(-1).inicio + largura;
    const x = v => M.left + ((v - xMin) / (xMax - xMin)) * (L - M.left - M.right);
    let corpo = grade;
    classes.forEach(c => {
      const x0 = x(c.inicio) + 1, w = x(c.inicio + largura) - x(c.inicio) - 2;
      corpo += charts.barra(x0, w, y(c.valor), y(0), 'var(--serie-1)',
        `${c.inicio} a ${c.inicio + largura - 1}${unidade}: ${charts.num(c.valor)}`);
    });
    classes.concat({ inicio: xMax }).forEach(c =>
      corpo += `<text class="eixo" x="${x(c.inicio)}" y="${A - M.bottom + 16}" text-anchor="middle">${c.inicio}</text>`);
    corpo += `<line class="base" x1="${M.left}" x2="${L - M.right}" y1="${y(0)}" y2="${y(0)}"/>`;
    marcas.forEach((m, k) => {
      const xm = x(m.valor), ancora = xm > L - 90 ? 'end' : 'start', dx = ancora === 'end' ? -4 : 4;
      corpo += `<line class="referencia ${m.classe}" x1="${xm}" x2="${xm}" y1="${M.top - 8}" y2="${y(0)}"/>
                <text class="rotulo" x="${xm + dx}" y="${M.top - 10 + k * 13}" text-anchor="${ancora}">${ui.esc(m.nome)} ${charts.num(m.valor)}</text>`;
    });
    return charts.svg(corpo, rotulo);
  },

  // Rosca: itens [{rotulo, valor, cor}]; percentuais e total calculados aqui; legenda com % ao lado.
  pizza({ itens, rotulo, centro = 'total' }) {
    const { L, A } = charts, cx = 130, cy = A / 2, R = 104, r = 62;
    const total = itens.reduce((s, i) => s + i.valor, 0);
    const ponto = (ang, raio) => [cx + raio * Math.sin(ang), cy - raio * Math.cos(ang)];
    const fatia = (a0, a1) => {
      const [x0, y0] = ponto(a0, R), [x1, y1] = ponto(a1, R), [x2, y2] = ponto(a1, r), [x3, y3] = ponto(a0, r);
      const grande = a1 - a0 > Math.PI ? 1 : 0;
      return `M${x0},${y0} A${R},${R} 0 ${grande} 1 ${x1},${y1} L${x2},${y2} A${r},${r} 0 ${grande} 0 ${x3},${y3} Z`;
    };
    let corpo = '', a = 0;
    itens.forEach((it, k) => {
      const pct = total ? (100 * it.valor) / total : 0;
      const tip = `${it.rotulo}: ${charts.num(it.valor)} (${charts.num(pct.toFixed(1))}%)`;
      const a1 = a + (2 * Math.PI * it.valor) / (total || 1);
      // fatia de 100% vira duas metades (um arco SVG não fecha um círculo inteiro)
      const partes = a1 - a >= 2 * Math.PI - 1e-6 ? [[a, a + Math.PI], [a + Math.PI, a1]] : [[a, a1]];
      if (it.valor > 0) partes.forEach(([p0, p1]) => corpo += `<path class="marca fatia" fill="${it.cor}" data-tip="${ui.esc(tip)}" d="${fatia(p0, p1)}"/>`);
      a = a1;
      const ly = 40 + k * 30;
      corpo += `<rect x="280" y="${ly - 10}" width="12" height="12" rx="3" fill="${it.cor}"/>
        <text class="rotulo" x="300" y="${ly}">${ui.esc(it.rotulo)}</text>
        <text class="valor" x="${L - 12}" y="${ly}" text-anchor="end">${charts.num(it.valor)} · ${charts.num(pct.toFixed(1))}%</text>`;
    });
    corpo += `<text class="valor centro" x="${cx}" y="${cy + 2}" text-anchor="middle">${charts.num(total)}</text>
      <text class="eixo" x="${cx}" y="${cy + 20}" text-anchor="middle">${ui.esc(centro)}</text>`;
    return charts.svg(corpo, rotulo);
  },

  // Radar: eixos (categorias) e séries [{nome, cor, valores}], escala comum a partir de zero.
  radar({ eixos, series, rotulo }) {
    const { L, A } = charts, cx = L / 2, cy = A / 2 + 4, R = 96;
    const { max } = charts.escala(Math.max(1, ...series.flatMap(s => s.valores)));
    const ang = i => (2 * Math.PI * i) / eixos.length;
    const pt = (i, v) => [cx + (R * v / max) * Math.sin(ang(i)), cy - (R * v / max) * Math.cos(ang(i))];
    let corpo = '';
    [0.25, 0.5, 0.75, 1].forEach(f => {
      corpo += `<polygon class="grade" fill="none" points="${eixos.map((_, i) => pt(i, f * max).join(',')).join(' ')}"/>`;
    });
    corpo += `<text class="eixo" x="${cx + 4}" y="${cy - R + 12}">${charts.num(max)}</text>`;
    eixos.forEach((e, i) => {
      const [x, y] = pt(i, max), [lx, ly] = pt(i, max * 1.17);
      const ancora = Math.abs(lx - cx) < 4 ? 'middle' : lx > cx ? 'start' : 'end';
      corpo += `<line class="grade" x1="${cx}" y1="${cy}" x2="${x}" y2="${y}"/>
        <text class="rotulo" x="${lx}" y="${ly + 4}" text-anchor="${ancora}">${ui.esc(e)}</text>`;
    });
    series.forEach(s => {
      const pts = s.valores.map((v, i) => pt(i, v));
      corpo += `<polygon class="area-radar" fill="${s.cor}" stroke="${s.cor}" points="${pts.map(p => p.join(',')).join(' ')}"/>`;
      pts.forEach(([x, y], i) => {
        corpo += `<circle class="ponto-radar" cx="${x}" cy="${y}" r="4" fill="${s.cor}"/>
          <circle class="alvo-ponto" cx="${x}" cy="${y}" r="12" data-tip="${ui.esc(eixos[i])}${series.length > 1 ? ' · ' + ui.esc(s.nome) : ''}: ${charts.num(s.valores[i])}"/>`;
      });
    });
    return charts.svg(corpo, rotulo);
  },

  // Dispersão: pontos [{x, y, rotulo, destaque}] e reta opcional y = a + b·x.
  dispersao({ pontos, reta, rotuloX, rotuloY, rotulo }) {
    const { L, A, M } = charts, esq = M.left + 12, base = A - M.bottom - 8;
    const ex = charts.escala(Math.max(1, ...pontos.map(p => p.x)));
    const ey = charts.escala(Math.max(1, ...pontos.map(p => p.y)));
    const x = v => esq + (v / ex.max) * (L - esq - M.right);
    const y = v => base - (v / ey.max) * (base - M.top);
    let corpo = '';
    for (let v = 0; v <= ey.max; v += ey.passo) {
      corpo += `<line class="grade" x1="${esq}" x2="${L - M.right}" y1="${y(v)}" y2="${y(v)}"/>
        <text class="eixo" x="${esq - 6}" y="${y(v) + 4}" text-anchor="end">${charts.num(v)}</text>`;
    }
    for (let v = 0; v <= ex.max; v += ex.passo) {
      corpo += `<text class="eixo" x="${x(v)}" y="${base + 16}" text-anchor="middle">${charts.num(v)}</text>`;
    }
    corpo += `<line class="base" x1="${esq}" x2="${L - M.right}" y1="${base}" y2="${base}"/>
      <text class="eixo" x="${(esq + L - M.right) / 2}" y="${A - 4}" text-anchor="middle">${ui.esc(rotuloX)}</text>
      <text class="eixo" x="${10}" y="${(base + M.top) / 2}" text-anchor="middle" transform="rotate(-90 10 ${(base + M.top) / 2})">${ui.esc(rotuloY)}</text>`;
    if (reta && Number.isFinite(reta.a) && Number.isFinite(reta.b)) {
      // recorta a reta na área do gráfico (y entre 0 e o máximo do eixo)
      const yr = v => Math.min(ey.max, Math.max(0, reta.a + reta.b * v));
      corpo += `<line class="tendencia" x1="${x(0)}" y1="${y(yr(0))}" x2="${x(ex.max)}" y2="${y(yr(ex.max))}"/>`;
    }
    pontos.forEach(p => {
      corpo += `<circle class="ponto-dispersao${p.destaque ? ' destaque' : ''}" cx="${x(p.x)}" cy="${y(p.y)}" r="${p.destaque ? 6 : 4.5}"/>
        <circle class="alvo-ponto" cx="${x(p.x)}" cy="${y(p.y)}" r="12" data-tip="${ui.esc(p.rotulo)}: ${charts.num(p.x)} pacientes · ${charts.num(p.y)} doses"/>`;
    });
    return charts.svg(corpo, rotulo);
  },

  legenda(itens) {
    return `<div class="legenda">${itens.map(i => i.classe
      ? `<span><svg width="18" height="10"><line class="referencia ${i.classe}" x1="0" x2="18" y1="5" y2="5"/></svg>${ui.esc(i.nome)}</span>`
      : `<span><i style="background:${i.cor}"></i>${ui.esc(i.nome)}</span>`).join('')}</div>`;
  },
};

document.addEventListener('mousemove', e => {
  let tip = document.getElementById('tooltip-grafico');
  const alvo = e.target.closest?.('[data-tip]');
  if (!alvo) { if (tip) tip.hidden = true; return; }
  if (!tip) {
    tip = Object.assign(document.createElement('div'), { id: 'tooltip-grafico' });
    document.body.appendChild(tip);
  }
  tip.textContent = alvo.dataset.tip;
  tip.hidden = false;
  tip.style.left = Math.min(e.clientX + 12, innerWidth - tip.offsetWidth - 8) + 'px';
  tip.style.top = (e.clientY + 14) + 'px';
});
