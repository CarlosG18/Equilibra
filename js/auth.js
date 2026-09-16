// ==========================================
// 1. FUNÇÕES AUXILIARES (Segurança e UI)
// ==========================================

// Função que espera o script principal carregar antes de rodar
async function safeLoadInterface() {
    return new Promise((resolve) => {
        const checkInterval = setInterval(async () => {
            // Verifica se a função existe E se o elemento da dashboard existe
            const funcExists = typeof updateFullInterface === 'function';
            const elementExists = document.getElementById('app-content');

            if (funcExists && elementExists) {
                clearInterval(checkInterval);
                console.log("Sistema pronto. Carregando dados...");
                try {
                    // Busca o papel do usuário ANTES de renderizar, pra evitar
                    // um flash de conteúdo que ele não deveria ver.
                    if (typeof loadCurrentUserRole === 'function') await loadCurrentUserRole();
                    await updateFullInterface();
                    if (typeof applyRolePermissions === 'function') applyRolePermissions();
                    if (typeof watchRolePermissions === 'function') watchRolePermissions();
                } catch (e) {
                    console.error("Erro no updateFullInterface:", e);
                }
                resolve();
            } else {
                console.warn("Aguardando carregamento dos scripts/DOM...");
            }
        }, 100); // Tenta a cada 100ms
    });
}

// A FUNÇÃO QUE FALTAVA (O Botão de Atualizar)
async function handleManualRefresh() {
    const btn = document.getElementById('btn-refresh');
    
    // Se o botão não existir na tela (ex: tela de login), ignora
    if (!btn) return;

    const icon = btn.querySelector('svg'); // Pega o ícone
    const span = btn.querySelector('span'); // Pega o texto (se houver)
    const textoOriginal = span ? span.innerText : 'Atualizar'; 

    // 1. Feedback Visual (Trava e gira)
    btn.disabled = true;
    btn.style.opacity = "0.7";
    if (icon) icon.classList.add('spin-anim'); // Adiciona a animação CSS
    if (span) span.innerText = "Buscando...";

    try {
        if (typeof initApp === 'function') {
            await initApp(); 
            if (typeof updateFullInterface === 'function') {
                updateFullInterface();
            }
            
            if (span) span.innerText = "Pronto!";
        } else {
            console.warn("⚠️ initApp não encontrada. Tentando apenas redesenhar...");
            if (typeof updateFullInterface === 'function') updateFullInterface();
        }

    } catch (error) {
        console.error("❌ Erro ao atualizar:", error);
        alert("Erro ao conectar com o banco de dados.");
    } finally {
        // 2. Destrava (com um pequeno delay para o usuário ver o "Pronto!")
        setTimeout(() => {
            btn.disabled = false;
            btn.style.opacity = "1";
            if (icon) icon.classList.remove('spin-anim'); // Para de girar
            if (span) span.innerText = textoOriginal; // Volta o texto original
        }, 1000);
    }
}

// ==========================================
// 2. GERENCIAMENTO DE ESTADO (Auth)
// ==========================================

// Decide qual das 3 telas mostrar pra uma sessão: login (sem sessão),
// "aguardando liberação" (logado mas sem linha em equilibra_user_roles —
// só possível depois que a criação de conta ficou aberta pra qualquer um) ou
// o app (logado e liberado). Centralizado aqui porque tanto o listener de
// auth quanto o carregamento inicial da página precisam da mesma lógica.
async function routeAfterSession(session) {
    const loginScreen = document.getElementById('login-screen');
    const pendingScreen = document.getElementById('pending-screen');
    const appContent = document.getElementById('app-content');

    if (!session) {
        if (loginScreen) loginScreen.style.display = 'flex';
        if (pendingScreen) pendingScreen.style.display = 'none';
        if (appContent) appContent.style.display = 'none';
        return;
    }

    const registered = typeof isCurrentUserRegistered === 'function' ? await isCurrentUserRegistered() : true;

    if (loginScreen) loginScreen.style.display = 'none';

    if (!registered) {
        if (appContent) appContent.style.display = 'none';
        if (pendingScreen) pendingScreen.style.display = 'flex';
        return;
    }

    if (pendingScreen) pendingScreen.style.display = 'none';
    if (appContent) appContent.style.display = 'block';
    await safeLoadInterface();
}

