// ==========================================================================
// RELATÓRIOS DE PROJETOS — histórico de situação por projeto (data, resumo
// do andamento, principal problema enfrentado, checklist de processo) e
// exportação em PDF (jsPDF), seguindo a identidade visual EJECT (Exo,
// #0A374E, rodapé institucional — ver assets/template.docx).
//
// O prazo mostrado aqui é sempre projects.deadline (não duplicamos o campo).
// ==========================================================================

const EJECT_BRAND_COLOR = [10, 55, 78]; // #0A374E em RGB

let situationReportsLatest = {};   // project_id -> entrada mais recente
let situationReportsCache = [];    // histórico do projeto atualmente aberto no modal
let currentSituationProjectId = null;
let editingSituationReportId = null;

// ---- Listagem (aba "Relatórios de Projetos") ----

async function loadSituationReportsOverview() {
    if (typeof projects === 'undefined') return;

    const res = await ProjectService.buscarUltimasSituacoes();
    situationReportsLatest = {};
    if (res.success) {
        res.data.forEach(r => {
            // já vem ordenado por data desc, então a primeira ocorrência de
            // cada projeto é a mais recente.
            if (!situationReportsLatest[r.project_id]) situationReportsLatest[r.project_id] = r;
        });
    }
    renderSituationReportsList();
}

function renderSituationReportsList() {
    const container = document.getElementById('situationReportsList');
    if (!container) return;
    container.innerHTML = '';

    if (!projects || projects.length === 0) {
        container.innerHTML = `
            <div class="proj-empty">
                <i class="fas fa-file-signature"></i>
                <p>Nenhum projeto cadastrado ainda.</p>
            </div>
        `;
        return;
    }

    projects.forEach(proj => {
        const manager = members.find(m => m.id === proj.manager_id);
        const latest = situationReportsLatest[proj.id];

        const card = document.createElement('div');
        card.className = 'proj-card situation-report-card';
        card.innerHTML = `
            <div class="proj-card-body">
                <div class="proj-card-header">
                    <p class="proj-card-name">${proj.name}</p>
                    ${situationUpdateStatusBadgeHTML(latest)}
                </div>
                <div class="proj-card-meta">
                    ${manager
                        ? `<span class="proj-meta-item"><i class="fas fa-user-tie"></i>${manager.name}</span>`
                        : `<span class="proj-meta-item proj-meta-empty"><i class="fas fa-user-tie"></i>Sem gerente</span>`}
                </div>
                ${latest
                    ? `<p class="proj-card-desc situation-report-preview"><i class="fas fa-clock-rotate-left"></i> Última atualização em ${_formatDateBR(latest.report_date)}: ${_truncateText(latest.progress_summary, 110)}</p>`
                    : `<p class="proj-card-desc proj-meta-empty">Nenhuma atualização registrada ainda.</p>`}
                <div class="proj-card-footer">
                    <div class="proj-card-deadline">${formatDeadlineCountdown(proj.deadline)}</div>
                    <div class="proj-card-actions">
                        <button class="btn btn-info btn-extra-small" onclick="openSituationReportModal('${proj.id}')">
                            <i class="fas fa-file-signature"></i> Ver relatório
                        </button>
                    </div>
                </div>
            </div>
        `;
        container.appendChild(card);
    });
}

function _truncateText(text, max) {
    if (!text) return '';
    return text.length > max ? text.slice(0, max).trim() + '…' : text;
}

// ---- Status de atualização semanal (semana de calendário: segunda a domingo) ----

function _getCurrentWeekRange() {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const day = now.getDay(); // 0=domingo ... 6=sábado
    const diffToMonday = day === 0 ? -6 : 1 - day;
    const monday = new Date(now);
    monday.setDate(now.getDate() + diffToMonday);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    return { monday, sunday };
}

function _isReportInCurrentWeek(reportDate) {
    if (!reportDate) return false;
    const { monday, sunday } = _getCurrentWeekRange();
    const d = new Date(reportDate + 'T00:00:00');
    return d >= monday && d <= sunday;
}

