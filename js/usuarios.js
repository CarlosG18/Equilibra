// ==========================================================================
// USUÁRIOS — tela de administração de acesso (só Diretor).
// Gerencia a tabela equilibra_user_roles: quais e-mails podem logar no
// Equilibra e com qual papel (diretor/gerente/membro) — ver js/permissoes.js
// e schema.sql (a mesma regra é aplicada de novo lá, via RLS).
// ==========================================================================

let editingUsuarioEmail = null;

const ROLE_META = {
    diretor: { label: 'Diretor', icon: 'fa-crown', color: '#7c3aed' },
    gerente: { label: 'Gerente', icon: 'fa-user-tie', color: '#0787cb' },
    membro:  { label: 'Membro',  icon: 'fa-user', color: '#8893a3' },
};

async function loadUsuarios() {
    const res = await ProjectService.listarUsuarios();
    renderUsuarios(res.success ? res.data : []);
}

function renderUsuarios(usuarios) {
    const list = document.getElementById('usuariosList');
    if (!list) return;
    list.innerHTML = '';

    if (!usuarios || usuarios.length === 0) {
        list.innerHTML = `
            <tr>
                <td colspan="3" style="text-align:center; color:var(--gray); font-style:italic;">
                    Nenhum usuário cadastrado ainda.
                </td>
            </tr>
        `;
        return;
    }

    usuarios.forEach(u => {
        const meta = ROLE_META[u.role] || ROLE_META.membro;
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><strong>${u.email}</strong></td>
            <td>
                <span class="role-pill" style="background:${meta.color}1a;color:${meta.color};border-color:${meta.color}55">
                    <i class="fas ${meta.icon}"></i> ${meta.label}
                </span>
            </td>
            <td>
                <div class="action-buttons">
                    <button class="btn btn-info btn-extra-small" onclick="editUsuario('${u.email}', '${u.role}')">
                        <i class="fas fa-edit"></i> Editar
                    </button>
                    <button class="btn btn-danger btn-extra-small" onclick="confirmDelete('usuario', '${u.email}', '${u.email}')">
                        <i class="fas fa-trash"></i> Remover
                    </button>
                </div>
            </td>
        `;
        list.appendChild(tr);
    });
}

function editUsuario(email, role) {
    const emailInput = document.getElementById('usuarioEmail');
    const roleInput = document.getElementById('usuarioRole');
    const originalInput = document.getElementById('usuarioEmailOriginal');
    if (!emailInput || !roleInput || !originalInput) return;

    emailInput.value = email;
    roleInput.value = role;
    originalInput.value = email;
    editingUsuarioEmail = email;

    const submitBtn = document.getElementById('usuarioSubmitBtn');
    if (submitBtn) {
        submitBtn.innerHTML = '<i class="fas fa-save"></i> Atualizar';
        submitBtn.classList.remove('btn-success');
        submitBtn.classList.add('btn-warning');
    }
    const cancelBtn = document.getElementById('usuarioCancelBtn');
    if (cancelBtn) cancelBtn.style.display = 'inline-block';

    openModal('modalUsuario');
}

function resetUsuarioFormState() {
    editingUsuarioEmail = null;

    const form = document.getElementById('usuarioForm');
    if (form) form.reset();

    const originalInput = document.getElementById('usuarioEmailOriginal');
    if (originalInput) originalInput.value = '';

    const submitBtn = document.getElementById('usuarioSubmitBtn');
    if (submitBtn) {
        submitBtn.innerHTML = '<i class="fas fa-save"></i> Salvar';
        submitBtn.classList.remove('btn-warning');
        submitBtn.classList.add('btn-success');
    }
    const cancelBtn = document.getElementById('usuarioCancelBtn');
    if (cancelBtn) cancelBtn.style.display = 'none';
}

async function deleteUsuario(email) {
    const res = await ProjectService.removerUsuario(email);
    if (res.success) {
        showFloatingAlert('Acesso removido.');
        loadUsuarios();
    } else {
        showFloatingAlert('Erro ao remover: ' + res.error, 'error');
    }
}

const usuarioForm = document.getElementById('usuarioForm');
if (usuarioForm) {
    usuarioForm.addEventListener('submit', async function (e) {
        e.preventDefault();

        const email = document.getElementById('usuarioEmail').value.trim().toLowerCase();
        const role = document.getElementById('usuarioRole').value;
        const originalEmail = document.getElementById('usuarioEmailOriginal').value;

        const submitBtn = this.querySelector('button[type="submit"]');
        const originalText = submitBtn.innerHTML;
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Salvando...';
        submitBtn.disabled = true;

        try {
            let res;
            if (editingUsuarioEmail) {
                // E-mail é a chave primária — se ele mudou, apaga o registro
                // antigo e cria um novo (não dá pra fazer UPDATE de PK aqui
                // sem uma segunda ida ao banco de qualquer forma).
                if (originalEmail && originalEmail !== email) {
                    await ProjectService.removerUsuario(originalEmail);
                    res = await ProjectService.adicionarUsuario(email, role);
                } else {
                    res = await ProjectService.atualizarPapelUsuario(originalEmail, role);
                }
            } else {
                res = await ProjectService.adicionarUsuario(email, role);
            }

            if (res.success) {
                showFloatingAlert(editingUsuarioEmail ? 'Usuário atualizado!' : 'Usuário cadastrado!');
                closeModal('modalUsuario');
                resetUsuarioFormState();
                loadUsuarios();
            } else {
                showFloatingAlert('Erro: ' + res.error, 'error');
            }
        } catch (err) {
            console.error('Erro ao salvar usuário:', err);
            showFloatingAlert('Erro inesperado ao salvar usuário.', 'error');
        } finally {
            submitBtn.innerHTML = editingUsuarioEmail ? '<i class="fas fa-save"></i> Atualizar' : (originalText || '<i class="fas fa-save"></i> Salvar');
            submitBtn.disabled = false;
        }
    });
}

const usuarioCancelBtn = document.getElementById('usuarioCancelBtn');
if (usuarioCancelBtn) {
    usuarioCancelBtn.addEventListener('click', function (e) {
        e.preventDefault();
        resetUsuarioFormState();
        showFloatingAlert('Edição cancelada.', 'info');
    });
}
