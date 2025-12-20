
// Dados iniciais do sistema
let members = [];
let projects = [];
let extraActivities = [];

// Variáveis para controle de edição
let editingMemberId = null;
let editingProjectId = null;
let editingActivityId = null;
let itemToDelete = null;
let deleteType = null; // 'member', 'project', 'activity' ou 'scrum'

// Inicializar sistema
document.addEventListener('DOMContentLoaded', function () {
    // Configurar navegação por abas
    setupTabNavigation();

    // Configurar sliders de pontos
    setupPointsSliders();

    // Configurar botões de cancelamento
    setupCancelButtons();

    // Configurar modal de confirmação
    setupConfirmationModal();

    // Calcular sobrecarga inicial
    calculateOverload();

    // Renderizar conteúdo inicial
    renderMembers();
    renderProjects();
    updateAllocationCheckboxes();
    updateScrumSelects();
    updateActivitySelects();
    updateDashboard();
    updateStats();
    renderScrumMasters();
    renderActivities();
});

// Configurar navegação por abas
function setupTabNavigation() {
    const tabButtons = document.querySelectorAll('.tab-button');
    const tabIndicator = document.getElementById('tabIndicator');

    tabButtons.forEach(button => {
        button.addEventListener('click', function () {
            const tabId = this.getAttribute('data-tab');

            // Remover classe active de todos os botões e conteúdos
            tabButtons.forEach(btn => btn.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));

            // Adicionar classe active ao botão clicado
            this.classList.add('active');

            // Mostrar o conteúdo correspondente
            document.getElementById(tabId).classList.add('active');

            // Mover indicador de aba
            const buttonIndex = Array.from(tabButtons).indexOf(this);
            tabIndicator.style.transform = `translateX(${buttonIndex * 100}%)`;

            // Atualizar dashboard quando for ativada
            if (tabId === 'dashboard') {
                updateDashboard();
            } else if (tabId === 'scrum') {
                updateScrumSelects();
                renderScrumMasters();
            } else if (tabId === 'activities') {
                updateActivitySelects();
                renderActivities();
            }
        });
    });
}

// Configurar sliders de pontos
function setupPointsSliders() {
    const pointsSlider = document.getElementById('overloadPoints');
    const pointsValue = document.getErenderMembersListlementById('pointsValue');

    pointsSlider.addEventListener('input', function () {
        pointsValue.textContent = `${this.value} pontos`;
    });

    const activityPointsSlider = document.getElementById('activityPoints');
    const activityPointsValue = document.getElementById('activityPointsValue');

    activityPointsSlider.addEventListener('input', function () {
        activityPointsValue.textContent = `${this.value} ponto${this.value > 1 ? 's' : ''}`;
    });
}

// Configurar botões de cancelamento
function setupCancelButtons() {
    document.getElementById('memberCancelBtn').addEventListener('click', function () {
        cancelMemberEdit();
    });

    document.getElementById('projectCancelBtn').addEventListener('click', function () {
        cancelProjectEdit();
    });

    document.getElementById('activityCancelBtn').addEventListener('click', function () {
        cancelActivityEdit();
    });
}

// Configurar modal de confirmação
function setupConfirmationModal() {
    const confirmModal = document.getElementById('confirmModal');
    const confirmDeleteBtn = document.getElementById('confirmDeleteBtn');
    const cancelDeleteBtn = document.getElementById('cancelDeleteBtn');

    cancelDeleteBtn.addEventListener('click', function () {
        confirmModal.classList.remove('active');
        itemToDelete = null;
        deleteType = null;
    });

    confirmDeleteBtn.addEventListener('click', function () {
        if (deleteType === 'member' && itemToDelete !== null) {
            deleteMember(itemToDelete);
        } else if (deleteType === 'project' && itemToDelete !== null) {
            deleteProject(itemToDelete);
        } else if (deleteType === 'activity' && itemToDelete !== null) {
            deleteActivity(itemToDelete);
        } else if (deleteType === 'scrum' && itemToDelete !== null) {
            removeScrumMaster(itemToDelete);
        }

        confirmModal.classList.remove('active');
        itemToDelete = null;
        deleteType = null;
    });
}

// Formulário de cadastro/edição de membro
document.getElementById('memberForm').addEventListener('submit', function (e) {
    e.preventDefault();

    const id = document.getElementById('memberId').value;
    const name = document.getElementById('memberName').value;
    const role = document.getElementById('memberRole').value;
    const email = document.getElementById('memberEmail').value;

    if (editingMemberId) {
        // Atualizar membro existente
        const memberIndex = members.findIndex(m => m.id === editingMemberId);
        if (memberIndex !== -1) {
            members[memberIndex].name = name;
            members[memberIndex].role = role;
            members[memberIndex].email = email;

            showFloatingAlert(`Membro "${name}" atualizado com sucesso!`, 'success');
        }
    } else {
        // Adicionar novo membro
        const newId = members.length > 0 ? Math.max(...members.map(m => m.id)) + 1 : 1;

        members.push({
            id: newId,
            name: name,
            role: role,
            email: email,
            overload: 0
        });

        showFloatingAlert(`Membro "${name}" cadastrado com sucesso!`, 'success');
    }

    // Limpar formulário e resetar estado
    cancelMemberEdit();

    // Atualizar interface
    renderMembers();
    updateAllocationCheckboxes();
    updateScrumSelects();
    updateActivitySelects();
    calculateOverload();
    updateDashboard();
    updateStats();
});