// "Atualizado" só quando a última atualização caiu na semana de calendário
// atual (segunda a domingo) — reseta toda segunda-feira, mesmo sem nenhuma
// mudança no projeto.
function situationUpdateStatusBadgeHTML(latest) {
    const isUpdated = !!(latest && _isReportInCurrentWeek(latest.report_date));
    return isUpdated
        ? '<span class="situation-update-badge is-updated"><i class="fas fa-check-circle"></i> Atualizado</span>'
        : '<span class="situation-update-badge is-outdated"><i class="fas fa-triangle-exclamation"></i> Desatualizado</span>';
}

// ---- Modal do projeto (histórico + formulário) ----

async function openSituationReportModal(projectId) {
    const project = projects.find(p => p.id === projectId);
    if (!project) return;

    currentSituationProjectId = projectId;

    const nameEl = document.getElementById('situationReportProjectName');
    if (nameEl) nameEl.textContent = `Relatório — ${project.name}`;

    _renderSituationModalMeta(project);

    document.getElementById('situationReportProjectId').value = projectId;
    resetSituationReportFormState();

    openModal('modalSituationReport');
    await _reloadSituationHistory();
}

// Cabeçalho do modal (badge de status + gerente/SM/prazo). Extraído à parte
// para poder ser reatualizado depois de salvar/excluir uma entrada, sem
// precisar reabrir o modal do zero.
function _renderSituationModalMeta(project) {
    const metaEl = document.getElementById('situationReportProjectMeta');
    if (!metaEl) return;

    const manager = members.find(m => m.id === project.manager_id);
    const sm = members.find(m => m.id === project.scrum_master);
    metaEl.innerHTML = `
        ${situationUpdateStatusBadgeHTML(situationReportsLatest[project.id])}
        ${manager ? `<span class="proj-meta-item"><i class="fas fa-user-tie"></i>${manager.name}</span>` : ''}
        ${sm ? `<span class="proj-meta-item"><i class="fas fa-user-shield"></i>${sm.name}</span>` : ''}
        <span class="proj-meta-item"><i class="fas fa-calendar-alt"></i>Prazo: ${formatDeadlineCountdown(project.deadline)}</span>
    `;
}

async function _reloadSituationHistory() {
    const historyContainer = document.getElementById('situationReportHistory');
    if (!historyContainer || !currentSituationProjectId) return;

    const res = await ProjectService.buscarHistoricoSituacao(currentSituationProjectId);
    situationReportsCache = res.success ? res.data : [];
    historyContainer.innerHTML = res.success
        ? renderSituationHistoryHTML(situationReportsCache)
        : '<p class="ux-ui-history-empty">Não foi possível carregar o histórico.</p>';
}

function renderSituationHistoryHTML(rows) {
    if (!rows || rows.length === 0) {
        return '<p class="ux-ui-history-empty">Nenhuma atualização registrada ainda.</p>';
    }

    const items = rows.map(r => {
        const checklist = [
            { ok: r.pipefy_updated, label: 'Pipefy' },
            { ok: r.ata_filled, label: 'ATA' },
            { ok: r.status_report_sent, label: 'Status report' },
        ].map(c => `<span class="situation-checklist-badge ${c.ok ? 'is-ok' : ''}"><i class="fas ${c.ok ? 'fa-check-circle' : 'fa-circle'}"></i> ${c.label}</span>`).join('');

        return `
            <li class="ux-ui-history-item">
                <div class="ux-ui-history-transition">${_formatDateBR(r.report_date)}</div>
                <div class="ux-ui-history-nota"><strong>Andamento:</strong> ${r.progress_summary}</div>
                ${r.main_issue ? `<div class="ux-ui-history-nota"><strong>Principal problema:</strong> ${r.main_issue}</div>` : ''}
                <div class="situation-checklist-row">${checklist}</div>
                <div class="ux-ui-history-meta">
                    <button type="button" class="btn btn-info btn-extra-small" onclick="editSituationEntry(${r.id})">
                        <i class="fas fa-edit"></i> Editar
                    </button>
                    <button type="button" class="btn btn-danger btn-extra-small" onclick="askDeleteSituationEntry(${r.id})">
                        <i class="fas fa-trash"></i> Excluir
                    </button>
                </div>
            </li>`;
    }).join('');

    return `<ul class="ux-ui-history-list">${items}</ul>`;
}

