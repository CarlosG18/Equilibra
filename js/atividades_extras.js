// FORMS

// --- ADICIONAR ATIVIDADE EXTRA ---
const activityForm = document.getElementById('activityForm');

if (activityForm) {
    activityForm.addEventListener('submit', async function (e) {
        e.preventDefault();

        const name = document.getElementById('activityName').value;
        const description = document.getElementById('activityDescription').value;
        const points = document.getElementById('activityPoints').value;
        const status = document.getElementById('activityStatus').value;

        // --- MUDANÇA: COLETAR CHECKBOXES ---
        const selectedMembers = [];
        document.querySelectorAll('input[name="activityMembers"]:checked').forEach(cb => {
            selectedMembers.push(cb.value);
        });

        // Validação
        if (selectedMembers.length === 0) {
            showFloatingAlert('Selecione pelo menos um membro responsável.', 'warning');
            return;
        }

        const submitBtn = document.getElementById('activitySubmitBtn');
        const originalText = submitBtn.innerHTML;
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> ...';
        submitBtn.disabled = true;

        try {
            let res;

            if (editingActivityId) {
                // ATUALIZAR
                res = await ProjectService.atualizarAtividade(
                    editingActivityId, name, description, selectedMembers, points, status
                );
                
                if (res.success) {
                    const index = extraActivities.findIndex(a => a.id === editingActivityId);
                    if (index !== -1) extraActivities[index] = res.data;
                    
                    showFloatingAlert('Atividade atualizada!', 'success');
                    cancelActivityEdit();
                }

            } else {
                // CRIAR
                res = await ProjectService.adicionarAtividade(
                    name, description, selectedMembers, points, status
                );

                if (res.success) {
                    extraActivities.push(res.data);
                    showFloatingAlert('Atividade criada!', 'success');
                    this.reset();
                    // Reset visual
                    document.getElementById('activityPointsValue').textContent = "3 pontos";
                    document.getElementById('activityPoints').value = 3;
                    updateActivityAllocationCheckboxes(); // Limpa checkboxes
                }
            }

            if (!res.success) showFloatingAlert('Erro: ' + res.error, 'error');
            else updateFullInterface();

        } catch (err) {
            console.error(err);
            showFloatingAlert('Erro inesperado.', 'error');
        } finally {
            if (editingActivityId) submitBtn.innerHTML = '<i class="fas fa-save"></i> Atualizar';
            else submitBtn.innerHTML = originalText;
            submitBtn.disabled = false;
        }
    });
}

// RENDERIZAÇÃO

// Renderizar lista de atividades extras
function renderActivities() {
    const activitiesList = document.getElementById('activitiesList');
    
    // Proteção caso o elemento não exista na página atual
    if (!activitiesList) return;
    
    activitiesList.innerHTML = '';

    if (extraActivities.length === 0) {
        activitiesList.innerHTML = `
            <tr>
                <td colspan="5" style="text-align: center; color: var(--gray); font-style: italic; padding: 20px;">
                    Nenhuma atividade extra cadastrada. Use o formulário acima para cadastrar atividades.
                </td>
            </tr>
        `;
        return;
    }

    extraActivities.forEach(activity => {
        // --- 1. LÓGICA DE MEMBROS (MÚLTIPLOS) ---
        // O Supabase retorna allocated_members como um array de IDs (strings)
        const memberIds = activity.allocated_members || [];
        let membersHtml = '';

        if (memberIds.length === 0) {
            membersHtml = '<span style="color: #aaa; font-style: italic;">Nenhum membro alocado</span>';
        } else {
            // Itera sobre os IDs, encontra o objeto membro correspondente e formata
            membersHtml = memberIds.map(id => {
                const m = members.find(mem => mem.id === id);
                if (m) {
                    // Exibe Nome e iniciais do cargo em tooltip ou pequeno
                    return `<div style="font-size: 0.9em; margin-bottom: 2px;">
                                <i class="fas fa-user-circle" style="color: var(--purple);"></i> 
                                <strong>${m.name}</strong> 
                                <span style="font-size: 0.8em; color: #666;">(${m.role})</span>
                            </div>`;
                }
                return '';
            }).join(''); // Junta todos os divs sem separador extra (já tem margin)
        }

        // --- 2. LÓGICA DE STATUS ---
        let statusClass = '';
        let statusText = '';

        switch (activity.status) {
            case 'ativa':
                statusClass = 'badge badge-success'; // Verde
                statusText = 'Ativa';
                break;
            case 'concluida':
                statusClass = 'badge badge-info'; // Azul/Info
                statusText = 'Concluída';
                break;
            case 'pendente':
                statusClass = 'badge badge-warning'; // Amarelo
                statusText = 'Pendente';
                break;
            default:
                statusClass = 'badge badge-secondary';
                statusText = activity.status || 'Desconhecido';
        }

        // --- 3. CONSTRUÇÃO DA LINHA ---
        const row = document.createElement('tr');

        row.innerHTML = `
            <td>
                <div style="font-weight: bold; color: var(--dark-blue);">${activity.name}</div>
                <small style="color: var(--gray); display: block; margin-top: 4px;">${activity.description || 'Sem descrição'}</small>
            </td>
            <td>
                ${membersHtml}
            </td>
            <td>
                <span class="activity-indicator" style="white-space: nowrap;">
                    ${activity.points} pts
                </span>
            </td>
            <td>
                <span class="${statusClass}">${statusText}</span>
            </td>
            <td>
                <div class="action-buttons">
                    <button class="btn btn-info btn-extra-small" onclick="editActivity('${activity.id}'); openModal('modalActivity')" title="Editar">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn btn-danger btn-extra-small" onclick="confirmDelete('activity', '${activity.id}', '${activity.name}')" title="Remover">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </td>
        `;

        activitiesList.appendChild(row);
    });
}


