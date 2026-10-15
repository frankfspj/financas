(() => {
  'use strict';

  // =========================================================
  // Configuração
  // =========================================================
  const STORAGE_KEY = 'financas.v1';
  const TEMA_KEY = 'financas.tema';
  const AJUDA_KEY = 'financas.ajudaVista';

  // A ordem define a cor de cada categoria (--c-<chave> no CSS). A paleta foi
  // validada nesta ordem para daltonismo — não reordene sem revalidar.
  const CATEGORIAS = {
    contas:      { nome: 'Contas Fixas' },
    compras:     { nome: 'Compras' },
    alimentacao: { nome: 'Alimentação' },
    assinaturas: { nome: 'Assinaturas' },
    online:      { nome: 'Compras Online' },
    veiculo:     { nome: 'Veículo' },
    lazer:       { nome: 'Lazer' },
    transporte:  { nome: 'Transporte' },
    fatura:      { nome: 'Fatura do Cartão' },
  };

  const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

  const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
  const brlCompacto = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', notation: 'compact', maximumFractionDigits: 1 });
  const fmt = (v) => brl.format(v || 0);
  const pct = (v) => `${(v * 100).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`;
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => document.querySelectorAll(sel);
  const corVar = (k) => `var(--c-${k})`;
  const cssVar = (nome) => getComputedStyle(document.documentElement).getPropertyValue(nome).trim();

  const ICONE_DEL = '<svg viewBox="0 0 24 24" width="16" height="16"><path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>';
  const ICONE_EDIT = '<svg viewBox="0 0 24 24" width="16" height="16"><path d="M4 20h4L19 9l-4-4L4 16v4zM13.5 6.5l4 4" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg>';
  const ICONE_COFRE = '<svg viewBox="0 0 24 24" width="18" height="18"><path d="M19 10c0-3.3-3.1-6-7-6S5 6.7 5 10c0 1.9 1 3.6 2.6 4.7V18a1 1 0 0 0 1 1h1.6a1 1 0 0 0 1-1v-1h1.6v1a1 1 0 0 0 1 1h1.6a1 1 0 0 0 1-1v-3.3c.9-.6 1.6-1.4 2-2.4H21v-3h-1.4c-.2-.5-.4-.9-.6-1.3M10 7.5h4" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  const ICONE_RESGATE = '<svg viewBox="0 0 24 24" width="18" height="18"><path d="M12 19V7M6.5 12.5L12 7l5.5 5.5M5 4h14" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  const ICONE_ENTRADA = '<svg viewBox="0 0 24 24" width="18" height="18"><path d="M12 4v12M6.5 10.5L12 16l5.5-5.5M5 20h14" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>';

  // =========================================================
  // Estado e persistência
  // =========================================================
  const state = {
    data: normalizar(carregar()) || { meses: {}, metas: [] },
    mes: chaveMes(new Date()),
    view: 'dashboard',
    filtro: 'todas',
    periodo: 6,
    editandoId: null,
    operacao: 'guardar',
    importPendente: null,
  };

  let grafico = null;
  let graficoHist = null;
  let desfazer = null;
  let toastTimer = null;

  function carregar() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY));
    } catch {
      return null;
    }
  }

  function salvar() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state.data));
    } catch {
      /* armazenamento indisponível: segue apenas em memória */
    }
  }

  // Garante a estrutura esperada e descarta registros inválidos.
  // Usado ao carregar do navegador e ao importar um backup.
  function normalizar(bruto) {
    if (!bruto || typeof bruto !== 'object' || typeof bruto.meses !== 'object' || bruto.meses === null) return null;

    const valido = (x) => x && typeof x === 'object' && Number.isFinite(x.valor) && x.valor >= 0
      && typeof x.data === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(x.data);
    const lista = (arr) => (Array.isArray(arr) ? arr.filter(valido) : []);

    const meses = {};
    Object.entries(bruto.meses).forEach(([chave, m]) => {
      if (!/^\d{4}-\d{2}$/.test(chave) || !m || typeof m !== 'object') return;
      meses[chave] = {
        saldo: Number.isFinite(m.saldo) ? m.saldo : null,
        itens: lista(m.itens).filter((i) => typeof i.nome === 'string'),
        guardados: lista(m.guardados),
        entradas: lista(m.entradas),
      };
    });

    const metas = Array.isArray(bruto.metas)
      ? bruto.metas.filter((g) => g && typeof g.nome === 'string' && Number.isFinite(g.alvo) && g.alvo > 0)
      : [];

    return { ...bruto, meses, metas };
  }

  // Mês (somente leitura)
  function mesDe(chave) {
    const m = state.data.meses[chave] || {};
    return {
      saldo: m.saldo ?? null,
      itens: m.itens || [],
      guardados: m.guardados || [],
      entradas: m.entradas || [],
    };
  }
  const mes = () => mesDe(state.mes);

  // Mês (cria se ainda não existir)
  function mesEditavel(chave = state.mes) {
    if (!state.data.meses[chave]) state.data.meses[chave] = { saldo: null, itens: [] };
    const m = state.data.meses[chave];
    if (!m.guardados) m.guardados = [];
    if (!m.entradas) m.entradas = [];
    return m;
  }

  // Valor com sinal: guardar soma, resgatar subtrai
  const valorReserva = (g) => (g.operacao === 'resgatar' ? -g.valor : g.valor);

  function todosGuardados() {
    return Object.values(state.data.meses).flatMap((m) => m.guardados || []);
  }

  // Saldo da reserva somando todos os meses
  function totalAcumulado() {
    return todosGuardados().reduce((s, g) => s + valorReserva(g), 0);
  }

  // Quanto já foi guardado (líquido) para uma meta
  function progressoMeta(id) {
    return todosGuardados().filter((g) => g.metaId === id).reduce((s, g) => s + valorReserva(g), 0);
  }

  // =========================================================
  // Utilitários
  // =========================================================
  function chaveMes(d) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  }

  function partesMes(chave) {
    const [ano, mesNum] = chave.split('-').map(Number);
    return { ano, mesNum };
  }

  function nomeMes(chave) {
    const { ano, mesNum } = partesMes(chave);
    return `${MESES[mesNum - 1]} ${ano}`;
  }

  function nomeMesExtenso(chave) {
    const { ano, mesNum } = partesMes(chave);
    return `${MESES[mesNum - 1].toLowerCase()} de ${ano}`;
  }

  function nomeMesCurto(chave) {
    const { ano, mesNum } = partesMes(chave);
    return `${MESES[mesNum - 1].slice(0, 3).toLowerCase()}/${String(ano).slice(2)}`;
  }

  function deslocarMes(chave, delta) {
    const { ano, mesNum } = partesMes(chave);
    return chaveMes(new Date(ano, mesNum - 1 + delta, 1));
  }

  function mesesEntre(de, ate) {
    const a = partesMes(de);
    const b = partesMes(ate);
    return (b.ano - a.ano) * 12 + (b.mesNum - a.mesNum);
  }

  function diasNoMes(chave) {
    const { ano, mesNum } = partesMes(chave);
    return new Date(ano, mesNum, 0).getDate();
  }

  function hojeISO() {
    const d = new Date();
    return `${chaveMes(d)}-${String(d.getDate()).padStart(2, '0')}`;
  }

  function dataCurta(iso) {
    const [, m, d] = iso.split('-').map(Number);
    return `${d} ${MESES[m - 1].slice(0, 3).toLowerCase()}`;
  }

  // Aceita "1.234,56", "1234,56", "1234.56", "R$ 50"
  function parseValor(str) {
    let s = String(str).trim().replace(/[R$\s]/g, '');
    if (!s) return NaN;
    if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
    const n = Number(s);
    return Number.isFinite(n) ? Math.round(n * 100) / 100 : NaN;
  }

  function valorParaInput(n) {
    return n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) => (
      { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
    ));
  }

  function plural(n, um, varios) {
    return `${n} ${n === 1 ? um : varios}`;
  }

  function novoId() {
    return crypto.randomUUID ? crypto.randomUUID() : String(Date.now() + Math.random());
  }

  function intervaloDoMes() {
    const inicio = `${state.mes}-01`;
    const fim = `${state.mes}-${String(diasNoMes(state.mes)).padStart(2, '0')}`;
    const hoje = hojeISO();
    return { inicio, fim, padrao: hoje.startsWith(state.mes) ? hoje : inicio };
  }

  function prepararData(input, valorAtual) {
    const { inicio, fim, padrao } = intervaloDoMes();
    input.min = inicio;
    input.max = fim;
    input.value = valorAtual || padrao;
  }

  function calcular(m) {
    const porCat = {};
    const qtdCat = {};
    Object.keys(CATEGORIAS).forEach((k) => { porCat[k] = 0; qtdCat[k] = 0; });

    let total = 0;
    m.itens.forEach((i) => {
      if (!(i.categoria in porCat)) return;
      porCat[i.categoria] += i.valor;
      qtdCat[i.categoria] += 1;
      total += i.valor;
    });

    let guardado = 0;
    let resgatado = 0;
    m.guardados.forEach((g) => {
      if (g.operacao === 'resgatar') resgatado += g.valor;
      else guardado += g.valor;
    });
    const liquido = guardado - resgatado;
    const extras = m.entradas.reduce((s, e) => s + e.valor, 0);

    const saldo = m.saldo || 0;
    const disponivel = saldo + extras;
    return {
      porCat,
      qtdCat,
      total,
      guardado,
      resgatado,
      liquido,
      extras,
      saldo,
      disponivel,
      temSaldo: m.saldo != null || extras > 0,
      restante: disponivel - total - liquido,
      uso: disponivel > 0 ? Math.max(total + liquido, 0) / disponivel : 0,
    };
  }

  function nivel(c) {
    if (!c.temSaldo) return 'neutral';
    if (c.restante < 0) return 'danger';
    if (c.uso >= 0.8) return 'warn';
    return 'ok';
  }

  // =========================================================
  // Renderização
  // =========================================================
  function render() {
    $('#monthLabel').textContent = nomeMes(state.mes);
    const m = mes();
    const c = calcular(m);
    renderKpis(m, c);
    renderGrafico(c);
    renderLista(m);
    renderResumo(m, c);
    renderHistorico();
    renderMetas();
    renderAvisoBackup();
  }

  function renderKpis(m, c) {
    $('#kpiSaldo').textContent = c.temSaldo ? fmt(c.disponivel) : '—';
    const rotulo = m.saldo != null ? 'Editar saldo' : 'Definir saldo';
    $('#editBalance').setAttribute('aria-label', rotulo);
    $('#editBalance').title = rotulo;
    $('#kpiSaldoHint').textContent = c.extras > 0
      ? `${fmt(c.saldo)} + ${fmt(c.extras)} em entradas extras`
      : 'Valor disponível para gastar';
    $('#kpiGasto').textContent = fmt(c.total);
    $('#kpiItens').textContent = plural(m.itens.length, 'lançamento', 'lançamentos');
    $('#kpiGuardado').textContent = fmt(c.liquido);
    $('#kpiAcumulado').textContent = `Total acumulado: ${fmt(totalAcumulado())}`;

    const restante = $('#kpiRestante');
    restante.textContent = c.temSaldo ? fmt(c.restante) : '—';
    restante.classList.toggle('is-negative', c.temSaldo && c.restante < 0);

    const bar = $('#progressBar');
    bar.style.width = `${Math.min(c.uso, 1) * 100}%`;
    bar.dataset.nivel = nivel(c);

    $('#kpiPct').textContent = c.temSaldo
      ? `${pct(c.uso)} do saldo utilizado`
      : 'Defina um saldo para acompanhar';
  }

  function estiloTooltip() {
    return {
      backgroundColor: '#121316',
      borderColor: cssVar('--line'),
      borderWidth: 1,
      padding: 12,
      cornerRadius: 10,
      boxPadding: 6,
      usePointStyle: true,
      titleFont: { family: 'Inter', weight: '600' },
      bodyFont: { family: 'Inter' },
      footerFont: { family: 'Inter', weight: '600' },
    };
  }

  function renderGrafico(c) {
    const chaves = Object.keys(CATEGORIAS);
    const valores = chaves.map((k) => c.porCat[k]);
    const vazio = c.total === 0;

    $('#chartEmpty').hidden = !vazio;
    $('#chartCenter').hidden = vazio;
    $('#pieChart').style.visibility = vazio ? 'hidden' : 'visible';
    $('#chartTotal').textContent = fmt(c.total);

    $('#legend').innerHTML = chaves.map((k) => `
      <li>
        <span class="dot" style="--c:${corVar(k)}"></span>
        <span>${CATEGORIAS[k].nome}</span>
        <span class="legend__pct">${c.total ? pct(c.porCat[k] / c.total) : '0%'}</span>
        <span class="legend__val">${fmt(c.porCat[k])}</span>
      </li>`).join('');

    if (typeof Chart === 'undefined') return; // sem internet: legenda continua funcionando

    // Cores lidas do CSS a cada render, para acompanhar o tema
    const cores = chaves.map((k) => cssVar(`--c-${k}`));
    const fundo = cssVar('--surface');

    if (grafico) {
      const ds = grafico.data.datasets[0];
      ds.data = valores;
      ds.backgroundColor = cores;
      ds.borderColor = fundo;
      Object.assign(grafico.options.plugins.tooltip, estiloTooltip());
      grafico.update();
      return;
    }

    grafico = new Chart($('#pieChart'), {
      type: 'doughnut',
      data: {
        labels: chaves.map((k) => CATEGORIAS[k].nome),
        datasets: [{
          data: valores,
          backgroundColor: cores,
          borderColor: fundo,
          borderWidth: 3,
          borderRadius: 6,
          hoverOffset: 8,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '70%',
        layout: { padding: 8 },
        animation: { animateRotate: true, duration: 700 },
        plugins: {
          legend: { display: false },
          tooltip: {
            ...estiloTooltip(),
            callbacks: {
              label: (ctx) => {
                const soma = ctx.dataset.data.reduce((a, b) => a + b, 0);
                return ` ${fmt(ctx.parsed)} · ${soma ? pct(ctx.parsed / soma) : '0%'}`;
              },
            },
          },
        },
      },
    });
  }

  function linhaLancamento({ id, tipo, icone, cor, nome, sub, valor, classeValor = '' }) {
    return `
      <li class="item" data-id="${id}" data-tipo="${tipo}" title="Clique para editar">
        <span class="item__icon" style="--c:${cor}">${icone}</span>
        <div class="item__body">
          <strong>${escapeHtml(nome)}</strong>
          <span>${sub}</span>
        </div>
        <span class="item__val ${classeValor}">${valor}</span>
        <button class="item__del" type="button" data-del="${id}" data-tipo="${tipo}" aria-label="Remover ${escapeHtml(nome)}">${ICONE_DEL}</button>
      </li>`;
  }

  function renderLista(m) {
    const filtro = state.filtro;
    const lancamentos = [
      ...m.itens.map((i) => ({ ...i, tipo: 'itens' })),
      ...m.guardados.map((g) => ({ ...g, tipo: 'guardados' })),
      ...m.entradas.map((e) => ({ ...e, tipo: 'entradas' })),
    ]
      .filter((l) => {
        if (filtro === 'todas') return true;
        if (filtro === 'guardado') return l.tipo === 'guardados';
        if (filtro === 'entradas') return l.tipo === 'entradas';
        return l.categoria === filtro;
      })
      .sort((a, b) => b.data.localeCompare(a.data) || b.criadoEm - a.criadoEm);

    const nomeMeta = (id) => state.data.metas.find((g) => g.id === id)?.nome;

    $('#list').innerHTML = lancamentos.map((l) => {
      if (l.tipo === 'entradas') {
        return linhaLancamento({
          id: l.id, tipo: 'entradas', icone: ICONE_ENTRADA, cor: 'var(--income-ink)',
          nome: l.nome || 'Entrada extra', sub: `Entrada extra · ${dataCurta(l.data)}`,
          valor: `+ ${fmt(l.valor)}`, classeValor: 'item__val--income',
        });
      }
      if (l.tipo === 'guardados') {
        const resgate = l.operacao === 'resgatar';
        const meta = nomeMeta(l.metaId);
        return linhaLancamento({
          id: l.id, tipo: 'guardados', icone: resgate ? ICONE_RESGATE : ICONE_COFRE, cor: 'var(--c-save)',
          nome: l.descricao || meta || (resgate ? 'Resgate' : 'Dinheiro guardado'),
          sub: `${resgate ? 'Resgatado' : 'Guardado'}${meta ? ` · ${escapeHtml(meta)}` : ''} · ${dataCurta(l.data)}`,
          valor: `${resgate ? '−' : '+'} ${fmt(l.valor)}`, classeValor: 'item__val--save',
        });
      }
      const conhecida = CATEGORIAS[l.categoria];
      return linhaLancamento({
        id: l.id, tipo: 'itens', icone: escapeHtml(l.nome.charAt(0).toUpperCase()),
        cor: conhecida ? corVar(l.categoria) : 'var(--muted)',
        nome: l.nome, sub: `${conhecida ? conhecida.nome : '—'} · ${dataCurta(l.data)}`,
        valor: `− ${fmt(l.valor)}`,
      });
    }).join('');

    const total = m.itens.length + m.guardados.length + m.entradas.length;
    const vazio = $('#listEmpty');
    vazio.hidden = lancamentos.length > 0;
    vazio.innerHTML = total
      ? '<strong>Nada por aqui</strong>Nenhum lançamento neste filtro.'
      : `<strong>Nenhum gasto registrado</strong>Adicione seu primeiro item para começar a acompanhar.
         <button class="btn btn--ghost" type="button" data-action="add">Adicionar item</button>`;
  }

  function renderResumo(m, c) {
    const hoje = new Date();
    const atual = chaveMes(hoje);
    const dias = diasNoMes(state.mes);
    const ehAtual = state.mes === atual;
    const decorridos = ehAtual ? hoje.getDate() : (state.mes < atual ? dias : 0);
    const restamDias = ehAtual ? dias - hoje.getDate() : 0;
    const media = decorridos ? c.total / decorridos : 0;
    const projecao = ehAtual ? media * dias : c.total;
    const chaves = Object.keys(CATEGORIAS);
    const n = m.itens.length;

    $('#resumoTitulo').textContent = `Resumo de ${nomeMes(state.mes)}`;
    $('#resumoPeriodo').textContent = ehAtual
      ? `Parcial · dia ${hoje.getDate()} de ${dias}`
      : (state.mes < atual ? 'Mês encerrado' : 'Mês futuro');

    // Status
    const status = $('#resumoStatus');
    const nv = nivel(c);
    status.dataset.nivel = nv;
    status.textContent = {
      neutral: 'Saldo não definido',
      ok: 'No controle',
      warn: 'Atenção',
      danger: 'Orçamento estourado',
    }[nv];

    // Frase principal
    const guardouTxt = c.guardado > 0 ? ` e guardou <b>${fmt(c.guardado)}</b>` : '';
    if (!n && !m.guardados.length) {
      $('#resumoFrase').innerHTML = 'Ainda não há gastos registrados neste mês.';
    } else if (c.disponivel > 0) {
      $('#resumoFrase').innerHTML = `Você gastou <b>${fmt(c.total)}</b> de <b>${fmt(c.disponivel)}</b>${guardouTxt}
        — ${pct(c.uso)} do seu saldo já tem destino.`;
    } else {
      $('#resumoFrase').innerHTML = `Você gastou <b>${fmt(c.total)}</b> em ${plural(n, 'lançamento', 'lançamentos')}${guardouTxt}.`;
    }

    // Insights
    const insights = [];
    if (n) {
      const topCat = chaves.reduce((a, b) => (c.porCat[b] > c.porCat[a] ? b : a));
      insights.push(`Sua maior categoria é <b>${CATEGORIAS[topCat].nome}</b>, com ${pct(c.porCat[topCat] / c.total)} dos gastos (${fmt(c.porCat[topCat])}).`);
    }
    if (c.extras > 0) {
      insights.push(`Você recebeu <b>${fmt(c.extras)}</b> em ${plural(m.entradas.length, 'entrada extra', 'entradas extras')} além do saldo do mês.`);
    }
    if (c.temSaldo) {
      if (c.restante >= 0) {
        insights.push(`${ehAtual ? 'Ainda restam' : 'Sobraram'} <b>${fmt(c.restante)}</b> do seu saldo.`);
      } else {
        insights.push(`Gastos e valores guardados ultrapassaram o saldo em <b>${fmt(-c.restante)}</b>.`);
      }
      if (ehAtual && n && restamDias > 0) {
        const diff = c.disponivel - c.liquido - projecao;
        insights.push(diff >= 0
          ? `No ritmo atual, você deve terminar o mês com cerca de <b>${fmt(diff)}</b> sobrando.`
          : `No ritmo atual, você deve gastar <b>${fmt(projecao)}</b> até o fim do mês — <b>${fmt(-diff)}</b> acima do disponível.`);
        if (c.restante > 0) {
          insights.push(`Para fechar no azul, gaste até <b>${fmt(c.restante / restamDias)}</b> por dia nos próximos ${plural(restamDias, 'dia', 'dias')}.`);
        }
      }
    }
    if (c.guardado > 0 || c.resgatado > 0) {
      const partes = [];
      if (c.guardado > 0) {
        const parteSaldo = c.disponivel > 0 ? ` (${pct(c.guardado / c.disponivel)} do saldo)` : '';
        partes.push(`guardou <b>${fmt(c.guardado)}</b>${parteSaldo}`);
      }
      if (c.resgatado > 0) partes.push(`resgatou <b>${fmt(c.resgatado)}</b>`);
      insights.push(`Neste mês você ${partes.join(' e ')}. Sua reserva total está em <b>${fmt(totalAcumulado())}</b>.`);
    }
    if (c.porCat.assinaturas > 0) {
      insights.push(`Assinaturas somam <b>${fmt(c.porCat.assinaturas)}</b> — vale revisar as que você não usa.`);
    }
    if (!c.temSaldo) {
      insights.push('Defina o saldo do mês no Dashboard para ver quanto ainda pode gastar.');
    }
    $('#resumoInsights').innerHTML = insights.map((t) => `<li>${t}</li>`).join('');

    // Indicadores
    const maior = m.itens.reduce((a, b) => (!a || b.valor > a.valor ? b : a), null);
    const stats = [
      { label: 'Média diária', valor: fmt(media), hint: decorridos ? `em ${plural(decorridos, 'dia', 'dias')}` : 'mês ainda não começou' },
      ehAtual
        ? { label: 'Projeção do mês', valor: fmt(projecao), hint: 'mantendo o ritmo atual' }
        : { label: 'Total do mês', valor: fmt(c.total), hint: plural(n, 'lançamento', 'lançamentos') },
      { label: 'Maior gasto', valor: maior ? fmt(maior.valor) : '—', hint: maior ? escapeHtml(maior.nome) : 'nenhum lançamento' },
      ehAtual
        ? { label: 'Dias restantes', valor: String(restamDias), hint: `de ${dias} dias no mês` }
        : { label: 'Saldo final', valor: c.temSaldo ? fmt(c.restante) : '—', hint: c.temSaldo ? (c.restante >= 0 ? 'sobrou no mês' : 'acima do saldo') : 'saldo não definido' },
    ];
    $('#resumoStats').innerHTML = renderStats(stats);

    // Por categoria (ordenado do maior para o menor)
    $('#resumoCategorias').innerHTML = [...chaves]
      .sort((a, b) => c.porCat[b] - c.porCat[a])
      .map((k) => {
        const p = c.total ? c.porCat[k] / c.total : 0;
        return `
          <div class="bd__row">
            <div class="bd__top">
              <span class="dot" style="--c:${corVar(k)}"></span>
              <span class="bd__name">${CATEGORIAS[k].nome}</span>
              <span class="bd__count">${plural(c.qtdCat[k], 'item', 'itens')}</span>
              <span class="bd__val">${fmt(c.porCat[k])}</span>
            </div>
            <div class="bd__top">
              <div class="bd__track" style="flex:1"><div class="bd__fill" style="--w:${p * 100}%;--c:${corVar(k)}"></div></div>
              <span class="bd__pct">${pct(p)}</span>
            </div>
          </div>`;
      }).join('');

    // Maiores gastos
    const top = [...m.itens].sort((a, b) => b.valor - a.valor).slice(0, 5);
    $('#resumoTop').innerHTML = top.length
      ? top.map((i) => {
          const cat = CATEGORIAS[i.categoria] || { nome: '—' };
          return `
            <li>
              <div class="item__body">
                <strong>${escapeHtml(i.nome)}</strong>
                <span>${cat.nome} · ${dataCurta(i.data)}</span>
              </div>
              <span class="item__val">${fmt(i.valor)}</span>
            </li>`;
        }).join('')
      : '<div class="empty"><strong>Sem lançamentos</strong>Seus maiores gastos aparecerão aqui.</div>';
  }

  function renderStats(stats) {
    return stats.map((s) => `
      <div class="stat">
        <span>${s.label}</span>
        <strong>${s.valor}</strong>
        <small>${s.hint}</small>
      </div>`).join('');
  }

  // =========================================================
  // Histórico (comparar meses)
  // =========================================================
  function renderHistorico() {
    if (state.view !== 'historico') return; // o gráfico só é desenhado quando visível

    const n = state.periodo;
    const chaves = Array.from({ length: n }, (_, i) => deslocarMes(state.mes, i - (n - 1)));
    const linhas = chaves.map((chave) => {
      const m = mesDe(chave);
      return { chave, m, c: calcular(m), temDados: m.saldo != null || m.itens.length || m.guardados.length || m.entradas.length };
    });
    const comDados = linhas.filter((l) => l.temDados);

    $('#histTitulo').textContent = `${nomeMes(chaves[0])} – ${nomeMes(chaves[n - 1])}`;

    // Indicadores
    const comGastos = linhas.filter((l) => l.c.total > 0);
    const mediaGastos = comGastos.length ? comGastos.reduce((s, l) => s + l.c.total, 0) / comGastos.length : 0;
    const maiorMes = comGastos.reduce((a, b) => (!a || b.c.total > a.c.total ? b : a), null);
    const guardadoPeriodo = linhas.reduce((s, l) => s + l.c.liquido, 0);
    const atual = linhas[n - 1].c.total;
    const anterior = linhas[n - 2].c.total;
    const variacao = anterior > 0 ? (atual - anterior) / anterior : null;

    $('#histStats').innerHTML = renderStats([
      { label: 'Média de gastos', valor: fmt(mediaGastos), hint: comGastos.length ? `por mês, em ${plural(comGastos.length, 'mês', 'meses')} com gastos` : 'sem gastos no período' },
      { label: 'Mês que mais gastou', valor: maiorMes ? fmt(maiorMes.c.total) : '—', hint: maiorMes ? nomeMes(maiorMes.chave) : 'sem gastos no período' },
      { label: 'Guardado no período', valor: fmt(guardadoPeriodo), hint: `reserva total: ${fmt(totalAcumulado())}` },
      {
        label: `${nomeMesCurto(chaves[n - 1])} vs. ${nomeMesCurto(chaves[n - 2])}`,
        valor: variacao === null ? '—' : `${variacao > 0 ? '↑' : variacao < 0 ? '↓' : ''} ${pct(Math.abs(variacao))}`,
        hint: variacao === null ? 'sem gastos no mês anterior' : (variacao > 0 ? 'gastou mais que no mês anterior' : variacao < 0 ? 'gastou menos que no mês anterior' : 'igual ao mês anterior'),
      },
    ]);

    // Tabela (mais recente primeiro)
    $('#histTable').innerHTML = [...linhas].reverse().map((l) => {
      const idx = chaves.indexOf(l.chave);
      const prev = idx > 0 ? linhas[idx - 1].c.total : 0;
      let delta = '<span class="muted">—</span>';
      if (l.c.total > 0 && prev > 0) {
        const v = (l.c.total - prev) / prev;
        delta = `<span class="delta" data-dir="${v > 0 ? 'up' : v < 0 ? 'down' : 'flat'}">${v > 0 ? '↑' : v < 0 ? '↓' : '='} ${pct(Math.abs(v))}</span>`;
      }
      const vazio = '<span class="muted">—</span>';
      return `
        <tr data-mes="${l.chave}" class="${l.temDados ? '' : 'is-empty'} ${l.chave === state.mes ? 'is-current' : ''}" tabindex="0">
          <td>${nomeMes(l.chave)}</td>
          <td class="num">${l.c.temSaldo ? fmt(l.c.disponivel) : vazio}</td>
          <td class="num">${l.temDados ? fmt(l.c.total) : vazio}</td>
          <td class="num">${l.c.liquido ? fmt(l.c.liquido) : vazio}</td>
          <td class="num ${l.c.temSaldo && l.c.restante < 0 ? 'is-negative' : ''}">${l.c.temSaldo ? fmt(l.c.restante) : vazio}</td>
          <td class="num">${delta}</td>
        </tr>`;
    }).join('');

    // Legenda (sempre visível: identidade nunca só pela cor)
    const cats = Object.keys(CATEGORIAS);
    $('#historyLegend').innerHTML = cats.map((k) => `<li><span class="dot" style="--c:${corVar(k)}"></span>${CATEGORIAS[k].nome}</li>`).join('')
      + '<li><span class="line-swatch"></span>Disponível</li>';

    const semDados = comDados.length === 0;
    $('#historyEmpty').hidden = !semDados;
    $('#historyChart').style.visibility = semDados ? 'hidden' : 'visible';

    if (typeof Chart === 'undefined') return;

    const fundo = cssVar('--surface');
    const tinta = cssVar('--ink');
    const muted = cssVar('--muted');
    const grade = cssVar('--line-2');

    const datasets = cats.map((k) => ({
      type: 'bar',
      label: CATEGORIAS[k].nome,
      data: linhas.map((l) => l.c.porCat[k]),
      backgroundColor: cssVar(`--c-${k}`),
      borderColor: fundo,
      borderWidth: { top: 2 },
      borderSkipped: false,
      stack: 'gastos',
      maxBarThickness: 40,
      order: 2,
    }));
    datasets.push({
      type: 'line',
      label: 'Disponível',
      data: linhas.map((l) => (l.c.temSaldo ? l.c.disponivel : null)),
      borderColor: tinta,
      backgroundColor: fundo,
      borderWidth: 2,
      borderDash: [5, 4],
      pointRadius: 4,
      pointHoverRadius: 6,
      pointBorderWidth: 2,
      spanGaps: true,
      tension: 0,
      order: 1,
    });

    if (graficoHist) graficoHist.destroy();
    graficoHist = new Chart($('#historyChart'), {
      data: { labels: chaves.map(nomeMesCurto), datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        animation: { duration: 500 },
        scales: {
          x: {
            stacked: true,
            grid: { display: false },
            border: { color: cssVar('--line') },
            ticks: { color: muted, font: { family: 'Inter', size: 12 } },
          },
          y: {
            stacked: true,
            beginAtZero: true,
            grid: { color: grade },
            border: { display: false },
            ticks: { color: muted, font: { family: 'Inter', size: 12 }, maxTicksLimit: 6, callback: (v) => brlCompacto.format(v) },
          },
        },
        plugins: {
          legend: { display: false },
          tooltip: {
            ...estiloTooltip(),
            filter: (item) => item.raw !== null && (item.dataset.type === 'line' || item.raw > 0),
            callbacks: {
              title: (items) => nomeMes(chaves[items[0].dataIndex]),
              label: (ctx) => ` ${ctx.dataset.label}: ${fmt(ctx.raw)}`,
              footer: (items) => `Total gasto: ${fmt(linhas[items[0].dataIndex].c.total)}`,
            },
          },
        },
      },
    });
  }

  // =========================================================
  // Metas
  // =========================================================
  function renderMetas() {
    const metas = state.data.metas;
    const acumulado = totalAcumulado();
    const emMetas = metas.reduce((s, g) => s + Math.max(progressoMeta(g.id), 0), 0);

    $('#metasVazio').hidden = metas.length > 0;
    $('#metasResumo').hidden = metas.length === 0;
    $('#metasResumo').innerHTML = `Reserva total <b>${fmt(acumulado)}</b> · <b>${fmt(emMetas)}</b> destinados a metas · <b>${fmt(Math.max(acumulado - emMetas, 0))}</b> livre`;

    const atual = chaveMes(new Date());
    $('#metasLista').innerHTML = metas.map((g) => {
      const guardado = progressoMeta(g.id);
      const p = Math.max(Math.min(guardado / g.alvo, 1), 0);
      const falta = Math.max(g.alvo - guardado, 0);
      const concluida = falta === 0;

      let detalhe;
      if (concluida) {
        detalhe = 'Meta atingida. Parabéns!';
      } else if (g.prazo) {
        const mesesRestantes = mesesEntre(atual, g.prazo) + 1;
        detalhe = mesesRestantes > 0
          ? `Guarde <b>${fmt(falta / mesesRestantes)}</b> por mês para chegar lá até ${nomeMesExtenso(g.prazo)}.`
          : `O prazo (${nomeMesExtenso(g.prazo)}) passou. Faltam <b>${fmt(falta)}</b>.`;
      } else {
        detalhe = `Faltam <b>${fmt(falta)}</b>.`;
      }

      return `
        <article class="goal ${concluida ? 'is-done' : ''}" data-id="${g.id}">
          <header class="goal__head">
            <div>
              <h3>${escapeHtml(g.nome)}</h3>
              <span class="goal__meta">${g.prazo ? `Prazo: ${nomeMes(g.prazo)}` : 'Sem prazo'}</span>
            </div>
            <div class="goal__tools">
              <button class="icon-btn icon-btn--sm" type="button" data-goal-edit="${g.id}" aria-label="Editar meta">${ICONE_EDIT}</button>
              <button class="icon-btn icon-btn--sm" type="button" data-goal-del="${g.id}" aria-label="Excluir meta">${ICONE_DEL}</button>
            </div>
          </header>
          <div class="goal__values">
            <strong>${fmt(guardado)}</strong>
            <span>de ${fmt(g.alvo)}</span>
          </div>
          <div class="goal__track" aria-hidden="true"><div class="goal__fill" style="--w:${p * 100}%"></div></div>
          <div class="goal__foot">
            <span class="goal__pct">${concluida ? '<span class="status" data-nivel="ok">Concluída</span>' : pct(p)}</span>
            <p>${detalhe}</p>
          </div>
          <button class="btn btn--save goal__cta" type="button" data-goal-save="${g.id}">
            ${ICONE_COFRE} Guardar para esta meta
          </button>
        </article>`;
    }).join('');
  }

  function montarPrazos(selecionado = '') {
    const inicio = chaveMes(new Date());
    const opcoes = ['<option value="">Sem prazo</option>'];
    for (let i = 0; i < 72; i += 1) {
      const chave = deslocarMes(inicio, i);
      opcoes.push(`<option value="${chave}">${nomeMes(chave)}</option>`);
    }
    // Mantém um prazo antigo (já vencido) ao editar
    if (selecionado && selecionado < inicio) opcoes.splice(1, 0, `<option value="${selecionado}">${nomeMes(selecionado)}</option>`);
    $('#goalPrazo').innerHTML = opcoes.join('');
    $('#goalPrazo').value = selecionado;
  }

  function abrirMeta(id = null) {
    const g = id ? state.data.metas.find((x) => x.id === id) : null;
    state.editandoId = g ? g.id : null;
    $('#goalEyebrow').textContent = g ? 'Editar meta' : 'Nova meta';
    $('#goalTitle').textContent = g ? g.nome : 'Criar meta de economia';
    $('#goalSubmit').textContent = g ? 'Salvar alterações' : 'Criar meta';
    $('#goalNome').value = g ? g.nome : '';
    $('#goalAlvo').value = g ? valorParaInput(g.alvo) : '';
    montarPrazos(g ? g.prazo || '' : '');
    $('#goalErro').hidden = true;
    $('#goalDialog').showModal();
    $('#goalNome').focus();
  }

  function salvarMeta(e) {
    e.preventDefault();
    const nome = $('#goalNome').value.trim();
    const alvo = parseValor($('#goalAlvo').value);
    const prazo = $('#goalPrazo').value;

    if (!nome) return mostrarErro('#goalErro', 'Dê um nome à meta.');
    if (!Number.isFinite(alvo) || alvo <= 0) return mostrarErro('#goalErro', 'Informe o valor da meta. Ex.: 5.000,00');

    const editando = state.editandoId;
    if (editando) {
      const g = state.data.metas.find((x) => x.id === editando);
      if (g) Object.assign(g, { nome, alvo, prazo });
    } else {
      state.data.metas.push({ id: novoId(), nome, alvo, prazo, criadoEm: Date.now() });
    }
    salvar();
    $('#goalDialog').close();
    render();
    mostrarToast(editando ? 'Meta atualizada' : 'Meta criada');
  }

  function removerMeta(id) {
    const idx = state.data.metas.findIndex((g) => g.id === id);
    if (idx < 0) return;
    const [meta] = state.data.metas.splice(idx, 1);
    // Os valores guardados continuam na reserva; só perdem o vínculo com a meta
    const vinculados = todosGuardados().filter((g) => g.metaId === id);
    vinculados.forEach((g) => { delete g.metaId; });
    salvar();
    render();
    mostrarToast(`Meta “${meta.nome}” excluída`, () => {
      state.data.metas.splice(idx, 0, meta);
      vinculados.forEach((g) => { g.metaId = id; });
    });
  }

  // =========================================================
  // Modal: saldo
  // =========================================================
  function abrirSaldo(boasVindas = false) {
    const m = mes();
    $('#balanceEyebrow').textContent = boasVindas ? 'Bem-vindo' : nomeMes(state.mes);
    $('#balanceTitle').textContent = boasVindas
      ? `Qual é o seu saldo para ${MESES[partesMes(state.mes).mesNum - 1].toLowerCase()}?`
      : (m.saldo != null ? 'Editar saldo do mês' : 'Definir saldo do mês');
    $('#balanceInput').value = m.saldo != null ? valorParaInput(m.saldo) : '';
    $('#balanceErro').hidden = true;
    $('#balanceDialog').showModal();
    $('#balanceInput').focus();
  }

  function salvarSaldo(e) {
    e.preventDefault();
    const valor = parseValor($('#balanceInput').value);
    if (!Number.isFinite(valor) || valor < 0) {
      mostrarErro('#balanceErro', 'Informe um valor válido. Ex.: 3.500,00');
      return;
    }
    mesEditavel().saldo = valor;
    salvar();
    $('#balanceDialog').close();
    render();
  }

  // =========================================================
  // Modal: item (gasto)
  // =========================================================
  function montarCategorias() {
    $('#catPicker').innerHTML = Object.entries(CATEGORIAS).map(([k, c], idx) => `
      <div class="cat-option" style="--c:${corVar(k)}">
        <input type="radio" name="categoria" id="cat-${k}" value="${k}" ${idx === 0 ? 'checked' : ''}>
        <label for="cat-${k}"><span class="dot"></span>${c.nome}</label>
      </div>`).join('');

    $('#filterCat').innerHTML = '<option value="todas">Todos os lançamentos</option>'
      + '<optgroup label="Gastos por categoria">'
      + Object.entries(CATEGORIAS).map(([k, c]) => `<option value="${k}">${c.nome}</option>`).join('')
      + '</optgroup><optgroup label="Outros">'
      + '<option value="entradas">Entradas extras</option>'
      + '<option value="guardado">Guardado e resgates</option>'
      + '</optgroup>';
  }

  function abrirItem(id = null) {
    const item = id ? mes().itens.find((i) => i.id === id) : null;
    state.editandoId = item ? item.id : null;

    prepararData($('#itemData'), item?.data);
    $('#itemEyebrow').textContent = item ? 'Editar gasto' : `Novo gasto · ${nomeMes(state.mes)}`;
    $('#itemTitle').textContent = item ? item.nome : 'Adicionar item';
    $('#itemSubmit').textContent = item ? 'Salvar alterações' : 'Adicionar';
    $('#itemNome').value = item ? item.nome : '';
    $('#itemValor').value = item ? valorParaInput(item.valor) : '';
    const cat = item && CATEGORIAS[item.categoria] ? item.categoria : Object.keys(CATEGORIAS)[0];
    $(`#cat-${cat}`).checked = true;
    $('#itemErro').hidden = true;

    $('#itemDialog').showModal();
    $('#itemNome').focus();
  }

  function salvarItem(e) {
    e.preventDefault();
    const nome = $('#itemNome').value.trim();
    const valor = parseValor($('#itemValor').value);
    const data = $('#itemData').value;
    const categoria = document.querySelector('input[name="categoria"]:checked')?.value;

    if (!nome) return mostrarErro('#itemErro', 'Dê um nome ao gasto.');
    if (!Number.isFinite(valor) || valor <= 0) return mostrarErro('#itemErro', 'Informe um valor maior que zero. Ex.: 49,90');
    if (!data || !data.startsWith(state.mes)) return mostrarErro('#itemErro', `Escolha uma data dentro de ${nomeMes(state.mes)}.`);
    if (!CATEGORIAS[categoria]) return mostrarErro('#itemErro', 'Escolha uma categoria.');

    const editando = state.editandoId;
    const m = mesEditavel();
    if (editando) {
      const item = m.itens.find((i) => i.id === editando);
      if (item) Object.assign(item, { nome, valor, data, categoria });
    } else {
      m.itens.push({ id: novoId(), nome, valor, data, categoria, criadoEm: Date.now() });
    }

    salvar();
    $('#itemDialog').close();
    render();
    mostrarToast(editando ? 'Item atualizado' : 'Item adicionado');
  }

  // =========================================================
  // Modal: entrada extra
  // =========================================================
  function abrirEntrada(id = null) {
    const ent = id ? mes().entradas.find((x) => x.id === id) : null;
    state.editandoId = ent ? ent.id : null;

    prepararData($('#incomeData'), ent?.data);
    $('#incomeEyebrow').textContent = ent ? 'Editar entrada' : `Entrada extra · ${nomeMes(state.mes)}`;
    $('#incomeTitle').textContent = ent ? ent.nome : 'Adicionar entrada';
    $('#incomeSubmit').textContent = ent ? 'Salvar alterações' : 'Adicionar entrada';
    $('#incomeNome').value = ent ? ent.nome : '';
    $('#incomeValor').value = ent ? valorParaInput(ent.valor) : '';
    $('#incomeErro').hidden = true;

    $('#incomeDialog').showModal();
    $('#incomeNome').focus();
  }

  function salvarEntrada(e) {
    e.preventDefault();
    const nome = $('#incomeNome').value.trim();
    const valor = parseValor($('#incomeValor').value);
    const data = $('#incomeData').value;

    if (!nome) return mostrarErro('#incomeErro', 'Descreva a entrada. Ex.: Freela');
    if (!Number.isFinite(valor) || valor <= 0) return mostrarErro('#incomeErro', 'Informe um valor maior que zero. Ex.: 300,00');
    if (!data || !data.startsWith(state.mes)) return mostrarErro('#incomeErro', `Escolha uma data dentro de ${nomeMes(state.mes)}.`);

    const editando = state.editandoId;
    const m = mesEditavel();
    if (editando) {
      const ent = m.entradas.find((x) => x.id === editando);
      if (ent) Object.assign(ent, { nome, valor, data });
    } else {
      m.entradas.push({ id: novoId(), nome, valor, data, criadoEm: Date.now() });
    }

    salvar();
    $('#incomeDialog').close();
    render();
    mostrarToast(editando ? 'Entrada atualizada' : `${fmt(valor)} adicionado ao saldo`);
  }

  // =========================================================
  // Modal: guardar / resgatar
  // =========================================================
  // Desconta o lançamento em edição, para validar o novo valor corretamente
  function semEditado(total, filtro = () => true) {
    const editado = state.editandoId && mes().guardados.find((g) => g.id === state.editandoId);
    return total - (editado && filtro(editado) ? valorReserva(editado) : 0);
  }

  const reservaDisponivel = () => semEditado(totalAcumulado());
  const disponivelNaMeta = (metaId) => semEditado(progressoMeta(metaId), (g) => g.metaId === metaId);

  function definirOperacao(op) {
    state.operacao = op;
    const resgate = op === 'resgatar';
    const editando = Boolean(state.editandoId);
    $(`#op-${op}`).checked = true;
    $('#saveTitle').textContent = resgate ? 'Resgatar dinheiro' : 'Guardar dinheiro';
    $('#saveText').textContent = resgate
      ? `O valor resgatado volta para o saldo disponível do mês. Sua reserva tem ${fmt(reservaDisponivel())}.`
      : 'O valor guardado sai do saldo disponível do mês, mas não entra como gasto no gráfico.';
    $('#saveDescricao').placeholder = resgate ? 'Ex.: Conserto do carro, Emergência' : 'Ex.: Reserva de emergência, Viagem';
    $('#saveSubmit').textContent = editando ? 'Salvar alterações' : (resgate ? 'Resgatar' : 'Guardar');
    $('#saveErro').hidden = true;
  }

  function abrirGuardar(id = null, operacao = 'guardar', metaId = '') {
    const g = id ? mes().guardados.find((x) => x.id === id) : null;
    state.editandoId = g ? g.id : null;

    prepararData($('#saveData'), g?.data);
    $('#saveEyebrow').textContent = g ? 'Editar lançamento' : nomeMes(state.mes);
    $('#saveValor').value = g ? valorParaInput(g.valor) : '';
    $('#saveDescricao').value = g ? (g.descricao || '') : '';

    $('#saveMeta').innerHTML = '<option value="">Sem meta</option>'
      + state.data.metas.map((x) => `<option value="${x.id}">${escapeHtml(x.nome)}</option>`).join('');
    $('#saveMeta').value = g ? (g.metaId || '') : metaId;
    $('#saveMeta').closest('.field').hidden = state.data.metas.length === 0;

    definirOperacao(g ? (g.operacao || 'guardar') : operacao);

    $('#saveDialog').showModal();
    $('#saveValor').focus();
  }

  function salvarGuardado(e) {
    e.preventDefault();
    const valor = parseValor($('#saveValor').value);
    const data = $('#saveData').value;
    const descricao = $('#saveDescricao').value.trim();
    const metaId = $('#saveMeta').value;
    const operacao = state.operacao;

    if (!Number.isFinite(valor) || valor <= 0) return mostrarErro('#saveErro', 'Informe um valor maior que zero. Ex.: 100,00');
    if (!data || !data.startsWith(state.mes)) return mostrarErro('#saveErro', `Escolha uma data dentro de ${nomeMes(state.mes)}.`);
    if (operacao === 'resgatar') {
      if (valor > reservaDisponivel() + 0.001) {
        return mostrarErro('#saveErro', `Sua reserva tem ${fmt(Math.max(reservaDisponivel(), 0))}. Não é possível resgatar mais que isso.`);
      }
      if (metaId && valor > disponivelNaMeta(metaId) + 0.001) {
        return mostrarErro('#saveErro', `Esta meta tem ${fmt(Math.max(disponivelNaMeta(metaId), 0))} guardados. Não é possível resgatar mais que isso dela.`);
      }
    }

    const editando = state.editandoId;
    const m = mesEditavel();
    const dados = { valor, data, descricao, operacao };
    if (metaId) dados.metaId = metaId;

    if (editando) {
      const g = m.guardados.find((x) => x.id === editando);
      if (g) {
        delete g.metaId;
        Object.assign(g, dados);
      }
    } else {
      m.guardados.push({ id: novoId(), ...dados, criadoEm: Date.now() });
    }

    salvar();
    $('#saveDialog').close();
    render();
    if (editando) mostrarToast('Lançamento atualizado');
    else mostrarToast(operacao === 'resgatar' ? `${fmt(valor)} resgatado` : `${fmt(valor)} guardado`);
  }

  // =========================================================
  // Remoção de lançamentos
  // =========================================================
  function removerLancamento(id, tipo) {
    const chave = state.mes;
    const lista = mesEditavel(chave)[tipo];
    const idx = lista.findIndex((i) => i.id === id);
    if (idx < 0) return;
    const [item] = lista.splice(idx, 1);
    salvar();
    render();

    const nomes = {
      itens: item.nome,
      entradas: item.nome || 'Entrada extra',
      guardados: item.descricao || (item.operacao === 'resgatar' ? 'Resgate' : 'Valor guardado'),
    };
    mostrarToast(`“${nomes[tipo]}” removido`, () => mesEditavel(chave)[tipo].splice(idx, 0, item));
  }

  // =========================================================
  // Backup (exportar / importar)
  // =========================================================
  function contarLancamentos(data) {
    return Object.values(data.meses).reduce((s, m) => s
      + (m.itens || []).length + (m.guardados || []).length + (m.entradas || []).length, 0);
  }

  function temDados() {
    return contarLancamentos(state.data) > 0 || state.data.metas.length > 0;
  }

  function renderAvisoBackup() {
    // Ponto de aviso: há dados e nenhum backup nos últimos 30 dias
    const ultimo = state.data.ultimoBackup;
    const antigo = !ultimo || Date.now() - ultimo > 30 * 24 * 60 * 60 * 1000;
    $('#backupDot').hidden = !(temDados() && antigo);
  }

  function abrirBackup() {
    const ultimo = state.data.ultimoBackup;
    $('#backupStatus').innerHTML = ultimo
      ? `Último backup: <b>${new Date(ultimo).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}</b>`
      : 'Você ainda não fez nenhum backup.';
    $('#backupMain').hidden = false;
    $('#backupConfirm').hidden = true;
    $('#backupErro').hidden = true;
    state.importPendente = null;
    $('#backupDialog').showModal();
  }

  function exportarBackup() {
    state.data.ultimoBackup = Date.now();
    salvar();
    const conteudo = {
      app: 'financas',
      versao: 2,
      exportadoEm: new Date().toISOString(),
      dados: state.data,
    };
    const blob = new Blob([JSON.stringify(conteudo, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `financas-backup-${hojeISO()}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    $('#backupDialog').close();
    renderAvisoBackup();
    mostrarToast('Backup exportado');
  }

  function lerArquivoBackup(arquivo) {
    if (!arquivo) return;
    const leitor = new FileReader();
    leitor.onload = () => {
      let bruto;
      try {
        bruto = JSON.parse(leitor.result);
      } catch {
        return mostrarErro('#backupErro', 'Este arquivo não é um backup válido (JSON inválido).');
      }
      const dados = normalizar(bruto && bruto.dados ? bruto.dados : bruto);
      if (!dados) return mostrarErro('#backupErro', 'Este arquivo não parece ser um backup do Finanças.');

      state.importPendente = dados;
      const meses = Object.keys(dados.meses).sort();
      const exportadoEm = bruto.exportadoEm ? new Date(bruto.exportadoEm) : null;
      const itens = [
        exportadoEm && !Number.isNaN(exportadoEm.getTime()) ? `Exportado em <b>${exportadoEm.toLocaleDateString('pt-BR')}</b>` : null,
        `<b>${plural(meses.length, 'mês', 'meses')}</b>${meses.length ? ` (${nomeMes(meses[0])} a ${nomeMes(meses[meses.length - 1])})` : ''}`,
        `<b>${plural(contarLancamentos(dados), 'lançamento', 'lançamentos')}</b>`,
        `<b>${plural(dados.metas.length, 'meta', 'metas')}</b>`,
      ].filter(Boolean);
      $('#backupSummary').innerHTML = itens.map((t) => `<li>${t}</li>`).join('');
      $('#backupErro').hidden = true;
      $('#backupMain').hidden = true;
      $('#backupConfirm').hidden = false;
    };
    leitor.onerror = () => mostrarErro('#backupErro', 'Não foi possível ler o arquivo.');
    leitor.readAsText(arquivo);
  }

  function confirmarImportacao() {
    if (!state.importPendente) return;
    state.data = state.importPendente;
    state.importPendente = null;
    salvar();
    $('#backupDialog').close();
    render();
    mostrarToast('Backup importado com sucesso');
  }

  // =========================================================
  // Ajuda
  // =========================================================
  function ajudaJaVista() {
    try { return localStorage.getItem(AJUDA_KEY) === '1'; } catch { return false; }
  }

  function abrirAjuda(topico = null) {
    fecharDialogos();
    if (topico) {
      $$('#helpDialog .faq').forEach((d) => { d.open = d.id === `ajuda-${topico}`; });
    }
    $('#helpDialog').showModal();
    const aberto = topico && $(`#ajuda-${topico}`);
    if (aberto) aberto.scrollIntoView({ block: 'nearest' });

    // Some o destaque pulsante depois da primeira visita à ajuda
    try { localStorage.setItem(AJUDA_KEY, '1'); } catch { /* sem armazenamento */ }
    $('#helpPulse').hidden = true;
  }

  function fecharDialogos() {
    $$('dialog[open]').forEach((d) => d.close());
  }

  // =========================================================
  // Tema claro / escuro
  // =========================================================
  function temaSalvo() {
    try { return localStorage.getItem(TEMA_KEY); } catch { return null; }
  }

  function aplicarTema(tema, persistir = false) {
    document.documentElement.dataset.theme = tema;
    $('#themeToggle').setAttribute('aria-label', tema === 'dark' ? 'Ativar modo claro' : 'Ativar modo escuro');
    if (persistir) {
      try { localStorage.setItem(TEMA_KEY, tema); } catch { /* sem armazenamento */ }
    }
    if (grafico) renderGrafico(calcular(mes()));
    renderHistorico();
  }

  function alternarTema() {
    aplicarTema(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark', true);
  }

  // =========================================================
  // Feedback
  // =========================================================
  function mostrarErro(sel, msg) {
    const el = $(sel);
    el.textContent = msg;
    el.hidden = false;
  }

  // onUndo: função que reverte a ação (mostra o botão "Desfazer")
  function mostrarToast(msg, onUndo = null) {
    desfazer = onUndo;
    $('#toastMsg').textContent = msg;
    $('#toastUndo').hidden = !onUndo;
    $('#toast').hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(esconderToast, onUndo ? 5000 : 2200);
  }

  function esconderToast() {
    $('#toast').hidden = true;
    desfazer = null;
  }

  function executarDesfazer() {
    if (!desfazer) return;
    desfazer();
    salvar();
    render();
    esconderToast();
  }

  // =========================================================
  // Navegação
  // =========================================================
  function trocarView(view) {
    state.view = view;
    $$('.tab').forEach((t) => t.classList.toggle('is-active', t.dataset.view === view));
    $$('.view').forEach((v) => v.classList.toggle('is-active', v.id === `view-${view}`));
    window.scrollTo({ top: 0, behavior: 'smooth' });
    renderHistorico();
  }

  function trocarMes(delta) {
    state.mes = deslocarMes(state.mes, delta);
    render();
  }

  // =========================================================
  // Eventos
  // =========================================================
  function ligarEventos() {
    $$('.tab').forEach((t) => t.addEventListener('click', () => trocarView(t.dataset.view)));
    $('#prevMonth').addEventListener('click', () => trocarMes(-1));
    $('#nextMonth').addEventListener('click', () => trocarMes(1));
    $('#themeToggle').addEventListener('click', alternarTema);

    // Dashboard
    $('#openAdd').addEventListener('click', () => abrirItem());
    $('#openSave').addEventListener('click', () => abrirGuardar());
    $('#openRescue').addEventListener('click', () => abrirGuardar(null, 'resgatar'));
    $('#openIncome').addEventListener('click', () => abrirEntrada());
    $('#editBalance').addEventListener('click', () => abrirSaldo());

    // Formulários
    $('#balanceForm').addEventListener('submit', salvarSaldo);
    $('#itemForm').addEventListener('submit', salvarItem);
    $('#incomeForm').addEventListener('submit', salvarEntrada);
    $('#saveForm').addEventListener('submit', salvarGuardado);
    $('#goalForm').addEventListener('submit', salvarMeta);
    $$('input[name="operacao"]').forEach((r) => r.addEventListener('change', () => definirOperacao(r.value)));

    $('#printResumo').addEventListener('click', () => window.print());
    $('#toastUndo').addEventListener('click', executarDesfazer);

    $('#filterCat').addEventListener('change', (e) => {
      state.filtro = e.target.value;
      renderLista(mes());
    });

    $('#list').addEventListener('click', (e) => {
      const del = e.target.closest('[data-del]');
      if (del) return removerLancamento(del.dataset.del, del.dataset.tipo);
      const li = e.target.closest('.item');
      if (!li) return;
      const abrir = { itens: abrirItem, guardados: abrirGuardar, entradas: abrirEntrada }[li.dataset.tipo];
      abrir(li.dataset.id);
    });

    // Histórico
    $$('input[name="periodo"]').forEach((r) => r.addEventListener('change', () => {
      state.periodo = Number(r.value);
      renderHistorico();
    }));
    const abrirMesDaTabela = (tr) => {
      if (!tr) return;
      state.mes = tr.dataset.mes;
      render();
      trocarView('dashboard');
    };
    $('#histTable').addEventListener('click', (e) => abrirMesDaTabela(e.target.closest('tr[data-mes]')));
    $('#histTable').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') abrirMesDaTabela(e.target.closest('tr[data-mes]'));
    });

    // Metas
    $('#openGoal').addEventListener('click', () => abrirMeta());
    $('#metasLista').addEventListener('click', (e) => {
      const edit = e.target.closest('[data-goal-edit]');
      const del = e.target.closest('[data-goal-del]');
      const save = e.target.closest('[data-goal-save]');
      if (edit) abrirMeta(edit.dataset.goalEdit);
      else if (del) removerMeta(del.dataset.goalDel);
      else if (save) abrirGuardar(null, 'guardar', save.dataset.goalSave);
    });

    // Backup
    $('#openBackup').addEventListener('click', abrirBackup);
    $('#exportBackup').addEventListener('click', exportarBackup);
    $('#importBackup').addEventListener('click', () => $('#importFile').click());
    $('#importFile').addEventListener('change', (e) => {
      lerArquivoBackup(e.target.files[0]);
      e.target.value = '';
    });
    $('#cancelImport').addEventListener('click', abrirBackupInicio);
    $('#confirmImport').addEventListener('click', confirmarImportacao);

    // Ajuda
    $('#openHelp').addEventListener('click', () => abrirAjuda());
    // Só um tópico aberto por vez
    $$('#helpDialog .faq').forEach((d) => d.addEventListener('toggle', () => {
      if (d.open) $$('#helpDialog .faq').forEach((o) => { if (o !== d) o.open = false; });
    }));

    // Ações em estados vazios, rodapé e dentro da ajuda
    document.addEventListener('click', (e) => {
      const acao = e.target.closest('[data-action]')?.dataset.action;
      if (!acao) return;
      if (acao === 'add') abrirItem();
      else if (acao === 'goal') abrirMeta();
      else if (acao === 'help') abrirAjuda('inicio');
      else if (acao === 'backup') {
        fecharDialogos();
        abrirBackup();
      }
    });

    // Fechar modais (botões e clique fora)
    $$('dialog').forEach((dlg) => {
      dlg.addEventListener('click', (e) => {
        if (e.target === dlg || e.target.closest('[data-close]')) dlg.close();
      });
      dlg.addEventListener('close', () => { state.editandoId = null; });
    });

    // Segue o tema do sistema enquanto o usuário não escolher um
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    media.addEventListener?.('change', (e) => {
      if (!temaSalvo()) aplicarTema(e.matches ? 'dark' : 'light');
    });

    // Impressão sempre no tema claro
    let temaAntesDeImprimir = null;
    window.addEventListener('beforeprint', () => {
      temaAntesDeImprimir = document.documentElement.dataset.theme;
      document.documentElement.dataset.theme = 'light';
    });
    window.addEventListener('afterprint', () => {
      if (temaAntesDeImprimir) document.documentElement.dataset.theme = temaAntesDeImprimir;
    });
  }

  function abrirBackupInicio() {
    state.importPendente = null;
    $('#backupMain').hidden = false;
    $('#backupConfirm').hidden = true;
    $('#backupErro').hidden = true;
  }

  // =========================================================
  // Início
  // =========================================================
  montarCategorias();
  ligarEventos();
  $('#helpPulse').hidden = ajudaJaVista();
  aplicarTema(document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light');
  render();

  const inicial = mes();
  if (inicial.saldo == null && !inicial.itens.length && !inicial.guardados.length && !inicial.entradas.length) {
    abrirSaldo(true);
  }
})();
