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
        updateFullInterface();
    } else {
        alert("Erro ao carregar dados: " + resultado.error);
    }
}

function updateFullInterface() {
    calculateOverload(); // Recalcula os pontos baseados nos dados novos
    renderMembers();
    renderProjects();
    if (typeof renderSmartAllocationCheckboxes === 'function') {
        renderSmartAllocationCheckboxes([]);
    } else {
        updateAllocationCheckboxes();
    }
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
    // 0. Zera a sobrecarga de todos antes de recalcular
    members.forEach(m => m.overload = 0);

    // 1. Soma pontos de PROJETOS
    projects.forEach(proj => {
        // Garante que é um array
        const memberIds = proj.allocated_members || []; 
        const points = parseInt(proj.overload_points) || 0;

        // Soma para a equipe de desenvolvimento
        memberIds.forEach(mId => {
            const member = members.find(m => m.id === mId);
            if (member) {
                member.overload += points;
            }
        });

        // Soma para o Scrum Master — peso proporcional à complexidade do projeto
        // Fórmula: max(1, round(points * 0.4)) → 1 pt p/ baixa, 2 p/ média, 3-4 p/ alta complexidade
        const smId = proj.scrum_master_id || proj.scrum_master;
        if (smId) {
            const sm = members.find(m => m.id === smId);
            if (sm) {
                const smPoints = Math.max(1, Math.round(points * 0.4)) + 2;
                sm.overload += smPoints;
            }
        }
    });

    // 2. Soma ATIVIDADES EXTRAS (CORRIGIDO PARA ARRAY)
    extraActivities.forEach(act => {
        if (act.status === 'ativa') {
            const points = parseInt(act.points) || 0;
            
            // Verifica se é o novo formato (Array de membros)
            if (act.allocated_members && Array.isArray(act.allocated_members)) {
                act.allocated_members.forEach(mId => {
                    const member = members.find(m => m.id === mId);
                    if (member) {
                        member.overload += points;
                    }
                });
            } 
            // Suporte para formato antigo (caso tenha sobrado algo no banco)
            else if (act.member_id) {
                const member = members.find(m => m.id === act.member_id);
                if (member) {
                    member.overload += points;
                }
            }
        }
    });

    // 3. Soma TESTES (ADICIONADO)
    // Verifica se a variável global projectTests existe (vinda do testes.js)
    if (typeof projectTests !== 'undefined' && Array.isArray(projectTests)) {
        projectTests.forEach(test => {
            if (test.status === 'em_andamento') {
                const points = parseInt(test.overload_points) || 0;

                // Itera sobre os membros do teste
                if (test.members && Array.isArray(test.members)) {
                    test.members.forEach(mId => {
                        const member = members.find(m => m.id === mId);
                        if (member) {
                            member.overload += points;
                        }
                    });
                }
            }
        });
    }

    // 4. Bônus de cargo: Gerente recebe +5 pontos pela responsabilidade de gerência
    members.forEach(m => {
        if (m.role && m.role.toLowerCase().includes('gerente')) {
            m.overload += 5;
        }
    });

    // 5. Carga pessoal: trabalho (+4) e matérias (round(qtd × 0.5) — cada 2 matérias = 1 pt)
    members.forEach(m => {
        if (m.trabalho) m.overload += 4;
        const mats = parseInt(m.num_materias) || 0;
        if (mats > 0) m.overload += Math.round(mats * 0.5);
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
    let color = 'linear-gradient(135deg, #0787cb 0%, #043c73 100%)';

    if (type === 'error') {
        icon = 'fa-times-circle';
        color = 'linear-gradient(135deg, #e23d28 0%, #b91c1c 100%)';
    } else if (type === 'warning') {
        icon = 'fa-exclamation-triangle';
        color = 'linear-gradient(135deg, #fc9c14 0%, #e0830a 100%)';
    }

    alertDiv.innerHTML = `<i class="fas ${icon}"></i> <span>${message}</span>`;
    alertDiv.style.background = color;
    alertDiv.classList.add('show');

    setTimeout(() => {
        alertDiv.classList.remove('show');
    }, 4000);
}

function setupTabNavigation() {
    const tabButtons = document.querySelectorAll('.tab-button');
    const tabIndicator = document.getElementById('tabIndicator');

    // Função interna para mover o indicador para o botão correto
    function moveIndicator(element) {
        if (!tabIndicator || !element) return;
        
        // Pega a largura exata e a posição do botão clicado em pixels
        tabIndicator.style.width = `${element.offsetWidth}px`;
        tabIndicator.style.transform = `translateX(${element.offsetLeft}px)`;
    }

    // Inicializa na aba que já está ativa ao carregar a página
    const activeBtn = document.querySelector('.tab-button.active');
    if (activeBtn) {
        // Um pequeno timeout garante que o CSS carregou e as medidas estão certas
        setTimeout(() => moveIndicator(activeBtn), 50);
    }

    tabButtons.forEach(button => {
        button.addEventListener('click', function (e) {
            e.preventDefault();
            const tabId = this.getAttribute('data-tab');

            // 1. UI: Remover classe active de todos
            tabButtons.forEach(btn => btn.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));

            // 2. UI: Ativar o clicado
            this.classList.add('active');
            const targetContent = document.getElementById(tabId);
            if(targetContent) targetContent.classList.add('active');

            // 3. UI: Mover o indicador visualmente
            moveIndicator(this);

            // 4. DADOS: Atualizar as abas específicas
            if (tabId === 'dashboard') {
                if(typeof updateDashboard === 'function') updateDashboard();
            } 
            else if (tabId === 'scrum') {
                if(typeof updateScrumManagementSelects === 'function') updateScrumManagementSelects();
                if(typeof renderScrumMasters === 'function') renderScrumMasters();
            }
            else if (tabId === 'activities') {
                if(typeof updateActivityAllocationCheckboxes === 'function') updateActivityAllocationCheckboxes();
                if(typeof renderActivities === 'function') renderActivities();
            }
            // Adicionado suporte para a aba de Testes
            else if (tabId === 'tests') {
                if(typeof updateTestUIHelpers === 'function') updateTestUIHelpers();
                if(typeof renderTests === 'function') renderTests();
            }
        });
    });

    // Ajusta o indicador se o usuário redimensionar a janela
    window.addEventListener('resize', () => {
        const currentActive = document.querySelector('.tab-button.active');
        if (currentActive) moveIndicator(currentActive);
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

// Retorna HTML colorido com contagem de sprints (ou dias para prazos curtos) até o prazo
function formatDeadlineCountdown(deadline) {
    if (!deadline) return '<span style="color:#aaa; font-size:0.85em;">—</span>';
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const d = new Date(deadline + 'T00:00:00');
    const diff = Math.round((d - today) / (1000 * 60 * 60 * 24));

    if (diff < 0) {
        const absDiff = Math.abs(diff);
        const label = absDiff >= SPRINT_DAYS ? _sprintLabel(absDiff) : `${absDiff}d`;
        return `<span style="color:#e23d28; font-size:0.82em; font-weight:bold;"><i class="fas fa-exclamation-circle"></i> Vencido (${label})</span>`;
    }
    if (diff === 0) return `<span style="color:#e23d28; font-weight:bold;"><i class="fas fa-bell"></i> Hoje!</span>`;
    if (diff <= 3)  return `<span style="color:#e23d28; font-size:0.85em;"><i class="fas fa-clock"></i> ${diff}d</span>`;
    if (diff <= 7)  return `<span style="color:#fc9c14; font-size:0.85em;"><i class="fas fa-clock"></i> ${diff}d</span>`;
    if (diff < SPRINT_DAYS) return `<span style="color:#fc9c14; font-size:0.85em;"><i class="fas fa-clock"></i> ${diff}d</span>`;
    return `<span style="color:#0787cb; font-size:0.85em;"><i class="fas fa-flag-checkered"></i> ${_sprintLabel(diff)}</span>`;
}

function _sprintLabel(days) {
    const s = days / SPRINT_DAYS;
    const rounded = Math.round(s * 10) / 10;
    const label = rounded % 1 === 0 ? rounded.toString() : rounded.toFixed(1);
    return `${label} sprint${rounded !== 1 ? 's' : ''}`;
}

// ===================== Deadline Picker (data/sprints) =====================
const SPRINT_DAYS = 14; // 1 sprint = 2 semanas

function _formatDateBR(iso) {
    const [y, m, d] = iso.split('-');
    return `${d}/${m}/${y}`;
}

function initDeadlinePickers() {
    document.querySelectorAll('.deadline-picker').forEach(picker => {
        const dateInput    = picker.querySelector('input[type="date"]');
        const sprintInput  = picker.querySelector('.deadline-sprint-qty');
        const preview      = picker.querySelector('.deadline-sprint-preview');
        const panelDate    = picker.querySelector('.deadline-panel-date');
        const panelSprint  = picker.querySelector('.deadline-panel-sprint');
        const btns         = picker.querySelectorAll('.deadline-mode-btn');

        if (!dateInput) return;

        btns.forEach(btn => {
            btn.addEventListener('click', () => {
                btns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                if (btn.dataset.mode === 'date') {
                    panelDate.style.display   = '';
                    panelSprint.style.display = 'none';
                } else {
                    panelDate.style.display   = 'none';
                    panelSprint.style.display = '';
                    if (sprintInput.value) _calcSprintDate(sprintInput, dateInput, preview);
                }
            });
        });

        sprintInput.addEventListener('input', () => {
            _calcSprintDate(sprintInput, dateInput, preview);
        });
    });
}

function _calcSprintDate(sprintInput, dateInput, preview) {
    const n = parseInt(sprintInput.value);
    if (!n || n < 1) {
        dateInput.value  = '';
        preview.textContent = '';
        return;
    }
    const date = new Date();
    date.setDate(date.getDate() + n * SPRINT_DAYS);
    const iso = date.toISOString().split('T')[0];
    dateInput.value     = iso;
    preview.textContent = `Prazo: ${_formatDateBR(iso)} (${n} sprint${n > 1 ? 's' : ''})`;
}

function resetDeadlinePicker(dateInputId) {
    const dateInput = document.getElementById(dateInputId);
    if (!dateInput) return;
    const picker = dateInput.closest('.deadline-picker');
    if (!picker) return;

    const btns        = picker.querySelectorAll('.deadline-mode-btn');
    const panelDate   = picker.querySelector('.deadline-panel-date');
    const panelSprint = picker.querySelector('.deadline-panel-sprint');
    const sprintInput = picker.querySelector('.deadline-sprint-qty');
    const preview     = picker.querySelector('.deadline-sprint-preview');

    btns.forEach((b, i) => b.classList.toggle('active', i === 0));
    panelDate.style.display   = '';
    panelSprint.style.display = 'none';
    dateInput.value           = '';
    if (sprintInput)  sprintInput.value  = '';
    if (preview)      preview.textContent = '';
}

document.addEventListener('DOMContentLoaded', initDeadlinePickers);

// Função auxiliar (caso não tenha)
function getInitials(name) {
    if (!name) return '?';
    const parts = name.trim().split(' ');
    if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}