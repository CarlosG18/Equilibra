// Funções globais para abrir/fechar modais
window.openModal = function (modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.add('active');

        // Gatilho especial para preencher membros no modal de Atividade se estiver vazio
        if (modalId === 'modalActivity') {
            const container = document.getElementById('activityMembersContainer');
            if (container && container.innerHTML.trim() === '' && typeof members !== 'undefined') {
                container.innerHTML = members.map(m => `
                    <label class="checkbox-label" style="display:flex;gap:8px;padding:5px;">
                        <input type="checkbox" name="activityMembers" value="${m.id}"> ${m.name}
                    </label>
                    `).join('');
            }
        }

        // Gatilho especial para preencher testes se necessário
        if (modalId === 'modalTest' && typeof updateTestUIHelpers === 'function') {
            updateTestUIHelpers();
        }
    }
}

window.closeModal = function (modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.remove('active');
        // Limpa form ao fechar (opcional, mas recomendado para "Novo")
        const form = modal.querySelector('form');
        if (form) form.reset();

        // Reseta variáveis de edição globais se existirem (para evitar que "Novo" abra como "Editar")
        if (typeof editingMemberId !== 'undefined') editingMemberId = null;
        if (typeof editingProjectId !== 'undefined') editingProjectId = null;
        if (typeof editingActivityId !== 'undefined') editingActivityId = null;

        // Reset de botões de salvar
        const btn = modal.querySelector('button[type="submit"]');
        if (btn && btn.innerHTML.includes('Atualizar')) {
            // Reseta texto simples se for edição
            // (O texto exato depende do seu JS, mas resetar o form ajuda)
        }
    }
}

// Fechar ao clicar fora da caixa branca
document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) closeModal(overlay.id);
    });
});