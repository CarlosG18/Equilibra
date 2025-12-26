// testes.js - CORRIGIDO E INTEGRADO

// Variável local para armazenar os testes carregados
let projectTests = [];

/**
 * Carrega os testes do banco de dados (Supabase)
 */
async function loadTests() {
    // CORREÇÃO: Usamos _supabase (definido no supabase.js) em vez de supabase
    const { data: tData, error } = await _supabase
        .from('project_tests')
        .select('*, projects(name), test_members(member_id)');

    if (error) {
        console.error('Erro ao carregar testes:', error);
        return;
    }

    // Processa os dados para facilitar o uso no front-end
    // Mapeia os IDs para nomes usando os dados globais se disponíveis
    projectTests = (tData || []).map(t => ({
        ...t,
        projectName: t.projects ? t.projects.name : 'Projeto Excluído',
        members: t.test_members.map(tm => tm.member_id)
    }));

    renderTests();
    
    // Se existir a função global de atualização do dashboard, chama ela
    if (typeof updateDashboard === 'function') {
        updateDashboard(); 
    }
}

/**
 * Renderiza a tabela HTML na aba de Testes
 */
function renderTests() {
    const list = document.getElementById('testsList');
    if (!list) return;

    list.innerHTML = '';
    
    if (projectTests.length === 0) {
        list.innerHTML = '<tr><td colspan="6" style="text-align:center">Nenhum teste criado.</td></tr>';
        return;
    }

    projectTests.forEach(t => {
        // Tenta resolver os nomes dos membros usando a lista global 'members' (do membros.js/app.js)
        // Se 'members' não estiver carregado ainda, mostra os IDs ou 'Carregando...'
        let memberNames = '...';
        if (typeof members !== 'undefined' && Array.isArray(members)) {
            memberNames = t.members.map(mid => {
                const m = members.find(x => x.id === mid);
                return m ? m.name : 'Desconhecido';
            }).join(', ');
        } else {
            memberNames = `${t.members.length} membro(s)`;
        }

        const statusBadge = t.status === 'em_andamento' 
            ? '<span class="badge badge-active" style="background:#2ecc71; color:white; padding:4px 8px; border-radius:4px;">Em Andamento</span>' 
            : '<span class="badge badge-done" style="background:#95a5a6; color:white; padding:4px 8px; border-radius:4px;">Concluído</span>';
        
        // Botão de ação (Concluir ou Reabrir)
        const toggleBtn = t.status === 'em_andamento'
            ? `<button class="btn btn-success btn-extra-small" onclick="toggleTestStatus(${t.id}, 'concluido')" title="Concluir Teste" style="margin-right:5px;"><i class="fas fa-check"></i></button>`
            : `<button class="btn btn-warning btn-extra-small" onclick="toggleTestStatus(${t.id}, 'em_andamento')" title="Reabrir Teste" style="margin-right:5px;"><i class="fas fa-undo"></i></button>`;

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><strong>${t.name}</strong></td>
            <td>${t.projectName}</td>
            <td><small>${memberNames || 'Ninguém'}</small></td>
            <td>${t.overload_points} pts</td>
            <td>${statusBadge}</td>
            <td>
                <div style="display:flex; align-items:center;">
                    ${toggleBtn}
                    <button class="btn btn-danger btn-extra-small" onclick="askDeleteTest(${t.id})"><i class="fas fa-trash"></i></button>
                </div>
            </td>
        `;
        list.appendChild(tr);
    });
}

/**
 * Função para criar um novo teste (Submit do Formulário)
 */
async function createTest(event) {
    event.preventDefault(); // Impede recarregar a página
    
    const projectId = document.getElementById('testProjectSelect').value;
    const name = document.getElementById('testName').value;
    const points = document.getElementById('testPoints').value;
    const status = document.getElementById('testStatus').value;
    
    // Pega todos os checkboxes marcados
    const checks = document.querySelectorAll('.tm-check:checked');

    if (!projectId) {
        showFloatingAlert('Selecione um projeto vinculado.', 'error');
        return;
    }

    showFloatingAlert('Salvando teste...', 'info');

    // 1. Insere o Teste na tabela project_tests
    // CORREÇÃO: Usamos _supabase
    const { data: testData, error } = await _supabase
        .from('project_tests')
        .insert({ 
            project_id: projectId, 
            name: name, 
            overload_points: parseInt(points), 
            status: status 
        })
        .select()
        .single();

    if (error) {
        console.error('Erro ao criar teste:', error);
        showFloatingAlert('Erro ao criar teste: ' + error.message, 'error');
        return;
    }

    // 2. Vincula os Membros na tabela test_members (muitos-para-muitos)
    if (checks.length > 0) {
        const inserts = Array.from(checks).map(c => ({
            test_id: testData.id,
            member_id: c.value // UUID do membro
        }));
        
        // CORREÇÃO: Usamos _supabase
        const { error: memberError } = await _supabase
            .from('test_members')
            .insert(inserts);
            
        if (memberError) {
            console.error('Erro ao vincular membros:', memberError);
            showFloatingAlert('Teste criado, mas houve erro ao vincular membros.', 'warning');
        }
    }

    showFloatingAlert('Teste criado com sucesso!', 'success');
    
    // Limpa o formulário
    document.getElementById('testForm').reset();
    if(document.getElementById('testPointsVal')) {
        document.getElementById('testPointsVal').textContent = '3'; 
    }
    
    // Recarrega a lista
    await loadTests();
    
    // Tenta atualizar a carga geral se a função loadData existir (do app.js)
    if(typeof loadData === 'function') {
        await loadData();
    }
}

/**
 * Alterna o status do teste (Em andamento <-> Concluído)
 */
async function toggleTestStatus(id, newStatus) {
    showFloatingAlert('Atualizando status...', 'info');
    
    // CORREÇÃO: Usamos _supabase
    const { error } = await _supabase
        .from('project_tests')
        .update({ status: newStatus })
        .eq('id', id);

    if (!error) {
        await loadTests();
        // Atualiza carga global
        if(typeof loadData === 'function') await loadData();
        showFloatingAlert('Status atualizado!', 'success');
    } else {
        console.error(error);
        showFloatingAlert('Erro ao atualizar status.', 'error');
    }
}

/**
 * Exclusão de teste
 */
async function askDeleteTest(id) {
    if(confirm('Tem certeza que deseja excluir este teste?')) {
        // CORREÇÃO: Usamos _supabase
        const { error } = await _supabase
            .from('project_tests')
            .delete()
            .eq('id', id);
            
        if(!error) {
            showFloatingAlert('Teste excluído.', 'success');
            await loadTests();
            if(typeof loadData === 'function') await loadData();
        } else {
            showFloatingAlert('Erro ao excluir.', 'error');
        }
    }
}

/**
 * Atualiza os Selects e Checkboxes da aba de testes
 * Chamado quando a aba é aberta ou quando dados carregam
 */
function updateTestUIHelpers() {
    // 1. Select de Projetos
    const tProj = document.getElementById('testProjectSelect');
    // Verifica se 'projects' (global) existe e tem dados
    if (tProj && typeof projects !== 'undefined' && Array.isArray(projects)) {
        tProj.innerHTML = '<option value="">Selecione o Projeto</option>' + 
            projects.map(p => `<option value="${p.id}">${p.name}</option>`).join('');
    }

    // 2. Checkboxes de Membros
    const tCheckContainer = document.getElementById('testMembersChecks');
    // Verifica se 'members' (global) existe e tem dados
    if (tCheckContainer && typeof members !== 'undefined' && Array.isArray(members)) {
        tCheckContainer.innerHTML = members.map(m => `
            <div class="checkbox-item" style="display:flex; align-items:center; gap:8px; margin-bottom:5px;">
                <input type="checkbox" value="${m.id}" class="tm-check" id="tm_${m.id}"> 
                <label for="tm_${m.id}" style="cursor:pointer; margin:0;">
                    ${m.name} <small style="color:#6c757d">(${m.role || 'Membro'})</small>
                </label>
            </div>
        `).join('');
    }
}

// Inicialização ao carregar o DOM
document.addEventListener('DOMContentLoaded', () => {
    // Configura o slider visualmente
    const slider = document.getElementById('testPoints');
    if(slider) {
        slider.oninput = function() { 
            const display = document.getElementById('testPointsVal');
            if(display) display.textContent = this.value; 
        };
    }
    
    // Associa o submit do formulário à função createTest
    const form = document.getElementById('testForm');
    if(form) {
        // Remove listeners antigos para evitar duplicação (boa prática em SPAs simples)
        const newForm = form.cloneNode(true);
        form.parentNode.replaceChild(newForm, form);
        newForm.addEventListener('submit', createTest);
    }

    // Tenta carregar testes iniciais
    loadTests();
});