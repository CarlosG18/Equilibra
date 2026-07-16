// Variável global para armazenar a instância do gráfico (para poder destruir e recriar)
let dashboardChart = null;

async function updateDashboard() {
    // 1. Atualizar Contadores Simples (Cards do Topo)
    setText('totalMembers', members.length);
    setText('totalProjects', projects.length);
    
    // Contar atividades ativas apenas
    const activeActivities = extraActivities.filter(a => a.status === 'ativa');
    setText('activitiesCount', activeActivities.length);

    // Contar Scrum Masters únicos (filtrando nulos)
    const uniqueSMs = new Set(projects.map(p => p.scrum_master).filter(id => id));
    setText('scrumMastersCount', uniqueSMs.size);

    // 2. Cálculos de Estatísticas de Sobrecarga
    let totalOverload = 0;
    let highOverloadCount = 0;    // >= OVERLOAD_CRITICAL
    let warningOverloadCount = 0; // >= OVERLOAD_WARNING
    let availableCount = 0;       // abaixo disso

    members.forEach(m => {
        // Garante que overload existe (caso calculateOverload ainda não tenha rodado)
        const load = m.overload || 0; 
        totalOverload += load;

        if (load >= OVERLOAD_CRITICAL) highOverloadCount++;
        else if (load >= OVERLOAD_WARNING) warningOverloadCount++;
        else availableCount++;
    });

    const avg = members.length > 0 ? (totalOverload / members.length).toFixed(1) : 0;
    
    setText('avgOverload', avg);
    setText('highOverloadCount', highOverloadCount);
    setText('availableMembers', availableCount);

    // 3. Renderizar Gráfico e Listas Avançadas
    renderOverloadChart(availableCount, warningOverloadCount, highOverloadCount);
    renderDashboardLists();
    renderWorkloadTable(); // Tabela detalhada no final da página
}

// --- FUNÇÃO PARA O GRÁFICO (CHART.JS) ---
function renderOverloadChart(low, medium, high) {
    const ctx = document.getElementById('overloadChart');
    if (!ctx) return;

    // Se já existe gráfico, destruir para criar o novo com dados atualizados
    if (dashboardChart) {
        dashboardChart.destroy();
    }

    // Texto de resumo ao lado do gráfico
    const summaryDiv = document.getElementById('overloadTextSummary');
    if (summaryDiv) {
        summaryDiv.innerHTML = `
            <ul style="list-style: none; padding: 0; display: flex; flex-direction: column; gap: 8px;">
                <li style="color: #056aa1; font-weight: 600;"><i class="fas fa-circle" style="font-size:0.7em;"></i> ${low} membros com carga tranquila</li>
                <li style="color: #b4600a; font-weight: 600;"><i class="fas fa-circle" style="font-size:0.7em;"></i> ${medium} membros em atenção</li>
                <li style="color: #bb1f12; font-weight: 600;"><i class="fas fa-circle" style="font-size:0.7em;"></i> ${high} membros sobrecarregados</li>
            </ul>
            <p style="color: var(--text-2,#5b6273); font-size: 0.85em; margin-top: 12px;">Recomenda-se redistribuir tarefas dos membros em vermelho para os membros em verde.</p>
        `;
    }

    // Criar novo gráfico
    dashboardChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: [
                `Disponível (<${OVERLOAD_WARNING})`,
                `Atenção (${OVERLOAD_WARNING}-${OVERLOAD_CRITICAL - 1})`,
                `Crítico (${OVERLOAD_CRITICAL}+)`,
            ],
            datasets: [{
                data: [low, medium, high],
                backgroundColor: ['#0787cb', '#fc9c14', '#e23d28'],
                borderColor: '#ffffff',
                borderWidth: 3,
                hoverOffset: 6
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '64%',
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        usePointStyle: true,
                        pointStyle: 'circle',
                        padding: 16,
                        font: { family: "'Inter', sans-serif", size: 12 },
                        color: '#5b6273'
                    }
                }
            }
        }
    });
}

