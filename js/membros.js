// FORMS 

// --- LISTENER DO FORMULÁRIO DE MEMBROS (CRIAR E EDITAR) ---
const memberForm = document.getElementById('memberForm');

if (memberForm) {
    memberForm.addEventListener('submit', async function (e) {
        e.preventDefault();

        // 1. COLETAR DADOS
        const name = document.getElementById('memberName').value;
        const role = document.getElementById('memberRole').value;
        const subarea = document.getElementById('memberSubarea').value;
        //const email = document.getElementById('memberEmail').value;

        // 2. FEEDBACK VISUAL
        const submitBtn = this.querySelector('button[type="submit"]');
        const originalText = submitBtn.innerHTML;
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processando...';
        submitBtn.disabled = true;

        try {
            let res;

            // --- DECISÃO: CRIAR OU ATUALIZAR? ---
            if (editingMemberId) {
                // >>> MODO EDIÇÃO <<<
                res = await ProjectService.atualizarMembro(editingMemberId, name, role, subarea);

                if (res.success) {
                    // Atualiza o membro no array local
                    const index = members.findIndex(m => m.id === editingMemberId);
                    if (index !== -1) {
                        members[index] = res.data;
                    }
                    showFloatingAlert('Membro atualizado com sucesso!');
                    resetMemberFormState(); // Sai do modo edição
                }

            } else {
                // >>> MODO CRIAÇÃO <<<
                res = await ProjectService.adicionarMembro(name, role, subarea);

                if (res.success) {
                    members.push(res.data);
                    showFloatingAlert('Membro adicionado com sucesso!');
                    this.reset();
                }
            }

            // --- FINALIZAÇÃO ---
            if (!res.success) {
                showFloatingAlert('Erro: ' + res.error, 'error');
            } else {
                // Atualiza toda a interface (importante para recarregar selects e tabelas)
                updateFullInterface();
            }

        } catch (err) {
            console.error(err);
            showFloatingAlert('Erro inesperado ao salvar membro.', 'error');
        } finally {
            // Restaura o botão
            if (editingMemberId) {
                submitBtn.innerHTML = '<i class="fas fa-save"></i> Atualizar Membro';
            } else {
                submitBtn.innerHTML = originalText || '<i class="fas fa-plus"></i> Adicionar Membro';
            }
            submitBtn.disabled = false;
        }
    });
}

// RENDER

function buildOverloadBreakdown(memberId) {
    const lines = [];

    projects.forEach(proj => {
        const pts = parseInt(proj.overload_points) || 0;
        if ((proj.allocated_members || []).includes(memberId)) {
            lines.push({ label: proj.name, pts, icon: 'fa-project-diagram', type: 'project' });
        }
        const smId = proj.scrum_master_id || proj.scrum_master;
        if (smId === memberId) {
            lines.push({ label: `SM: ${proj.name}`, pts: 2, icon: 'fa-crown', type: 'sm' });
        }
    });

    extraActivities.forEach(act => {
        if (act.status !== 'ativa') return;
        const pts = parseInt(act.points) || 0;
        const allocated = act.allocated_members && Array.isArray(act.allocated_members)
            ? act.allocated_members.includes(memberId)
            : act.member_id === memberId;
        if (allocated) {
            lines.push({ label: act.name || act.title || 'Atividade', pts, icon: 'fa-tasks', type: 'activity' });
        }
    });

    if (typeof projectTests !== 'undefined' && Array.isArray(projectTests)) {
        projectTests.forEach(test => {
            if (test.status === 'em_andamento' && (test.members || []).includes(memberId)) {
                const pts = parseInt(test.overload_points) || 0;
                lines.push({ label: test.name || test.title || 'Teste', pts, icon: 'fa-vial', type: 'test' });
            }
        });
    }

    return lines;
}

function buildOverloadTooltipHtml(memberId) {
    const lines = buildOverloadBreakdown(memberId);
    if (lines.length === 0) {
        return '<div class="overload-tooltip-empty">Sem alocações ativas</div>';
    }

    const typeColors = {
        project:  '#043c73',
        sm:       '#0787cb',
        activity: '#fc9c14',
        test:     '#5bb0e0',
    };

    const rows = lines.map(l => `
        <div class="overload-tooltip-row">
            <span class="overload-tooltip-label">
                <i class="fas ${l.icon}" style="color:${typeColors[l.type]};width:14px"></i>
                ${l.label}
            </span>
            <span class="overload-tooltip-pts">+${l.pts} pt${l.pts !== 1 ? 's' : ''}</span>
        </div>
    `).join('');

    const total = lines.reduce((s, l) => s + l.pts, 0);

    return `
        <div class="overload-tooltip-title"><i class="fas fa-layer-group"></i> Detalhamento</div>
        ${rows}
        <div class="overload-tooltip-total">
            <span>Total</span>
            <span>${total} pontos</span>
        </div>
    `;
}

// Tooltip global fixo — criado uma vez e reposicionado a cada hover
function _getOrCreateGlobalTooltip() {
    let tip = document.getElementById('overloadGlobalTooltip');
    if (!tip) {
        tip = document.createElement('div');
        tip.id = 'overloadGlobalTooltip';
        tip.className = 'overload-tooltip-box';
        tip.style.display = 'none';
        document.body.appendChild(tip);
    }
    return tip;
}

function _positionTooltip(tip, anchor) {
    const MARGIN = 8;
    const rect = anchor.getBoundingClientRect();
    const tw = tip.offsetWidth || 260;
    const th = tip.offsetHeight;

    // tenta posicionar acima; se não couber, posiciona abaixo
    let top = rect.top - th - MARGIN;
    if (top < MARGIN) top = rect.bottom + MARGIN;

    // centraliza horizontalmente, garantindo que não saia da tela
    let left = rect.left + rect.width / 2 - tw / 2;
    left = Math.max(MARGIN, Math.min(left, window.innerWidth - tw - MARGIN));

    tip.style.top  = `${top}px`;
    tip.style.left = `${left}px`;
}