// ---- CRUD do formulário ----

function resetSituationReportFormState() {
    editingSituationReportId = null;
    document.getElementById('situationReportId').value = '';

    const form = document.getElementById('situationReportForm');
    if (form) form.reset();

    const dateInput = document.getElementById('situationReportDate');
    if (dateInput) dateInput.value = new Date().toISOString().split('T')[0];

    const submitBtn = document.getElementById('situationReportSubmitBtn');
    if (submitBtn) {
        submitBtn.innerHTML = '<i class="fas fa-save"></i> Salvar atualização';
        submitBtn.classList.remove('btn-warning');
        submitBtn.classList.add('btn-success');
    }

    const cancelBtn = document.getElementById('situationReportCancelBtn');
    if (cancelBtn) cancelBtn.style.display = 'none';
}

function editSituationEntry(id) {
    const entry = situationReportsCache.find(r => r.id === id);
    if (!entry) return;

    editingSituationReportId = id;
    document.getElementById('situationReportId').value = id;
    document.getElementById('situationReportDate').value = entry.report_date;
    document.getElementById('situationReportSummary').value = entry.progress_summary || '';
    document.getElementById('situationReportIssue').value = entry.main_issue || '';
    document.getElementById('situationReportPipefy').checked = !!entry.pipefy_updated;
    document.getElementById('situationReportAta').checked = !!entry.ata_filled;
    document.getElementById('situationReportStatusReport').checked = !!entry.status_report_sent;

    const submitBtn = document.getElementById('situationReportSubmitBtn');
    if (submitBtn) {
        submitBtn.innerHTML = '<i class="fas fa-save"></i> Atualizar entrada';
        submitBtn.classList.remove('btn-success');
        submitBtn.classList.add('btn-warning');
    }

    const cancelBtn = document.getElementById('situationReportCancelBtn');
    if (cancelBtn) cancelBtn.style.display = 'inline-block';

    const form = document.getElementById('situationReportForm');
    if (form) form.scrollIntoView({ behavior: 'smooth' });
}

async function askDeleteSituationEntry(id) {
    if (!confirm('Tem certeza que deseja excluir esta atualização?')) return;

    const res = await ProjectService.removerSituacaoProjeto(id);
    if (res.success) {
        showFloatingAlert('Atualização excluída.', 'success');
        await _reloadSituationHistory();
        await loadSituationReportsOverview();
        const project = projects.find(p => p.id === currentSituationProjectId);
        if (project) _renderSituationModalMeta(project);
    } else {
        showFloatingAlert('Erro ao excluir: ' + res.error, 'error');
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('situationReportForm');
    if (form) {
        form.addEventListener('submit', async function (e) {
            e.preventDefault();

            const projectId = document.getElementById('situationReportProjectId').value;
            const reportDate = document.getElementById('situationReportDate').value;
            const summary = document.getElementById('situationReportSummary').value.trim();
            const issue = document.getElementById('situationReportIssue').value.trim();
            const pipefy = document.getElementById('situationReportPipefy').checked;
            const ata = document.getElementById('situationReportAta').checked;
            const statusReport = document.getElementById('situationReportStatusReport').checked;

            if (!projectId || !summary) {
                showFloatingAlert('Preencha ao menos a data e o resumo do andamento.', 'error');
                return;
            }

            const submitBtn = document.getElementById('situationReportSubmitBtn');
            if (submitBtn) submitBtn.disabled = true;

            try {
                const res = editingSituationReportId
                    ? await ProjectService.atualizarSituacaoProjeto(editingSituationReportId, reportDate, summary, issue, pipefy, ata, statusReport)
                    : await ProjectService.adicionarSituacaoProjeto(projectId, reportDate, summary, issue, pipefy, ata, statusReport);

                if (res.success) {
                    showFloatingAlert(editingSituationReportId ? 'Atualização salva!' : 'Atualização registrada!', 'success');
                    resetSituationReportFormState();
                    await _reloadSituationHistory();
                    await loadSituationReportsOverview();
                    const project = projects.find(p => p.id === currentSituationProjectId);
                    if (project) _renderSituationModalMeta(project);
                } else {
                    showFloatingAlert('Erro: ' + res.error, 'error');
                }
            } finally {
                if (submitBtn) submitBtn.disabled = false;
            }
        });
    }

    const cancelBtn = document.getElementById('situationReportCancelBtn');
    if (cancelBtn) {
        cancelBtn.addEventListener('click', resetSituationReportFormState);
    }

    const pdfBtn = document.getElementById('situationReportPdfBtn');
    if (pdfBtn) {
        pdfBtn.addEventListener('click', () => {
            if (currentSituationProjectId) generateSituationReportPDF(currentSituationProjectId);
        });
    }

    const generalPdfBtn = document.getElementById('situationReportsGeneralPdfBtn');
    if (generalPdfBtn) {
        generalPdfBtn.addEventListener('click', generateGeneralSituationReportPDF);
    }
});

