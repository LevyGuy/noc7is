/**
 * Landing Page Component
 * Marketing page with features, screenshots, and login form
 */
class LandingComponent {
    /**
     * Create landing page
     * @param {HTMLElement} container - Container element
     * @param {Function} onLogin - Callback when login succeeds
     */
    constructor(container, onLogin) {
        this.container = container;
        this.onLogin = onLogin;
        this.isLoading = false;
        this._mobileMenuOpen = false;
        this._cleanups = [];

        this.render();
    }

    /**
     * Render the full landing page
     */
    render() {
        this.container.innerHTML = '';

        const landing = DOM.create('div', { className: 'landing' }, [
            this._createNav(),
            this._createHero(),
            this._createFeatures(),
            this._createScreenshots(),
            this._createAbout(),
            this._createContact(),
            this._createLoginSection(),
            this._createPrivacy(),
            this._createTerms(),
            this._createFooter()
        ]);

        this.container.appendChild(landing);
    }

    // =========================================
    // Navigation
    // =========================================

    _createNav() {
        const navLinks = [
            { label: 'Features', target: 'landing-features' },
            { label: 'Screenshots', target: 'landing-screenshots' },
            { label: 'About', target: 'landing-about' },
            { label: 'Contact', target: 'landing-contact' }
        ];

        const mobileMenu = DOM.create('div', {
            className: 'landing__nav-mobile',
            id: 'landing-mobile-menu'
        }, [
            ...navLinks.map(link =>
                DOM.create('button', {
                    className: 'landing__nav-link',
                    onClick: () => {
                        this._scrollTo(link.target);
                        this._closeMobileMenu();
                    }
                }, [link.label])
            ),
            DOM.create('button', {
                className: 'landing__nav-link landing__nav-link--cta',
                onClick: () => {
                    this._scrollTo('landing-login');
                    this._closeMobileMenu();
                }
            }, ['Login'])
        ]);

        return DOM.create('nav', { className: 'landing__nav' }, [
            DOM.create('div', { className: 'landing__nav-inner' }, [
                DOM.create('button', {
                    className: 'landing__nav-brand',
                    onClick: () => this._scrollTo('landing-hero'),
                    style: { border: 'none', background: 'none', padding: 0, cursor: 'pointer' }
                }, [
                    DOM.create('img', {
                        src: 'logo.png',
                        alt: 'noc7is logo',
                        className: 'landing__nav-logo',
                        style: { height: '40px', width: 'auto' }
                    })
                ]),
                DOM.create('div', { className: 'landing__nav-links' }, [
                    ...navLinks.map(link =>
                        DOM.create('button', {
                            className: 'landing__nav-link',
                            onClick: () => this._scrollTo(link.target)
                        }, [link.label])
                    ),
                    DOM.create('button', {
                        className: 'landing__nav-link landing__nav-link--cta',
                        onClick: () => this._scrollTo('landing-login')
                    }, ['Login'])
                ]),
                DOM.create('button', {
                    className: 'landing__nav-toggle',
                    onClick: () => this._toggleMobileMenu()
                }, ['\u2630'])
            ]),
            mobileMenu
        ]);
    }

    // =========================================
    // Hero
    // =========================================

    _createHero() {
        return DOM.create('section', { className: 'landing__hero', id: 'landing-hero' }, [
            DOM.create('div', { className: 'landing__container' }, [
                DOM.create('h1', { className: 'landing__hero-title', style: { margin: 0, marginBottom: 'var(--space-sm)' } }, [
                    DOM.create('img', {
                        src: 'logo.png',
                        alt: 'noc7is logo',
                        style: { height: '80px', width: 'auto', display: 'block', margin: '0 auto', borderRadius: '5px' }
                    })
                ]),
                DOM.create('p', { className: 'landing__hero-tagline' }, [
                    'Your data, encrypted. Your privacy, protected.'
                ]),
                DOM.create('p', { className: 'landing__hero-subtitle' }, [
                    'A zero-knowledge Kanban board. The server is blind. Only you hold the key.'
                ]),
                DOM.create('div', { className: 'landing__hero-actions' }, [
                    DOM.create('button', {
                        className: 'landing__hero-btn landing__hero-btn--primary',
                        onClick: () => this._scrollTo('landing-login')
                    }, ['Get Started']),
                    DOM.create('button', {
                        className: 'landing__hero-btn landing__hero-btn--secondary',
                        onClick: () => this._scrollTo('landing-features')
                    }, ['Learn More'])
                ])
            ])
        ]);
    }