// Formulário de cadastro/edição de projeto
document.getElementById('projectForm').addEventListener('submit', function (e) {
    e.preventDefault();

    const id = document.getElementById('projectId').value;
    const name = document.getElementById('projectName').value;
    const description = document.getElementById('projectDescription').value;
    const overloadPoints = parseInt(document.getElementById('overloadPoints').value);

    // Coletar membros alocados
    const allocatedMembers = [];
    const checkboxes = document.querySelectorAll('.member-checkbox:checked');
    checkboxes.forEach(checkbox => {
        allocatedMembers.push(parseInt(checkbox.value));
    });

    if (editingProjectId) {
        // Atualizar projeto existente
        const projectIndex = projects.findIndex(p => p.id === editingProjectId);
        if (projectIndex !== -1) {
            projects[projectIndex].name = name;
            projects[projectIndex].description = description;
            projects[projectIndex].overloadPoints = overloadPoints;
            projects[projectIndex].allocatedMembers = allocatedMembers;

            showFloatingAlert(`Projeto "${name}" atualizado com sucesso!`, 'success');
        }
    } else {
        // Adicionar novo projeto
        const newId = projects.length > 0 ? Math.max(...projects.map(p => p.id)) + 1 : 1;

        projects.push({
            id: newId,
            name: name,
            description: description,
            overloadPoints: overloadPoints,
            allocatedMembers: allocatedMembers,
            scrumMaster: null // Inicialmente sem Scrum Master
        });

        showFloatingAlert(`Projeto "${name}" cadastrado com sucesso!`, 'success');
    }

    // Limpar formulário e resetar estado
    cancelProjectEdit();

    // Atualizar interface
    renderProjects();
    updateScrumSelects();
    calculateOverload();
    updateDashboard();
    updateStats();
    renderScrumMasters();
});

// Formulário de Scrum Master
document.getElementById('scrumForm').addEventListener('submit', function (e) {
    e.preventDefault();

    const projectId = parseInt(document.getElementById('scrumProject').value);
    const scrumMasterId = parseInt(document.getElementById('scrumMaster').value);

    if (!projectId || !scrumMasterId) {
        showFloatingAlert('Por favor, selecione um projeto e um Scrum Master.', 'warning');
        return;
    }

    // Verificar se o membro está alocado no projeto
    const project = projects.find(p => p.id === projectId);
    if (!project) {
        showFloatingAlert('Projeto não encontrado.', 'error');
        return;
    }

    if (!project.allocatedMembers.includes(scrumMasterId)) {
        showFloatingAlert('O Scrum Master deve estar alocado no projeto.', 'warning');
        return;
    }

    // Definir Scrum Master
    project.scrumMaster = scrumMasterId;

    // Atualizar interface
    renderProjects();
    renderScrumMasters();
    calculateOverload();
    updateDashboard();
    updateStats();

    const projectName = project.name;
    const memberName = members.find(m => m.id === scrumMasterId).name;

    showFloatingAlert(`${memberName} definido como Scrum Master do projeto "${projectName}"!`, 'success');

    // Limpar formulário
    document.getElementById('scrumForm').reset();
});

// Formulário de atividade extra
document.getElementById('activityForm').addEventListener('submit', function (e) {
    e.preventDefault();

    const id = document.getElementById('activityId').value;
    const name = document.getElementById('activityName').value;
    const description = document.getElementById('activityDescription').value;
    const memberId = parseInt(document.getElementById('activityMember').value);
    const points = parseInt(document.getElementById('activityPoints').value);
    const status = document.getElementById('activityStatus').value;

    if (editingActivityId) {
        // Atualizar atividade existente
        const activityIndex = extraActivities.findIndex(a => a.id === editingActivityId);
        if (activityIndex !== -1) {
            extraActivities[activityIndex].name = name;
            extraActivities[activityIndex].description = description;
            extraActivities[activityIndex].memberId = memberId;
            extraActivities[activityIndex].points = points;
            extraActivities[activityIndex].status = status;

            showFloatingAlert(`Atividade "${name}" atualizada com sucesso!`, 'success');
        }
    } else {
        // Adicionar nova atividade
        const newId = extraActivities.length > 0 ? Math.max(...extraActivities.map(a => a.id)) + 1 : 1;

        extraActivities.push({
            id: newId,
            name: name,
            description: description,
            memberId: memberId,
            points: points,
            status: status
        });

        showFloatingAlert(`Atividade "${name}" cadastrada com sucesso!`, 'success');
    }

    // Limpar formulário e resetar estado
    cancelActivityEdit();

    // Atualizar interface
    renderActivities();
    calculateOverload();
    updateDashboard();
    updateStats();
});

