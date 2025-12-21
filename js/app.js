// ==========================================
// 1. ESTADO GLOBAL
// ==========================================
let members = [];
let projects = [];
let extraActivities = []; // Nota: No banco chama-se 'extra_activities'

// Variáveis de controle de UI
let editingMemberId = null;
let editingProjectId = null;
let editingActivityId = null;
let itemToDelete = null;
let deleteType = null; // 'member', 'project', 'activity' ou 'scrum'

// ==========================================
// 2. INICIALIZAÇÃO
// ==========================================
document.addEventListener('DOMContentLoaded', async function () {
    // Configura UI (Abas, Botões, etc)
    setupTabNavigation();
    setupPointsSliders();
    setupCancelButtons();
    
    setupConfirmationModal(); // Se houver modal de exclusão

    // INICIA A CARGA DE DADOS DO SUPABASE
    await initApp();
});

async function initApp() {
    // Mostra algum loading se necessário
    const btnRefresh = document.querySelector('header h1');
    if(btnRefresh) btnRefresh.innerHTML += ' <i class="fas fa-sync fa-spin" style="font-size: 0.5em"></i>';

    // Chama o serviço criado no supabase.js
    const resultado = await ProjectService.carregarTodosDados();

    if (resultado.success) {
        // Atualiza as variáveis globais com dados do banco
        members = resultado.data.members;
        projects = resultado.data.projects;
        // Mapeia activities para garantir compatibilidade se necessário
        extraActivities = resultado.data.activities;

        console.log("✅ Dados sincronizados:", { members, projects, extraActivities });

        // Remove spinner
        const spinner = document.querySelector('.fa-sync');
        if(spinner) spinner.remove();

        // Renderiza tudo
        //updateFullInterface();
    } else {
        alert("Erro ao carregar dados: " + resultado.error);
    }
}

function updateFullInterface() {
    calculateOverload(); // Recalcula os pontos baseados nos dados novos
    renderMembers();
    renderProjects();
    updateAllocationCheckboxes();
    updateScrumManagementSelects();
    updateActivityAllocationCheckboxes(); // Para selecionar o membro na aba atividades
    renderActivitiesSummary();
    updateDashboard();
    renderScrumMasters();
    renderActivities();
}

// ==========================================
// 3. LÓGICA DE NEGÓCIO (CÁLCULOS)
// ==========================================

function calculateOverload() {
    // Zera a sobrecarga de todos antes de recalcular
    members.forEach(m => m.overload = 0);

    // 1. Soma pontos de Projetos (Membro Alocado)
    projects.forEach(proj => {
        const memberIds = proj.allocated_members || []; // Array de UUIDs
        const points = parseInt(proj.overload_points) || 0;

        memberIds.forEach(mId => {
            const member = members.find(m => m.id === mId);
            if (member) {
                member.overload += points;
            }
        });

        // 2. Soma pontos do Scrum Master (se houver regra específica)
        // Assumindo que o SM recebe a mesma carga do projeto:
        if (proj.scrum_master) {
            const sm = members.find(m => m.id === proj.scrum_master);
            if (sm) {
                sm.overload += points; 
            }
        }
    });

    // 3. Soma Atividades Extras
    extraActivities.forEach(act => {
        if (act.status === 'ativa') {
            const member = members.find(m => m.id === act.member_id);
            if (member) {
                member.overload += (parseInt(act.points) || 0);
            }
        }
    });
}



// ==========================================
// 6. ATUALIZADORES DE SELECTS E CHECKBOXES
// ==========================================

function updateAllocationCheckboxes() {
    const container = document.getElementById('membersAllocation'); 
    
    // Verificação de segurança
    if (!container) {
        console.warn("Container 'membersAllocation' não encontrado no HTML");
        return;
    }
    
    container.innerHTML = ''; // Limpa o conteúdo anterior
    
    // Adiciona classe de grid se não tiver (para ficar bonito conforme seu CSS)
    container.classList.add('checkbox-group');

    if (members.length === 0) {
        container.innerHTML = '<p style="color:#666; font-style:italic">Nenhum membro cadastrado.</p>';
        return;
    }
    
    members.forEach(member => {
        const label = document.createElement('label');
        label.className = 'checkbox-label'; // Classe do seu CSS original
        
        // O value DEVE ser o ID do membro (UUID do Supabase)
        // O name DEVE ser 'projectMembers' para o formulário pegar depois
        label.innerHTML = `
            <input type="checkbox" name="projectMembers" value="${member.id}">
            <span>${member.name} <small style="font-size:0.85em; color:var(--gray)">(${member.role})</small></span>
        `;
        container.appendChild(label);
    });
}

