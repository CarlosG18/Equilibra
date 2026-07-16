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

// "2026-08-01" → "01/08". O ano fica implícito; a contagem regressiva ao lado
// dá o contexto temporal.
function _shortDateBR(iso) {
    return _formatDateBR(iso).slice(0, 5);
}

// Célula "Período": início → prazo final, com a contagem regressiva do prazo.
// Um teste que ainda não começou é sinalizado, já que ele não gera carga até lá.
function buildTestPeriodCell(test) {
    const start = test.start_date;
    const end = test.deadline;

    let range;
    if (start && end)      range = `${_shortDateBR(start)} → ${_shortDateBR(end)}`;
    else if (end)          range = `→ ${_shortDateBR(end)}`;
    else if (start)        range = `${_shortDateBR(start)} → sem prazo`;
    else                   range = '<span style="color:#aaa">Sem datas</span>';

    // A contagem regressiva só faz sentido com prazo final; sem ele,
    // formatDeadlineCountdown devolveria um "—" solto embaixo da faixa.
    const countdown = end ? formatDeadlineCountdown(end) : '';

    let notStarted = '';
    if (start && test.status === 'em_andamento') {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        if (new Date(start + 'T00:00:00') > today) {
            notStarted = '<br><span style="color:#8893a3; font-size:0.78em;"><i class="fas fa-hourglass-start"></i> Não iniciado</span>';
        }
    }

    return `
        <div style="font-size:0.85em; color:#444;">${range}</div>
        ${countdown}${notStarted}
    `;
}

/**
 * Renderiza a tabela HTML na aba de Testes
 */