// Função para editar membro
function editMember(id) {
    const member = members.find(m => m.id === id);
    if (!member) return;

    // Preencher formulário com dados do membro
    document.getElementById('memberId').value = member.id;
    document.getElementById('memberName').value = member.name;
    document.getElementById('memberRole').value = member.role;
    document.getElementById('memberEmail').value = member.email;

    // Alterar estado para edição
    editingMemberId = id;
    document.getElementById('memberSubmitBtn').innerHTML = '<i class="fas fa-save"></i> Atualizar Membro';
    document.getElementById('memberCancelBtn').style.display = 'inline-block';

    // Rolar para o topo do formulário
    document.getElementById('memberForm').scrollIntoView({ behavior: 'smooth' });

    showFloatingAlert(`Editando membro: ${member.name}`, 'info');
}

// Função para cancelar edição de membro
function cancelMemberEdit() {
    document.getElementById('memberForm').reset();
    document.getElementById('memberId').value = '';
    editingMemberId = null;
    document.getElementById('memberSubmitBtn').innerHTML = '<i class="fas fa-save"></i> Cadastrar Membro';
    document.getElementById('memberCancelBtn').style.display = 'none';
}

// Função para editar projeto
function editProject(id) {
    const project = projects.find(p => p.id === id);
    if (!project) return;

    // Preencher formulário com dados do projeto
    document.getElementById('projectId').value = project.id;
    document.getElementById('projectName').value = project.name;
    document.getElementById('projectDescription').value = project.description;
    document.getElementById('overloadPoints').value = project.overloadPoints;
    document.getElementById('pointsValue').textContent = `${project.overloadPoints} pontos`;

    // Alterar estado para edição
    editingProjectId = id;
    document.getElementById('projectSubmitBtn').innerHTML = '<i class="fas fa-save"></i> Atualizar Projeto';
    document.getElementById('projectCancelBtn').style.display = 'inline-block';

    // Atualizar checkboxes de alocação
    updateAllocationCheckboxes(project.allocatedMembers);

    // Rolar para o topo do formulário
    document.getElementById('projectForm').scrollIntoView({ behavior: 'smooth' });

    showFloatingAlert(`Editando projeto: ${project.name}`, 'info');
}

// Função para cancelar edição de projeto
function cancelProjectEdit() {
    document.getElementById('projectForm').reset();
    document.getElementById('projectId').value = '';
    document.getElementById('pointsValue').textContent = '5 pontos';
    editingProjectId = null;
    document.getElementById('projectSubmitBtn').innerHTML = '<i class="fas fa-save"></i> Cadastrar Projeto';
    document.getElementById('projectCancelBtn').style.display = 'none';

    // Atualizar checkboxes sem seleções
    updateAllocationCheckboxes();
}

// Função para editar atividade
function editActivity(id) {
    const activity = extraActivities.find(a => a.id === id);
    if (!activity) return;

    // Preencher formulário com dados da atividade
    document.getElementById('activityId').value = activity.id;
    document.getElementById('activityName').value = activity.name;
    document.getElementById('activityDescription').value = activity.description;
    document.getElementById('activityMember').value = activity.memberId;
    document.getElementById('activityPoints').value = activity.points;
    document.getElementById('activityPointsValue').textContent = `${activity.points} ponto${activity.points > 1 ? 's' : ''}`;
    document.getElementById('activityStatus').value = activity.status;

    // Alterar estado para edição
    editingActivityId = id;
    document.getElementById('activitySubmitBtn').innerHTML = '<i class="fas fa-save"></i> Atualizar Atividade';
    document.getElementById('activityCancelBtn').style.display = 'inline-block';

    // Rolar para o topo do formulário
    document.getElementById('activityForm').scrollIntoView({ behavior: 'smooth' });

    showFloatingAlert(`Editando atividade: ${activity.name}`, 'info');
}

// Função para cancelar edição de atividade
function cancelActivityEdit() {
    document.getElementById('activityForm').reset();
    document.getElementById('activityId').value = '';
    document.getElementById('activityPointsValue').textContent = '3 pontos';
    editingActivityId = null;
    document.getElementById('activitySubmitBtn').innerHTML = '<i class="fas fa-save"></i> Cadastrar Atividade';
    document.getElementById('activityCancelBtn').style.display = 'none';
}

