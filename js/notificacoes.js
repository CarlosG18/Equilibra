// ==========================================================================
// NOTIFICAÇÕES — painel in-app (sino no topbar).
// Não tem armazenamento próprio: é sempre derivado do estado atual de
// `members`/`projects`/`extraActivities` (mesmas globais de js/app.js),
// igual à filosofia do resto do sistema (a fonte de verdade é o dado, não
// um registro paralelo de "alertas enviados").
// ==========================================================================

const NOTIF_DEADLINE_DAYS = 3; // janela de "prazo próximo"
const NOTIF_UXUI_GRACE_DAYS = 3; // não alerta projeto recém-criado

// Dias até uma data (negativo = já venceu). null quando não há data.
function _notifDaysUntil(dateStr) {
    if (!dateStr) return null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const d = new Date(dateStr + 'T00:00:00');
    return Math.round((d - today) / (1000 * 60 * 60 * 24));
}

function _notifDeadlineDueSoon(dateStr) {
    const diff = _notifDaysUntil(dateStr);
    return diff !== null && diff <= NOTIF_DEADLINE_DAYS;
}

function _notifDeadlineLabel(diff) {
    if (diff < 0) return `vencido há ${Math.abs(diff)}d`;
    if (diff === 0) return 'vence hoje';
    return `vence em ${diff}d`;
}

// Monta a lista de alertas atuais. Vencidos/críticos primeiro.
function buildNotifications() {
    const items = [];

    // 1. Sobrecarga crítica de membro
    members.forEach(m => {
        const load = m.overload || 0;
        if (load >= OVERLOAD_CRITICAL) {
            items.push({
                icon: 'fa-triangle-exclamation',
                color: '#a51d1d',
                title: `${m.name} está sobrecarregado`,
                message: `${load} pts de sobrecarga (crítico a partir de ${OVERLOAD_CRITICAL})`,
                tabTarget: 'members',
                urgency: load,
            });
        }
    });

    // 2. Prazo de projeto próximo/vencido
    projects.forEach(p => {
        if (!_notifDeadlineDueSoon(p.deadline)) return;
        const diff = _notifDaysUntil(p.deadline);
        items.push({
            icon: 'fa-calendar-day',
            color: diff < 0 ? '#a51d1d' : '#fc9c14',
            title: `Prazo do projeto "${p.name}"`,
            message: _notifDeadlineLabel(diff),
            tabTarget: 'projects',
            urgency: diff < 0 ? 1000 - diff : 100 - diff,
        });
    });

    // 3. UX/UI parado
    projects.forEach(p => {
        if (!hasUxUiAllocated(p.allocated_members)) return;
        const status = p.ux_ui_status || 'nao_iniciado';
        if (status !== 'nao_iniciado') return;

        if (p.created_at) {
            const ageDays = _notifDaysUntil(p.created_at.slice(0, 10)) * -1;
            if (ageDays < NOTIF_UXUI_GRACE_DAYS) return;
        }

        items.push({
            icon: 'fa-pen-ruler',
            color: '#8893a3',
            title: `UX/UI parado em "${p.name}"`,
            message: 'Time alocado, mas o ciclo de UX/UI ainda não começou',
            tabTarget: 'projects',
            urgency: 5,
        });
    });

    // 4. Atividade extra ativa com prazo próximo/vencido
    extraActivities.forEach(a => {
        if (a.status !== 'ativa') return;
        if (!_notifDeadlineDueSoon(a.deadline)) return;
        const diff = _notifDaysUntil(a.deadline);
        items.push({
            icon: 'fa-list-check',
            color: diff < 0 ? '#a51d1d' : '#fc9c14',
            title: `Prazo da atividade "${a.name}"`,
            message: _notifDeadlineLabel(diff),
            tabTarget: 'activities',
            urgency: diff < 0 ? 1000 - diff : 100 - diff,
        });
    });

    items.sort((a, b) => b.urgency - a.urgency);
    return items;
}

function _notifGoToTab(tabTarget) {
    const btn = document.querySelector(`.tab-button[data-tab="${tabTarget}"]`);
    if (btn) btn.click();

    const menu = document.getElementById('notifMenu');
    const trigger = document.getElementById('notifTrigger');
    if (menu) menu.classList.remove('open');
    if (trigger) trigger.setAttribute('aria-expanded', 'false');
}

function renderNotifications() {
    const badge = document.getElementById('notifBadge');
    const list = document.getElementById('notifList');
    if (!badge || !list) return;

    const items = buildNotifications();

    if (items.length === 0) {
        badge.style.display = 'none';
    } else {
        badge.textContent = items.length > 9 ? '9+' : String(items.length);
        badge.style.display = '';
    }

    if (items.length === 0) {
        list.innerHTML = `
            <div class="notif-empty">
                <i class="fas fa-circle-check"></i>
                <p>Nenhum alerta no momento.</p>
            </div>
        `;
        return;
    }

    list.innerHTML = items.map((item, index) => `
        <button type="button" class="notif-item" data-notif-index="${index}">
            <span class="notif-item-icon" style="background:${item.color}1a;color:${item.color}">
                <i class="fas ${item.icon}"></i>
            </span>
            <span class="notif-item-body">
                <span class="notif-item-title">${item.title}</span>
                <span class="notif-item-message">${item.message}</span>
            </span>
        </button>
    `).join('');

    list.querySelectorAll('.notif-item').forEach((btn, index) => {
        btn.addEventListener('click', () => _notifGoToTab(items[index].tabTarget));
    });
}