    // =========================================
    // Features
    // =========================================

    _createFeatures() {
        const features = [
            { icon: '\uD83D\uDD10', title: 'Zero-Knowledge Encryption', text: 'AES-256-GCM encryption in your browser. Your password derives the key locally \u2014 the server never sees your data.' },
            { icon: '\uD83D\uDCCB', title: 'Multi-Dashboard Boards', text: 'Organize work, personal tasks, and projects in separate Kanban boards with custom lists.' },
            { icon: '\uD83D\uDDB1\uFE0F', title: 'Drag & Drop', text: 'Reorder lists and move tasks with smooth drag & drop \u2014 works on desktop and mobile touch devices.' },
            { icon: '\uD83C\uDFF7\uFE0F', title: 'Color-Coded Labels', text: 'Tag items with 8 vibrant colors for instant visual categorization and filtering.' },
            { icon: '\uD83D\uDCC1', title: 'Folders', text: 'Group related items into collapsible folders within your lists for better organization.' },
            { icon: '\u23F0', title: 'Snooze Items & Lists', text: 'Temporarily hide items or entire lists and bring them back on your schedule.' },
            { icon: '\uD83D\uDCBE', title: 'Auto-Save', text: 'Changes are encrypted and synced to the server automatically \u2014 no save button needed.' },
            { icon: '\uD83E\uDEB6', title: 'Zero Dependencies', text: 'No frameworks, no npm, no bloat. Pure HTML, CSS, and JavaScript for maximum speed.' },
            { icon: '\uD83D\uDCE5', title: 'Import from Trello', text: 'Migrate your existing Trello boards with a simple JSON import. Switch in seconds.' },
            { icon: '\uD83D\uDCF1', title: 'Fully Responsive', text: 'Works seamlessly on desktop, tablet, and mobile browsers with an adaptive layout.' }
        ];

        return DOM.create('section', {
            className: 'landing__section landing__section--alt',
            id: 'landing-features'
        }, [
            DOM.create('div', { className: 'landing__container' }, [
                DOM.create('h2', { className: 'landing__section-title' }, ['Why noc7is?']),
                DOM.create('p', { className: 'landing__section-subtitle' }, [
                    'Privacy-first task management with powerful features and zero compromise.'
                ]),
                DOM.create('div', { className: 'landing__features-grid' }, features.map(f =>
                    DOM.create('div', { className: 'landing__feature-card' }, [
                        DOM.create('span', { className: 'landing__feature-icon' }, [f.icon]),
                        DOM.create('h3', { className: 'landing__feature-title' }, [f.title]),
                        DOM.create('p', { className: 'landing__feature-text' }, [f.text])
                    ])
                ))
            ])
        ]);
    }

    // =========================================
    // Screenshots
    // =========================================

