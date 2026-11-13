(() => {
  const root = document.documentElement;
  root.classList.add('js');
  const themeButton = document.querySelector('[data-theme-toggle]');
  function applyTheme(theme) {
    root.dataset.theme = theme;
    themeButton.textContent = theme === 'dark' ? 'Light mode' : 'Dark mode';
    themeButton.setAttribute('aria-label', `Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`);
  }
  let savedTheme;
  try { savedTheme = localStorage.getItem('data-science-study-theme'); } catch {}
  applyTheme(savedTheme === 'dark' ? 'dark' : 'light');
  themeButton.addEventListener('click', () => {
    const theme = root.dataset.theme === 'dark' ? 'light' : 'dark';
    applyTheme(theme);
    try { localStorage.setItem('data-science-study-theme', theme); } catch {}
  });
  const menuButton = document.querySelector('[data-menu-toggle]');
  const nav = document.querySelector('#study-nav');
  menuButton.addEventListener('click', () => {
    const open = nav.classList.toggle('open');
    menuButton.setAttribute('aria-expanded', String(open));
  });
  const dialog = document.querySelector('#definition-dialog');
  document.addEventListener('click', event => {
    const link = event.target.closest('a.term');
    if (!link || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey || event.button !== 0) return;
    const id = link.hash.slice(1);
    const entry = window.STUDY_GLOSSARY?.find(item => item.id === id);
    if (!entry || !dialog.showModal) return;
    event.preventDefault();
    dialog.querySelector('h2').textContent = entry.term;
    dialog.querySelector('[data-definition]').textContent = entry.definition;
    dialog.querySelector('[data-full-definition]').href = `glossary.html#${entry.id}`;
    dialog.showModal();
  });
  dialog.querySelector('[data-close]').addEventListener('click', () => dialog.close());
  dialog.addEventListener('keydown', event => {
    if (event.key === 'Escape') {
      event.preventDefault();
      dialog.close();
    }
  });
  dialog.addEventListener('click', event => { if (event.target === dialog) {
    const bounds = dialog.getBoundingClientRect();
    if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) dialog.close();
  }});
  const search = document.querySelector('#glossary-search');
  if (search) {
    const items = [...document.querySelectorAll('[data-glossary-entry]')];
    search.addEventListener('input', () => {
      const query = search.value.trim().toLowerCase();
      let count = 0;
      items.forEach(item => {
        item.hidden = !item.textContent.toLowerCase().includes(query);
        if (!item.hidden) count++;
      });
      document.querySelector('#glossary-count').textContent = `${count} of ${items.length} terms`;
    });
  }
  document.querySelectorAll('table').forEach(table => {
    if (table.parentElement.classList.contains('table-scroll')) return;
    const wrapper = document.createElement('div');
    wrapper.className = 'table-scroll';
    wrapper.tabIndex = 0;
    wrapper.setAttribute('role', 'region');
    wrapper.setAttribute('aria-label', 'Scrollable reference table');
    table.before(wrapper);
    wrapper.append(table);
  });
})();
