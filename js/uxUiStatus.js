// ==========================================================================
// STATUS DE UX/UI — ciclo de atuação independente do andamento geral do projeto.
// UX/UI não fica alocado o projeto inteiro (como Front-end/Back-end): atua no
// início (pesquisa/wireframes/protótipo) e depois só pontualmente em correções.
// ==========================================================================

const UX_UI_STATUSES = [
    { key: 'nao_iniciado', label: 'Não iniciado', icon: 'fa-circle',              color: '#8893a3' },
    { key: 'em_andamento', label: 'Em andamento',  icon: 'fa-circle-play',        color: '#0a7a52' },
    { key: 'finalizado',   label: 'Finalizado',    icon: 'fa-circle-check',       color: '#0787cb' },
    { key: 'em_correcao',  label: 'Em correção',   icon: 'fa-triangle-exclamation', color: '#fc9c14' },
];

function getUxUiStatusMeta(key) {
    return UX_UI_STATUSES.find(s => s.key === key) || UX_UI_STATUSES[0];
}

// UX/UI é derivado da mesma forma que Front-end/Back-end: membros com
// subarea === 'ux_ui' dentre os alocados no projeto (sem tabela de vínculo própria).
function hasUxUiAllocated(memberIds) {
    return (memberIds || []).some(id => {
        const m = members.find(mm => mm.id === id);
        return m && m.subarea === 'ux_ui';
    });
}

// Só mostra "+Npts até dd/mm" quando os pontos realmente estão sendo cobrados:
// status exatamente "Em andamento" e prazo em sprints ainda não vencido.
// Em qualquer outro status (inclusive "Em correção") o membro segue disponível
// como UX/UI da equipe, mas sem sobrecarga — por isso o badge não menciona pontos.
function _uxUiSprintInfo(statusKey, deadline, points) {
    if (statusKey !== 'em_andamento' || !deadline || !points) return '';
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const d = new Date(deadline + 'T00:00:00');
    if (d < today) return ''; // prazo vencido: pontos já não contam mais
    return ` · +${points}pts até ${d.toLocaleDateString('pt-BR')}`;
}

// Nome do membro de UX/UI atrelado a este ciclo, se houver.
function _uxUiMemberName(memberId) {
    if (!memberId) return null;
    const m = members.find(mm => mm.id === memberId);
    return m ? m.name : 'Membro removido';
}

// Badge de status — usado no modal (seção exclusiva) e no card do projeto.
function renderUxUiStatusBadgeHTML(statusKey, deadline, points, memberId) {
    const meta = getUxUiStatusMeta(statusKey || 'nao_iniciado');
    const memberName = _uxUiMemberName(memberId);
    return `
        <span class="ux-ui-status-badge" style="background:${meta.color}1a;color:${meta.color};border-color:${meta.color}55">
            <i class="fas ${meta.icon}"></i> UX/UI ${meta.label}${memberName ? ` (${memberName})` : ''}${_uxUiSprintInfo(statusKey, deadline, points)}
        </span>`;
}

// Badge compacto para a linha .proj-card-meta na listagem de projetos (RF07).
function uxUiStatusCardBadge(statusKey, deadline, points) {
    if (!statusKey) return '';
    const meta = getUxUiStatusMeta(statusKey);
    return `
        <span class="proj-meta-item ux-ui-card-badge" style="color:${meta.color}">
            <i class="fas ${meta.icon}"></i>UX/UI ${meta.label}${_uxUiSprintInfo(statusKey, deadline, points)}
        </span>`;
}

// Lista de histórico (mais recente primeiro) para dentro da seção do modal.
function renderUxUiHistoryHTML(historyRows) {
    if (!historyRows || historyRows.length === 0) {
        return '<p class="ux-ui-history-empty">Nenhuma alteração registrada ainda.</p>';
    }

    const rows = historyRows.map(h => {
        const from = getUxUiStatusMeta(h.previous_status).label;
        const to = getUxUiStatusMeta(h.new_status).label;
        const memberName = _uxUiMemberName(h.ux_ui_member_id) || '—';
        const data = h.created_at ? new Date(h.created_at).toLocaleString('pt-BR') : '';
        return `
            <li class="ux-ui-history-item">
                <div class="ux-ui-history-transition"><strong>${from}</strong> → <strong>${to}</strong></div>
                <div class="ux-ui-history-meta">
                    <span><i class="fas fa-user-pen"></i> ${memberName}</span>
                    <span><i class="fas fa-clock"></i> ${data}</span>
                </div>
                ${h.nota ? `<div class="ux-ui-history-nota">${h.nota}</div>` : ''}
            </li>`;
    }).join('');

    return `<ul class="ux-ui-history-list">${rows}</ul>`;
}