    _createScreenshots() {
        const screenshots = [
            { src: 'screenshots/add_dashboard.png', caption: 'Create and manage multiple dashboards' },
            { src: 'screenshots/add_item.png', caption: 'Add items to your Kanban lists' },
            { src: 'screenshots/add_label.png', caption: 'Color-coded labels for categorization' },
            { src: 'screenshots/add_folder.png', caption: 'Organize items into folders' },
            { src: 'screenshots/add_folder_items.png', caption: 'View and manage folder contents' },
            { src: 'screenshots/snooze_item.png', caption: 'Snooze items for later' },
            { src: 'screenshots/snooze_list.png', caption: 'Snooze or move entire lists' },
            { src: 'screenshots/add_separator.png', caption: 'Visual separators and snoozed lists' }
        ];

        return DOM.create('section', {
            className: 'landing__section',
            id: 'landing-screenshots'
        }, [
            DOM.create('div', { className: 'landing__container' }, [
                DOM.create('h2', { className: 'landing__section-title' }, ['See It In Action']),
                DOM.create('p', { className: 'landing__section-subtitle' }, [
                    'A clean, intuitive interface designed to help you focus on what matters.'
                ]),
                DOM.create('div', { className: 'landing__screenshots-grid' }, screenshots.map(s =>
                    DOM.create('div', {
                        className: 'landing__screenshot',
                        onClick: () => this._openLightbox(s.src, s.caption)
                    }, [
                        DOM.create('img', {
                            className: 'landing__screenshot-img',
                            src: s.src,
                            alt: s.caption,
                            loading: 'lazy'
                        }),
                        DOM.create('p', { className: 'landing__screenshot-caption' }, [s.caption])
                    ])
                ))
            ])
        ]);
    }

    // =========================================
    // About
    // =========================================

    _createAbout() {
        return DOM.create('section', {
            className: 'landing__section landing__section--alt',
            id: 'landing-about'
        }, [
            DOM.create('div', { className: 'landing__container' }, [
                DOM.create('h2', { className: 'landing__section-title' }, ['About']),
                DOM.create('div', { className: 'landing__about-content' }, [
                    DOM.create('p', { className: 'landing__about-text' }, [
                        'noc7is is a privacy-first Kanban board built on a zero-knowledge architecture. Your data is encrypted with AES-256-GCM in your browser before it ever reaches the server. The server stores only encrypted blobs it cannot read \u2014 your password is the only key, and it never leaves your device.'
                    ]),
                    DOM.create('p', { className: 'landing__about-text' }, [
                        'Built with vanilla JavaScript, HTML, and CSS \u2014 no frameworks, no npm packages, no external dependencies. Lightweight, fast, and completely transparent. Licensed under MIT.'
                    ]),
                    DOM.create('div', { className: 'landing__about-highlights' }, [
                        this._createHighlight('AES-256', 'Encryption'),
                        this._createHighlight('0', 'Dependencies'),
                        this._createHighlight('100%', 'Client-side'),
                        this._createHighlight('MIT', 'License')
                    ])
                ])
            ])
        ]);
    }

    _createHighlight(value, label) {
        return DOM.create('div', { className: 'landing__about-highlight' }, [
            DOM.create('span', { className: 'landing__about-highlight-value' }, [value]),
            DOM.create('span', { className: 'landing__about-highlight-label' }, [label])
        ]);
    }

    // =========================================
    // Contact
    // =========================================

    _createContact() {
        return DOM.create('section', {
            className: 'landing__section',
            id: 'landing-contact'
        }, [
            DOM.create('div', { className: 'landing__container' }, [
                DOM.create('h2', { className: 'landing__section-title' }, ['Contact']),
                DOM.create('div', { className: 'landing__contact-content' }, [
                    DOM.create('p', { className: 'landing__contact-text' }, [
                        'Have questions, feedback, or ideas? Reach out on X (Twitter).'
                    ]),
                    DOM.create('a', {
                        className: 'landing__contact-link',
                        href: 'https://x.com/levyguy',
                        target: '_blank',
                        rel: 'noopener noreferrer'
                    }, ['@levyguy on X'])
                ])
            ])
        ]);
    }

    // =========================================
    // Login Section
    // =========================================

