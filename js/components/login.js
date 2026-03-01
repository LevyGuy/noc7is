/**
 * Login Component
 * Handles user authentication via BlindBase
 */
class LoginComponent {
    /**
     * Create login component
     * @param {HTMLElement} container - Container element
     * @param {Function} onLogin - Callback when login succeeds
     */
    constructor(container, onLogin) {
        this.container = container;
        this.onLogin = onLogin;
        this.isLoading = false;

        this.render();
    }

    /**
     * Render the login form
     */
    render() {
        this.container.innerHTML = '';

        const login = DOM.create('div', { className: 'login' }, [
            DOM.create('div', { className: 'login__card' }, [
                DOM.create('h1', { className: 'login__title' }, ['noc7is']),
                DOM.create('p', { className: 'login__subtitle' }, [
                    'Your data, encrypted. Your privacy, protected.'
                ]),

                DOM.create('form', {
                    className: 'login__form',
                    id: 'login-form',
                    onSubmit: (e) => this._handleSubmit(e)
                }, [
                    DOM.create('div', { className: 'form-group' }, [
                        DOM.create('label', { className: 'form-label', for: 'username' }, ['Username']),
                        DOM.create('input', {
                            className: 'form-input',
                            type: 'text',
                            id: 'username',
                            placeholder: 'Enter username (lowercase)',
                            autocomplete: 'username',
                            required: 'true'
                        })
                    ]),

                    DOM.create('div', { className: 'form-group' }, [
                        DOM.create('label', { className: 'form-label', for: 'password' }, ['Password']),
                        DOM.create('input', {
                            className: 'form-input',
                            type: 'password',
                            id: 'password',
                            placeholder: 'Enter your password',
                            autocomplete: 'current-password',
                            required: 'true'
                        })
                    ]),

                    DOM.create('button', {
                        className: 'btn btn--primary btn--lg btn--block',
                        type: 'submit',
                        id: 'login-btn'
                    }, [
                        DOM.create('span', { id: 'login-text' }, ['Unlock Vault']),
                        DOM.create('span', { id: 'login-loading', className: 'hidden' }, [
                            DOM.create('span', { className: 'spinner' }),
                            ' Unlocking...'
                        ])
                    ]),

                    DOM.create('p', { className: 'login__error hidden', id: 'login-error' })
                ]),

                DOM.create('p', { className: 'login__info' }, [
                    'Your password never leaves your device. It is used to derive an encryption key locally. If you forget your password, your data cannot be recovered.'
                ])
            ])
        ]);

        this.container.appendChild(login);

        // Focus username field
        document.getElementById('username').focus();
    }

    /**
     * Handle form submission
     * @param {Event} e
     */
    async _handleSubmit(e) {
        e.preventDefault();

        if (this.isLoading) return;

        const username = document.getElementById('username').value.trim().toLowerCase();
        const password = document.getElementById('password').value;
        const errorEl = document.getElementById('login-error');
        const loginText = document.getElementById('login-text');
        const loginLoading = document.getElementById('login-loading');
        const loginBtn = document.getElementById('login-btn');

        // Validate
        if (!username || !password) {
            this._showError('Please enter both username and password.');
            return;
        }

        if (username.length < 3) {
            this._showError('Username must be at least 3 characters.');
            return;
        }

        if (!/^[a-z0-9_]+$/.test(username)) {
            this._showError('Username can only contain lowercase letters, numbers, and underscores.');
            return;
        }

        // Show loading state
        this.isLoading = true;
        DOM.hide(loginText);
        DOM.show(loginLoading);
        DOM.hide(errorEl);
        loginBtn.disabled = true;

        try {
            await this.onLogin(username, password);
        } catch (error) {
            this._showError(error.message || 'Login failed. Please try again.');
            this.isLoading = false;
            DOM.show(loginText);
            DOM.hide(loginLoading);
            loginBtn.disabled = false;
        }
    }

    /**
     * Show error message
     * @param {string} message
     */
    _showError(message) {
        const errorEl = document.getElementById('login-error');
        if (errorEl) {
            Sanitize.text(errorEl, message);
            DOM.show(errorEl);
        }
    }

    /**
     * Clean up component
     */
    destroy() {
        DOM.clear(this.container);
    }
}

// Make available globally
window.LoginComponent = LoginComponent;