// --- ATUALIZA AS LISTAS DO DASHBOARD (ALERTAS, SM, DISPONÍVEIS) ---
function renderDashboardLists() {
    // A. Membros Mais Disponíveis (Top 5 com menor carga)
    const sortedByLowLoad = [...members].sort((a, b) => (a.overload || 0) - (b.overload || 0));
    const mostAvailableList = document.getElementById('mostAvailableMembers');
    if (mostAvailableList) {
        mostAvailableList.innerHTML = sortedByLowLoad.slice(0, 5).map(m => `
            <div style="display: flex; justify-content: space-between; margin-bottom: 8px; border-bottom: 1px solid #eee; padding-bottom: 5px;">
                <span><i class="fas fa-user" style="color: #0787cb;"></i> ${m.name}</span>
                <span class="badge badge-success">${m.overload || 0} pts</span>
            </div>
        `).join('') || '<small>Sem dados.</small>';
    }

    // B. Estado de Alerta (membros em carga crítica)
    const alertMembers = members.filter(m => (m.overload || 0) >= OVERLOAD_CRITICAL).sort((a, b) => (b.overload || 0) - (a.overload || 0));
    const alertList = document.getElementById('alertMembers');
    if (alertList) {
        alertList.innerHTML = alertMembers.length > 0 ? alertMembers.map(m => `
            <div style="display: flex; justify-content: space-between; margin-bottom: 8px; color: #bb1f12;">
                <strong><i class="fas fa-exclamation-circle"></i> ${m.name}</strong>
                <strong>${m.overload || 0} pts</strong>
            </div>
        `).join('') : '<div style="color: #056aa1;"><i class="fas fa-check"></i> Ninguém sobrecarregado!</div>';
    }

    // C. Lista de Scrum Masters e seus Projetos
    const smMap = {};
    projects.forEach(p => {
        if (p.scrum_master) {
            if (!smMap[p.scrum_master]) smMap[p.scrum_master] = [];
            smMap[p.scrum_master].push(p.name);
        }
    });

    const smList = document.getElementById('scrumMastersList');
    if (smList) {
        smList.innerHTML = Object.keys(smMap).map(smId => {
            const member = members.find(m => m.id === smId);
            const name = member ? member.name : 'Desconhecido';
            const projectsList = smMap[smId].join(', ');
            return `
                <div style="margin-bottom: 10px; font-size: 0.9em;">
                    <div style="font-weight: bold; color: var(--purple);">${name}</div>
                    <div style="color: #666; font-size: 0.85em;">Gerencia: ${projectsList}</div>
                </div>
            `;
        }).join('') || '<small>Nenhum SM alocado.</small>';
    }
    
    // D. Atividades Extras Ativas (Top 5 recentes)
    const activeActivitiesDiv = document.getElementById('activeActivitiesList');
    if (activeActivitiesDiv) {
        const activeActs = extraActivities.filter(a => a.status === 'ativa').slice(-5);
        activeActivitiesDiv.innerHTML = activeActs.map(a => `
            <div style="margin-bottom: 8px; border-left: 3px solid var(--pink); padding-left: 8px;">
                <div style="font-weight: bold;">${a.name}</div>
                <small style="color: #888;">${a.points} pts</small>
            </div>
        `).join('') || '<small>Nenhuma atividade ativa.</small>';
    }

    // E. Próximos prazos (todos os itens com deadline, ordenados)
    const upcomingDiv = document.getElementById('upcomingDeadlinesList');
    if (upcomingDiv) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const upcoming = [];

        projects.forEach(p => {
            if (p.deadline) upcoming.push({ name: p.name, deadline: p.deadline, icon: 'fa-diagram-project', color: '#0787cb' });
        });
        extraActivities.filter(a => a.status === 'ativa').forEach(a => {
            if (a.deadline) upcoming.push({ name: a.name, deadline: a.deadline, icon: 'fa-tasks', color: '#fc9c14' });
        });
        if (typeof projectTests !== 'undefined' && Array.isArray(projectTests)) {
            projectTests.filter(t => t.status === 'em_andamento').forEach(t => {
                if (t.deadline) upcoming.push({ name: t.name, deadline: t.deadline, icon: 'fa-vial', color: '#8893a3' });
            });
        }

        upcoming.sort((a, b) => a.deadline.localeCompare(b.deadline));

        upcomingDiv.innerHTML = upcoming.slice(0, 6).map(item => `
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; border-bottom: 1px solid #eee; padding-bottom: 5px;">
                <span style="font-size:0.88em; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; max-width:55%;">
                    <i class="fas ${item.icon}" style="color:${item.color}"></i> ${item.name}
                </span>
                <span>${formatDeadlineCountdown(item.deadline)}</span>
            </div>
        `).join('') || '<small style="color:#aaa">Nenhum prazo cadastrado.</small>';
    }
}

// --- TOOLTIPS DA TABELA DE CARGA ---
// Os pontos vêm das mesmas linhas que somam a coluna "Sobrecarga" — ver
// js/overload.js. Não recalcule nada aqui: o peso do SM é proporcional à
// complexidade do projeto, não um valor fixo.
const _WL_TOOLTIP_COLORS = {
    project:  '#043c73',
    sm:       '#0787cb',
    ux_ui:    '#c026d3',
    activity: '#fc9c14',
};

