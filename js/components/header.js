/**
 * Header Component
 * App header with navigation and save status
 */
class HeaderComponent {
    /**
     * Create header component
     * @param {HTMLElement} container
     * @param {Object} options
     * @param {string} options.title - Header title
     * @param {boolean} options.showBack - Show back button
     * @param {boolean} options.editableTitle - Title is editable
     * @param {Function} options.onBack - Back button callback
     * @param {Function} options.onTitleChange - Title change callback
     * @param {Function} options.onLogout - Logout callback
     */
    constructor(container, options = {}) {
        this.container = container;
        this.options = {
            title: 'noc7is',
            showBack: false,
            editableTitle: false,
            onBack: null,
            onTitleChange: null,
            onLogout: null,
            ...options
        };

        this.isEditingTitle = false;

        this.render();
        this._setupEventListeners();
    }

    /**
     * Render the header
     */
    render() {
        this.container.innerHTML = '';

        const header = DOM.create('header', { className: 'header' }, [
            DOM.create('div', { className: 'header__left' }, [
                // Back button
                this.options.showBack ? DOM.create('button', {
                    className: 'header__back',
                    id: 'header-back'
                }, ['\u2190 Back']) : null,

                // Title
                DOM.create('h1', {
                    className: `header__title ${this.options.editableTitle ? 'header__title--editable' : ''}`,
                    id: 'header-title'
                }, [this.options.title])
            ].filter(Boolean)),

            DOM.create('div', { className: 'header__right' }, [
                DOM.create('span', { className: 'header__save-status', id: 'save-status' }),
                DOM.create('button', { className: 'header__logout', id: 'header-logout' }, ['Logout'])
            ])
        ]);

        this.container.appendChild(header);
    }

    /**
     * Set up event listeners
     */
    _setupEventListeners() {
        // Back button
        const backBtn = document.getElementById('header-back');
        if (backBtn && this.options.onBack) {
            backBtn.addEventListener('click', this.options.onBack);
        }

        // Logout button
        const logoutBtn = document.getElementById('header-logout');
        if (logoutBtn && this.options.onLogout) {
            logoutBtn.addEventListener('click', this.options.onLogout);
        }

        // Editable title
        const titleEl = document.getElementById('header-title');
        if (titleEl && this.options.editableTitle && this.options.onTitleChange) {
            titleEl.addEventListener('click', () => this._startEditingTitle());
        }

        // Save status updates
        this._saveStatusUnsubscribe = eventBus.on(Events.SAVE_STATUS, (status) => {
            this._updateSaveStatus(status);
        });
    }

    /**
     * Start editing the title
     */
    _startEditingTitle() {
        if (this.isEditingTitle) return;
        this.isEditingTitle = true;

        const titleEl = document.getElementById('header-title');
        const currentTitle = titleEl.textContent;

        const input = DOM.create('input', {
            className: 'header__title-input',
            type: 'text',
            value: currentTitle,
            id: 'header-title-input'
        });

        titleEl.classList.add('hidden');
        titleEl.parentNode.insertBefore(input, titleEl.nextSibling);
        input.focus();
        input.select();

        const save = () => {
            const newTitle = input.value.trim();
            if (newTitle && newTitle !== currentTitle) {
                Sanitize.text(titleEl, newTitle);
                this.options.title = newTitle;
                if (this.options.onTitleChange) {
                    this.options.onTitleChange(newTitle);
                }
            }
            this._finishEditingTitle(input, titleEl);
        };

        input.addEventListener('blur', save);
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                save();
            } else if (e.key === 'Escape') {
                this._finishEditingTitle(input, titleEl);
            }
        });
    }

    /**
     * Finish editing the title
     */
    _finishEditingTitle(input, titleEl) {
        this.isEditingTitle = false;
        if (input.parentNode) {
            input.parentNode.removeChild(input);
        }
        titleEl.classList.remove('hidden');
    }

    /**
     * Update save status display
     * @param {string} status - 'idle' | 'saving' | 'saved' | 'error'
     */
    _updateSaveStatus(status) {
        const el = document.getElementById('save-status');
        if (!el) return;

        const statusMap = {
            idle: '',
            saving: '\u21BB Saving...',
            saved: '\u2713 Saved',
            error: '\u26A0 Save failed'
        };

        Sanitize.text(el, statusMap[status] || '');
        el.className = `header__save-status header__save-status--${status}`;
    }

    /**
     * Update the title
     * @param {string} title
     */
    updateTitle(title) {
        this.options.title = title;
        const titleEl = document.getElementById('header-title');
        if (titleEl && !this.isEditingTitle) {
            Sanitize.text(titleEl, title);
        }
    }

    /**
     * Clean up component
     */
    destroy() {
        if (this._saveStatusUnsubscribe) {
            this._saveStatusUnsubscribe();
        }
        DOM.clear(this.container);
    }
}

// Make available globally
window.HeaderComponent = HeaderComponent;
