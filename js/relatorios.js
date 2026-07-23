// ==========================================================================
// RELATÓRIOS — exportação em CSV dos dados já carregados em memória
// (members/projects/extraActivities, as mesmas globais de js/app.js).
// Sem backend próprio: gera o arquivo inteiramente no cliente.
// ==========================================================================

const REPORT_SUBAREA_LABELS = { ux_ui: 'UX/UI', frontend: 'Frontend', backend: 'Backend', '': '—' };

// Separador ';' (não ',') porque o Excel em pt-BR usa vírgula como separador
// decimal e trata ';' como delimitador de campo em CSV.
function _csvEscape(value) {
    const str = value === null || value === undefined ? '' : String(value);
    if (/[;"\n]/.test(str)) return '"' + str.replace(/"/g, '""') + '"';
    return str;
}

function _rowsToCSV(rows) {
    return rows.map(r => r.map(_csvEscape).join(';')).join('\r\n');
}

// BOM no início para o Excel reconhecer UTF-8 e não corromper acentos.
function _downloadCSV(filename, rows) {
    const csv = '﻿' + _rowsToCSV(rows);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    if (typeof showFloatingAlert === 'function') {
        showFloatingAlert('Relatório exportado com sucesso!', 'success');
    }
}

function _reportFileStamp() {
    return new Date().toISOString().slice(0, 10);
}

function _reportPlainDate(iso) {
    if (!iso) return 'Sem prazo';
    const [y, m, d] = iso.split('-');
    return `${d}/${m}/${y}`;
}

function _reportOverloadStatusLabel(load) {
    if (load >= OVERLOAD_CRITICAL) return 'Crítico';
    if (load >= OVERLOAD_WARNING) return 'Atenção';
    return 'Disponível';
}

// ---- Relatório: sobrecarga da equipe (mesmos dados da tabela do dashboard) ----
function exportOverloadReport() {
    const rows = [
        ['Membro', 'Cargo', 'Projetos', 'Atividades', 'Sobrecarga (pts)', 'Status', 'Próximo prazo'],
    ];

    const sortedMembers = [...members].sort((a, b) => (b.overload || 0) - (a.overload || 0));

    sortedMembers.forEach(member => {
        const lines = overloadLinesFor(member.id);
        const projectsCount = lines.filter(l => ['project', 'sm', 'ux_ui'].includes(l.type)).length;
        const activitiesCount = lines.filter(l => l.type === 'activity').length;
        const overload = member.overload || 0;
        const earliestDeadline = typeof getEarliestDeadlineForMember === 'function'
            ? getEarliestDeadlineForMember(member.id)
            : null;

        rows.push([
            member.name,
            member.role,
            projectsCount,
            activitiesCount,
            overload,
            _reportOverloadStatusLabel(overload),
            _reportPlainDate(earliestDeadline),
        ]);
    });

    _downloadCSV(`equilibra-sobrecarga-${_reportFileStamp()}.csv`, rows);
}

// ---- Relatório: cadastro de membros ----
function exportMembersReport() {
    const rows = [
        ['Nome', 'Cargo', 'Subárea', 'Matérias no semestre', 'Trabalha fora', 'Sobrecarga (pts)', 'Status'],
    ];

    members.forEach(m => {
        const overload = m.overload || 0;
        rows.push([
            m.name,
            m.role,
            REPORT_SUBAREA_LABELS[m.subarea || ''] || m.subarea,
            m.num_materias || 0,
            m.trabalho ? 'Sim' : 'Não',
            overload,
            _reportOverloadStatusLabel(overload),
        ]);
    });

    _downloadCSV(`equilibra-membros-${_reportFileStamp()}.csv`, rows);
}

// ---- Relatório: projetos ----
function exportProjectsReport() {
    const rows = [
        ['Nome', 'Tipo', 'Descrição', 'Pontos', 'Scrum Master', 'Gerente responsável', 'Prazo', 'Membros alocados', 'Status UX/UI'],
    ];

    projects.forEach(p => {
        const sm = members.find(m => m.id === p.scrum_master);
        const manager = members.find(m => m.id === p.manager_id);
        const teamNames = (p.allocated_members || [])
            .map(id => { const m = members.find(mm => mm.id === id); return m ? m.name : null; })
            .filter(Boolean)
            .join(', ');

        rows.push([
            p.name,
            p.type ? projectTypeLabel(p.type) : '',
            p.description || '',
            p.overload_points || 0,
            sm ? sm.name : 'Sem SM',
            manager ? manager.name : 'Sem gerente',
            _reportPlainDate(p.deadline),
            teamNames,
            p.ux_ui_status ? getUxUiStatusMeta(p.ux_ui_status).label : '—',
        ]);
    });

    _downloadCSV(`equilibra-projetos-${_reportFileStamp()}.csv`, rows);
}

// ---- Relatório: atividades extras ----
function exportActivitiesReport() {
    const rows = [
        ['Atividade', 'Descrição', 'Pontos', 'Status', 'Prazo', 'Membros responsáveis'],
    ];

    extraActivities.forEach(a => {
        const memberNames = (a.allocated_members || [])
            .map(id => { const m = members.find(mm => mm.id === id); return m ? m.name : null; })
            .filter(Boolean)
            .join(', ');

        rows.push([
            a.name,
            a.description || '',
            a.points || 0,
            a.status === 'ativa' ? 'Ativa' : 'Encerrada',
            _reportPlainDate(a.deadline),
            memberNames,
        ]);
    });

    _downloadCSV(`equilibra-atividades-${_reportFileStamp()}.csv`, rows);
}
