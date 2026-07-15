// ==========================================
// CONFIGURAÇÃO DO SUPABASE
// ==========================================

// Verifica se o arquivo de configuração foi carregado antes
if (typeof CONFIG === 'undefined') {
    console.error('ERRO CRÍTICO: O arquivo config.js não foi carregado. As credenciais estão faltando.');
    alert('Erro de configuração: config.js não encontrado.');
}

// Pega as credenciais do objeto global CONFIG (definido no config.js)
const SUPABASE_URL = CONFIG.SUPABASE_URL;
const SUPABASE_KEY = CONFIG.SUPABASE_KEY;

// Verifica se a biblioteca do Supabase foi carregada (CDN)
if (typeof supabase === 'undefined') {
    console.error('ERRO: A biblioteca do Supabase não foi carregada. Verifique o index.html.');
}

// Inicializa o cliente
const _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// Opcional: Coloca o cliente no window para poder usar no console do navegador para testes
window._supabase = _supabase;

// ==========================================
// SERVIÇO DE DADOS (ProjectService)
// ==========================================

const ProjectService = {
    
    // --- 1. UTILITÁRIOS GERAIS ---
    
    async testConnection() {
        console.log("🔵 Testando conexão com Supabase...");
        const { data, error } = await _supabase.from('members').select('id').limit(1);
        
        if (error) {
            console.error("🔴 Erro de conexão:", error.message);
            return { success: false, message: error.message };
        }
        console.log("🟢 Conexão OK!");
        return { success: true };
    },

    async carregarTodosDados() {
        console.log("🔄 Buscando dados do banco...");
        
        try {
            const [membersRes, projectsRes, activitiesRes] = await Promise.all([
                _supabase.from('members').select('*'),
                _supabase.from('projects').select('*'),
                _supabase.from('extra_activities').select('*')
            ]);

            if (membersRes.error) throw membersRes.error;
            if (projectsRes.error) throw projectsRes.error;
            if (activitiesRes.error) throw activitiesRes.error;

            return {
                success: true,
                data: {
                    members: membersRes.data || [],
                    projects: projectsRes.data || [],
                    activities: activitiesRes.data || []
                }
            };

        } catch (error) {
            console.error("Erro ao carregar dados:", error.message);
            return { success: false, error: error.message };
        }
    },

    // ==========================================
    // --- 2. CRUD DE MEMBROS ---
    // ==========================================

    async adicionarMembro(name, role, subarea, num_materias, trabalho) {
        const { data, error } = await _supabase
            .from('members')
            .insert([{
                name,
                role,
                subarea: subarea || null,
                num_materias: parseInt(num_materias) || 0,
                trabalho: !!trabalho,
            }])
            .select();

        if (error) return { success: false, error: error.message };
        return { success: true, data: data[0] };
    },

    async atualizarMembro(id, name, role, subarea, num_materias, trabalho) {
        const { data, error } = await _supabase
            .from('members')
            .update({
                name,
                role,
                subarea: subarea || null,
                num_materias: parseInt(num_materias) || 0,
                trabalho: !!trabalho,
            })
            .eq('id', id)
            .select();

        if (error) return { success: false, error: error.message };
        return { success: true, data: data[0] };
    },

    async removerMembro(id) {
        const { error } = await _supabase.from('members').delete().eq('id', id);
        if (error) return { success: false, error: error.message };
        return { success: true };
    },

    // ==========================================
    // --- 3. CRUD DE PROJETOS (Com Correção de Scrum Master) ---
    // ==========================================

    async adicionarProjeto(name, description, overloadPoints, scrumMasterId, allocatedMembersIds, deadline, type) {
        if (!type) return { success: false, error: 'Tipo do projeto é obrigatório.' };

        const { data, error } = await _supabase
            .from('projects')
            .insert([{
                name,
                description,
                overload_points: parseInt(overloadPoints),
                scrum_master: scrumMasterId || null,
                allocated_members: allocatedMembersIds,
                deadline: deadline || null,
                type
            }])
            .select();

        if (error) return { success: false, error: error.message };
        return { success: true, data: data[0] };
    },

    async atualizarProjeto(id, name, description, overloadPoints, scrumMasterId, allocatedMembersIds, deadline, type) {
        if (!type) return { success: false, error: 'Tipo do projeto é obrigatório.' };

        const updateData = {
            name,
            description,
            overload_points: parseInt(overloadPoints),
            scrum_master: scrumMasterId || null,
            allocated_members: allocatedMembersIds,
            deadline: deadline || null,
            type
        };

        const { data, error } = await _supabase
            .from('projects')
            .update(updateData)
            .eq('id', id)
            .select();

        if (error) return { success: false, error: error.message };
        return { success: true, data: data[0] };
    },

    // Função específica rápida apenas para trocar o SM (opcional, mas útil)
    async definirScrumMaster(projectId, scrumMasterId) {
        const updatePayload = { scrum_master: scrumMasterId || null };

        // Se está atribuindo um SM, garante que ele está no allocated_members
        if (scrumMasterId) {
            const { data: current, error: fetchError } = await _supabase
                .from('projects')
                .select('allocated_members')
                .eq('id', projectId)
                .single();

            if (fetchError) return { success: false, error: fetchError.message };

            const allocated = current.allocated_members || [];
            if (!allocated.includes(scrumMasterId)) {
                updatePayload.allocated_members = [...allocated, scrumMasterId];
            }
        }

        const { data, error } = await _supabase
            .from('projects')
            .update(updatePayload)
            .eq('id', projectId)
            .select();

        if (error) return { success: false, error: error.message };
        return { success: true, data: data[0] };
    },

    async removerProjeto(id) {
        const { error } = await _supabase.from('projects').delete().eq('id', id);
        if (error) return { success: false, error: error.message };
        return { success: true };
    },

    // --- Ciclo independente de status do UX/UI ---

    async alterarStatusUxUi(projectId, novoStatus, statusAnterior, uxUiMemberId, nota, sprints) {
        const validStatuses = ['nao_iniciado', 'em_andamento', 'finalizado', 'em_correcao'];
        if (!validStatuses.includes(novoStatus)) {
            return { success: false, error: 'Status de UX/UI inválido.' };
        }
        if (!uxUiMemberId) {
            return { success: false, error: 'Selecione o membro de UX/UI do projeto.' };
        }

        const updatePayload = { ux_ui_status: novoStatus, ux_ui_member_id: uxUiMemberId };

        // Só "Em andamento" cobra sobrecarga: exige quantos sprints o UX/UI vai
        // ficar ocupado, e os pontos só contam até esse prazo vencer. Em
        // qualquer outro status (inclusive "Em correção") o membro segue como
        // UX/UI da equipe para próximas atividades, sem gerar pontos.
        const isWorking = novoStatus === 'em_andamento';
        if (isWorking) {
            const n = parseInt(sprints);
            if (!n || n < 1) {
                return { success: false, error: 'Informe quantos sprints o UX/UI vai ficar ocupado.' };
            }
            const deadline = new Date();
            deadline.setDate(deadline.getDate() + n * 7); // 1 sprint = 1 semana
            updatePayload.ux_ui_sprints = n;
            updatePayload.ux_ui_points = n * 2;
            updatePayload.ux_ui_deadline = deadline.toISOString().split('T')[0];
        }

        const { data: projectData, error: projectError } = await _supabase
            .from('projects')
            .update(updatePayload)
            .eq('id', projectId)
            .select();

        if (projectError) return { success: false, error: projectError.message };

        const { data: historyData, error: historyError } = await _supabase
            .from('project_ux_status_history')
            .insert([{
                project_id: projectId,
                previous_status: statusAnterior || null,
                new_status: novoStatus,
                ux_ui_member_id: uxUiMemberId,
                nota: nota || null
            }])
            .select();

        if (historyError) return { success: false, error: historyError.message };

        return { success: true, project: projectData[0], history: historyData[0] };
    },

    async buscarHistoricoUxUi(projectId) {
        const { data, error } = await _supabase
            .from('project_ux_status_history')
            .select('*')
            .eq('project_id', projectId)
            .order('created_at', { ascending: false })
            .order('id', { ascending: false });

        if (error) return { success: false, error: error.message };
        return { success: true, data: data || [] };
    },

    // ==========================================
    // --- 4. CRUD DE ATIVIDADES EXTRAS ---
    // ==========================================

    // CRIAR
    async adicionarAtividade(name, description, memberIds, points, status, deadline) {
        const { data, error } = await _supabase
            .from('extra_activities')
            .insert([{
                name,
                description,
                allocated_members: memberIds,
                points: parseInt(points),
                status: status || 'ativa',
                deadline: deadline || null
            }])
            .select();

        if (error) return { success: false, error: error.message };
        return { success: true, data: data[0] };
    },

    // ATUALIZAR
    async atualizarAtividade(id, name, description, memberIds, points, status, deadline) {
        const { data, error } = await _supabase
            .from('extra_activities')
            .update({
                name,
                description,
                allocated_members: memberIds,
                points: parseInt(points),
                status: status,
                deadline: deadline || null
            })
            .eq('id', id)
            .select();

        if (error) return { success: false, error: error.message };
        return { success: true, data: data[0] };
    },

    async atualizarStatusAtividade(id, novoStatus) {
        const { data, error } = await _supabase
            .from('extra_activities')
            .update({ status: novoStatus })
            .eq('id', id)
            .select();

        if (error) return { success: false, error: error.message };
        return { success: true, data: data[0] };
    },

    async removerAtividade(id) {
        const { error } = await _supabase.from('extra_activities').delete().eq('id', id);
        if (error) return { success: false, error: error.message };
        return { success: true };
    }
};