// Renderizar lista de membros
function renderMembers() {
    const membersList = document.getElementById('membersList');
    membersList.innerHTML = '';

    members.forEach(member => {
        const row = document.createElement('tr');

        // Determinar classe de sobrecarga
        const overloadClass = getOverloadClassForMember(member.overload);

        row.innerHTML = `
            <td>
                <strong>${member.name}</strong>
            </td>
            <td>${member.role}</td>
            <td>${member.email}</td>
            <td>
                <span class="overload-indicator ${overloadClass}">${member.overload} pontos</span>
            </td>
            <td>
                <div class="action-buttons">
                    <button class="btn btn-info btn-extra-small" onclick="editMember(${member.id})">
                        <i class="fas fa-edit"></i> Editar
                    </button>
                    <button class="btn btn-danger btn-extra-small" onclick="confirmDelete('member', ${member.id}, '${member.name}')">
                        <i class="fas fa-trash"></i> Remover
                    </button>
                </div>
            </td>
        `;

        membersList.appendChild(row);
    });
}

// Renderizar lista de projetos
function renderProjects() {
    const projectsList = document.getElementById('projectsList');
    projectsList.innerHTML = '';

    projects.forEach(project => {
        // Obter nomes dos membros alocados
        const allocatedMemberNames = project.allocatedMembers.map(memberId => {
            const member = members.find(m => m.id === memberId);
            return member ? member.name : 'Membro não encontrado';
        }).join(', ');

        // Obter nome do Scrum Master
        const scrumMasterName = project.scrumMaster ?
            members.find(m => m.id === project.scrumMaster)?.name : 'Não definido';

        const row = document.createElement('tr');

        row.innerHTML = `
            <td>
                <strong>${project.name}</strong><br>
                <small style="color: var(--gray);">${project.description}</small>
            </td>
            <td>
                <span class="overload-indicator ${getOverloadClass(project.overloadPoints)}">
                    ${project.overloadPoints} pontos
                </span>
            </td>
            <td>
                ${scrumMasterName !== 'Não definido' ?
                `<span class="scrum-indicator">${scrumMasterName}</span>` :
                '<span style="color: var(--gray); font-style: italic;">Não definido</span>'}
            </td>
            <td>${allocatedMemberNames || 'Nenhum membro alocado'}</td>
            <td>
                <div class="action-buttons">
                    <button class="btn btn-info btn-extra-small" onclick="editProject(${project.id})">
                        <i class="fas fa-edit"></i> Editar
                    </button>
                    <button class="btn btn-danger btn-extra-small" onclick="confirmDelete('project', ${project.id}, '${project.name}')">
                        <i class="fas fa-trash"></i> Remover
                    </button>
                </div>
            </td>
        `;

        projectsList.appendChild(row);
    });
}

// Renderizar lista de Scrum Masters
function renderScrumMasters() {
    const scrumList = document.getElementById('scrumList');
    scrumList.innerHTML = '';

    // Filtrar projetos que têm Scrum Master
    const projectsWithScrum = projects.filter(p => p.scrumMaster !== null);

    if (projectsWithScrum.length === 0) {
        scrumList.innerHTML = `
            <tr>
                <td colspan="4" style="text-align: center; color: var(--gray); font-style: italic;">
                    Nenhum Scrum Master definido. Use o formulário acima para definir Scrum Masters.
                </td>
            </tr>
        `;
        return;
    }

    projectsWithScrum.forEach(project => {
        const scrumMaster = members.find(m => m.id === project.scrumMaster);
        if (!scrumMaster) return;

        const row = document.createElement('tr');

        row.innerHTML = `
            <td>
                <strong>${project.name}</strong>
            </td>
            <td>
                <strong>${scrumMaster.name}</strong><br>
                <small>${scrumMaster.role}</small>
            </td>
            <td>${scrumMaster.email}</td>
            <td>
                <button class="btn btn-danger btn-extra-small" onclick="confirmDelete('scrum', ${project.id}, '${project.name}')">
                    <i class="fas fa-user-slash"></i> Remover
                </button>
            </td>
        `;

        scrumList.appendChild(row);
    });
}

// Renderizar lista de atividades extras
function renderActivities() {
    const activitiesList = document.getElementById('activitiesList');
    activitiesList.innerHTML = '';

    if (extraActivities.length === 0) {
        activitiesList.innerHTML = `
            <tr>
                <td colspan="5" style="text-align: center; color: var(--gray); font-style: italic;">
                    Nenhuma atividade extra cadastrada. Use o formulário acima para cadastrar atividades.
                </td>
            </tr>
        `;
        return;
    }

    extraActivities.forEach(activity => {
        const member = members.find(m => m.id === activity.memberId);
        if (!member) return;

        // Determinar cor do status
        let statusClass = '';
        let statusText = '';

        switch (activity.status) {
            case 'ativa':
                statusClass = 'badge badge-success';
                statusText = 'Ativa';
                break;
            case 'concluida':
                statusClass = 'badge badge-info';
                statusText = 'Concluída';
                break;
            case 'pendente':
                statusClass = 'badge badge-warning';
                statusText = 'Pendente';
                break;
        }

        const row = document.createElement('tr');

        row.innerHTML = `
            <td>
                <strong>${activity.name}</strong><br>
                <small style="color: var(--gray);">${activity.description}</small>
            </td>
            <td>
                <strong>${member.name}</strong><br>
                <small>${member.role}</small>
            </td>
            <td>
                <span class="activity-indicator">${activity.points} pontos</span>
            </td>
            <td>
                <span class="${statusClass}">${statusText}</span>
            </td>
            <td>
                <div class="action-buttons">
                    <button class="btn btn-info btn-extra-small" onclick="editActivity(${activity.id})">
                        <i class="fas fa-edit"></i> Editar
                    </button>
                    <button class="btn btn-danger btn-extra-small" onclick="confirmDelete('activity', ${activity.id}, '${activity.name}')">
                        <i class="fas fa-trash"></i> Remover
                    </button>
                </div>
            </td>
        `;

        activitiesList.appendChild(row);
    });
}

