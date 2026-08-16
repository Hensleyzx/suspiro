import { PROJECT_INFO } from './data.js';

const NAV_ITEMS = [
  { href: 'index.html', icon: 'fa-house', label: 'Início', page: 'inicio' },
  { href: 'dashboard.html', icon: 'fa-chart-line', label: 'Dashboard', page: 'dashboard' },
  { href: 'analise.html', icon: 'fa-address-card', label: 'Cadastros', page: 'analise' },
  { href: 'resultados.html', icon: 'fa-clipboard-check', label: 'Resultados', page: 'resultados' },
  { href: 'sobre.html', icon: 'fa-circle-info', label: 'Sobre o Projeto', page: 'sobre' },
];

const THEME_KEY = 'genesis_theme';

export function getTheme() {
  return document.documentElement.dataset.theme || localStorage.getItem(THEME_KEY) || 'dark';
}

export function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  localStorage.setItem(THEME_KEY, theme);
  updateThemeButton(theme);
  window.dispatchEvent(new CustomEvent('genesis:themechange', { detail: { theme } }));
}

function updateThemeButton(theme) {
  const btn = document.getElementById('theme-toggle');
  if (!btn) return;
  btn.innerHTML = theme === 'dark' ? '<i class="fa-solid fa-sun"></i><span>Claro</span>' : '<i class="fa-solid fa-moon"></i><span>Escuro</span>';
  btn.title = theme === 'dark' ? 'Ativar modo claro' : 'Ativar modo escuro';
}

export function getChartTheme() {
  const s = getComputedStyle(document.documentElement);
  return {
    text: s.getPropertyValue('--text-secondary').trim() || '#a9b4d0',
    muted: s.getPropertyValue('--text-muted').trim() || '#6b7794',
    grid: s.getPropertyValue('--chart-grid').trim() || 'rgba(70,90,130,.18)',
    card: s.getPropertyValue('--bg-card').trim() || '#141c3a',
    primary: s.getPropertyValue('--primary').trim() || '#2e7ff0',
  };
}

export function renderLayout(activePage, headerTitle) {
  const navHtml = NAV_ITEMS.map((item) => `
    <a href="${item.href}" class="nav-item ${item.page === activePage ? 'active' : ''}">
      <i class="fa-solid ${item.icon}"></i><span>${item.label}</span>
    </a>`).join('');

  return {
    sidebarHtml: `
      <aside class="sidebar" id="sidebar">
        <div class="sidebar__brand">
          <div class="sidebar__logo"><i class="fa-solid fa-dna"></i></div>
          <div class="sidebar__brand-text"><h1>GENESIS</h1><span>LLA · Bioinformática</span></div>
        </div>
        <nav class="sidebar__nav"><div class="sidebar__section">Navegação</div>${navHtml}</nav>
        <div class="sidebar__footer"><strong>${PROJECT_INFO.school}</strong><br>${PROJECT_INFO.event}</div>
      </aside><div class="sidebar-backdrop" id="sidebar-backdrop"></div>`,
    headerHtml: `
      <header class="header">
        <div class="header__title"><button class="menu-toggle" id="menu-toggle" aria-label="Menu"><i class="fa-solid fa-bars"></i></button><h2>${headerTitle}</h2><span class="badge">LLA</span></div>
        <div class="header__right">
          <button class="theme-toggle" id="theme-toggle" type="button" aria-label="Alternar tema"></button>
          <div class="header__status"><span class="status-dot"></span><span>Interface ativa</span></div>
          <div class="header__user"><div class="header__avatar">GE</div><div class="header__user-info"><span class="name">GENESIS</span><span class="role">Pesquisa acadêmica</span></div></div>
        </div>
      </header>`,
  };
}

export function mountLayout(activePage, headerTitle) {
  const saved = localStorage.getItem(THEME_KEY) || (window.matchMedia?.('(prefers-color-scheme: light)').matches ? 'light' : 'dark');
  document.documentElement.dataset.theme = saved;
  const { sidebarHtml, headerHtml } = renderLayout(activePage, headerTitle);
  const shell = document.createElement('div');
  shell.className = 'app-shell';
  shell.innerHTML = `${sidebarHtml}<div class="main-area">${headerHtml}<main class="content" id="page-content"></main></div>`;
  document.body.appendChild(shell);

  const sidebar = document.getElementById('sidebar');
  const backdrop = document.getElementById('sidebar-backdrop');
  document.getElementById('menu-toggle')?.addEventListener('click', () => { sidebar.classList.add('open'); backdrop.classList.add('active'); });
  backdrop?.addEventListener('click', () => { sidebar.classList.remove('open'); backdrop.classList.remove('active'); });
  document.getElementById('theme-toggle')?.addEventListener('click', () => applyTheme(getTheme() === 'dark' ? 'light' : 'dark'));
  updateThemeButton(saved);
}

export function warningBanner() {
  return `<div class="academic-warning"><i class="fa-solid fa-triangle-exclamation"></i><p><strong>Aviso:</strong> ${PROJECT_INFO.warning}</p></div>`;
}

export function injectFontAwesome() {
  if (document.querySelector('link[data-fa]')) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css';
  link.setAttribute('data-fa', 'true');
  document.head.appendChild(link);
}
