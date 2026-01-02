// FORMS

// --- LISTENER DO FORMULÁRIO DE PROJETO (CRIAR E EDITAR) ---
const projectForm = document.getElementById('projectForm');

if (projectForm) {
    projectForm.addEventListener('submit', async function (e) {
        e.preventDefault();

        // 1. COLETAR DADOS DO FORMULÁRIO
        const name = document.getElementById('projectName').value;
        const descInput = document.getElementById('projectDescription');
        const desc = descInput ? descInput.value : '';
        
        // Verifica se o ID é projectPoints ou overloadPoints
        const pointsInput = document.getElementById('overloadPoints') || document.getElementById('projectPoints');
        const points = pointsInput ? pointsInput.value : 0;

        // 2. TENTAR RECUPERAR O ID DO PROJETO DE FORMA SEGURA
        // Prioriza o valor do input hidden 'projectId', se não tiver, tenta a variável global
        const hiddenIdInput = document.getElementById('projectId');
        const idParaEditar = (hiddenIdInput && hiddenIdInput.value) ? hiddenIdInput.value : editingProjectId;

        // 3. COLETAR MEMBROS
        const selectedMembers = [];
        document.querySelectorAll('input[name="projectMembers"]:checked').forEach(cb => {
            selectedMembers.push(cb.value);
        });

        // 4. FEEDBACK VISUAL
        const submitBtn = this.querySelector('button[type="submit"]');
        const originalText = submitBtn.innerHTML;
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processando...';
        submitBtn.disabled = true;

        try {
            let res;

            // --- DECISÃO: CRIAR OU ATUALIZAR? ---
            if (idParaEditar) {
                // >>> MODO EDIÇÃO <<<
                
                // CORREÇÃO DO SCRUM MASTER:
                // Busca o projeto original para manter o Scrum Master que já estava definido
                let currentScrumMasterId = null;
                const originalProject = projects.find(p => p.id === idParaEditar);
                if (originalProject) {
                    currentScrumMasterId = originalProject.scrum_master;
                }

                // Chama atualização passando 'idParaEditar' e o 'currentScrumMasterId'
                res = await ProjectService.atualizarProjeto(
                    idParaEditar, 
                    name, 
                    desc, 
                    points, 
                    currentScrumMasterId, // Mantém o SM original
                    selectedMembers
                );

                if (res.success) {
                    // Atualiza localmente
                    const index = projects.findIndex(p => p.id === idParaEditar);
                    if (index !== -1) {
                        projects[index] = res.data;
                    }
                    showFloatingAlert('Projeto atualizado com sucesso!');
                    resetProjectFormState();
                }

            } else {
                // >>> MODO CRIAÇÃO <<<
                res = await ProjectService.adicionarProjeto(
                    name, 
                    desc, 
                    points, 
                    null, // Novo projeto começa sem SM (definido na outra aba)
                    selectedMembers
                );
                
                if (res.success) {
                    projects.push(res.data);
                    showFloatingAlert('Projeto criado com sucesso!');
                    this.reset();
                    updateAllocationCheckboxes(); 
                }
            }

            // --- FINALIZAÇÃO ---
            if (!res.success) {
                showFloatingAlert('Erro: ' + res.error, 'error');
            } else {
                updateFullInterface();
            }

        } catch (err) {
            console.error("Erro no processamento:", err);
            showFloatingAlert('Erro inesperado ao salvar projeto.', 'error');
        } finally {
            // Restaura botão
            if (typeof editingProjectId !== 'undefined' && editingProjectId) {
                submitBtn.innerHTML = '<i class="fas fa-save"></i> Atualizar Projeto';
            } else {
                submitBtn.innerHTML = originalText || '<i class="fas fa-plus"></i> Criar Projeto';
            }
            submitBtn.disabled = false;
        }
    });
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
                <span class="overload-indicator ${getOverloadClassForMember(proj.overloadPoints)}">
                    ${proj.overload_points} pontos
                </span>
            </td>
            <td>
                ${sm !== 'Não definido' ?
                `<span class="scrum-indicator">${smName}</span>` :
                '<span style="color: var(--gray); font-style: italic;">Não definido</span>'}
            </td>
            <td>${teamHtml || 'Nenhum membro alocado'}</td>
            <td>
                <div class="action-buttons">
                    <button class="btn btn-info btn-extra-small" onclick="editProject('${proj.id}'); openModal('modalProject')">
                        <i class="fas fa-edit"></i> Editar
                    </button>
                    <button class="btn btn-danger btn-extra-small" onclick="confirmDelete('project', '${proj.id}', '${proj.name}')">
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

    // 3. Preencher Membros Alocados (Checkboxes)
    // Primeiro, garante que os checkboxes existem
    updateAllocationCheckboxes(); 
    
    // Depois, marca os que estão no projeto
    const allocatedIDs = project.allocated_members || [];
    const checkboxes = document.querySelectorAll('input[name="projectMembers"]');
    
    checkboxes.forEach(cb => {
        // Se o valor do checkbox (ID do membro) estiver no array do projeto, marca ele
        cb.checked = allocatedIDs.includes(cb.value);
    });

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
    if(form) form.reset();

    const submitBtn = document.querySelector('#projectForm button[type="submit"]');
    if(submitBtn) {
        submitBtn.innerHTML = '<i class="fas fa-plus"></i> Criar Projeto'; // Texto original
        submitBtn.classList.remove('btn-warning');
        // submitBtn.classList.add('btn-primary'); // Se usar classes bootstrap
    }

    const cancelBtn = document.getElementById('projectCancelBtn');
    if(cancelBtn) cancelBtn.style.display = 'none';
    
    // Reseta checkboxes visualmente
    updateAllocationCheckboxes();
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