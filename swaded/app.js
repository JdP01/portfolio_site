const pages = Array.from(document.querySelectorAll('[data-page]'));
const navigationButtons = Array.from(document.querySelectorAll('[data-view]'));
const navLinks = Array.from(document.querySelectorAll('.nav-link'));
const tabs = Array.from(document.querySelectorAll('.assistant-tab'));
const panels = Array.from(document.querySelectorAll('[data-panel-content]'));
let toastTimer = 0;
function showToast(message) {
    let toast = document.querySelector('.toast-message');
    if (!toast) {
        toast = document.createElement('div');
        toast.className = 'toast-message';
        toast.setAttribute('role', 'status');
        document.body.append(toast);
    }
    toast.textContent = message;
    toast.classList.add('visible');
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => toast?.classList.remove('visible'), 2400);
}
function setView(viewName) {
    const target = pages.find((page) => page.dataset.page === viewName);
    if (!target)
        return;
    pages.forEach((page) => page.classList.toggle('hidden', page !== target));
    document.body.classList.toggle('studio-mode', viewName === 'studio');
    navLinks.forEach((link) => link.classList.toggle('active', link.dataset.view === viewName));
    window.scrollTo({ top: 0, behavior: 'smooth' });
}
navigationButtons.forEach((button) => {
    button.addEventListener('click', () => {
        if (button.dataset.view)
            setView(button.dataset.view);
    });
});
for (const button of document.querySelectorAll('[data-scroll]')) {
    button.addEventListener('click', () => {
        document.getElementById(button.dataset.scroll ?? '')?.scrollIntoView({ behavior: 'smooth' });
    });
}
tabs.forEach((tab) => {
    tab.addEventListener('click', () => {
        const panelName = tab.dataset.panel;
        if (!panelName)
            return;
        tabs.forEach((item) => {
            const isActive = item === tab;
            item.classList.toggle('active', isActive);
            item.setAttribute('aria-selected', String(isActive));
        });
        panels.forEach((panel) => panel.classList.toggle('hidden', panel.dataset.panelContent !== panelName));
    });
});
document.querySelectorAll('.filter-chip').forEach((chip) => {
    chip.addEventListener('click', () => {
        if (chip.classList.contains('category-chip')) {
            chip.classList.toggle('active');
            return;
        }
        document.querySelectorAll('.filter-chip:not(.category-chip)').forEach((item) => item.classList.remove('active'));
        chip.classList.add('active');
    });
});
document.querySelectorAll('.save-button').forEach((button) => {
    button.addEventListener('click', () => {
        const saved = button.classList.toggle('saved');
        button.textContent = saved ? '♥' : '♡';
        showToast(saved ? 'Added to your library' : 'Removed from your library');
    });
});
document.querySelectorAll('.tree-item').forEach((item) => {
    item.addEventListener('click', () => {
        if (item.classList.contains('folder-item'))
            return;
        document.querySelectorAll('.tree-item').forEach((node) => node.classList.remove('selected-file'));
        item.classList.add('selected-file');
        const selectedFile = item.textContent?.trim().split(/\s+/).at(-1) ?? 'main.ts';
        const codeTitle = document.querySelector('.code-toolbar > div');
        if (codeTitle) {
            const filename = codeTitle.querySelector('.active-filename');
            if (filename)
                filename.textContent = selectedFile;
        }
        showToast(`${selectedFile} selected`);
    });
});
document.querySelectorAll('.publish-button, .canvas-start, .invite-button').forEach((button) => {
    button.addEventListener('click', () => {
        const message = button.classList.contains('publish-button')
            ? 'Your world is almost ready to publish'
            : button.classList.contains('invite-button')
                ? 'Collaboration invites are coming soon'
                : 'Your game workspace is ready to build';
        showToast(message);
    });
});
document.querySelectorAll('.play-small, .button-outline').forEach((button) => {
    button.addEventListener('click', () => showToast('Preview is ready to play'));
});
document.querySelectorAll('.play-circle, .card-arrow').forEach((button) => {
    button.addEventListener('click', () => showToast('Game lobbies are coming soon'));
});
document.querySelectorAll('.search-button').forEach((button) => {
    button.addEventListener('click', () => showToast('Search is coming soon'));
});
document.querySelectorAll('.send-button').forEach((button) => {
    button.addEventListener('click', () => showToast('AI chat is a visual preview'));
});
for (const button of document.querySelectorAll('.sort-control button, .load-more button, .composer-tools button, .assistant-actions button, .tool-button, .pane-controls button:not(.play-small), .tiny-chevron, .workspace-label button, .sidebar-heading button, .idea-card button, .code-toolbar button')) {
    button.addEventListener('click', () => showToast('This control is part of the studio preview'));
}
document.querySelectorAll('.canvas-tool').forEach((button) => {
    button.addEventListener('click', () => {
        document.querySelectorAll('.canvas-tool').forEach((tool) => {
            const isActive = tool === button;
            tool.classList.toggle('active', isActive);
            tool.setAttribute('aria-pressed', String(isActive));
        });
        showToast(`${button.dataset.tool ?? 'Scene'} tool selected`);
    });
});
document.querySelectorAll('.canvas-mode').forEach((button) => {
    button.addEventListener('click', () => {
        document.querySelectorAll('.canvas-mode').forEach((mode) => mode.classList.toggle('active', mode === button));
    });
});
document.querySelectorAll('.prompt-chip').forEach((button) => {
    button.addEventListener('click', () => {
        const prompt = button.dataset.prompt ?? button.textContent?.trim() ?? '';
        const promptInput = document.querySelector('.prompt-input');
        if (promptInput) {
            promptInput.value = prompt;
            promptInput.focus();
        }
    });
});
document.querySelectorAll('.scene-add').forEach((button) => {
    button.addEventListener('click', () => showToast('New scene is a visual preview'));
});
