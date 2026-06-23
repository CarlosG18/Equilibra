// ALOCAÇÃO INTELIGENTE

function renderSmartAllocationCheckboxes(selectedIds = []) {
    const container = document.getElementById('membersAllocation');
    if (!container) return;

    container.innerHTML = '';
    container.classList.add('checkbox-group');

    if (members.length === 0) {
        container.innerHTML = '<p style="color:#666; font-style:italic">Nenhum membro cadastrado.</p>';
        return;
    }

    const subareaConfig = [
        { key: 'ux_ui',    label: 'UX/UI',    icon: 'fa-paint-brush', color: '#0a374e' },
        { key: 'frontend', label: 'Frontend',  icon: 'fa-laptop-code', color: '#0787cb' },
        { key: 'backend',  label: 'Backend',   icon: 'fa-server',      color: '#fc9c14' },
        { key: '',         label: 'Sem subárea', icon: 'fa-user',       color: '#8893a3' },
    ];

    const rankIcons = ['🥇', '🥈', '🥉'];

    const header = document.createElement('div');
    header.className = 'smart-allocation-header';
    header.innerHTML = '<i class="fas fa-sort-amount-up"></i> Ordenado por menor sobrecarga (ranking inteligente)';
    container.appendChild(header);

    subareaConfig.forEach(({ key, label, icon, color }) => {
        const group = members
            .filter(m => (m.subarea || '') === key)
            .sort((a, b) => (a.overload || 0) - (b.overload || 0));

        if (group.length === 0) return;

        const groupHeader = document.createElement('div');
        groupHeader.className = 'smart-subarea-header';
        groupHeader.style.setProperty('--subarea-color', color);
        groupHeader.innerHTML = `<i class="fas ${icon}"></i> ${label} <span class="smart-subarea-count">${group.length}</span>`;
        container.appendChild(groupHeader);

        group.forEach((member, index) => {
            const overload = member.overload || 0;
            const overloadClass = getOverloadClassForMember(overload);
            const isChecked = selectedIds.includes(member.id) ? 'checked' : '';
            const rankIcon = index < 3 ? `<span class="smart-rank-icon">${rankIcons[index]}</span>` : '';

            const label = document.createElement('label');
            label.className = 'checkbox-label smart-allocation-label';
            label.setAttribute('data-overload', overload);
            label.innerHTML = `
                <input type="checkbox" name="projectMembers" value="${member.id}" ${isChecked}>
                <div class="smart-member-info">
                    <div class="smart-member-name">
                        ${rankIcon}
                        <span>${member.name}</span>
                        <small class="smart-member-role">${member.role}</small>
                    </div>
                    <span class="overload-indicator ${overloadClass} smart-overload-badge">${overload} pts</span>
                </div>
            `;
            container.appendChild(label);
        });
    });
}

// FORMS

// --- LISTENER DO FORMULÁRIO DE PROJETO (CRIAR E EDITAR) ---
const projectForm = document.getElementById('projectForm');

if (projectForm) {
    projectForm.addEventListener('submit', async function (e) {
        e.preventDefault();

        const name = document.getElementById('projectName').value;
        const descInput = document.getElementById('projectDescription');
        const desc = descInput ? descInput.value : '';
        const pointsInput = document.getElementById('overloadPoints') || document.getElementById('projectPoints');
        const points = pointsInput ? pointsInput.value : 0;

        const selectedMembers = [];
        document.querySelectorAll('input[name="projectMembers"]:checked').forEach(cb => {
            selectedMembers.push(cb.value);
        });

        const submitBtn = this.querySelector('button[type="submit"]');
        const originalText = submitBtn.innerHTML;
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processando...';
        submitBtn.disabled = true;

        try {
            if (editingProjectId) {
                await _salvarEdicaoProjeto(editingProjectId, name, desc, points, selectedMembers);
            } else {
                await _criarProjeto(name, desc, points, selectedMembers, this);
            }
        } catch (err) {
            console.error("Erro no processamento:", err);
            showFloatingAlert('Erro inesperado ao salvar projeto.', 'error');
        } finally {
            submitBtn.innerHTML = editingProjectId
                ? '<i class="fas fa-save"></i> Atualizar Projeto'
                : originalText || '<i class="fas fa-plus"></i> Criar Projeto';
            submitBtn.disabled = false;
        }
    });
}