// Atualizar checkboxes de alocação de membros
function updateAllocationCheckboxes(preSelected = []) {
    const allocationDiv = document.getElementById('membersAllocation');
    allocationDiv.innerHTML = '';

    if (members.length === 0) {
        allocationDiv.innerHTML = '<p class="alert alert-warning">Nenhum membro cadastrado. Cadastre membros primeiro.</p>';
        return;
    }

    // Criar container para os checkboxes
    const container = document.createElement('div');
    container.className = 'checkbox-group';

    members.forEach(member => {
        const label = document.createElement('label');
        label.className = 'checkbox-label';

        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.className = 'member-checkbox';
        checkbox.value = member.id;

        // Marcar como selecionado se estiver na lista preSelected
        if (preSelected.includes(member.id)) {
            checkbox.checked = true;
        }

        const memberInfo = document.createElement('div');
        memberInfo.innerHTML = `
            <div style="font-weight: 600; color: var(--dark);">${member.name}</div>
            <div style="font-size: 0.9rem; color: var(--gray);">${member.role}</div>
        `;

        label.appendChild(checkbox);
        label.appendChild(memberInfo);
        container.appendChild(label);
    });

    allocationDiv.appendChild(container);
}

// Atualizar selects de Scrum Master
function updateScrumSelects() {
    const projectSelect = document.getElementById('scrumProject');
    const memberSelect = document.getElementById('scrumMaster');

    // Limpar opções existentes
    projectSelect.innerHTML = '<option value="">Selecione um projeto</option>';
    memberSelect.innerHTML = '<option value="">Selecione um membro</option>';

    // Adicionar projetos
    projects.forEach(project => {
        const option = document.createElement('option');
        option.value = project.id;
        option.textContent = project.name;
        projectSelect.appendChild(option);
    });

    // Adicionar membros
    members.forEach(member => {
        const option = document.createElement('option');
        option.value = member.id;
        option.textContent = `${member.name} - ${member.role}`;
        memberSelect.appendChild(option);
    });
}

// Atualizar selects de atividades
function updateActivitySelects() {
    const memberSelect = document.getElementById('activityMember');

    // Limpar opções existentes
    memberSelect.innerHTML = '<option value="">Selecione um membro</option>';

    // Adicionar membros
    members.forEach(member => {
        const option = document.createElement('option');
        option.value = member.id;
        option.textContent = `${member.name} - ${member.role}`;
        memberSelect.appendChild(option);
    });
}

// Calcular sobrecarga de cada membro
function calculateOverload() {
    // Resetar sobrecarga de todos os membros
    members.forEach(member => {
        member.overload = 0;
    });

    // Calcular sobrecarga baseada nos projetos
    projects.forEach(project => {
        const overloadPerMember = project.overloadPoints;

        project.allocatedMembers.forEach(memberId => {
            const member = members.find(m => m.id === memberId);
            if (member) {
                // Adicionar pontos do projeto
                member.overload += overloadPerMember;

                // Adicionar pontos extras se for Scrum Master
                if (project.scrumMaster === memberId) {
                    member.overload += 2; // +2 pontos por ser Scrum Master
                }
            }
        });
    });

    // Calcular sobrecarga baseada em atividades extras ativas
    extraActivities.forEach(activity => {
        if (activity.status === 'ativa') {
            const member = members.find(m => m.id === activity.memberId);
            if (member) {
                member.overload += activity.points;
            }
        }
    });

    // Atualizar a exibição dos membros
    renderMembers();
}

// Atualizar dashboard
function updateDashboard() {
    updateOverloadSummary();
    updateMostAvailableMembers();
    updateAlertMembers();
    updateScrumMastersDashboard();
    updateActiveActivitiesDashboard();
    updateMembersWorkloadTable();
}