// ---- Geração do PDF (jsPDF + identidade visual EJECT) ----

// Relatório de um único projeto: usa o histórico já carregado no modal
// (situationReportsCache), exige ao menos uma atualização cadastrada.
function generateSituationReportPDF(projectId) {
    const project = projects.find(p => p.id === projectId);
    if (!project) return;

    const latest = situationReportsCache[0];
    if (!latest) {
        showFloatingAlert('Cadastre ao menos uma atualização antes de gerar o PDF.', 'error');
        return;
    }

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit: 'mm', format: 'a4' });
    _registerExoFonts(doc);

    _drawSituationReportPage(doc, project, latest);

    const fileStamp = new Date().toISOString().slice(0, 10);
    doc.save(`relatorio-${project.name.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}-${fileStamp}.pdf`);

    if (typeof showFloatingAlert === 'function') {
        showFloatingAlert('PDF gerado com sucesso!', 'success');
    }
}

// Relatório geral: uma página por projeto, na mesma ordem da listagem,
// usando a última atualização de cada um (situationReportsLatest, já
// carregada pela aba). Projetos sem nenhuma atualização entram mesmo assim,
// sinalizados como tal — para não esconder quem ainda não foi preenchido.
function generateGeneralSituationReportPDF() {
    if (!projects || projects.length === 0) {
        showFloatingAlert('Nenhum projeto cadastrado ainda.', 'error');
        return;
    }

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit: 'mm', format: 'a4' });
    _registerExoFonts(doc);

    projects.forEach((project, index) => {
        if (index > 0) doc.addPage();
        _drawSituationReportPage(doc, project, situationReportsLatest[project.id] || null);
    });

    const fileStamp = new Date().toISOString().slice(0, 10);
    doc.save(`relatorio-geral-projetos-${fileStamp}.pdf`);

    if (typeof showFloatingAlert === 'function') {
        showFloatingAlert('Relatório geral gerado com sucesso!', 'success');
    }
}

