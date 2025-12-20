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

    async adicionarMembro(name, role) {
        const { data, error } = await _supabase
            .from('members')
            .insert([{ name, role }])
            .select();

        if (error) return { success: false, error: error.message };
        return { success: true, data: data[0] };
    },

    async atualizarMembro(id, name, role) {
        const { data, error } = await _supabase
            .from('members')
            .update({ name, role })
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

    async adicionarProjeto(name, description, overloadPoints, scrumMasterId, allocatedMembersIds) {
        const { data, error } = await _supabase
            .from('projects')
            .insert([{ 
                name, 
                description, 
                overload_points: parseInt(overloadPoints), 
                scrum_master: scrumMasterId || null, // Garante NULL se vier vazio
                allocated_members: allocatedMembersIds // Array de UUIDs
            }])
            .select();

        if (error) return { success: false, error: error.message };
        return { success: true, data: data[0] };
    },

    // AQUI ESTÁ A ATUALIZAÇÃO IMPORTANTE
    async atualizarProjeto(id, name, description, overloadPoints, scrumMasterId, allocatedMembersIds) {
        // Prepara o objeto de update garantindo a associação correta
        const updateData = { 
            name, 
            description, 
            overload_points: parseInt(overloadPoints), 
            scrum_master: scrumMasterId || null, // Se vier string vazia "", salva como NULL
            allocated_members: allocatedMembersIds
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
        const { data, error } = await _supabase
            .from('projects')
            .update({ scrum_master: scrumMasterId || null })
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

    // ==========================================
    // --- 4. CRUD DE ATIVIDADES EXTRAS ---
    // ==========================================

    // CRIAR
    async adicionarAtividade(name, description, memberIds, points, status) {
        // memberIds deve ser um ARRAY de strings (UUIDs)
        const { data, error } = await _supabase
            .from('extra_activities')
            .insert([{ 
                name, 
                description, 
                allocated_members: memberIds, // <--- Mudou aqui (Array)
                points: parseInt(points),
                status: status || 'ativa'
            }])
            .select();

        if (error) return { success: false, error: error.message };
        return { success: true, data: data[0] };
    },

    // ATUALIZAR
    async atualizarAtividade(id, name, description, memberIds, points, status) {
        const { data, error } = await _supabase
            .from('extra_activities')
            .update({ 
                name, 
                description, 
                allocated_members: memberIds, // <--- Mudou aqui
                points: parseInt(points),
                status: status
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