// Atualizar resumo de sobrecarga
function updateOverloadSummary() {
    const summaryDiv = document.getElementById('overloadSummary');
    summaryDiv.innerHTML = '';

    if (members.length === 0) {
        summaryDiv.innerHTML = '<p class="alert alert-warning">Nenhum membro cadastrado.</p>';
        return;
    }

    members.forEach(member => {
        // Determinar classe de sobrecarga
        const overloadClass = getOverloadClassForMember(member.overload);

        // Calcular porcentagem (máximo 25 pontos = 100%)
        const percentage = Math.min(member.overload * 4, 100);

        // Determinar cor da barra de progresso
        let progressColor = 'linear-gradient(90deg, #4361ee 0%, #4895ef 100%)'; // Azul padrão
        if (member.overload > 15) progressColor = 'linear-gradient(90deg, #e74c3c 0%, #f94144 100%)'; // Vermelho
        else if (member.overload > 10) progressColor = 'linear-gradient(90deg, #f39c12 0%, #f72585 100%)'; // Laranja/Rosa

        const div = document.createElement('div');
        div.className = 'form-group';
        div.innerHTML = `
            <label>${member.name} <span class="overload-indicator ${overloadClass}">${member.overload} pontos</span></label>
            <div class="progress-bar">
                <div class="progress-value" style="width: ${percentage}%; background: ${progressColor};"></div>
            </div>
        `;

        summaryDiv.appendChild(div);
    });
}

// Atualizar membros mais disponíveis
function updateMostAvailableMembers() {
    const container = document.getElementById('mostAvailableMembers');
    container.innerHTML = '';

    if (members.length === 0) {
        container.innerHTML = '<p class="alert alert-warning">Nenhum membro cadastrado.</p>';
        return;
    }

    // Ordenar membros por sobrecarga (menor para maior)
    const sortedMembers = [...members].sort((a, b) => a.overload - b.overload);

    // Pegar os 3 membros mais disponíveis (menor sobrecarga)
    const mostAvailable = sortedMembers.slice(0, Math.min(3, sortedMembers.length));

    mostAvailable.forEach(member => {
        const card = document.createElement('div');
        card.className = 'member-card success-card';

        card.innerHTML = `
            <h4>${member.name}</h4>
            <p><i class="fas fa-briefcase"></i> <strong>Cargo:</strong> ${member.role}</p>
            <p><i class="fas fa-weight-hanging"></i> <strong>Sobrecarga:</strong> ${member.overload} pontos</p>
            <p><i class="fas fa-check-circle"></i> <strong>Status:</strong> Disponível para novos projetos</p>
        `;

        container.appendChild(card);
    });
}

// Atualizar membros em alerta
function updateAlertMembers() {
    const container = document.getElementById('alertMembers');
    container.innerHTML = '';

    if (members.length === 0) {
        container.innerHTML = '<p class="alert alert-warning">Nenhum membro cadastrado.</p>';
        return;
    }

    // Filtrar membros com sobrecarga alta (>15) ou média (>10)
    const alertMembers = members.filter(member => member.overload > 10);

    if (alertMembers.length === 0) {
        container.innerHTML = '<p class="alert alert-success">Nenhum membro em estado de alerta. Toda a equipe está com carga equilibrada.</p>';
        return;
    }

    // Ordenar por sobrecarga (maior para menor)
    alertMembers.sort((a, b) => b.overload - a.overload);

    alertMembers.forEach(member => {
        const cardClass = member.overload > 15 ? 'alert-card' : 'warning-card';
        const statusText = member.overload > 15 ? 'Sobrecarregado' : 'Atenção necessária';
        const icon = member.overload > 15 ? 'fas fa-exclamation-circle' : 'fas fa-exclamation-triangle';

        const card = document.createElement('div');
        card.className = `member-card ${cardClass}`;

        card.innerHTML = `
            <h4>${member.name}</h4>
            <p><i class="fas fa-briefcase"></i> <strong>Cargo:</strong> ${member.role}</p>
            <p><i class="fas fa-weight-hanging"></i> <strong>Sobrecarga:</strong> ${member.overload} pontos</p>
            <p><i class="${icon}"></i> <strong>Status:</strong> ${statusText}</p>
        `;

        container.appendChild(card);
    });
}

