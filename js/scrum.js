//RENDER 
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
        const scrumMaster = members.find(m => m.id === project.scrum_master);
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
                <button class="btn btn-danger btn-extra-small" onclick="confirmDelete('scrum', '${project.id}', '${project.name}')">
                    <i class="fas fa-user-slash"></i> Remover
                </button>
            </td>
        `;

        scrumList.appendChild(row);
    });
}

// UTILITARIOS
function updateScrumSelects() {
    const select = document.getElementById('scrumMasterSelect');
    if (!select) return;
    
    select.innerHTML = '<option value="">Selecione um Scrum Master...</option>';
    
    members.forEach(member => {
        // value é UUID
        select.innerHTML += `<option value="${member.id}">${member.name}</option>`;
    });
}

//formulario do scrum
// --- FORMULÁRIO DE DEFINIR SCRUM MASTER ---
const scrumForm = document.getElementById('scrumForm');

if (scrumForm) {
    scrumForm.addEventListener('submit', async function (e) {
        e.preventDefault();

        // 1. Obter valores (UUIDs)
        const projectId = document.getElementById('scrumProject').value;
        const scrumMasterId = document.getElementById('scrumMaster').value;

        if (!projectId || !scrumMasterId) {
            showFloatingAlert('Por favor, selecione um projeto e um membro.', 'warning');
            return;
        }

        // 2. Validações Lógicas
        const project = projects.find(p => p.id === projectId);
        if (!project) {
            showFloatingAlert('Projeto não encontrado.', 'error');
            return;
        }

        // Verifica se o membro está alocado no projeto (Regra de Negócio)
        // Nota: O campo no banco é allocated_members (snake_case)
        const allocated = project.allocated_members || [];
        if (!allocated.includes(scrumMasterId)) {
            showFloatingAlert('Este membro não está alocado no projeto. Aloque-o antes de torná-lo Scrum Master.', 'warning');
            return;
        }

        // 3. Feedback Visual
        const submitBtn = this.querySelector('button[type="submit"]');
        const originalText = submitBtn.innerHTML;
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Salvando...';
        submitBtn.disabled = true;

        try {
            // 4. Chamada ao Supabase
            const res = await ProjectService.definirScrumMaster(projectId, scrumMasterId);

            if (res.success) {
                // Atualiza localmente
                const index = projects.findIndex(p => p.id === projectId);
                if (index !== -1) {
                    projects[index] = res.data;
                }

                // Mensagem de sucesso bonita
                const member = members.find(m => m.id === scrumMasterId);
                const memberName = member ? member.name : 'Membro';
                showFloatingAlert(`${memberName} agora é Scrum Master de "${project.name}"!`, 'success');

                this.reset(); // Limpa o formulário
                updateFullInterface(); // Atualiza tabelas e cards
            } else {
                showFloatingAlert('Erro: ' + res.error, 'error');
            }

        } catch (err) {
            console.error(err);
            showFloatingAlert('Erro inesperado.', 'error');
        } finally {
            submitBtn.innerHTML = originalText;
            submitBtn.disabled = false;
        }
    });
}

// CRUD 

// Função para preencher os selects da aba Scrum Master
function updateScrumManagementSelects() {
    // 1. Preencher Select de Projetos
    const projSelect = document.getElementById('scrumProject');
    if (projSelect) {
        projSelect.innerHTML = '<option value="">Selecione um projeto...</option>';
        projects.forEach(p => {
            projSelect.innerHTML += `<option value="${p.id}">${p.name}</option>`;
        });
    }

    // 2. Preencher Select de Membros
    const memberSelect = document.getElementById('scrumMaster');
    if (memberSelect) {
        memberSelect.innerHTML = '<option value="">Selecione um membro...</option>';
        members.forEach(m => {
            memberSelect.innerHTML += `<option value="${m.id}">${m.name}</option>`;
        });
    }
}

// Função para remover Scrum Master
async function removeScrumMaster(projectId) {
    // Encontra o projeto localmente apenas para pegar o nome (opcional, para feedback)
    const project = projects.find(p => p.id === projectId);
    
    if (!project) return;

    try {
        // Chama o serviço passando NULL como ID do membro
        // Isso vai setar a coluna scrum_master como NULL no banco
        const res = await ProjectService.definirScrumMaster(projectId, null);

        if (res.success) {
            // 1. Atualiza o estado local com os dados atualizados do servidor
            const index = projects.findIndex(p => p.id === projectId);
            if (index !== -1) {
                projects[index] = res.data;
            }

            // 2. Atualiza toda a interface (Gráficos, Tabelas, Selects)
            updateFullInterface();

            showFloatingAlert('Scrum Master removido com sucesso!', 'success');
        } else {
            showFloatingAlert('Erro ao remover: ' + res.error, 'error');
        }
    } catch (err) {
        console.error("Erro ao remover SM:", err);
        showFloatingAlert('Erro inesperado ao remover Scrum Master.', 'error');
    }
}