// Ouvinte do Supabase
_supabase.auth.onAuthStateChange(async (event, session) => {
    await routeAfterSession(session);
});

// Gatilho Manual ao carregar a página (Corrigido)
document.addEventListener('DOMContentLoaded', async () => {
    const loginForm = document.getElementById('loginForm');
    if (loginForm) loginForm.addEventListener('submit', handleLogin);

    const signupForm = document.getElementById('signupForm');
    if (signupForm) signupForm.addEventListener('submit', handleSignup);

    // Um botão de olho por campo de senha — delega num único listener em
    // vez de repetir onclick por botão (login tem 1 campo, criar conta tem 2).
    document.querySelectorAll('[data-password-toggle-for]').forEach(button => {
        button.addEventListener('click', () => togglePasswordVisibility(button.dataset.passwordToggleFor, button));
    });

    const authModeToggle = document.getElementById('authModeToggle');
    if (authModeToggle) authModeToggle.addEventListener('click', toggleAuthMode);

    const { data: { session } } = await _supabase.auth.getSession();

    // Se tiver sessão, o onAuthStateChange já vai disparar,
    // mas por segurança, se ele falhar, forçamos aqui:
    if (session) {
        const appContent = document.getElementById('app-content');
        if (appContent && appContent.style.display === 'none') {
             // Só roda se a tela ainda estiver escondida
             await routeAfterSession(session);
        }
    }
});

// ==========================================
// 3. LOGIN E LOGOUT
// ==========================================

// Alterna entre esconder e mostrar a senha digitada num campo específico —
// tanto o de login quanto os dois de criar conta usam a mesma função.
function togglePasswordVisibility(inputId, button) {
    const input = document.getElementById(inputId);
    if (!input || !button) return;

    const willShow = input.type === 'password';
    input.type = willShow ? 'text' : 'password';

    button.setAttribute('aria-pressed', String(willShow));
    button.setAttribute('aria-label', willShow ? 'Ocultar senha' : 'Mostrar senha');

    const icon = button.querySelector('i');
    if (icon) icon.className = willShow ? 'fas fa-eye-slash' : 'fas fa-eye';

    // Mantém o cursor no campo para não interromper a digitação.
    input.focus();
}

// Esconde a mensagem de erro/aviso da tela de login/criar conta.
function _clearAuthMessages() {
    const errorMsg = document.getElementById('loginError');
    const notice = document.getElementById('loginNotice');
    if (errorMsg) { errorMsg.style.display = 'none'; errorMsg.textContent = ''; }
    if (notice) { notice.hidden = true; notice.textContent = ''; }
}

// Alterna entre o formulário de login e o de criar conta na mesma tela.
function toggleAuthMode() {
    const loginForm = document.getElementById('loginForm');
    const signupForm = document.getElementById('signupForm');
    const toggleBtn = document.getElementById('authModeToggle');
    if (!loginForm || !signupForm || !toggleBtn) return;

    const switchingToSignup = !loginForm.hidden;
    loginForm.hidden = switchingToSignup;
    signupForm.hidden = !switchingToSignup;

    toggleBtn.innerHTML = switchingToSignup
        ? 'Já tem conta? <span>Entrar</span>'
        : 'Não tem conta? <span>Criar uma</span>';

    _clearAuthMessages();
}

