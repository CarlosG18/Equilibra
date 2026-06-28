// ==========================================================================
// ANÁLISES — Projeção de capacidade da equipe para projetos futuros.
// Lê o estado global `members` (com `overload` já calculado por calculateOverload)
// e estima quais tipos de projeto a equipe consegue absorver agora.
// ==========================================================================

// Cenários de projeto: cada um exige X frontends e Y backends LIVRES.
const PROJECT_SCENARIOS = [
    {
        key: 'site',
        name: 'Site',
        icon: 'fa-globe',
        desc: 'Site institucional / multi-página',
        front: 2,
        back: 1,
        points: 5,   // sobrecarga estimada por membro alocado
        color: '#0787cb',
    },
    {
        key: 'lp_simples',
        name: 'LP Simples',
        icon: 'fa-file',
        desc: 'Landing page enxuta, poucas seções',
        front: 1,
        back: 1,
        points: 3,
        color: '#10b981',
    },
    {
        key: 'lp_complexa',
        name: 'LP Complexa',
        icon: 'fa-file-invoice',
        desc: 'Landing page com muitas seções/integrações',
        front: 2,
        back: 1,
        points: 6,
        color: '#fc9c14',
    },
    {
        key: 'sistema',
        name: 'Sistema (simplificado)',
        icon: 'fa-server',
        desc: 'Aplicação web com CRUD e regras de negócio',
        front: 2,
        back: 2,
        points: 8,
        color: '#7c3aed',
    },
];

// Retorna o limite de "livre" escolhido no select (padrão: < 10 pts = Disponível).
function _getLivreThreshold() {
    const sel = document.getElementById('analysisThreshold');
    const val = sel ? parseInt(sel.value) : 10;
    return isNaN(val) ? 10 : val;
}

// Membros de uma subárea que estão LIVRES, ordenados do mais ocioso ao mais carregado.
function _getFreeMembers(subarea, threshold) {
    return members
        .filter(m => m.subarea === subarea && (m.overload || 0) < threshold)
        .sort((a, b) => (a.overload || 0) - (b.overload || 0));
}

// Conta total de membros de uma subárea (independente da carga).
function _countSubarea(subarea) {
    return members.filter(m => m.subarea === subarea).length;
}

// ---- Cards de capacidade atual da equipe ----
function _renderAnalysisCapacity(threshold) {
    const container = document.getElementById('analysisCapacity');
    if (!container) return;

    const freeFront = _getFreeMembers('frontend', threshold);
    const freeBack = _getFreeMembers('backend', threshold);
    const freeUx = _getFreeMembers('ux_ui', threshold);

    const cards = [
        {
            icon: 'fa-laptop-code',
            color: '#0787cb',
            value: freeFront.length,
            total: _countSubarea('frontend'),
            label: 'Frontends livres',
        },
        {
            icon: 'fa-database',
            color: '#fc9c14',
            value: freeBack.length,
            total: _countSubarea('backend'),
            label: 'Backends livres',
        },
        {
            icon: 'fa-pen-ruler',
            color: '#0a374e',
            value: freeUx.length,
            total: _countSubarea('ux_ui'),
            label: 'UX/UI livres',
        },
    ];

    container.innerHTML = cards.map(c => `
        <div class="stat-card">
            <span class="stat-icon" style="background:${c.color}1a;color:${c.color}"><i class="fas ${c.icon}"></i></span>
            <div class="stat-body">
                <div class="stat-value">${c.value}<small style="font-size:0.5em;color:var(--text-2,#5b6273);font-weight:500"> / ${c.total}</small></div>
                <div class="stat-label">${c.label}</div>
            </div>
        </div>
    `).join('');
}

// Monta a lista de "chips" de membros sugeridos.
function _membersChips(list) {
    if (list.length === 0) return '<span style="color:#aaa;font-size:0.85em">—</span>';
    return list.map(m => `
        <span class="analysis-chip" title="${m.role}">
            <i class="fas fa-user" style="opacity:0.6"></i> ${m.name}
            <strong>${m.overload || 0}pt</strong>
        </span>
    `).join('');
}

