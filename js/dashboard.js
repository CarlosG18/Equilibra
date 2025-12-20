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
    let highOverloadCount = 0; // > 15
    let warningOverloadCount = 0; // 10 - 15
    let availableCount = 0; // < 10

    members.forEach(m => {
        // Garante que overload existe (caso calculateOverload ainda não tenha rodado)
        const load = m.overload || 0; 
        totalOverload += load;

        if (load >= 15) highOverloadCount++;
        else if (load >= 10) warningOverloadCount++;
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
            <ul style="list-style: none; padding: 0;">
                <li style="margin-bottom: 10px; color: #2ecc71; font-weight: bold;"><i class="fas fa-circle"></i> ${low} membros com carga tranquila</li>
                <li style="margin-bottom: 10px; color: #f1c40f; font-weight: bold;"><i class="fas fa-circle"></i> ${medium} membros em atenção</li>
                <li style="margin-bottom: 10px; color: #e74c3c; font-weight: bold;"><i class="fas fa-circle"></i> ${high} membros sobrecarregados</li>
            </ul>
            <p style="color: #666; font-size: 0.9em;">Recomenda-se redistribuir tarefas dos membros em vermelho para os membros em verde.</p>
        `;
    }

    // Criar novo gráfico
    dashboardChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['Disponível (<10)', 'Atenção (10-15)', 'Crítico (>15)'],
            datasets: [{
                data: [low, medium, high],
                backgroundColor: ['#2ecc71', '#f1c40f', '#e74c3c'],
                borderWidth: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'bottom' }
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
                <span><i class="fas fa-user" style="color: #2ecc71;"></i> ${m.name}</span>
                <span class="badge badge-success">${m.overload || 0} pts</span>
            </div>
        `).join('') || '<small>Sem dados.</small>';
    }

    // B. Estado de Alerta (Membros com carga >= 15)
    const alertMembers = members.filter(m => (m.overload || 0) >= 15);
    const alertList = document.getElementById('alertMembers');
    if (alertList) {
        alertList.innerHTML = alertMembers.length > 0 ? alertMembers.map(m => `
            <div style="display: flex; justify-content: space-between; margin-bottom: 8px; color: #c0392b;">
                <strong><i class="fas fa-exclamation-circle"></i> ${m.name}</strong>
                <strong>${m.overload || 0} pts</strong>
            </div>
        `).join('') : '<div style="color: #2ecc71;"><i class="fas fa-check"></i> Ninguém sobrecarregado!</div>';
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
        const activeActs = extraActivities.filter(a => a.status === 'ativa').slice(-5); // Pega as 5 últimas
        activeActivitiesDiv.innerHTML = activeActs.map(a => `
            <div style="margin-bottom: 8px; border-left: 3px solid var(--pink); padding-left: 8px;">
                <div style="font-weight: bold;">${a.name}</div>
                <small style="color: #888;">${a.points} pts</small>
            </div>
        `).join('') || '<small>Nenhuma atividade ativa.</small>';
    }
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
        
        // Quantos projetos o membro participa (como dev/membro)
        const memberProjects = projects.filter(p => {
            const alocados = p.allocated_members || []; 
            return Array.isArray(alocados) && alocados.includes(member.id);
        });

        // Quantos projetos o membro gerencia (Scrum Master)
        const smProjects = projects.filter(p => p.scrum_master === member.id);
        
        // Quantas atividades extras ativas
        const memberActivities = extraActivities.filter(a => {
            const alocados = a.allocated_members || [];
            return a.status === 'ativa' && Array.isArray(alocados) && alocados.includes(member.id);
        });

        const overload = member.overload || 0;

        // --- LÓGICA VISUAL ---

        // A. Flag de Scrum Master (Roxa)
        const isScrumMaster = smProjects.length > 0;
        const smFlag = isScrumMaster 
            ? `<span style="
                  background-color: #f3e5f5; 
                  color: #7b1fa2; 
                  font-size: 0.7em; 
                  font-weight: bold;
                  padding: 2px 6px; 
                  border-radius: 4px; 
                  margin-left: 8px; 
                  border: 1px solid #e1bee7; 
                  vertical-align: middle;
                  display: inline-block;" 
                  title="Atua como Scrum Master em ${smProjects.length} projeto(s)">
                  <i class="fas fa-user-shield"></i> SM
               </span>` 
            : '';

        // B. Status Badge (Crítico/Atenção/Disponível)
        let statusBadge = '';
        let rowStyle = ''; 

        if (overload >= 15) {
            // CRÍTICO
            statusBadge = `
                <span style="background-color: #ffebee; color: #c62828; padding: 4px 10px; border-radius: 12px; font-size: 0.85em; font-weight: bold; border: 1px solid #ffcdd2; white-space: nowrap;">
                    <i class="fas fa-fire"></i> Crítico
                </span>`;
            rowStyle = 'background-color: #fffafa;'; // Fundo levemente avermelhado na linha
        } else if (overload >= 10) {
            // ATENÇÃO
            statusBadge = `
                <span style="background-color: #fff8e1; color: #f57f17; padding: 4px 10px; border-radius: 12px; font-size: 0.85em; font-weight: bold; border: 1px solid #ffecb3; white-space: nowrap;">
                    <i class="fas fa-exclamation-triangle"></i> Atenção
                </span>`;
        } else {
            // DISPONÍVEL
            statusBadge = `
                <span style="background-color: #e8f5e9; color: #2e7d32; padding: 4px 10px; border-radius: 12px; font-size: 0.85em; font-weight: bold; border: 1px solid #c8e6c9; white-space: nowrap;">
                    <i class="fas fa-check"></i> Disponível
                </span>`;
        }

        // --- CONSTRUÇÃO DO HTML DA LINHA ---
        const row = document.createElement('tr');
        if (rowStyle) row.style.cssText = rowStyle;

        row.innerHTML = `
            <td>
                <div style="font-weight: bold; color: var(--dark-blue); display: flex; align-items: center;">
                    ${member.name}
                    ${smFlag}
                </div>
                <small style="color: #888;">${member.role}</small>
            </td>
            <td style="text-align: center;">
                <span class="badge" style="background-color: #f0f2f5; color: #555; border: 1px solid #ddd; min-width: 30px;">
                    ${memberProjects.length}
                </span>
            </td>
            <td style="text-align: center;">
                <span class="badge" style="background-color: #f0f2f5; color: #555; border: 1px solid #ddd; min-width: 30px;">
                    ${memberActivities.length}
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
        `;
        tbody.appendChild(row);
    });
}

// Função auxiliar de cores
function getColorForLoad(value) {
    if (value >= 15) return '#e74c3c';
    if (value >= 10) return '#f1c40f';
    return '#2ecc71';
}