// Chamada pelo submit do #loginForm — tanto pelo botão "Entrar" quanto por
// Enter em qualquer campo. O preventDefault impede o GET nativo do form, que
// recarregaria a página.
async function handleLogin(event) {
    if (event) event.preventDefault();

    const email = document.getElementById('emailInput').value;
    const password = document.getElementById('passwordInput').value;
    const errorMsg = document.getElementById('loginError');

    if (errorMsg) errorMsg.style.display = 'none';
    
    if (!email || !password) {
        if (errorMsg) {
            errorMsg.innerText = "Preencha e-mail e senha.";
            errorMsg.style.display = 'block';
        }
        return;
    }

    try {
        const { error } = await _supabase.auth.signInWithPassword({
            email: email,
            password: password,
        });

        if (error) throw error;
        // Sucesso: onAuthStateChange assume daqui

    } catch (error) {
        console.error("Erro no login:", error.message);
        const msg = (error.message === "Invalid login credentials") 
            ? "E-mail ou senha incorretos." 
            : "Erro: " + error.message;
            
        if (errorMsg) {
            errorMsg.innerText = msg;
            errorMsg.style.display = 'block';
        } else {
            alert(msg);
        }
    }
}

// Chamada pelo submit do #signupForm — cria a conta no Supabase Auth. Quem
// se cadastra assim entra como "Membro" por padrão (equilibra_get_my_role()
// cai pro papel mais restrito pra e-mail que ainda não está em
// equilibra_user_roles — ver schema.sql); um Diretor promove depois pela
// aba "Usuários", se for o caso.
async function handleSignup(event) {
    if (event) event.preventDefault();

    const name = document.getElementById('signupNameInput').value.trim();
    const email = document.getElementById('signupEmailInput').value.trim();
    const password = document.getElementById('signupPasswordInput').value;
    const passwordConfirm = document.getElementById('signupPasswordConfirmInput').value;
    const errorMsg = document.getElementById('loginError');
    const notice = document.getElementById('loginNotice');

    _clearAuthMessages();

    if (!name || !email || !password || !passwordConfirm) {
        if (errorMsg) { errorMsg.innerText = "Preencha todos os campos."; errorMsg.style.display = 'block'; }
        return;
    }
    if (password.length < 6) {
        if (errorMsg) { errorMsg.innerText = "A senha precisa ter pelo menos 6 caracteres."; errorMsg.style.display = 'block'; }
        return;
    }
    if (password !== passwordConfirm) {
        if (errorMsg) { errorMsg.innerText = "As senhas não são iguais."; errorMsg.style.display = 'block'; }
        return;
    }

    const submitBtn = event && event.target ? event.target.querySelector('button[type="submit"]') : null;
    const originalText = submitBtn ? submitBtn.innerHTML : '';
    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Criando conta...';
    }

    try {
        const { data, error } = await _supabase.auth.signUp({
            email,
            password,
            options: { data: { full_name: name } },
        });

        if (error) throw error;

        if (data.session) {
            // Confirmação de e-mail desativada neste projeto (confirmado):
            // já sai logado. onAuthStateChange assume daqui — routeAfterSession
            // vai ver que essa conta é nova (sem linha em
            // equilibra_user_roles) e mandar pra tela de "aguardando
            // liberação" em vez do app.
            return;
        }

        // Confirmação de e-mail ativada: precisa confirmar antes de entrar.
        // toggleAuthMode() PRIMEIRO — ele limpa as mensagens da tela ao
        // trocar de formulário, então o aviso só pode ser escrito depois.
        toggleAuthMode(); // volta pra tela de login
        document.getElementById('emailInput').value = email;
        if (notice) {
            notice.textContent = `Conta criada! Enviamos um e-mail de confirmação para ${email} — confirme antes de entrar.`;
            notice.hidden = false;
        }

    } catch (error) {
        console.error("Erro ao criar conta:", error.message);
        const msg = error.message === "User already registered"
            ? "Este e-mail já está cadastrado. Tente entrar."
            : "Erro: " + error.message;

        if (errorMsg) {
            errorMsg.innerText = msg;
            errorMsg.style.display = 'block';
        } else {
            alert(msg);
        }
    } finally {
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = originalText || 'Criar conta';
        }
    }
}

async function handleLogout() {
    try {
        const { error } = await _supabase.auth.signOut();
        if (error) throw error;
        window.location.reload(); 
    } catch (error) {
        console.error("Erro ao sair:", error);
    }
}