function _buildWorkloadTooltip(lines, title, titleIcon, emptyText) {
    if (lines.length === 0) {
        return `<div class="overload-tooltip-empty">${emptyText}</div>`;
    }
    const rows = lines.map(l => `
        <div class="overload-tooltip-row">
            <span class="overload-tooltip-label">
                <i class="fas ${l.icon}" style="color:${_WL_TOOLTIP_COLORS[l.type]};width:14px"></i> ${l.label}
            </span>
            <span class="overload-tooltip-pts">${l.pts} pt${l.pts !== 1 ? 's' : ''}</span>
        </div>`).join('');
    return `<div class="overload-tooltip-title"><i class="fas ${titleIcon}"></i> ${title}</div>${rows}`;
}

function buildProjectsTooltipHtml(lines) {
    const projectLines = lines.filter(l => ['project', 'sm', 'ux_ui'].includes(l.type));
    return _buildWorkloadTooltip(projectLines, 'Projetos', 'fa-project-diagram', 'Sem pontos de projeto');
}

function buildActivitiesTooltipHtml(lines) {
    const activityLines = lines.filter(l => l.type === 'activity');
    return _buildWorkloadTooltip(activityLines, 'Atividades Extras', 'fa-tasks', 'Sem atividades ativas');
}

function setupWorkloadTableTooltips() {
    const tbody = document.getElementById('membersWorkloadList');
    if (!tbody) return;

    tbody.addEventListener('mouseenter', function (e) {
        const cell = e.target.closest('[data-wl-tooltip]');
        if (!cell) return;
        const tip = _getOrCreateGlobalTooltip();
        tip.innerHTML = cell.dataset.wlTooltip;
        tip.style.display = 'block';
        _positionTooltip(tip, cell);
    }, true);

    tbody.addEventListener('mouseleave', function (e) {
        if (!e.target.closest('[data-wl-tooltip]')) return;
        const tip = document.getElementById('overloadGlobalTooltip');
        if (tip) tip.style.display = 'none';
    }, true);
}