// Desenha, na página atual do doc, o relatório de situação de um projeto:
// faixa de cabeçalho, dados do projeto, resumo/problema da atualização mais
// recente (ou aviso de que não há nenhuma) e o rodapé institucional.
// Compartilhado pelo relatório individual e pelo relatório geral (uma página
// por projeto) para manter os dois com a mesma identidade visual.
function _drawSituationReportPage(doc, project, latest) {
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 20;
    let y = 0;

    // Faixa de cabeçalho com a cor institucional
    doc.setFillColor(...EJECT_BRAND_COLOR);
    doc.rect(0, 0, pageWidth, 38, 'F');

    doc.setFont('Exo', 'bold');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(11);
    doc.text('EJECT — Empresa Júnior da Escola de Ciências e Tecnologia da UFRN', margin, 15);

    doc.setFont('Exo', 'semibold');
    doc.setFontSize(20);
    doc.text('Relatório de Situação do Projeto', margin, 27);

    y = 50;

    doc.setTextColor(...EJECT_BRAND_COLOR);
    doc.setFont('Exo', 'bold');
    doc.setFontSize(16);
    doc.text(project.name, margin, y);
    y += 10;

    const manager = members.find(m => m.id === project.manager_id);
    const sm = members.find(m => m.id === project.scrum_master);
    const deadlineLabel = project.deadline ? _formatDateBR(project.deadline) : 'Sem prazo definido';

    doc.setFont('Exo', 'normal');
    doc.setFontSize(11);
    doc.setTextColor(60, 60, 60);
    const infoLines = [
        `Prazo: ${deadlineLabel}`,
        `Gerente responsável: ${manager ? manager.name : 'Não definido'}`,
        `Scrum Master: ${sm ? sm.name : 'Não definido'}`,
        `Data desta atualização: ${latest ? _formatDateBR(latest.report_date) : 'Sem atualização registrada'}`,
    ];
    infoLines.forEach(line => { doc.text(line, margin, y); y += 6; });

    y += 4;
    doc.setDrawColor(...EJECT_BRAND_COLOR);
    doc.setLineWidth(0.4);
    doc.line(margin, y, pageWidth - margin, y);
    y += 10;

    y = _pdfSection(doc, 'Resumo do andamento', latest ? latest.progress_summary : 'Nenhuma atualização registrada para este projeto.', margin, pageWidth, y);
    y += 4;
    y = _pdfSection(doc, 'Principal problema enfrentado', latest ? (latest.main_issue || 'Nenhum problema relevante reportado.') : '—', margin, pageWidth, y);
    y += 8;

    doc.setFont('Exo', 'semibold');
    doc.setFontSize(12);
    doc.setTextColor(...EJECT_BRAND_COLOR);
    doc.text('Checklist de processo', margin, y);
    y += 7;

    doc.setFont('Exo', 'normal');
    doc.setFontSize(11);
    const checklist = [
        [!!(latest && latest.pipefy_updated), 'Pipefy atualizado'],
        [!!(latest && latest.ata_filled), 'ATA preenchida'],
        [!!(latest && latest.status_report_sent), 'Status report enviado'],
    ];
    // Desenhado como um quadrinho vetorial (preenchido = feito, contorno =
    // pendente) em vez de usar ✔/✘: esses caracteres não existem no
    // subconjunto Latin da fonte Exo embutida, então o glifo ausente
    // renderizava igual para os dois casos — todo item aparecia "marcado".
    const boxSize = 3.4;
    checklist.forEach(([ok, label]) => {
        const boxY = y - boxSize + 0.6;
        if (ok) {
            doc.setFillColor(10, 122, 82);
            doc.rect(margin, boxY, boxSize, boxSize, 'F');
        } else {
            doc.setDrawColor(160, 160, 160);
            doc.setLineWidth(0.3);
            doc.rect(margin, boxY, boxSize, boxSize, 'S');
        }
        doc.setTextColor(60, 60, 60);
        doc.text(label, margin + boxSize + 4, y);
        y += 7;
    });

    // Rodapé institucional (mesmo texto do template.docx)
    const footerY = pageHeight - 18;
    doc.setDrawColor(220, 220, 220);
    doc.setLineWidth(0.2);
    doc.line(margin, footerY - 4, pageWidth - margin, footerY - 4);

    doc.setFont('Exo', 'semibold');
    doc.setFontSize(8.5);
    doc.setTextColor(120, 120, 120);
    doc.text('Empresa Júnior da Escola de Ciências e Tecnologia da UFRN', margin, footerY);
    doc.text('ECT - Escola de Ciências e Tecnologia  ·  ejectufrn.com.br', margin, footerY + 4.5);
}

// Escreve um bloco "Título + parágrafo" com quebra de linha automática,
// devolvendo o novo cursor Y para o próximo bloco.
function _pdfSection(doc, title, body, margin, pageWidth, y) {
    doc.setFont('Exo', 'semibold');
    doc.setFontSize(12);
    doc.setTextColor(...EJECT_BRAND_COLOR);
    doc.text(title, margin, y);
    y += 7;

    doc.setFont('Exo', 'normal');
    doc.setFontSize(11);
    doc.setTextColor(40, 40, 40);
    const maxWidth = pageWidth - margin * 2;
    const lines = doc.splitTextToSize(body || '—', maxWidth);
    doc.text(lines, margin, y);
    y += lines.length * 5.5;

    return y;
}
