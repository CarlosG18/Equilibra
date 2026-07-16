// ==========================================================================
// SOBRECARGA — fonte única de verdade da pontuação.
//
// Todo cálculo de pontos de um membro passa por aqui: o badge da lista
// (app.js), o detalhamento em tooltip (membros.js) e a projeção mensal
// (analises.js). Antes cada um tinha sua própria cópia das regras, e elas
// divergiram — o tooltip chegava a somar diferente do badge ao lado.
//
// A função devolve LINHAS (label + pontos). O total é a soma delas, então o
// detalhamento e o badge não têm como discordar.
// ==========================================================================

// Faixas de sobrecarga de um MEMBRO. Comparações sempre com >=.
const OVERLOAD_CRITICAL = 15;   // >= 15: crítico
const OVERLOAD_WARNING = 10;    // >= 10: atenção; abaixo disso, disponível

// Bônus fixos.
const OVERLOAD_MANAGER_BONUS = 5;   // cargo de gerente
const OVERLOAD_JOB_POINTS = 4;      // trabalha fora
const OVERLOAD_SUBJECT_RATE = 0.5;  // cada 2 matérias = 1 pt

// Peso de quem coordena (Scrum Master ou gestor de testes): proporcional à
// complexidade do item, mais uma base fixa pela responsabilidade em si.
// Para um projeto de 1 a 10 pts, dá de 3 a 6 pts.
function coordinationPoints(points) {
    return Math.max(1, Math.round(points * 0.4)) + 2;
}

// Meia-noite de hoje — referência de "agora" para prazos.
function _todayStart() {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
}

// Um item com prazo ainda está ativo na data de referência?
// Prazo vencendo HOJE ainda conta.
function _deadlineActiveAt(deadline, refDate) {
    if (!deadline) return true; // sem prazo: nunca expira
    return new Date(deadline + 'T00:00:00') >= refDate;
}

// Projetos/atividades/testes expiram por prazo APENAS na projeção temporal.
// Na carga de hoje (cutoff = null) todo item cadastrado conta, vencido ou não —
// "o que a pessoa carrega agora" é diferente de "o que ainda estará ativo em X".
// A exceção é a sobrecarga de UX/UI, que é temporária por definição e sempre
// respeita o prazo (ver abaixo).
function _itemActive(deadline, cutoff) {
    if (!cutoff) return true;
    return _deadlineActiveAt(deadline, cutoff);
}

// Linhas de sobrecarga de um membro.
//   opts.cutoff: Date  → considera só o que ainda estará ativo nessa data.
//                null  → carga de hoje (padrão).
// Retorna: [{ label, pts, icon, type }]
function overloadLinesFor(memberId, opts = {}) {
    const cutoff = opts.cutoff || null;
    const refDate = cutoff || _todayStart();
    const member = members.find(m => m.id === memberId);
    if (!member) return [];

    const lines = [];

    // 1. PROJETOS
    projects.forEach(proj => {
        if (!_itemActive(proj.deadline, cutoff)) return;
        const pts = parseInt(proj.overload_points) || 0;

        // O UX/UI não é cobrado pelo projeto inteiro como o Front/Back — ele
        // entra e sai do projeto num ciclo próprio, cobrado no passo 2.
        if ((proj.allocated_members || []).includes(memberId) && member.subarea !== 'ux_ui') {
            lines.push({ label: proj.name, pts, icon: 'fa-project-diagram', type: 'project' });
        }

        const smId = proj.scrum_master_id || proj.scrum_master;
        if (smId === memberId) {
            lines.push({
                label: `SM: ${proj.name}`,
                pts: coordinationPoints(pts),
                icon: 'fa-crown',
                type: 'sm',
            });
        }
    });

    // 2. UX/UI — sobrecarga temporária, só enquanto o ciclo está "em andamento"
    // e o prazo não venceu. Fora disso o membro continua sendo o UX/UI da
    // equipe para próximas atividades, mas sem pontos.
    projects.forEach(proj => {
        if (proj.ux_ui_status !== 'em_andamento') return;
        if (proj.ux_ui_member_id !== memberId) return;
        if (!proj.ux_ui_deadline || !proj.ux_ui_points) return;
        if (!_deadlineActiveAt(proj.ux_ui_deadline, refDate)) return;

        lines.push({
            label: `UX/UI: ${proj.name}`,
            pts: parseInt(proj.ux_ui_points) || 0,
            icon: 'fa-pen-ruler',
            type: 'ux_ui',
        });
    });

    // 3. ATIVIDADES EXTRAS
    extraActivities.forEach(act => {
        if (act.status !== 'ativa') return;
        if (!_itemActive(act.deadline, cutoff)) return;

        // Formato antigo (member_id único) ainda pode existir no banco.
        const allocated = Array.isArray(act.allocated_members)
            ? act.allocated_members.includes(memberId)
            : act.member_id === memberId;
        if (!allocated) return;

        lines.push({
            label: act.name || act.title || 'Atividade',
            pts: parseInt(act.points) || 0,
            icon: 'fa-tasks',
            type: 'activity',
        });
    });

    // 4. TESTES
    if (typeof projectTests !== 'undefined' && Array.isArray(projectTests)) {
        projectTests.forEach(test => {
            if (test.status !== 'em_andamento') return;
            if (!_itemActive(test.deadline, cutoff)) return;
            const pts = parseInt(test.overload_points) || 0;
            const label = test.name || test.title || 'Teste';

            if ((test.members || []).includes(memberId)) {
                lines.push({ label, pts, icon: 'fa-vial', type: 'test' });
            }
            if (test.test_manager === memberId) {
                lines.push({
                    label: `Gestor: ${label}`,
                    pts: coordinationPoints(pts),
                    icon: 'fa-user-shield',
                    type: 'test_manager',
                });
            }
        });
    }

    // 5. CARGO E CARGA PESSOAL — constantes ao longo do tempo.
    if (member.role && member.role.toLowerCase().includes('gerente')) {
        lines.push({ label: 'Bônus de Gerência', pts: OVERLOAD_MANAGER_BONUS, icon: 'fa-user-tie', type: 'cargo' });
    }
    if (member.trabalho) {
        lines.push({ label: 'Emprego', pts: OVERLOAD_JOB_POINTS, icon: 'fa-briefcase', type: 'personal' });
    }
    const mats = parseInt(member.num_materias) || 0;
    if (mats > 0) {
        lines.push({
            label: `${mats} matéria${mats !== 1 ? 's' : ''}`,
            pts: Math.round(mats * OVERLOAD_SUBJECT_RATE),
            icon: 'fa-book',
            type: 'personal',
        });
    }

    return lines;
}

// Total de pontos de um membro. Mesmas opções de overloadLinesFor().
function overloadTotalFor(memberId, opts = {}) {
    return overloadLinesFor(memberId, opts).reduce((sum, l) => sum + l.pts, 0);
}

// Classe CSS pela faixa de sobrecarga de um MEMBRO.
function getOverloadClassForMember(points) {
    if (points >= OVERLOAD_CRITICAL) return 'high-overload';
    if (points >= OVERLOAD_WARNING) return 'medium-overload';
    return 'low-overload';
}

// Classe CSS pela complexidade de um PROJETO. Escala diferente da do membro:
// os pontos de um projeto vão de 1 a 10 (limite do slider), não somam nada.
function getOverloadClassForProject(points) {
    if (points >= 8) return 'high-overload';
    if (points >= 5) return 'medium-overload';
    return 'low-overload';
}
