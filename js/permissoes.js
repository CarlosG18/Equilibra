// ==========================================================================
// PERMISSÕES — tipos de usuário (Diretor / Gerente / Membro).
//
// A fonte de verdade real é o RLS no Supabase (ver schema.sql — a mesma
// regra abaixo está espelhada lá em política de banco). O que fazemos aqui
// é só esconder da interface o que o papel atual não pode fazer, pra uma
// UX limpa: tentar mesmo assim seria barrado pelo banco de qualquer jeito.
// ==========================================================================

const ROLE_LABELS = { diretor: 'Diretor', gerente: 'Gerente', membro: 'Membro' };

// view: acessa a seção/aba. write: cria/edita. delete: apaga.
const PERMISSIONS = {
    diretor: {
        members:          { view: true, write: true,  delete: true },
        projects:         { view: true, write: true,  delete: true },
        situationReports: { view: true, write: true,  delete: true },
        tests:            { view: true, write: true,  delete: true },
        scrum:            { view: true, write: true,  delete: true },
        activities:       { view: true, write: true,  delete: true },
        planning:         { view: true },
        users:            { view: true, write: true,  delete: true },
    },
    gerente: {
        members:          { view: true, write: false, delete: false },
        projects:         { view: true, write: true,  delete: false },
        situationReports: { view: true, write: true,  delete: false },
        tests:            { view: true, write: true,  delete: false },
        scrum:            { view: true, write: false, delete: false },
        activities:       { view: true, write: true,  delete: true },
        planning:         { view: true },
        users:            { view: false, write: false, delete: false },
    },
    membro: {
        members:          { view: true, write: false, delete: false },
        projects:         { view: true, write: false, delete: false },
        situationReports: { view: true, write: false, delete: false },
        tests:            { view: true, write: false, delete: false },
        scrum:            { view: true, write: false, delete: false },
        activities:       { view: true, write: false, delete: false },
        planning:         { view: false },
        users:            { view: false, write: false, delete: false },
    },
};

let currentUserRole = 'membro';

// Busca o papel de quem está logado (RPC equilibra_get_my_role, ver
// schema.sql). Chamada uma vez por sessão, logo após o login — ver
// js/auth.js. Qualquer falha cai pro papel mais restrito, nunca pro mais
// permissivo: seguro por padrão.
async function loadCurrentUserRole() {
    try {
        const { data, error } = await _supabase.rpc('equilibra_get_my_role');
        currentUserRole = (!error && data) ? data : 'membro';
    } catch (e) {
        console.error('Erro ao buscar papel do usuário:', e);
        currentUserRole = 'membro';
    }
    return currentUserRole;
}

function can(section, action = 'view') {
    const sectionPerms = (PERMISSIONS[currentUserRole] || PERMISSIONS.membro)[section];
    return !!(sectionPerms && sectionPerms[action]);
}

// Esconde todo elemento [data-requires="secao:acao"] (ou [data-nav-requires
// ="secao"], equivalente a "view") que o papel atual não tenha permissão —
// abas inteiras (nav) ou controles pontuais (botões, formulários) dentro de
// uma aba que o usuário pode acessar.
function applyRolePermissions() {
    document.querySelectorAll('[data-requires]').forEach(el => {
        const [section, action] = el.dataset.requires.split(':');
        el.hidden = !can(section, action || 'view');
    });

    // Variante "OR": visível se QUALQUER uma das permissões listadas valer.
    // Usada pra esconder a célula/coluna "Ações" inteira só quando NENHUMA
    // ação daquela linha sobra pro papel atual (ex: Gerente em Testes ainda
    // vê "Editar", mesmo sem "Excluir" — a célula continua visível).
    document.querySelectorAll('[data-requires-any]').forEach(el => {
        const options = el.dataset.requiresAny.split(',');
        const allowed = options.some(opt => {
            const [section, action] = opt.trim().split(':');
            return can(section, action || 'view');
        });
        el.hidden = !allowed;
    });

    document.querySelectorAll('[data-nav-requires]').forEach(el => {
        el.hidden = !can(el.dataset.navRequires, 'view');
    });

    _renderRoleBadges();
}

function _renderRoleBadges() {
    document.querySelectorAll('.role-badge').forEach(el => {
        el.textContent = ROLE_LABELS[currentUserRole] || ROLE_LABELS.membro;
        el.classList.remove('role-badge-diretor', 'role-badge-gerente', 'role-badge-membro');
        el.classList.add(`role-badge-${currentUserRole}`);
    });
}

// Reaplica automaticamente sempre que o conteúdo do app muda (toda vez que
// uma render function troca o innerHTML de uma lista/tabela) — assim
// nenhuma render function precisa lembrar de chamar applyRolePermissions()
// manualmente depois de desenhar a própria lista.
let _roleObserver = null;
function watchRolePermissions() {
    const target = document.getElementById('app-content');
    if (!target || _roleObserver) return;

    _roleObserver = new MutationObserver(() => applyRolePermissions());
    _roleObserver.observe(target, { childList: true, subtree: true });
}