function setupOverloadTooltips() {
    const tip = _getOrCreateGlobalTooltip();
    const list = document.getElementById('membersList');
    if (!list) return;

    list.addEventListener('mouseenter', function (e) {
        const wrapper = e.target.closest('.overload-tooltip-wrapper');
        if (!wrapper) return;
        const memberId = wrapper.dataset.memberId;
        tip.innerHTML = buildOverloadTooltipHtml(memberId);
        tip.style.display = 'block';
        _positionTooltip(tip, wrapper);
    }, true);

    list.addEventListener('mouseleave', function (e) {
        if (!e.target.closest('.overload-tooltip-wrapper')) return;
        tip.style.display = 'none';
    }, true);
}

function renderMembers() {
    const list = document.getElementById('membersList');
    if (!list) return;

    list.innerHTML = '';

    const sortedMembers = [...members].sort((a, b) => b.overload - a.overload);

    const subareaLabels = { ux_ui: 'UX/UI', frontend: 'Frontend', backend: 'Backend' };
    const subareaColors = { ux_ui: '#0a374e', frontend: '#0787cb', backend: '#fc9c14' };

    sortedMembers.forEach(member => {
        const overloadClass = getOverloadClassForMember(member.overload);
        const subareaKey = member.subarea || '';
        const subareaTag = subareaKey
            ? `<span class="member-subarea-tag" style="background:${subareaColors[subareaKey]}20;color:${subareaColors[subareaKey]};border:1px solid ${subareaColors[subareaKey]}55">
                   ${subareaLabels[subareaKey]}
               </span>`
            : '';

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>
                <strong>${member.name}</strong>
            </td>
            <td>
                <div style="display:flex;flex-direction:column;gap:4px">
                    <span>${member.role}</span>
                    ${subareaTag}
                </div>
            </td>
            <td>
                <div class="overload-tooltip-wrapper" data-member-id="${member.id}">
                    <span class="overload-indicator ${overloadClass}">
                        ${member.overload} pontos <i class="fas fa-info-circle" style="font-size:0.8em;opacity:0.7"></i>
                    </span>
                </div>
            </td>
            <td>
                <div class="action-buttons">
                    <button class="btn btn-info btn-extra-small" onclick="editMember('${member.id}'); openModal('modalMember')">
                        <i class="fas fa-edit"></i> Editar
                    </button>
                    <button class="btn btn-danger btn-extra-small" onclick="confirmDelete('member', '${member.id}', '${member.name.replace(/'/g, "\\'")}')">
                        <i class="fas fa-trash"></i> Remover
                    </button>
                </div>
            </td>
        `;
        list.appendChild(tr);
    });

    setupOverloadTooltips();
}

// CRUD

// Exemplo de função de exclusão (necessário implementar no ProjectService)
async function deleteMember(id) {
    const res = await ProjectService.removerMembro(id);
    if(res.success) {
        members = members.filter(m => m.id !== id);
        showFloatingAlert('Membro removido.');
        updateFullInterface();
    } else {
        showFloatingAlert('Erro ao remover: ' + res.error, 'error');
    }
}

//editando membro
// Função para preparar o formulário para EDIÇÃO
function editMember(id) {
    const member = members.find(m => m.id === id);
    if (!member) return;

    // 1. Preencher formulário com dados do membro
    document.getElementById('memberId').value = member.id;
    document.getElementById('memberName').value = member.name;
    document.getElementById('memberRole').value = member.role;
    document.getElementById('memberSubarea').value = member.subarea || '';
    //document.getElementById('memberEmail').value = member.email;

    // 2. Alterar estado visual para edição
    editingMemberId = id; // Variável global de controle
    
    const submitBtn = document.querySelector('#memberForm button[type="submit"]');
    if (submitBtn) {
        submitBtn.innerHTML = '<i class="fas fa-save"></i> Atualizar Membro';
        submitBtn.classList.remove('btn-primary'); // Opcional
        submitBtn.classList.add('btn-warning');    // Opcional
    }
    
    // Mostrar botão cancelar
    const cancelBtn = document.getElementById('memberCancelBtn');
    if (cancelBtn) cancelBtn.style.display = 'inline-block';

    // Rolar para o topo do formulário
    document.getElementById('memberForm').scrollIntoView({ behavior: 'smooth' });

    showFloatingAlert(`Editando membro: ${member.name}`, 'info');
}

// Função para cancelar edição / limpar estado
function resetMemberFormState() {
    editingMemberId = null;

    const form = document.getElementById('memberForm');
    if (form) form.reset();

    const submitBtn = document.querySelector('#memberForm button[type="submit"]');
    if (submitBtn) {
        submitBtn.innerHTML = '<i class="fas fa-plus"></i> Adicionar Membro';
        submitBtn.classList.remove('btn-warning');
        // submitBtn.classList.add('btn-primary');
    }

    const cancelBtn = document.getElementById('memberCancelBtn');
    if (cancelBtn) cancelBtn.style.display = 'none';
}

// Configurar botão cancelar (chame isso no setupCancelButtons ou DOMContentLoaded)
const btnCancelMember = document.getElementById('memberCancelBtn');
if (btnCancelMember) {
    btnCancelMember.addEventListener('click', function(e) {
        e.preventDefault();
        resetMemberFormState();
        showFloatingAlert('Edição cancelada.', 'info');
    });
}