// CRUD

function editActivity(id) {
    const activity = extraActivities.find(a => a.id === id);
    if (!activity) return;

    document.getElementById('activityId').value = activity.id;
    document.getElementById('activityName').value = activity.name;
    document.getElementById('activityDescription').value = activity.description || '';
    document.getElementById('activityPoints').value = activity.points;
    document.getElementById('activityStatus').value = activity.status;
    document.getElementById('activityPointsValue').textContent = `${activity.points} pontos`;

    // --- PREENCHER CHECKBOXES ---
    // Reseta primeiro
    updateActivityAllocationCheckboxes();
    
    // Marca os que estão no array (allocated_members)
    const allocated = activity.allocated_members || [];
    const checkboxes = document.querySelectorAll('input[name="activityMembers"]');
    
    checkboxes.forEach(cb => {
        if (allocated.includes(cb.value)) {
            cb.checked = true;
        }
    });

    // UI
    editingActivityId = id;
    const submitBtn = document.getElementById('activitySubmitBtn');
    submitBtn.innerHTML = '<i class="fas fa-save"></i> Atualizar Atividade';
    submitBtn.classList.remove('btn-pink');
    submitBtn.classList.add('btn-warning');
    
    document.getElementById('activityCancelBtn').style.display = 'inline-block';
    document.getElementById('activityForm').scrollIntoView({ behavior: 'smooth' });
}

// Função para cancelar edição
function cancelActivityEdit() {
    editingActivityId = null;
    document.getElementById('activityForm').reset();
    
    // Reseta checkboxes
    updateActivityAllocationCheckboxes(); 

    const submitBtn = document.getElementById('activitySubmitBtn');
    submitBtn.innerHTML = '<i class="fas fa-save"></i> Cadastrar Atividade';
    submitBtn.classList.remove('btn-warning');
    submitBtn.classList.add('btn-pink');

    document.getElementById('activityCancelBtn').style.display = 'none';
}

// Função para deletar (Async)
async function deleteActivity(id) {
    // Adicione logica de confirmação se desejar
    const res = await ProjectService.removerAtividade(id);

    if (res.success) {
        extraActivities = extraActivities.filter(a => a.id !== id);
        showFloatingAlert('Atividade removida.', 'success');
        updateFullInterface();
    } else {
        showFloatingAlert('Erro ao remover: ' + res.error, 'error');
    }
}

// Gera os checkboxes de membros dentro do form de Atividades
function updateActivityAllocationCheckboxes() {
    const container = document.getElementById('activityMembersAllocation'); 
    
    if (!container) return;
    
    container.innerHTML = ''; // Limpa

    if (members.length === 0) {
        container.innerHTML = '<small>Nenhum membro cadastrado.</small>';
        return;
    }
    
    members.forEach(member => {
        const label = document.createElement('label');
        label.className = 'checkbox-label'; // Use a mesma classe CSS dos projetos
        label.style.display = 'block';
        label.style.marginBottom = '5px';
        
        label.innerHTML = `
            <input type="checkbox" name="activityMembers" value="${member.id}">
            <span>${member.name}</span>
        `;
        container.appendChild(label);
    });
}

