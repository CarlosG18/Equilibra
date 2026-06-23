// ==========================================================================
// UI shell — sidebar (mobile), título dinâmico do topo e menu do usuário.
// Apenas comportamento de interface; não toca em dados nem regras de negócio.
// ==========================================================================
(function () {
    const sidebar = document.getElementById('sidebar');
    const scrim = document.getElementById('sidebarScrim');
    const menuToggle = document.getElementById('menuToggle');
    const pageTitle = document.getElementById('pageTitle');
    const crumb = document.getElementById('crumbCurrent');
    const navItems = document.querySelectorAll('.sidebar-nav .nav-item');

    // ---- Drawer da sidebar no mobile ----
    function openSidebar() {
        if (!sidebar) return;
        sidebar.classList.add('is-open');
        if (scrim) scrim.classList.add('is-visible');
    }
    function closeSidebar() {
        if (!sidebar) return;
        sidebar.classList.remove('is-open');
        if (scrim) scrim.classList.remove('is-visible');
    }

    if (menuToggle) menuToggle.addEventListener('click', openSidebar);
    if (scrim) scrim.addEventListener('click', closeSidebar);

    // ---- Título do topo acompanha a aba ativa ----
    function setTitle(label) {
        if (pageTitle) pageTitle.textContent = label;
        if (crumb) crumb.textContent = label;
        document.title = `Equilibra — ${label}`;
    }

    navItems.forEach(item => {
        item.addEventListener('click', () => {
            const label = item.getAttribute('data-title') || item.textContent.trim();
            setTitle(label);
            closeSidebar(); // fecha o drawer ao navegar no mobile
        });
    });

    // Fecha o drawer ao voltar para desktop
    window.addEventListener('resize', () => {
        if (window.innerWidth > 1024) closeSidebar();
    });

    // ---- Menu do usuário (dropdown) ----
    const userTrigger = document.getElementById('userTrigger');
    const userMenu = document.getElementById('userMenu');

    if (userTrigger && userMenu) {
        userTrigger.addEventListener('click', (e) => {
            e.stopPropagation();
            const open = userMenu.classList.toggle('open');
            userTrigger.setAttribute('aria-expanded', open ? 'true' : 'false');
        });
        document.addEventListener('click', (e) => {
            if (!userMenu.contains(e.target)) {
                userMenu.classList.remove('open');
                userTrigger.setAttribute('aria-expanded', 'false');
            }
        });
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                userMenu.classList.remove('open');
                userTrigger.setAttribute('aria-expanded', 'false');
            }
        });
    }
})();