// --- TABELA DETALHADA DE CARGA (COM FLAG SM E ORDENAÇÃO) ---
function renderWorkloadTable() {
    const tbody = document.getElementById('membersWorkloadList');

    // Verificação de segurança
    if (!tbody) return;

    tbody.innerHTML = '';

    // 1. ORDENAÇÃO: Cria cópia e ordena por sobrecarga (Do maior para o menor)
    const sortedMembers = [...members].sort((a, b) => {
        const loadA = a.overload || 0;
        const loadB = b.overload || 0;
        return loadB - loadA; // Decrescente
    });

    sortedMembers.forEach(member => {
        // --- CÁLCULOS DE DADOS ---

        // Linhas que compõem a sobrecarga do membro — a mesma fonte da coluna
        // "Sobrecarga" e do tooltip da lista de membros.
        const lines = overloadLinesFor(member.id);

        // Quantos projetos o membro gerencia (Scrum Master)
        const smProjects = projects.filter(p => p.scrum_master === member.id);

        const overload = member.overload || 0;

        // --- LÓGICA VISUAL ---

        // A. Flag de Scrum Master (Roxa)
        const isScrumMaster = smProjects.length > 0;
        const smFlag = isScrumMaster
            ? `<span style="
                  background-color: #e3f3fc;
                  color: #056aa1;
                  font-size: 0.7em;
                  font-weight: bold;
                  padding: 2px 6px;
                  border-radius: 4px;
                  margin-left: 8px;
                  border: 1px solid #c2e4f5;
                  vertical-align: middle;
                  display: inline-block;" 
                  title="Atua como Scrum Master em ${smProjects.length} projeto(s)">
                  <i class="fas fa-user-shield"></i> SM
               </span>` 
            : '';

        // B. Status Badge (Crítico/Atenção/Disponível)
        let statusBadge = '';
        let rowStyle = ''; 

        if (overload >= OVERLOAD_CRITICAL) {
            // CRÍTICO
            statusBadge = `
                <span style="background-color: #fdece9; color: #a51d1d; padding: 4px 10px; border-radius: 12px; font-size: 0.85em; font-weight: bold; border: 1px solid #f4c9c9; white-space: nowrap;">
                    <i class="fas fa-fire"></i> Crítico
                </span>`;
            rowStyle = 'background-color: #fffafa;'; // Fundo levemente avermelhado na linha
        } else if (overload >= OVERLOAD_WARNING) {
            // ATENÇÃO
            statusBadge = `
                <span style="background-color: #fff1da; color: #b4600a; padding: 4px 10px; border-radius: 12px; font-size: 0.85em; font-weight: bold; border: 1px solid #f8d9a6; white-space: nowrap;">
                    <i class="fas fa-exclamation-triangle"></i> Atenção
                </span>`;
        } else {
            // DISPONÍVEL
            statusBadge = `
                <span style="background-color: #e3f3fc; color: #056aa1; padding: 4px 10px; border-radius: 12px; font-size: 0.85em; font-weight: bold; border: 1px solid #c2e4f5; white-space: nowrap;">
                    <i class="fas fa-check"></i> Disponível
                </span>`;
        }

        // --- CONSTRUÇÃO DO HTML DA LINHA ---
        const row = document.createElement('tr');
        if (rowStyle) row.style.cssText = rowStyle;

        const projectsTooltip = buildProjectsTooltipHtml(lines).replace(/"/g, '&quot;');
        const activitiesTooltip = buildActivitiesTooltipHtml(lines).replace(/"/g, '&quot;');
        const earliestDeadline = getEarliestDeadlineForMember(member.id);

        // Contadores das colunas: contam as mesmas linhas que os tooltips
        // detalham, para o número e o detalhamento não discordarem.
        const projectsCount = lines.filter(l => ['project', 'sm', 'ux_ui'].includes(l.type)).length;
        const activitiesCount = lines.filter(l => l.type === 'activity').length;

        row.innerHTML = `
            <td>
                <div style="font-weight: bold; color: var(--dark-blue); display: flex; align-items: center;">
                    ${member.name}
                    ${smFlag}
                </div>
                <small style="color: #888;">${member.role}</small>
            </td>
            <td style="text-align: center;">
                <span class="badge wl-tooltip-anchor" data-wl-tooltip="${projectsTooltip}"
                      style="background-color: #f0f2f5; color: #555; border: 1px solid #ddd; min-width: 30px; cursor: default;">
                    ${projectsCount}
                    <i class="fas fa-info-circle" style="font-size:0.75em;opacity:0.5;margin-left:2px"></i>
                </span>
            </td>
            <td style="text-align: center;">
                <span class="badge wl-tooltip-anchor" data-wl-tooltip="${activitiesTooltip}"
                      style="background-color: #f0f2f5; color: #555; border: 1px solid #ddd; min-width: 30px; cursor: default;">
                    ${activitiesCount}
                    <i class="fas fa-info-circle" style="font-size:0.75em;opacity:0.5;margin-left:2px"></i>
                </span>
            </td>
            <td style="width: 25%;">
                <div style="display: flex; align-items: center; gap: 10px;">
                    <span style="font-weight: bold; width: 25px; text-align: right; color: #444;">${overload}</span>
                    <div style="flex-grow: 1; height: 8px; background: #eee; border-radius: 4px; overflow: hidden; box-shadow: inset 0 1px 2px rgba(0,0,0,0.05);">
                        <div style="width: ${Math.min((overload/20)*100, 100)}%; height: 100%; background: ${getColorForLoad(overload)}; border-radius: 4px; transition: width 0.5s ease-in-out;"></div>
                    </div>
                </div>
            </td>
            <td style="text-align: center;">
                ${statusBadge}
            </td>
            <td style="text-align: center; white-space: nowrap;">
                ${formatDeadlineCountdown(earliestDeadline)}
            </td>
        `;
        tbody.appendChild(row);
    });

    setupWorkloadTableTooltips();
}

// Retorna a data mais próxima (string ISO) entre todos os itens ativos do membro
function getEarliestDeadlineForMember(memberId) {
    const deadlines = [];
    projects.forEach(p => {
        const allocated = p.allocated_members || [];
        if ((allocated.includes(memberId) || p.scrum_master === memberId) && p.deadline) {
            deadlines.push(p.deadline);
        }
    });
    extraActivities.forEach(a => {
        const allocated = a.allocated_members || [];
        if (a.status === 'ativa' && allocated.includes(memberId) && a.deadline) {
            deadlines.push(a.deadline);
        }
    });
    if (typeof projectTests !== 'undefined' && Array.isArray(projectTests)) {
        projectTests.forEach(t => {
            if (t.status === 'em_andamento' && t.members && t.members.includes(memberId) && t.deadline) {
                deadlines.push(t.deadline);
            }
        });
    }
    if (deadlines.length === 0) return null;
    return deadlines.sort()[0];
}

// Função auxiliar de cores
function getColorForLoad(value) {
    if (value >= OVERLOAD_CRITICAL) return '#e23d28';
    if (value >= OVERLOAD_WARNING) return '#fc9c14';
    return '#0787cb';
}