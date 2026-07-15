// ==========================================================================
// TIPOS DE PROJETO — classificação + composição mínima de equipe.
// Fonte única usada por: projetos.js (badges de criação/edição/card)
//                        analises.js (simulação de capacidade "e se")
// ==========================================================================

const PROJECT_TYPES = [
    {
        key: 'site',
        name: 'Site',
        icon: 'fa-globe',
        desc: 'Site institucional / multi-página',
        ux_ui: 1,
        front: 2,
        back: 1,
        points: 5,   // sobrecarga estimada por membro alocado
        color: '#0787cb',
    },
    {
        key: 'lp_simples',
        name: 'Landing Page Simples',
        icon: 'fa-file',
        desc: 'Landing page enxuta, poucas seções',
        ux_ui: 1,
        front: 1,
        back: 1,
        points: 3,
        color: '#10b981',
    },
    {
        key: 'lp_complexa',
        name: 'Landing Page Complexa',
        icon: 'fa-file-invoice',
        desc: 'Landing page com muitas seções/integrações',
        ux_ui: 1,
        front: 2,
        back: 1,
        points: 6,
        color: '#fc9c14',
    },
    {
        key: 'sistema',
        name: 'Sistema',
        icon: 'fa-server',
        desc: 'Aplicação web com CRUD e regras de negócio',
        ux_ui: 1,
        front: 2,
        back: 2,
        points: 8,
        color: '#7c3aed',
    },
];

function getProjectType(key) {
    return PROJECT_TYPES.find(t => t.key === key) || null;
}

function projectTypeLabel(key) {
    const t = getProjectType(key);
    return t ? t.name : 'Tipo não definido';
}

// Conta, dentre os IDs alocados, quantos membros existem por subárea.
function _countAllocatedBySubarea(memberIds) {
    const counts = { ux_ui: 0, frontend: 0, backend: 0 };
    (memberIds || []).forEach(id => {
        const m = members.find(mm => mm.id === id);
        if (m && counts.hasOwnProperty(m.subarea)) counts[m.subarea]++;
    });
    return counts;
}

// Compara a equipe alocada contra o mínimo exigido pelo tipo do projeto.
// Retorna null se o tipo for desconhecido/ausente (projeto legado sem tipo).
function computeTeamComposition(typeKey, memberIds) {
    const type = getProjectType(typeKey);
    if (!type) return null;

    const counts = _countAllocatedBySubarea(memberIds);
    const areas = [
        { key: 'ux_ui', label: 'UX/UI', min: type.ux_ui, have: counts.ux_ui },
        { key: 'frontend', label: 'Front-end', min: type.front, have: counts.frontend },
        { key: 'backend', label: 'Back-end', min: type.back, have: counts.backend },
    ].map(a => ({ ...a, ok: a.have >= a.min }));

    return { areas, complete: areas.every(a => a.ok) };
}

// HTML dos badges por área + status geral, usado no modal de criação/edição.
function renderTeamCompositionBadgesHTML(typeKey, memberIds) {
    const comp = computeTeamComposition(typeKey, memberIds);
    if (!comp) return '';

    const badges = comp.areas.map(a => `
        <span class="team-comp-badge ${a.ok ? 'badge-team-ok' : 'badge-team-missing'}">
            <i class="fas ${a.ok ? 'fa-circle-check' : 'fa-triangle-exclamation'}"></i>
            ${a.label} (${a.have}/${a.min})
        </span>`).join('');

    const status = comp.complete
        ? `<div class="team-comp-status team-comp-status-ok"><i class="fas fa-circle-check"></i> Equipe mínima atendida</div>`
        : `<div class="team-comp-status team-comp-status-missing"><i class="fas fa-triangle-exclamation"></i> A equipe ainda necessita de: ${comp.areas
            .filter(a => !a.ok)
            .map(a => `+${a.min - a.have} ${a.label}`)
            .join(', ')}</div>`;

    return `<div class="team-comp-badges">${badges}</div>${status}`;
}

// Badge compacto de status geral para o card do projeto na listagem.
function teamCompositionCardBadge(typeKey, memberIds) {
    const comp = computeTeamComposition(typeKey, memberIds);
    if (!comp) return '';
    if (comp.complete) {
        return `<span class="proj-meta-item team-comp-ok"><i class="fas fa-circle-check"></i>Equipe completa</span>`;
    }
    const faltas = comp.areas.filter(a => !a.ok).map(a => `+${a.min - a.have} ${a.label}`).join(', ');
    return `<span class="proj-meta-item team-comp-missing"><i class="fas fa-triangle-exclamation"></i>Faltam: ${faltas}</span>`;
}
