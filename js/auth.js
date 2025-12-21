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
                    await updateFullInterface();
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

// Ouvinte do Supabase
_supabase.auth.onAuthStateChange(async (event, session) => {
    const loginScreen = document.getElementById('login-screen');
    const appContent = document.getElementById('app-content');

    if (session) {
        if (loginScreen) loginScreen.style.display = 'none';
        if (appContent) appContent.style.display = 'block';

        // Usa o carregamento seguro
        await safeLoadInterface(); 

    } else {
        if (loginScreen) loginScreen.style.display = 'flex';
        if (appContent) appContent.style.display = 'none';
    }
});

// Gatilho Manual ao carregar a página (Corrigido)
document.addEventListener('DOMContentLoaded', async () => {
    const { data: { session } } = await _supabase.auth.getSession();
    
    // Se tiver sessão, o onAuthStateChange já vai disparar, 
    // mas por segurança, se ele falhar, forçamos aqui:
    if (session) {
        const appContent = document.getElementById('app-content');
        if (appContent && appContent.style.display === 'none') {
             // Só roda se a tela ainda estiver escondida
             document.getElementById('login-screen').style.display = 'none';
             appContent.style.display = 'block';
             await safeLoadInterface();
        }
    }
});

// ==========================================
// 3. LOGIN E LOGOUT
// ==========================================

async function handleLogin() {
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

async function handleLogout() {
    try {
        const { error } = await _supabase.auth.signOut();
        if (error) throw error;
        window.location.reload(); 
    } catch (error) {
        console.error("Erro ao sair:", error);
    }
}