// Função para renderizar o resumo (ORDENADO e COLORIDO)
function renderActivitiesSummary() {
    const container = document.getElementById('activitiesSummary');
    if (!container) return;

    container.innerHTML = '';

    // 1. PREPARAR DADOS (Calcular contagens antes de desenhar)
    const summaryData = members.map(member => {
        // Contar Atividades Extras Ativas
        const activityCount = extraActivities.filter(a => {
            const alocados = a.allocated_members || [];
            return a.status === 'ativa' && alocados.includes(member.id);
        }).length;

        // Contar Projetos (apenas informativo)
        const projectCount = projects.filter(p => {
            const alocados = p.allocated_members || [];
            return Array.isArray(alocados) && alocados.includes(member.id);
        }).length;

        return {
            member: member,
            activityCount: activityCount,
            projectCount: projectCount
        };
    });

    // 2. FILTRAR E ORDENAR
    // Filtra só quem tem atividades (> 0) e ordena do maior para o menor
    const activeMembers = summaryData
        .filter(item => item.activityCount > 0)
        .sort((a, b) => b.activityCount - a.activityCount);

    // Se lista vazia
    if (activeMembers.length === 0) {
        container.innerHTML = `
            <div style="text-align: center; padding: 20px; color: #999;">
                <i class="fas fa-check-circle" style="font-size: 2em; margin-bottom: 10px; opacity: 0.5;"></i><br>
                Nenhum membro com atividades extras ativas.
            </div>`;
        return;
    }

    // Container visual
    const listContainer = document.createElement('div');
    listContainer.style.display = 'flex';
    listContainer.style.flexDirection = 'column';
    listContainer.style.gap = '8px';

    // 3. RENDERIZAR COM CORES
    activeMembers.forEach((item, index) => {
        const { member, activityCount, projectCount } = item;

        // --- LÓGICA DE CORES E ÍCONES ---
        let badgeColor = '#2ecc71'; // Verde (Padrão)
        let borderColor = 'transparent';
        let rankIcon = '';

        if (activityCount >= 5) {
            badgeColor = '#e74c3c'; // Vermelho (Crítico)
            borderColor = '#e74c3c';
        } else if (activityCount >= 3) {
            badgeColor = '#f39c12'; // Laranja (Atenção)
            borderColor = '#f39c12';
        }

        // Top 3 Ícones
        if (index === 0) rankIcon = '🥇';
        else if (index === 1) rankIcon = '🥈';
        else if (index === 2) rankIcon = '🥉';
        else rankIcon = `<span style="color:#aaa; font-size:0.8em; font-weight:normal">#${index + 1}</span>`;

        // Criar o HTML
        const row = document.createElement('div');
        row.className = 'summary-item';
        // Estilo base do card
        row.style.cssText = `
            display: flex; 
            align-items: center; 
            justify-content: space-between; 
            padding: 12px; 
            background-color: #fff; 
            border-radius: 10px; 
            box-shadow: 0 2px 5px rgba(0,0,0,0.05); 
            border-left: 4px solid ${badgeColor}; /* Borda colorida na esquerda */
            transition: transform 0.2s;
        `;

        row.innerHTML = `
            <div style="display: flex; align-items: center; gap: 12px;">
                <div style="position: relative;">
                    <div style="width: 40px; height: 40px; background: #f4f6f8; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: var(--dark-blue); font-weight: bold; font-size: 0.9em; border: 2px solid ${borderColor === 'transparent' ? '#eee' : borderColor};">
                        ${getInitials(member.name)}
                    </div>
                    <div style="position: absolute; top: -5px; right: -5px; font-size: 0.8em; background: #fff; border-radius: 50%; width: 20px; height: 20px; display: flex; align-items: center; justify-content: center; box-shadow: 0 1px 2px rgba(0,0,0,0.2);">
                        ${rankIcon}
                    </div>
                </div>
                
                <div>
                    <div style="font-weight: bold; color: var(--dark-blue); font-size: 0.95em;">${member.name}</div>
                    <div style="font-size: 0.75em; color: #888;">${member.role}</div>
                </div>
            </div>
            
            <div style="display: flex; gap: 12px; align-items: center;">
                
                <div style="text-align: center; opacity: 0.6;">
                    <span style="font-weight: bold; color: var(--dark-blue); font-size: 0.9em;">${projectCount}</span>
                    <div style="font-size: 0.6em; text-transform: uppercase;">Proj</div>
                </div>

                <div style="width: 1px; height: 20px; background: #eee;"></div>

                <div style="text-align: center;">
                    <span style="background-color: ${badgeColor}; color: white; border-radius: 12px; padding: 2px 10px; font-weight: bold; font-size: 0.9em; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                        ${activityCount}
                    </span>
                    <div style="font-size: 0.6em; color: ${badgeColor}; font-weight: bold; margin-top: 2px;">Extra</div>
                </div>
            </div>
        `;

        listContainer.appendChild(row);
    });

    container.appendChild(listContainer);
}