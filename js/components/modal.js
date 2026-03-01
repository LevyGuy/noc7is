/**
 * Modal Base Component
 * Provides a reusable modal dialog framework
 */
class Modal {
    /**
     * Create a modal
     * @param {Object} options
     * @param {string} options.title - Modal title
     * @param {string|HTMLElement} options.content - Modal body content
     * @param {Array} options.buttons - Footer buttons [{text, className, onClick}]
     * @param {Function} options.onClose - Callback when modal closes
     * @param {boolean} options.closeOnBackdrop - Close when clicking backdrop (default: true)
     */
    constructor(options = {}) {
        this.options = {
            title: '',
            content: '',
            buttons: [],
            onClose: null,
            closeOnBackdrop: true,
            ...options
        };

        this.element = null;
        this.backdrop = null;
        this._boundKeyHandler = this._handleKeyDown.bind(this);

        this.render();
    }

    /**
     * Render the modal
     */
    render() {
        // Create backdrop
        this.backdrop = DOM.create('div', {
            className: 'modal-backdrop',
            onClick: (e) => {
                if (this.options.closeOnBackdrop && e.target === this.backdrop) {
                    this.close();
                }
            }
        });

        // Create modal
        this.element = DOM.create('div', { className: 'modal' }, [
            // Header
            DOM.create('div', { className: 'modal__header' }, [
                DOM.create('h2', { className: 'modal__title' }, [this.options.title]),
                DOM.create('button', {
                    className: 'modal__close',
                    onClick: () => this.close()
                }, ['\u00D7'])
            ]),
            // Body
            DOM.create('div', { className: 'modal__body' }),
            // Footer (if buttons provided)
            this.options.buttons.length > 0 ? DOM.create('div', { className: 'modal__footer' }) : null
        ].filter(Boolean));

        // Set body content
        const body = this.element.querySelector('.modal__body');
        if (typeof this.options.content === 'string') {
            body.innerHTML = ''; // Clear first
            const contentDiv = DOM.create('div');
            contentDiv.textContent = this.options.content;
            body.appendChild(contentDiv);
        } else if (this.options.content instanceof HTMLElement) {
            body.appendChild(this.options.content);
        }

        // Add buttons
        if (this.options.buttons.length > 0) {
            const footer = this.element.querySelector('.modal__footer');
            this.options.buttons.forEach(btn => {
                const button = DOM.create('button', {
                    className: `btn ${btn.className || 'btn--secondary'}`,
                    onClick: () => {
                        if (btn.onClick) btn.onClick(this);
                    }
                }, [btn.text]);
                footer.appendChild(button);
            });
        }

        this.backdrop.appendChild(this.element);
        document.body.appendChild(this.backdrop);

        // Add keyboard listener
        document.addEventListener('keydown', this._boundKeyHandler);

        // Focus first input or close button
        const firstInput = this.element.querySelector('input, textarea');
        if (firstInput) {
            firstInput.focus();
        } else {
            this.element.querySelector('.modal__close').focus();
        }

        eventBus.emit(Events.MODAL_OPEN, this);
    }

    /**
     * Handle keyboard events
     * @param {KeyboardEvent} e
     */
    _handleKeyDown(e) {
        if (e.key === 'Escape') {
            this.close();
        }
    }

    /**
     * Close and destroy the modal
     */
    close() {
        document.removeEventListener('keydown', this._boundKeyHandler);

        if (this.backdrop && this.backdrop.parentNode) {
            this.backdrop.parentNode.removeChild(this.backdrop);
        }

        if (this.options.onClose) {
            this.options.onClose();
        }

        eventBus.emit(Events.MODAL_CLOSE, this);
    }

    /**
     * Get the modal body element
     * @returns {HTMLElement}
     */
    getBody() {
        return this.element.querySelector('.modal__body');
    }

    /**
     * Update modal title
     * @param {string} title
     */
    setTitle(title) {
        const titleEl = this.element.querySelector('.modal__title');
        if (titleEl) {
            Sanitize.text(titleEl, title);
        }
    }
}

// Make available globally
window.Modal = Modal;