async function _criarProjeto(name, desc, points, selectedMembers, form) {
    const res = await ProjectService.adicionarProjeto(name, desc, points, null, selectedMembers);
    if (res.success) {
        projects.push(res.data);
        showFloatingAlert('Projeto criado com sucesso!');
        form.reset();
        updateFullInterface();
    } else {
        showFloatingAlert('Erro: ' + res.error, 'error');
    }
}

async function _salvarEdicaoProjeto(id, name, desc, points, selectedMembers) {
    const originalProject = projects.find(p => p.id === id);
    const currentScrumMasterId = originalProject ? originalProject.scrum_master : null;

    const res = await ProjectService.atualizarProjeto(id, name, desc, points, currentScrumMasterId, selectedMembers);
    if (res.success) {
        const index = projects.findIndex(p => p.id === id);
        if (index !== -1) projects[index] = res.data;
        showFloatingAlert('Projeto atualizado com sucesso!');
        resetProjectFormState();
        updateFullInterface();
    } else {
        showFloatingAlert('Erro: ' + res.error, 'error');
    }
}

// REDENRIZAÇÃO

function renderProjects() {
    const container = document.getElementById('projectsList'); // Grid de projetos
    if (!container) return;
    container.innerHTML = '';

    projects.forEach(proj => {
        // Obter nome do SM
        const sm = members.find(m => m.id === proj.scrum_master);
        const smName = sm ? sm.name : 'Não definido';

        // Obter nomes da equipe
        const teamIds = proj.allocated_members || [];
        const teamHtml = teamIds.map(id => {
            const m = members.find(mem => mem.id === id);
            return m ? `<span class="member-tag">${m.name}</span>` : '';
        }).join('');

        const div = document.createElement('tr');
        div.className = 'project-card';
        div.innerHTML = `
            <td>
                <strong>${proj.name}</strong><br>
                <small style="color: var(--gray);">${proj.description}</small>
            </td>
            <td>
                <span class="overload-indicator ${getOverloadClassForMember(proj.overload_points)}">
                    ${proj.overload_points} pontos
                </span>
            </td>
            <td>
                ${sm ?
                `<span class="scrum-indicator">${smName}</span>` :
                '<span style="color: var(--gray); font-style: italic;">Não definido</span>'}
            </td>
            <td>${teamHtml || 'Nenhum membro alocado'}</td>
            <td>
                <div class="action-buttons">
                    <button class="btn btn-info btn-extra-small" onclick="editProject('${proj.id}'); openModal('modalProject')">
                        <i class="fas fa-edit"></i> Editar
                    </button>
                    <button class="btn btn-danger btn-extra-small" onclick="confirmDelete('project', '${proj.id}', '${proj.name.replace(/'/g, "\\'")}')">
                        <i class="fas fa-trash"></i> Remover
                    </button>
                </div>
            </td>
            `;
        container.appendChild(div);
    });
}

// CRUD

// Função para deletar projeto (Conectada ao Supabase)
async function deleteProject(id) {
    // 1. Confirmação visual (opcional, mas recomendada se não houver modal antes)
    // if (!confirm("Tem certeza que deseja excluir este projeto?")) return;

    // 2. Chamada ao serviço do Supabase
    const res = await ProjectService.removerProjeto(id);

    // 3. Verifica o resultado
    if (res.success) {
        // A. Atualiza o estado local (remove do array em memória)
        projects = projects.filter(project => project.id !== id);

        // B. Recalcula as sobrecargas (pois os membros agora têm menos trabalho)
        calculateOverload();

        // C. Atualiza toda a Interface
        renderProjects();       // Atualiza a lista de projetos
        renderMembers();        // Atualiza a lista de membros (para mostrar a nova sobrecarga)
        updateScrumSelects();   // Remove o projeto das opções se necessário
        updateDashboard();      // Atualiza os gráficos/números do topo
        renderScrumMasters();   // Atualiza lista de SMs
        
        // Se existir a função updateStats no seu código, mantenha-a:
        if (typeof updateStats === 'function') updateStats();

        showFloatingAlert('Projeto removido com sucesso!', 'success');
    } else {
        // D. Tratamento de erro
        console.error(res.error);
        showFloatingAlert('Erro ao remover projeto: ' + res.error, 'error');
    }
}