// Atualizar Scrum Masters no dashboard
function updateScrumMastersDashboard() {
    const container = document.getElementById('scrumMastersList');
    container.innerHTML = '';

    // Filtrar membros que são Scrum Masters
    const scrumMasters = [];
    projects.forEach(project => {
        if (project.scrumMaster) {
            const member = members.find(m => m.id === project.scrumMaster);
            const projectName = project.name;

            if (member && !scrumMasters.some(sm => sm.member.id === member.id)) {
                // Encontrar todos os projetos onde este membro é Scrum Master
                const projectsAsScrum = projects.filter(p => p.scrumMaster === member.id);
                scrumMasters.push({
                    member: member,
                    projects: projectsAsScrum
                });
            }
        }
    });

    if (scrumMasters.length === 0) {
        container.innerHTML = '<p class="alert alert-info">Nenhum Scrum Master definido.</p>';
        return;
    }

    scrumMasters.forEach(scrumMaster => {
        const card = document.createElement('div');
        card.className = 'member-card scrum-card';

        const projectNames = scrumMaster.projects.map(p => p.name).join(', ');

        card.innerHTML = `
            <h4>${scrumMaster.member.name} <span class="badge badge-scrum">Scrum Master</span></h4>
            <p><i class="fas fa-briefcase"></i> <strong>Cargo:</strong> ${scrumMaster.member.role}</p>
            <p><i class="fas fa-project-diagram"></i> <strong>Projetos:</strong> ${projectNames}</p>
            <p><i class="fas fa-weight-hanging"></i> <strong>Sobrecarga:</strong> ${scrumMaster.member.overload} pontos</p>
        `;

        container.appendChild(card);
    });
}

// Atualizar atividades extras ativas no dashboard
function updateActiveActivitiesDashboard() {
    const container = document.getElementById('activeActivitiesList');
    container.innerHTML = '';

    // Filtrar atividades ativas
    const activeActivities = extraActivities.filter(a => a.status === 'ativa');

    if (activeActivities.length === 0) {
        container.innerHTML = '<p class="alert alert-info">Nenhuma atividade extra ativa no momento.</p>';
        return;
    }

    // Ordenar por pontos (maior para menor)
    activeActivities.sort((a, b) => b.points - a.points);

    // Pegar até 4 atividades
    const displayActivities = activeActivities.slice(0, Math.min(4, activeActivities.length));

    displayActivities.forEach(activity => {
        const member = members.find(m => m.id === activity.memberId);
        if (!member) return;

        const card = document.createElement('div');
        card.className = 'member-card';
        card.style.borderTopColor = '#f72585';

        card.innerHTML = `
            <h4>${activity.name}</h4>
            <p><i class="fas fa-user"></i> <strong>Responsável:</strong> ${member.name}</p>
            <p><i class="fas fa-align-left"></i> <strong>Descrição:</strong> ${activity.description}</p>
            <p><i class="fas fa-weight-hanging"></i> <strong>Pontos:</strong> ${activity.points} pontos</p>
        `;

        container.appendChild(card);
    });
}

// Atualizar tabela de carga de trabalho dos membros
function updateMembersWorkloadTable() {
    const tableBody = document.getElementById('membersWorkloadList');
    tableBody.innerHTML = '';

    if (members.length === 0) {
        return;
    }

    members.forEach(member => {
        // Encontrar projetos do membro
        const memberProjects = projects.filter(project =>
            project.allocatedMembers.includes(member.id)
        );

        // Nomes dos projetos
        const projectNames = memberProjects.map(p => p.name).join(', ') || 'Nenhum';

        // Verificar se é Scrum Master de algum projeto
        const scrumProjects = projects.filter(project => project.scrumMaster === member.id);
        const scrumProjectNames = scrumProjects.map(p => p.name).join(', ') || 'Não';

        // Encontrar atividades extras do membro
        const memberActivities = extraActivities.filter(activity =>
            activity.memberId === member.id && activity.status === 'ativa'
        );
        const activityNames = memberActivities.map(a => a.name).join(', ') || 'Nenhuma';

        // Determinar status
        let status = 'Disponível';
        let statusClass = 'low-overload';

        if (member.overload > 15) {
            status = 'Sobrecarregado';
            statusClass = 'high-overload';
        } else if (member.overload > 10) {
            status = 'Atenção';
            statusClass = 'medium-overload';
        }

        const row = document.createElement('tr');

        row.innerHTML = `
            <td><strong>${member.name}</strong></td>
            <td>${member.role}</td>
            <td>${projectNames}</td>
            <td>${scrumProjectNames}</td>
            <td>${activityNames}</td>
            <td>
                <span class="overload-indicator ${getOverloadClassForMember(member.overload)}">
                    ${member.overload} pontos
                </span>
            </td>
            <td>
                <span class="overload-indicator ${statusClass}">${status}</span>
            </td>
        `;

        tableBody.appendChild(row);
    });
}

// Atualizar estatísticas
function updateStats() {
    document.getElementById('totalMembers').textContent = members.length;
    document.getElementById('totalProjects').textContent = projects.length;

    // Calcular sobrecarga média
    const avgOverload = members.length > 0
        ? (members.reduce((sum, member) => sum + member.overload, 0) / members.length).toFixed(1)
        : 0;
    document.getElementById('avgOverload').textContent = avgOverload;

    // Contar membros com sobrecarga alta (>15)
    const highOverload = members.filter(member => member.overload > 15).length;
    document.getElementById('highOverloadCount').textContent = highOverload;

    // Contar membros disponíveis (sobrecarga <= 10)
    const availableMembers = members.filter(member => member.overload <= 10).length;
    document.getElementById('availableMembers').textContent = availableMembers;

    // Contar Scrum Masters únicos
    const scrumMasterIds = [...new Set(projects.map(p => p.scrumMaster).filter(id => id !== null))];
    document.getElementById('scrumMastersCount').textContent = scrumMasterIds.length;

    // Contar atividades extras ativas
    const activeActivities = extraActivities.filter(a => a.status === 'ativa').length;
    document.getElementById('activitiesCount').textContent = activeActivities;
}