function renderTests() {
    const list = document.getElementById('testsList');
    if (!list) return;

    list.innerHTML = '';
    
    if (projectTests.length === 0) {
        list.innerHTML = '<tr><td colspan="8" style="text-align:center">Nenhum teste criado.</td></tr>';
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

        let managerName = '';
        if (t.test_manager && typeof members !== 'undefined' && Array.isArray(members)) {
            const mgr = members.find(x => x.id === t.test_manager);
            managerName = mgr ? mgr.name : '';
        }

        const statusBadge = t.status === 'em_andamento' 
            ? '<span class="badge badge-active">Em Andamento</span>'
            : '<span class="badge badge-done">Concluído</span>';
        
        // Botão de ação (Concluir ou Reabrir)
        const toggleBtn = t.status === 'em_andamento'
            ? `<button class="btn btn-success btn-extra-small" onclick="toggleTestStatus(${t.id}, 'concluido')" title="Concluir Teste" style="margin-right:5px;"><i class="fas fa-check"></i></button>`
            : `<button class="btn btn-warning btn-extra-small" onclick="toggleTestStatus(${t.id}, 'em_andamento')" title="Reabrir Teste" style="margin-right:5px;"><i class="fas fa-undo"></i></button>`;

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><strong>${t.name}</strong></td>
            <td>${t.projectName}</td>
            <td><small>${managerName || '<span class="muted">Não definido</span>'}</small></td>
            <td><small>${memberNames || 'Ninguém'}</small></td>
            <td>${t.overload_points} pts</td>
            <td style="white-space: nowrap;">${buildTestPeriodCell(t)}</td>
            <td>${statusBadge}</td>
            <td>
                <div style="display:flex; align-items:center;">
                    ${toggleBtn}
                    <button class="btn btn-primary btn-extra-small" onclick="editTest(${t.id})" title="Editar Teste" style="margin-right:5px;"><i class="fas fa-edit"></i></button>
                    <button class="btn btn-danger btn-extra-small" onclick="askDeleteTest(${t.id})"><i class="fas fa-trash"></i></button>
                </div>
            </td>
        `;
        list.appendChild(tr);
    });
}

/**
 * Função para criar ou atualizar um teste (Submit do Formulário)
 */
async function createTest(event) {
    event.preventDefault(); // Impede recarregar a página

    const projectId = document.getElementById('testProjectSelect').value;
    const name = document.getElementById('testName').value;
    const points = document.getElementById('testPoints').value;
    const status = document.getElementById('testStatus').value;
    const deadlineInput = document.getElementById('testDeadline');
    const deadline = deadlineInput ? deadlineInput.value : '';
    const startDateInput = document.getElementById('testStartDate');
    const startDate = startDateInput ? startDateInput.value : '';
    const testManagerSelect = document.getElementById('testManager');
    const testManagerId = testManagerSelect ? testManagerSelect.value : '';

    // Pega todos os checkboxes marcados
    const checks = document.querySelectorAll('.tm-check:checked');

    if (!projectId) {
        showFloatingAlert('Selecione um projeto vinculado.', 'error');
        return;
    }

    if (startDate && deadline && startDate > deadline) {
        showFloatingAlert('O início do teste não pode ser depois do prazo final.', 'error');
        return;
    }

    const payload = {
        project_id: projectId,
        name: name,
        overload_points: parseInt(points),
        status: status,
        start_date: startDate || null,
        deadline: deadline || null,
        test_manager: testManagerId || null
    };

    let testId;

    if (editingTestId) {
        showFloatingAlert('Atualizando teste...', 'info');

        // 1. Atualiza o Teste na tabela project_tests
        const { error } = await _supabase
            .from('project_tests')
            .update(payload)
            .eq('id', editingTestId);

        if (error) {
            console.error('Erro ao atualizar teste:', error);
            showFloatingAlert('Erro ao atualizar teste: ' + error.message, 'error');
            return;
        }

        testId = editingTestId;

        // 2. Ressincroniza os membros vinculados (remove todos e reinsere os marcados)
        const { error: deleteError } = await _supabase
            .from('test_members')
            .delete()
            .eq('test_id', testId);

        if (deleteError) {
            console.error('Erro ao ressincronizar membros:', deleteError);
            showFloatingAlert('Teste atualizado, mas houve erro ao ressincronizar membros.', 'warning');
        }
    } else {
        showFloatingAlert('Salvando teste...', 'info');

        // 1. Insere o Teste na tabela project_tests
        const { data: testData, error } = await _supabase
            .from('project_tests')
            .insert(payload)
            .select()
            .single();

        if (error) {
            console.error('Erro ao criar teste:', error);
            showFloatingAlert('Erro ao criar teste: ' + error.message, 'error');
            return;
        }

        testId = testData.id;
    }

    // 3. Vincula os Membros na tabela test_members (muitos-para-muitos)
    if (checks.length > 0) {
        const inserts = Array.from(checks).map(c => ({
            test_id: testId,
            member_id: c.value // UUID do membro
        }));

        // CORREÇÃO: Usamos _supabase
        const { error: memberError } = await _supabase
            .from('test_members')
            .insert(inserts);

        if (memberError) {
            console.error('Erro ao vincular membros:', memberError);
            showFloatingAlert('Teste salvo, mas houve erro ao vincular membros.', 'warning');
        }
    }

    showFloatingAlert(editingTestId ? 'Teste atualizado com sucesso!' : 'Teste criado com sucesso!', 'success');
    resetTestFormState();
    closeModal('modalTest');

    // Recarrega a lista
    await loadTests();

    // Tenta atualizar a carga geral se a função loadData existir (do app.js)
    if(typeof loadData === 'function') {
        await loadData();
    }
}

/**
 * Preenche o formulário com os dados de um teste existente para edição
 */
function editTest(id) {
    const test = projectTests.find(t => t.id === id);
    if (!test) return;

    openModal('modalTest');

    document.getElementById('testId').value = test.id;
    document.getElementById('testProjectSelect').value = test.project_id;
    document.getElementById('testName').value = test.name;
    document.getElementById('testPoints').value = test.overload_points;
    syncTestPointsDisplay();

    document.getElementById('testStatus').value = test.status;

    const testManagerSelect = document.getElementById('testManager');
    if (testManagerSelect) testManagerSelect.value = test.test_manager || '';

    if (typeof resetDeadlinePicker === 'function') {
        resetDeadlinePicker('testDeadline');
    }
    const deadlineInput = document.getElementById('testDeadline');
    if (deadlineInput) deadlineInput.value = test.deadline || '';

    const startDateInput = document.getElementById('testStartDate');
    if (startDateInput) startDateInput.value = test.start_date || '';

    // Marca os membros já vinculados ao teste
    document.querySelectorAll('.tm-check').forEach(cb => {
        cb.checked = test.members.includes(cb.value);
    });

    editingTestId = id;

    const submitBtn = document.getElementById('testSubmitBtn');
    if (submitBtn) {
        submitBtn.innerHTML = '<i class="fas fa-save"></i> Atualizar Teste';
        submitBtn.classList.remove('btn-add-test');
        submitBtn.classList.add('btn-warning');
    }

    const cancelBtn = document.getElementById('testCancelBtn');
    if (cancelBtn) cancelBtn.style.display = 'inline-block';

    const form = document.getElementById('testForm');
    if (form) form.scrollIntoView({ behavior: 'smooth' });

    showFloatingAlert(`Editando teste: ${test.name}`, 'info');
}

/**
 * Restaura o formulário de teste ao estado de criação
 */
function resetTestFormState() {
    editingTestId = null;

    const submitBtn = document.getElementById('testSubmitBtn');
    if (submitBtn) {
        submitBtn.innerHTML = '<i class="fas fa-save"></i> Criar teste';
        submitBtn.classList.remove('btn-warning');
        submitBtn.classList.add('btn-add-test');
    }

    const cancelBtn = document.getElementById('testCancelBtn');
    if (cancelBtn) cancelBtn.style.display = 'none';
}

/**
 * Cancela a edição em andamento e limpa o formulário
 */
function cancelTestEdit() {
    resetTestFormState();
    const form = document.getElementById('testForm');
    if (form) form.reset();
    if (typeof resetDeadlinePicker === 'function') {
        resetDeadlinePicker('testDeadline');
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

    // 2. Select de Gestor de Testes
    const tManager = document.getElementById('testManager');
    if (tManager && typeof members !== 'undefined' && Array.isArray(members)) {
        const currentValue = tManager.value;
        tManager.innerHTML = '<option value="">Nenhum gestor definido</option>' +
            members.map(m => `<option value="${m.id}">${m.name}</option>`).join('');
        tManager.value = currentValue;
    }

    // 3. Checkboxes de Membros
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

// Mantém o número ao lado do slider igual ao valor dele.
function syncTestPointsDisplay() {
    const slider = document.getElementById('testPoints');
    const display = document.getElementById('testPointsVal');
    if (slider && display) display.textContent = slider.value;
}

// Inicialização ao carregar o DOM
document.addEventListener('DOMContentLoaded', () => {
    const slider = document.getElementById('testPoints');
    if (slider) {
        slider.addEventListener('input', syncTestPointsDisplay);
    }

    const form = document.getElementById('testForm');
    if (form) {
        form.addEventListener('submit', createTest);

        // O evento 'reset' dispara ANTES dos campos voltarem ao default, por isso
        // a ressincronização precisa esperar o próximo tick.
        form.addEventListener('reset', () => setTimeout(syncTestPointsDisplay, 0));
    }

    // Tenta carregar testes iniciais
    loadTests();
});