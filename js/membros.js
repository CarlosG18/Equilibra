// FORMS 

// --- LISTENER DO FORMULÁRIO DE MEMBROS (CRIAR E EDITAR) ---
const memberForm = document.getElementById('memberForm');

if (memberForm) {
    memberForm.addEventListener('submit', async function (e) {
        e.preventDefault();

        // 1. COLETAR DADOS
        const name = document.getElementById('memberName').value;
        const role = document.getElementById('memberRole').value;
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
                res = await ProjectService.atualizarMembro(editingMemberId, name, role);

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
                res = await ProjectService.adicionarMembro(name, role);

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

function renderMembers() {
    const list = document.getElementById('membersList'); // Ajuste o ID conforme seu HTML (pode ser membersWorkloadList ou outro)
    if (!list) return;

    list.innerHTML = '';
    
    // Ordenar por sobrecarga (decrescente)
    const sortedMembers = [...members].sort((a, b) => b.overload - a.overload);

    sortedMembers.forEach(member => {
        // Encontrar projetos deste membro
        const memberProjects = projects.filter(p => 
            (p.allocated_members && p.allocated_members.includes(member.id)) || 
            p.scrum_master === member.id
        );

        const projectNames = memberProjects.map(p => p.name).join(', ');
        const overloadClass = getOverloadClassForMember(member.overload);

        // Verifica se é SM em algum lugar
        const isSM = projects.some(p => p.scrum_master === member.id);
        
        // Verifica atividades
        const memberActivities = extraActivities.filter(a => a.member_id === member.id && a.status === 'ativa');

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>
                <strong>${member.name}</strong>
            </td>
            <td>${member.role}</td>
            <td>
                <span class="overload-indicator ${overloadClass}">${member.overload} pontos</span>
            </td>
            <td>
                <div class="action-buttons">
                    <button class="btn btn-info btn-extra-small" onclick="editMember('${member.id}')">
                        <i class="fas fa-edit"></i> Editar
                    </button>
                    <button class="btn btn-danger btn-extra-small" onclick="confirmDelete('member', '${member.id}', '${member.name}')">
                        <i class="fas fa-trash"></i> Remover
                    </button>
                </div>
            </td>
        `;
        list.appendChild(tr);
    });
}

// CRUD

// Exemplo de função de exclusão (necessário implementar no ProjectService)
async function deleteMember(id) {
    if(confirm('Tem certeza que deseja remover este membro?')) {
        const res = await ProjectService.removerMembro(id); // Criar essa função no supabase.js
        if(res.success) {
            // Remove localmente
            members = members.filter(m => m.id !== id);
            showFloatingAlert('Membro removido.');
            updateFullInterface();
        } else {
            showFloatingAlert('Erro ao remover: ' + res.error, 'error');
        }
    }
}

//editando membro
// Função para preparar o formulário para EDIÇÃO
function editMember(id) {
    const member = members.find(m => m.id === id);
    if (!member) return;

    // 1. Preencher formulário com dados do membro
    document.getElementById('memberId').value = member.id; // Se houver campo hidden
    document.getElementById('memberName').value = member.name;
    document.getElementById('memberRole').value = member.role;
    document.getElementById('memberEmail').value = member.email;

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