function editProject(id) {
    // Busca o projeto na lista local (que já veio do Supabase)
    const project = projects.find(p => p.id === id);
    if (!project) return;

    // 1. Preencher campos de texto e número
    document.getElementById('projectId').value = project.id; // Campo hidden se existir
    document.getElementById('projectName').value = project.name;
    
    // Tratamento para descrição (pode ser null)
    const descInput = document.getElementById('projectDescription');
    if (descInput) descInput.value = project.description || '';

    // Tratamento para pontos (Supabase usa snake_case: overload_points)
    const pointsVal = project.overload_points || 0;
    const pointsInput = document.getElementById('overloadPoints'); // ou 'projectPoints' dependendo do seu HTML
    if (pointsInput) pointsInput.value = pointsVal;
    
    // Atualiza o texto do slider
    const pointsDisplay = document.getElementById('pointsValue');
    if (pointsDisplay) pointsDisplay.textContent = `${pointsVal} pontos`;

    // 2. Preencher Scrum Master
    const smSelect = document.getElementById('scrumMasterSelect');
    if (smSelect) {
        smSelect.value = project.scrum_master || ""; // Seleciona o ID ou vazio
    }

    // 3. Preencher Membros Alocados (Checkboxes) com ranking inteligente
    const allocatedIDs = project.allocated_members || [];
    renderSmartAllocationCheckboxes(allocatedIDs);

    // 4. Alterar estado da UI para "Modo Edição"
    editingProjectId = id; // Variável global de controle
    
    const submitBtn = document.querySelector('#projectForm button[type="submit"]');
    if (submitBtn) {
        submitBtn.innerHTML = '<i class="fas fa-save"></i> Atualizar Projeto';
        submitBtn.classList.remove('btn-success'); // Opcional: mudar cor
        submitBtn.classList.add('btn-warning');    // Opcional
    }

    // Mostrar botão de cancelar
    const cancelBtn = document.getElementById('projectCancelBtn');
    if (cancelBtn) cancelBtn.style.display = 'inline-block';

    // Rolar até o formulário
    document.getElementById('projectForm').scrollIntoView({ behavior: 'smooth' });

    showFloatingAlert(`Editando projeto: ${project.name}`, 'info');
}

function resetProjectFormState() {
    editingProjectId = null;

    const form = document.getElementById('projectForm');
    if (form) {
        form.reset();
        const hiddenId = document.getElementById('projectId');
        if (hiddenId) hiddenId.value = '';
    }

    const submitBtn = document.querySelector('#projectForm button[type="submit"]');
    if(submitBtn) {
        submitBtn.innerHTML = '<i class="fas fa-plus"></i> Criar Projeto'; // Texto original
        submitBtn.classList.remove('btn-warning');
        // submitBtn.classList.add('btn-primary'); // Se usar classes bootstrap
    }

    const cancelBtn = document.getElementById('projectCancelBtn');
    if(cancelBtn) cancelBtn.style.display = 'none';

    renderSmartAllocationCheckboxes([]);
}

// Ligar o botão cancelar (adicione no setupCancelButtons ou no DOMContentLoaded)
const btnCancelProject = document.getElementById('projectCancelBtn');
if(btnCancelProject) {
    btnCancelProject.addEventListener('click', function(e) {
        e.preventDefault(); // Evita recarregar se for submit
        resetProjectFormState();
        showFloatingAlert('Edição cancelada.', 'info');
    });
}