// Função para confirmar exclusão
function confirmDelete(type, id, name) {
    itemToDelete = id;
    deleteType = type;

    let message = '';
    if (type === 'member') {
        message = `Tem certeza que deseja excluir o membro "${name}"? Esta ação não pode ser desfeita.`;
    } else if (type === 'project') {
        message = `Tem certeza que deseja excluir o projeto "${name}"? Esta ação não pode ser desfeita.`;
    } else if (type === 'activity') {
        message = `Tem certeza que deseja excluir a atividade "${name}"? Esta ação não pode ser desfeita.`;
    } else if (type === 'scrum') {
        message = `Tem certeza que deseja remover o Scrum Master do projeto "${name}"?`;
    }

    document.getElementById('confirmMessage').textContent = message;
    document.getElementById('confirmModal').classList.add('active');
}

// Função para deletar membro
function deleteMember(id) {
    // Remover membro
    members = members.filter(member => member.id !== id);

    // Remover membro de todos os projetos
    projects.forEach(project => {
        project.allocatedMembers = project.allocatedMembers.filter(memberId => memberId !== id);
        // Se o membro era Scrum Master, remover essa atribuição
        if (project.scrumMaster === id) {
            project.scrumMaster = null;
        }
    });

    // Remover atividades do membro
    extraActivities = extraActivities.filter(activity => activity.memberId !== id);

    // Atualizar interface
    renderMembers();
    renderProjects();
    renderActivities();
    updateAllocationCheckboxes();
    updateScrumSelects();
    updateActivitySelects();
    calculateOverload();
    updateDashboard();
    updateStats();
    renderScrumMasters();

    showFloatingAlert('Membro removido com sucesso!', 'success');
}

// Função para deletar projeto
function deleteProject(id) {
    // Remover projeto
    projects = projects.filter(project => project.id !== id);

    // Atualizar interface
    renderProjects();
    updateScrumSelects();
    calculateOverload();
    updateDashboard();
    updateStats();
    renderScrumMasters();

    showFloatingAlert('Projeto removido com sucesso!', 'success');
}

// Função para deletar atividade
function deleteActivity(id) {
    // Remover atividade
    extraActivities = extraActivities.filter(activity => activity.id !== id);

    // Atualizar interface
    renderActivities();
    calculateOverload();
    updateDashboard();
    updateStats();

    showFloatingAlert('Atividade removida com sucesso!', 'success');
}

// Função para remover Scrum Master
function removeScrumMaster(projectId) {
    const project = projects.find(p => p.id === projectId);
    if (project) {
        project.scrumMaster = null;

        // Atualizar interface
        renderProjects();
        renderScrumMasters();
        calculateOverload();
        updateDashboard();
        updateStats();

        showFloatingAlert('Scrum Master removido com sucesso!', 'success');
    }
}

// Mostrar alerta flutuante
function showFloatingAlert(message, type = 'success') {
    const alertDiv = document.getElementById('floatingAlert');
    const alertMessage = document.getElementById('alertMessage');

    // Configurar cor e ícone baseado no tipo
    let icon = 'fa-check-circle';
    let backgroundColor = 'linear-gradient(135deg, #2ecc71 0%, #27ae60 100%)';

    if (type === 'error' || type === 'danger') {
        icon = 'fa-exclamation-circle';
        backgroundColor = 'linear-gradient(135deg, #e74c3c 0%, #c0392b 100%)';
    } else if (type === 'warning') {
        icon = 'fa-exclamation-triangle';
        backgroundColor = 'linear-gradient(135deg, #f39c12 0%, #e67e22 100%)';
    } else if (type === 'info') {
        icon = 'fa-info-circle';
        backgroundColor = 'linear-gradient(135deg, #3498db 0%, #2980b9 100%)';
    }

    // Atualizar conteúdo
    alertDiv.innerHTML = `<i class="fas ${icon} fa-lg"></i><div>${message}</div>`;
    alertDiv.style.background = backgroundColor;

    // Mostrar alerta
    alertDiv.classList.add('show');

    // Esconder após 5 segundos
    setTimeout(() => {
        alertDiv.classList.remove('show');
    }, 5000);
}

// Funções auxiliares
function getOverloadClassForMember(points) {
    if (points > 15) return 'high-overload';
    if (points > 10) return 'medium-overload';
    return 'low-overload';
}

function getOverloadClass(points) {
    if (points >= 8) return 'high-overload';
    if (points >= 5) return 'medium-overload';
    return 'low-overload';
}