function updateActivitySelects() {
    const select = document.getElementById('activityMemberSelect'); // Verifique ID no HTML
    if (!select) return;

    select.innerHTML = '<option value="">Selecione o Membro...</option>';
    members.forEach(member => {
        select.innerHTML += `<option value="${member.id}">${member.name}</option>`;
    });
}

// ==========================================
// 7. DASHBOARD E ESTATÍSTICAS
// ==========================================

function updateAlertLists() {
    const alertDiv = document.getElementById('alertMembers');
    const availDiv = document.getElementById('mostAvailableMembers');

    if (alertDiv) {
        const overloaded = members.filter(m => m.overload > 15);
        alertDiv.innerHTML = overloaded.length ? '' : 'Nenhum membro em estado crítico.';
        overloaded.forEach(m => {
            alertDiv.innerHTML += `<div class="alert-item text-danger"><i class="fas fa-exclamation-circle"></i> ${m.name} (${m.overload} pts)</div>`;
        });
    }

    if (availDiv) {
        const available = members.filter(m => m.overload < 8).slice(0, 5); // Top 5 livres
        availDiv.innerHTML = available.length ? '' : 'Todos estão ocupados.';
        available.forEach(m => {
            availDiv.innerHTML += `<div class="avail-item text-success"><i class="fas fa-check"></i> ${m.name} (${m.overload} pts)</div>`;
        });
    }
}

// ==========================================
// 8. UTILITÁRIOS
// ==========================================

function setText(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
}

function getOverloadClassForMember(points) {
    if (points > 15) return 'high-overload';
    if (points > 10) return 'medium-overload';
    return 'low-overload';
}

function showFloatingAlert(message, type = 'success') {
    // Verifica se existe o elemento de alerta no HTML, senão cria dinamicamente
    let alertDiv = document.getElementById('floatingAlert');
    if (!alertDiv) {
        alertDiv = document.createElement('div');
        alertDiv.id = 'floatingAlert';
        alertDiv.className = 'floating-alert';
        document.body.appendChild(alertDiv);
    }

    let icon = 'fa-check-circle';
    let color = 'linear-gradient(135deg, #2ecc71 0%, #27ae60 100%)';

    if (type === 'error') {
        icon = 'fa-times-circle';
        color = 'linear-gradient(135deg, #e74c3c 0%, #c0392b 100%)';
    } else if (type === 'warning') {
        icon = 'fa-exclamation-triangle';
        color = 'linear-gradient(135deg, #f39c12 0%, #e67e22 100%)';
    }

    alertDiv.innerHTML = `<i class="fas ${icon}"></i> <span>${message}</span>`;
    alertDiv.style.background = color;
    alertDiv.classList.add('show');

    setTimeout(() => {
        alertDiv.classList.remove('show');
    }, 4000);
}

// Funções de UI originais (Tabs, Sliders)
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
    const pointsValue = document.getElementById('pointsValue');

    pointsSlider.addEventListener('input', function () {
        pointsValue.textContent = `${this.value} pontos`;
    });

    const activityPointsSlider = document.getElementById('activityPoints');
    const activityPointsValue = document.getElementById('activityPointsValue');

    activityPointsSlider.addEventListener('input', function () {
        activityPointsValue.textContent = `${this.value} ponto${this.value > 1 ? 's' : ''}`;
    });
}

function setupCancelButtons() {
    // Lógica para botões de limpar formulário
    document.querySelectorAll('.btn-secondary').forEach(btn => {
        btn.addEventListener('click', function() {
            const form = this.closest('form');
            if(form) form.reset();
        });
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

// Ligar o botão de cancelar
const btnCancelActivity = document.getElementById('activityCancelBtn');
if (btnCancelActivity) {
    btnCancelActivity.addEventListener('click', cancelActivityEdit);
}

// Função auxiliar (caso não tenha)
function getInitials(name) {
    if (!name) return '?';
    const parts = name.trim().split(' ');
    if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}