    _createLoginSection() {
        return DOM.create('section', {
            className: 'landing__section landing__section--alt',
            id: 'landing-login'
        }, [
            DOM.create('div', { className: 'landing__container' }, [
                DOM.create('h2', { className: 'landing__section-title' }, ['Unlock Your Vault']),
                DOM.create('p', { className: 'landing__section-subtitle' }, [
                    'Enter your credentials to access your encrypted boards. New username? A vault will be created automatically.'
                ]),
                DOM.create('div', { className: 'landing__login-wrapper' }, [
                    DOM.create('div', { className: 'landing__login-card' }, [
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
                ])
            ])
        ]);
    }

    // =========================================
    // Privacy Policy
    // =========================================

    _createPrivacy() {
        const content = DOM.create('div', { className: 'landing__legal' });

        const sections = [
            {
                title: 'Overview',
                text: 'noc7is is designed with privacy as its core principle. We employ a zero-knowledge architecture, meaning the server never has access to your unencrypted data.'
            },
            {
                title: 'Data We Store',
                items: [
                    'Your username (used to identify your encrypted data vault)',
                    'A cryptographic salt (used for key derivation, not your password)',
                    'Your encrypted data blob (boards, lists, items \u2014 fully encrypted with AES-256-GCM)'
                ]
            },
            {
                title: 'Data We Do Not Store',
                items: [
                    'Your password \u2014 it never leaves your browser',
                    'Your encryption key \u2014 derived locally and held only in browser memory',
                    'Any unencrypted content from your boards, lists, or items'
                ]
            },
            {
                title: 'Encryption',
                text: 'All user data is encrypted client-side using AES-256-GCM before transmission. The encryption key is derived from your password using PBKDF2 with 100,000 iterations. The server applies an additional layer of encryption using Sodium Secretbox. Even the server operator cannot read your data.'
            },
            {
                title: 'Cookies & Tracking',
                text: 'noc7is does not use cookies, analytics, tracking pixels, or any third-party services. No personal data is collected, sold, or shared with anyone.'
            },
            {
                title: 'Data Retention',
                text: 'Your encrypted data is stored for as long as your account exists. Since we cannot read your data, we cannot selectively delete individual items. Deleting your vault removes all associated encrypted data.'
            },
            {
                title: 'Your Responsibility',
                text: 'Because of the zero-knowledge design, you are solely responsible for remembering your password. There is no password reset mechanism \u2014 losing your password means your data is mathematically irrecoverable.'
            }
        ];

        sections.forEach(section => {
            content.appendChild(DOM.create('h3', {}, [section.title]));
            if (section.text) {
                content.appendChild(DOM.create('p', {}, [section.text]));
            }
            if (section.items) {
                content.appendChild(DOM.create('ul', {}, section.items.map(item =>
                    DOM.create('li', {}, [item])
                )));
            }
        });

        return DOM.create('section', {
            className: 'landing__section',
            id: 'landing-privacy'
        }, [
            DOM.create('div', { className: 'landing__container' }, [
                DOM.create('h2', { className: 'landing__section-title' }, ['Privacy Policy']),
                content
            ])
        ]);
    }

    // =========================================
    // Terms of Use
    // =========================================

    _createTerms() {
        const content = DOM.create('div', { className: 'landing__legal' });

        const sections = [
            {
                title: 'Acceptance',
                text: 'By using noc7is, you agree to these terms. If you do not agree, please do not use the service.'
            },
            {
                title: 'Service Description',
                text: 'noc7is is a zero-knowledge encrypted Kanban board application. It is provided as open-source software under the MIT License. The service allows you to create, organize, and manage tasks using encrypted boards that only you can read.'
            },
            {
                title: 'No Password Recovery',
                text: 'noc7is uses client-side encryption where your password is the sole encryption key. There is no password reset or recovery mechanism. If you lose or forget your password, your data cannot be recovered by anyone, including the service operator. You accept this limitation by using the service.'
            },
            {
                title: 'User Responsibilities',
                items: [
                    'You are responsible for maintaining the security of your password',
                    'You must not use the service for any illegal purposes',
                    'You are responsible for all activity under your account',
                    'You should maintain your own backups using the export feature'
                ]
            },
            {
                title: 'No Warranty',
                text: 'The service is provided "as-is" without warranty of any kind, express or implied. The service operator makes no guarantees regarding uptime, data availability, or data integrity. Use the service at your own risk.'
            },
            {
                title: 'Limitation of Liability',
                text: 'The service operator is not liable for any data loss, unauthorized access due to compromised passwords, service interruptions, or any other damages arising from the use of the service.'
            },
            {
                title: 'Changes to Terms',
                text: 'These terms may be updated from time to time. Continued use of the service constitutes acceptance of any changes.'
            }
        ];

        sections.forEach(section => {
            content.appendChild(DOM.create('h3', {}, [section.title]));
            if (section.text) {
                content.appendChild(DOM.create('p', {}, [section.text]));
            }
            if (section.items) {
                content.appendChild(DOM.create('ul', {}, section.items.map(item =>
                    DOM.create('li', {}, [item])
                )));
            }
        });

        return DOM.create('section', {
            className: 'landing__section landing__section--alt',
            id: 'landing-terms'
        }, [
            DOM.create('div', { className: 'landing__container' }, [
                DOM.create('h2', { className: 'landing__section-title' }, ['Terms of Use']),
                content
            ])
        ]);
    }

    // =========================================
    // Footer
    // =========================================

    _createFooter() {
        return DOM.create('footer', { className: 'landing__footer' }, [
            DOM.create('div', { className: 'landing__container' }, [
                DOM.create('div', { className: 'landing__footer-inner' }, [
                    DOM.create('img', {
                        src: 'logo.png',
                        alt: 'noc7is logo',
                        className: 'landing__footer-brand',
                        style: { height: '28px', width: 'auto' }
                    }),
                    DOM.create('div', { className: 'landing__footer-links' }, [
                        DOM.create('button', {
                            className: 'landing__footer-link',
                            onClick: () => this._scrollTo('landing-features')
                        }, ['Features']),
                        DOM.create('button', {
                            className: 'landing__footer-link',
                            onClick: () => this._scrollTo('landing-about')
                        }, ['About']),
                        DOM.create('button', {
                            className: 'landing__footer-link',
                            onClick: () => this._scrollTo('landing-contact')
                        }, ['Contact']),
                        DOM.create('button', {
                            className: 'landing__footer-link',
                            onClick: () => this._scrollTo('landing-privacy')
                        }, ['Privacy Policy']),
                        DOM.create('button', {
                            className: 'landing__footer-link',
                            onClick: () => this._scrollTo('landing-terms')
                        }, ['Terms of Use'])
                    ]),
                    DOM.create('p', { className: 'landing__footer-copyright' }, [
                        '\u00A9 ' + new Date().getFullYear() + ' noc7is. The server is blind. Only you hold the key.'
                    ])
                ])
            ])
        ]);
    }

    // =========================================
    // Interactions
    // =========================================

    _scrollTo(sectionId) {
        const el = document.getElementById(sectionId);
        if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    }

    _toggleMobileMenu() {
        this._mobileMenuOpen = !this._mobileMenuOpen;
        const menu = document.getElementById('landing-mobile-menu');
        if (menu) {
            if (this._mobileMenuOpen) {
                menu.classList.add('landing__nav-mobile--open');
            } else {
                menu.classList.remove('landing__nav-mobile--open');
            }
        }
    }

    _closeMobileMenu() {
        this._mobileMenuOpen = false;
        const menu = document.getElementById('landing-mobile-menu');
        if (menu) {
            menu.classList.remove('landing__nav-mobile--open');
        }
    }

    _openLightbox(src, alt) {
        const img = DOM.create('img', {
            className: 'landing__lightbox-img',
            src: src,
            alt: alt
        });

        new Modal({
            title: alt,
            content: img,
            closeOnBackdrop: true
        });
    }

    // =========================================
    // Login Form Handling
    // =========================================

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

    _showError(message) {
        const errorEl = document.getElementById('login-error');
        if (errorEl) {
            Sanitize.text(errorEl, message);
            DOM.show(errorEl);
        }
    }

    // =========================================
    // Cleanup
    // =========================================

    destroy() {
        this._cleanups.forEach(fn => fn());
        this._cleanups = [];
        DOM.clear(this.container);
    }
}

// Make available globally
window.LandingComponent = LandingComponent;