// ---- Cards de cenários de projeto ----
function _renderAnalysisScenarios(threshold) {
    const container = document.getElementById('analysisScenarios');
    if (!container) return;

    const freeFront = _getFreeMembers('frontend', threshold);
    const freeBack = _getFreeMembers('backend', threshold);

    container.innerHTML = PROJECT_SCENARIOS.map(sc => {
        const haveFront = freeFront.length;
        const haveBack = freeBack.length;
        const okFront = haveFront >= sc.front;
        const okBack = haveBack >= sc.back;
        const viable = okFront && okBack;

        // Sugestão de time (os mais ociosos de cada subárea).
        const suggestedFront = freeFront.slice(0, sc.front);
        const suggestedBack = freeBack.slice(0, sc.back);

        // Status visual.
        let statusLabel, statusColor, statusIcon;
        if (viable) {
            statusLabel = 'Viável';
            statusColor = '#10b981';
            statusIcon = 'fa-circle-check';
        } else if (okFront || okBack) {
            statusLabel = 'Parcial';
            statusColor = '#fc9c14';
            statusIcon = 'fa-triangle-exclamation';
        } else {
            statusLabel = 'Inviável';
            statusColor = '#e23d28';
            statusIcon = 'fa-circle-xmark';
        }

        // Mensagem do que falta.
        const faltas = [];
        if (!okFront) faltas.push(`${sc.front - haveFront} frontend(s)`);
        if (!okBack) faltas.push(`${sc.back - haveBack} backend(s)`);
        const faltaMsg = faltas.length
            ? `<div class="analysis-missing"><i class="fas fa-circle-exclamation"></i> Faltam ${faltas.join(' e ')} livres</div>`
            : `<div class="analysis-ready"><i class="fas fa-thumbs-up"></i> Time disponível para iniciar</div>`;

        const reqBadge = (need, have, label, color) => `
            <span class="analysis-req" style="border-color:${color}55;color:${color};background:${color}12">
                ${need} ${label}
                <small style="opacity:0.7">(${have} livre${have !== 1 ? 's' : ''})</small>
            </span>`;

        return `
            <div class="analysis-card" style="border-top:3px solid ${sc.color}">
                <div class="analysis-card-head">
                    <div class="analysis-card-title">
                        <i class="fas ${sc.icon}" style="color:${sc.color}"></i>
                        <div>
                            <strong>${sc.name}</strong>
                            <small>${sc.desc}</small>
                        </div>
                    </div>
                    <span class="analysis-status" style="background:${statusColor}1a;color:${statusColor}">
                        <i class="fas ${statusIcon}"></i> ${statusLabel}
                    </span>
                </div>

                <div class="analysis-reqs">
                    ${reqBadge(sc.front, haveFront, 'Front', '#0787cb')}
                    ${reqBadge(sc.back, haveBack, 'Back', '#fc9c14')}
                </div>

                ${faltaMsg}

                <div class="analysis-team">
                    <div class="analysis-team-row">
                        <span class="analysis-team-label"><i class="fas fa-laptop-code" style="color:#0787cb"></i> Front</span>
                        <div class="analysis-chips">${_membersChips(suggestedFront)}</div>
                    </div>
                    <div class="analysis-team-row">
                        <span class="analysis-team-label"><i class="fas fa-database" style="color:#fc9c14"></i> Back</span>
                        <div class="analysis-chips">${_membersChips(suggestedBack)}</div>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

// Resumo: quantos cenários são viáveis agora.
function _renderAnalysisSummaryNote(threshold) {
    const container = document.getElementById('analysisScenarios');
    if (!container) return;
    const freeFront = _getFreeMembers('frontend', threshold);
    const freeBack = _getFreeMembers('backend', threshold);
    const viaveis = PROJECT_SCENARIOS.filter(sc =>
        freeFront.length >= sc.front && freeBack.length >= sc.back).length;

    const note = document.getElementById('analysisSummaryNote');
    const html = `<i class="fas fa-lightbulb"></i> Com a folga atual, a equipe consegue assumir
        <strong>${viaveis} de ${PROJECT_SCENARIOS.length}</strong> tipos de projeto sem sobrecarregar ninguém.`;
    if (note) {
        note.innerHTML = html;
    } else {
        const div = document.createElement('div');
        div.id = 'analysisSummaryNote';
        div.className = 'analysis-summary-note';
        div.innerHTML = html;
        container.parentNode.insertBefore(div, container);
    }
}

// ==========================================================================
// PROJEÇÃO TEMPORAL — capacidade da equipe mês a mês.
// Conforme projetos / atividades / testes vencem o prazo, os membros alocados
// são liberados e a folga aumenta.
// ==========================================================================

const ANALYSIS_MONTHS_AHEAD = 6;     // quantos meses projetar
const ANALYSIS_CRITICAL = 15;        // a partir daqui o membro é "crítico" (sobrecarregado)
let _selectedProduct = 'site';       // produto fixo escolhido pelo usuário (projeção mensal)
let _simMonthIndex = 0;              // mês de entrada escolhido na simulação (0 = atual)
let _simBasket = {};                // carrinho da simulação: { [productKey]: quantidade }

const _MONTH_NAMES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

// Um item (projeto/atividade/teste) ainda está ATIVO num dado corte de data?
// Sem prazo => continua indefinidamente (nunca libera).
function _isActiveAt(deadline, cutoff) {
    if (!deadline) return true;
    return new Date(deadline + 'T00:00:00') > cutoff;
}

// Recalcula o overload de cada membro considerando apenas itens ainda ativos em `cutoff`.
// Espelha a lógica de calculateOverload() em app.js, mas com filtro de prazo.
function _overloadAtCutoff(cutoff) {
    const load = {};
    members.forEach(m => { load[m.id] = 0; });

    // Projetos
    projects.forEach(p => {
        if (!_isActiveAt(p.deadline, cutoff)) return;
        const pts = parseInt(p.overload_points) || 0;
        (p.allocated_members || []).forEach(id => { if (load[id] != null) load[id] += pts; });
        const smId = p.scrum_master_id || p.scrum_master;
        if (smId && load[smId] != null) load[smId] += Math.max(1, Math.round(pts * 0.4)) + 2;
    });

    // Atividades extras
    extraActivities.forEach(a => {
        if (a.status !== 'ativa') return;
        if (!_isActiveAt(a.deadline, cutoff)) return;
        const pts = parseInt(a.points) || 0;
        const ids = Array.isArray(a.allocated_members)
            ? a.allocated_members
            : (a.member_id ? [a.member_id] : []);
        ids.forEach(id => { if (load[id] != null) load[id] += pts; });
    });

    // Testes
    if (typeof projectTests !== 'undefined' && Array.isArray(projectTests)) {
        projectTests.forEach(t => {
            if (t.status !== 'em_andamento') return;
            if (!_isActiveAt(t.deadline, cutoff)) return;
            const pts = parseInt(t.overload_points) || 0;
            (t.members || []).forEach(id => { if (load[id] != null) load[id] += pts; });
        });
    }

    // Carga pessoal e cargo (constantes ao longo do tempo)
    members.forEach(m => {
        if (m.role && m.role.toLowerCase().includes('gerente')) load[m.id] += 5;
        if (m.trabalho) load[m.id] += 4;
        const mats = parseInt(m.num_materias) || 0;
        if (mats > 0) load[m.id] += Math.round(mats * 0.5);
    });

    return load;
}

// Último instante do mês `i` à frente do mês atual (i=0 => fim do mês corrente).
function _cutoffForMonth(i) {
    const today = new Date();
    return new Date(today.getFullYear(), today.getMonth() + i + 1, 0, 23, 59, 59);
}

// Rótulo "Mai/2026" para o mês `i`.
function _monthLabel(i) {
    const today = new Date();
    const d = new Date(today.getFullYear(), today.getMonth() + i, 1);
    return `${_MONTH_NAMES[d.getMonth()]}/${d.getFullYear()}`;
}

// Quantas instâncias do produto cabem num dado mapa de cargas SEM ninguém ficar crítico.
// Retorna também a alocação de cada instância (para a simulação visual).
// Assigna gulosamente os membros mais ociosos; um membro só entra se está livre
// e se, após receber os pontos do produto, continuar abaixo do limite crítico.
function _howManyFit(loadMap, product, threshold) {
    const sim = {};
    members.forEach(m => { sim[m.id] = loadMap[m.id] || 0; });

    const allocations = [];
    let guard = 0;
    while (guard++ < 50) {
        const pick = (subarea, qty) => members
            .filter(m => m.subarea === subarea
                && sim[m.id] < threshold
                && sim[m.id] + product.points < ANALYSIS_CRITICAL)
            .sort((a, b) => sim[a.id] - sim[b.id])
            .slice(0, qty);

        const fronts = pick('frontend', product.front);
        const backs = pick('backend', product.back);
        if (fronts.length < product.front || backs.length < product.back) break;

        [...fronts, ...backs].forEach(m => { sim[m.id] += product.points; });
        allocations.push({
            front: fronts.map(m => m.id),
            back: backs.map(m => m.id),
        });
    }
    return { count: allocations.length, allocations };
}

// Simula a entrada de VÁRIOS projetos (lista de produtos) sobre um mapa de cargas,
// compartilhando o mesmo pool de membros. Aloca os mais pesados primeiro (mais conservador).
// Retorna o mapa de cargas simulado, os projetos que couberam e os que não couberam.
function _simulateBasket(loadMap, productList, threshold) {
    const sim = {};
    members.forEach(m => { sim[m.id] = loadMap[m.id] || 0; });

    const placed = [];
    const failed = [];
    const order = [...productList].sort((a, b) => b.points - a.points);

    order.forEach(prod => {
        const pick = (subarea, qty) => members
            .filter(m => m.subarea === subarea
                && sim[m.id] < threshold
                && sim[m.id] + prod.points < ANALYSIS_CRITICAL)
            .sort((a, b) => sim[a.id] - sim[b.id])
            .slice(0, qty);

        const fronts = pick('frontend', prod.front);
        const backs = pick('backend', prod.back);
        if (fronts.length < prod.front || backs.length < prod.back) {
            failed.push(prod);
            return;
        }
        [...fronts, ...backs].forEach(m => { sim[m.id] += prod.points; });
        placed.push({ prod, members: [...fronts, ...backs].map(m => m.id) });
    });

    return { sim, placed, failed };
}

// Membros livres de uma subárea num dado mapa de cargas, ordenados pelos mais ociosos.
function _freeFromLoad(loadMap, subarea, threshold) {
    return members
        .filter(m => m.subarea === subarea && (loadMap[m.id] || 0) < threshold)
        .sort((a, b) => (loadMap[a.id] || 0) - (loadMap[b.id] || 0));
}

// Itens (projeto/atividade/teste) que vencem entre prevCutoff (exclusivo) e cutoff (inclusivo).
function _itemsEndingBetween(prevCutoff, cutoff) {
    const ended = [];
    const within = (deadline) => {
        if (!deadline) return false;
        const d = new Date(deadline + 'T00:00:00');
        return d > prevCutoff && d <= cutoff;
    };
    const memberNames = (ids) => (ids || [])
        .map(id => { const m = members.find(mm => mm.id === id); return m ? m.name : null; })
        .filter(Boolean);

    projects.forEach(p => {
        if (within(p.deadline)) {
            const ids = [...(p.allocated_members || [])];
            const smId = p.scrum_master_id || p.scrum_master;
            if (smId && !ids.includes(smId)) ids.push(smId);
            ended.push({ name: p.name, icon: 'fa-diagram-project', members: memberNames(ids) });
        }
    });
    extraActivities.forEach(a => {
        if (a.status === 'ativa' && within(a.deadline)) {
            const ids = Array.isArray(a.allocated_members) ? a.allocated_members : (a.member_id ? [a.member_id] : []);
            ended.push({ name: a.name, icon: 'fa-tasks', members: memberNames(ids) });
        }
    });
    if (typeof projectTests !== 'undefined' && Array.isArray(projectTests)) {
        projectTests.forEach(t => {
            if (t.status === 'em_andamento' && within(t.deadline)) {
                ended.push({ name: t.name || 'Teste', icon: 'fa-vial', members: memberNames(t.members) });
            }
        });
    }
    return ended;
}

// ---- Abas de seleção de produto ----
function _renderProductTabs() {
    const container = document.getElementById('analysisProductTabs');
    if (!container) return;
    container.innerHTML = PROJECT_SCENARIOS.map(sc => `
        <button class="analysis-product-tab ${sc.key === _selectedProduct ? 'active' : ''}"
                style="${sc.key === _selectedProduct ? `border-color:${sc.color};color:${sc.color};background:${sc.color}12` : ''}"
                onclick="selectAnalysisProduct('${sc.key}')">
            <i class="fas ${sc.icon}"></i>
            ${sc.name}
            <small>${sc.front}F / ${sc.back}B</small>
        </button>
    `).join('');
}

// Troca de produto fixo (chamada pelos botões).
function selectAnalysisProduct(key) {
    _selectedProduct = key;
    const threshold = _getLivreThreshold();
    _renderProductTabs();
    _renderAnalysisMonths(threshold);
    _renderAnalysisSim(threshold);
}

// ---- Linha do tempo mensal para o produto escolhido ----
function _renderAnalysisMonths(threshold) {
    const container = document.getElementById('analysisMonths');
    if (!container) return;

    const product = PROJECT_SCENARIOS.find(p => p.key === _selectedProduct) || PROJECT_SCENARIOS[0];

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let prevCutoff = new Date(today.getTime() - 1); // antes de hoje
    let firstViableLabel = null;

    const cards = [];
    for (let i = 0; i < ANALYSIS_MONTHS_AHEAD; i++) {
        const cutoff = _cutoffForMonth(i);

        const load = _overloadAtCutoff(cutoff);
        const freeFront = _freeFromLoad(load, 'frontend', threshold);
        const freeBack = _freeFromLoad(load, 'backend', threshold);
        const okFront = freeFront.length >= product.front;
        const okBack = freeBack.length >= product.back;
        const viable = okFront && okBack;

        // Quantas instâncias do produto cabem neste mês sem ninguém ficar crítico.
        const fit = _howManyFit(load, product, threshold).count;

        const monthLabel = _monthLabel(i);
        if (viable && !firstViableLabel) firstViableLabel = monthLabel;

        const ended = _itemsEndingBetween(prevCutoff, cutoff);
        prevCutoff = cutoff;

        let statusColor, statusIcon, statusLabel;
        if (viable) { statusColor = '#10b981'; statusIcon = 'fa-circle-check'; statusLabel = 'Viável'; }
        else if (okFront || okBack) { statusColor = '#fc9c14'; statusIcon = 'fa-triangle-exclamation'; statusLabel = 'Parcial'; }
        else { statusColor = '#e23d28'; statusIcon = 'fa-circle-xmark'; statusLabel = 'Inviável'; }

        const endedHtml = ended.length
            ? ended.map(e => `
                <div class="analysis-month-ended" title="${e.members.join(', ')}">
                    <i class="fas ${e.icon}"></i> ${e.name}
                    ${e.members.length ? `<small>libera ${e.members.length}</small>` : ''}
                </div>`).join('')
            : '<div class="analysis-month-noend">Nada vence neste mês</div>';

        const fitColor = fit > 0 ? '#0a7a52' : '#a51d1d';
        cards.push(`
            <div class="analysis-month-card ${viable ? 'is-viable' : ''}">
                <div class="analysis-month-head">
                    <span class="analysis-month-name">${monthLabel}${i === 0 ? ' <small>(atual)</small>' : ''}</span>
                    <span class="analysis-month-status" style="background:${statusColor}1a;color:${statusColor}">
                        <i class="fas ${statusIcon}"></i> ${statusLabel}
                    </span>
                </div>
                <div class="analysis-month-fit" style="color:${fitColor}">
                    <i class="fas fa-layer-group"></i> Cabem <strong>${fit}</strong> ${product.name}
                </div>
                <div class="analysis-month-caps">
                    <span class="${okFront ? 'ok' : 'no'}"><i class="fas fa-laptop-code"></i> ${freeFront.length}/${product.front} Front</span>
                    <span class="${okBack ? 'ok' : 'no'}"><i class="fas fa-database"></i> ${freeBack.length}/${product.back} Back</span>
                </div>
                <div class="analysis-month-ends">
                    ${endedHtml}
                </div>
            </div>
        `);
    }

    const verdict = firstViableLabel
        ? `<i class="fas fa-flag-checkered"></i> <strong>${product.name}</strong> torna-se viável a partir de <strong>${firstViableLabel}</strong>.`
        : `<i class="fas fa-circle-exclamation"></i> <strong>${product.name}</strong> não fica viável nos próximos ${ANALYSIS_MONTHS_AHEAD} meses com a folga prevista.`;

    container.innerHTML = `
        <div class="analysis-verdict" style="border-left-color:${product.color}">${verdict}</div>
        <div class="analysis-months-track">${cards.join('')}</div>
    `;
}

// ==========================================================================
// SIMULAÇÃO "E SE?" — entrada de VÁRIOS projetos num mês escolhido.
// O usuário monta um carrinho (qtd por tipo de produto); a simulação aloca
// todos sobre o mesmo pool de membros e mostra a carga antes → depois.
// Também exibe o TETO MÁXIMO do mês (quantos de cada tipo cabem, isolados).
// Nada é salvo nem aplicado aos dados reais.
// ==========================================================================

// Troca o mês de entrada da simulação (chamado pelo select).
function setSimMonth(idx) {
    _simMonthIndex = parseInt(idx) || 0;
    _renderAnalysisSim(_getLivreThreshold());
}

// Ajusta a quantidade de um produto no carrinho (chamado pelos botões +/−).
function simAddProduct(key, delta) {
    _simBasket[key] = Math.max(0, (_simBasket[key] || 0) + delta);
    _renderAnalysisSim(_getLivreThreshold());
}

// Limpa o carrinho da simulação.
function simClearBasket() {
    _simBasket = {};
    _renderAnalysisSim(_getLivreThreshold());
}

function _statusForLoad(load) {
    if (load >= ANALYSIS_CRITICAL) return { label: 'Crítico', color: '#e23d28' };
    if (load >= 10) return { label: 'Atenção', color: '#fc9c14' };
    return { label: 'Disponível', color: '#0a7a52' };
}

function _renderAnalysisSim(threshold) {
    const container = document.getElementById('analysisSim');
    if (!container) return;

    const i = Math.min(_simMonthIndex, ANALYSIS_MONTHS_AHEAD - 1);
    const cutoff = _cutoffForMonth(i);
    const load = _overloadAtCutoff(cutoff);

    // --- Seletor de mês de entrada ---
    const monthOptions = Array.from({ length: ANALYSIS_MONTHS_AHEAD }, (_, idx) =>
        `<option value="${idx}" ${idx === i ? 'selected' : ''}>${_monthLabel(idx)}${idx === 0 ? ' (atual)' : ''}</option>`
    ).join('');

    // --- Teto máximo do mês: quantos de cada tipo cabem isoladamente ---
    const tetoChips = PROJECT_SCENARIOS.map(sc => {
        const max = _howManyFit(load, sc, threshold).count;
        return `<span class="analysis-teto-chip">
            <i class="fas ${sc.icon}" style="color:${sc.color}"></i> ${sc.name}: <strong>${max}</strong>
        </span>`;
    }).join('');

    // --- Steppers (carrinho) ---
    const steppers = PROJECT_SCENARIOS.map(sc => {
        const count = _simBasket[sc.key] || 0;
        return `
            <div class="analysis-stepper">
                <span class="analysis-stepper-name">
                    <i class="fas ${sc.icon}" style="color:${sc.color}"></i> ${sc.name}
                    <small>${sc.front}F/${sc.back}B · +${sc.points}</small>
                </span>
                <div class="analysis-stepper-ctrl">
                    <button type="button" onclick="simAddProduct('${sc.key}',-1)" ${count === 0 ? 'disabled' : ''}>−</button>
                    <span>${count}</span>
                    <button type="button" onclick="simAddProduct('${sc.key}',1)">+</button>
                </div>
            </div>`;
    }).join('');

    const controls = `
        <div class="analysis-sim-controls">
            <label>Entrada em
                <select class="form-control" onchange="setSimMonth(this.value)">${monthOptions}</select>
            </label>
            <div class="analysis-teto">
                <span class="analysis-teto-label"><i class="fas fa-arrow-up-wide-short"></i> Teto do mês (por tipo, isolado):</span>
                ${tetoChips}
            </div>
        </div>
        <div class="analysis-basket">
            <div class="analysis-basket-head">
                <strong><i class="fas fa-cart-plus"></i> Projetos a simular neste mês</strong>
                <button type="button" class="analysis-basket-clear" onclick="simClearBasket()">Limpar</button>
            </div>
            <div class="analysis-steppers">${steppers}</div>
        </div>`;

    // --- Expande o carrinho em uma lista de produtos ---
    const productList = [];
    PROJECT_SCENARIOS.forEach(sc => {
        const n = _simBasket[sc.key] || 0;
        for (let k = 0; k < n; k++) productList.push(sc);
    });

    if (productList.length === 0) {
        container.innerHTML = controls + `
            <p class="analysis-sim-hint"><i class="fas fa-circle-info"></i>
            Adicione projetos acima para simular a carga combinada em ${_monthLabel(i)}.</p>`;
        return;
    }

    // --- Simula a entrada combinada ---
    const { sim, placed, failed } = _simulateBasket(load, productList, threshold);

    // Membros cuja carga mudou.
    const changed = members
        .filter(m => (sim[m.id] || 0) !== (load[m.id] || 0))
        .sort((a, b) => (sim[b.id] || 0) - (sim[a.id] || 0));

    const areaTag = (sub) => sub === 'frontend'
        ? '<span class="analysis-area-tag" style="color:#0787cb;background:#0787cb14">Front</span>'
        : sub === 'backend'
            ? '<span class="analysis-area-tag" style="color:#fc9c14;background:#fc9c1414">Back</span>'
            : '<span class="analysis-area-tag" style="color:#0a374e;background:#0a374e14">UX/UI</span>';

    const rows = changed.map(m => {
        const before = load[m.id] || 0;
        const after = sim[m.id] || 0;
        const st = _statusForLoad(after);
        return `
            <tr>
                <td><strong>${m.name}</strong><br><small style="color:var(--text-2,#5b6273)">${m.role}</small></td>
                <td style="text-align:center">${areaTag(m.subarea)}</td>
                <td style="text-align:center">${before}</td>
                <td style="text-align:center;color:#0a7a52">+${after - before}</td>
                <td style="text-align:center;font-weight:700">${after}</td>
                <td style="text-align:center"><span style="color:${st.color};font-weight:600">${st.label}</span></td>
            </tr>`;
    }).join('');

    // --- Veredito ---
    let verdict;
    if (failed.length === 0) {
        verdict = `<div class="analysis-ready" style="margin-top:10px"><i class="fas fa-circle-check"></i>
            Todos os ${placed.length} projeto(s) cabem em ${_monthLabel(i)} sem ninguém ficar crítico.</div>`;
    } else {
        const failNames = failed.map(p => p.name).join(', ');
        verdict = `<div class="analysis-missing" style="margin-top:10px"><i class="fas fa-triangle-exclamation"></i>
            Cabem ${placed.length} de ${productList.length}. Sem capacidade para: <strong>${failNames}</strong>
            (não há membros livres suficientes).</div>`;
    }

    container.innerHTML = controls + `
        <div class="table-container" style="margin-top:12px">
            <table class="analysis-sim-table">
                <thead>
                    <tr>
                        <th>Membro</th><th style="text-align:center">Área</th>
                        <th style="text-align:center">Carga prevista</th>
                        <th style="text-align:center">+ Projetos</th>
                        <th style="text-align:center">Nova carga</th>
                        <th style="text-align:center">Status</th>
                    </tr>
                </thead>
                <tbody>${rows}</tbody>
            </table>
        </div>
        ${verdict}
        <p style="color:#aab2bf;font-size:0.8em;margin-top:8px"><i class="fas fa-lock"></i> Simulação — não altera os dados reais.</p>
    `;
}

// Função principal — chamada ao abrir a aba e a cada refresh geral.
function renderAnalises() {
    if (typeof members === 'undefined' || !Array.isArray(members)) return;
    const threshold = _getLivreThreshold();
    _renderAnalysisCapacity(threshold);
    _renderAnalysisSummaryNote(threshold);
    _renderAnalysisScenarios(threshold);
    _renderProductTabs();
    _renderAnalysisMonths(threshold);
    _renderAnalysisSim(threshold);
}
