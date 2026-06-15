/**
 * BlindBase Kanban Application
 * Main application entry point
 */
class App {
    constructor() {
        this.blindBase = new BlindBase('api.php');
        this.store = null;
        this.currentView = null;
        this.headerComponent = null;
        this.searchComponent = null;
        this._pendingHighlight = null;

        this._setupRouter();
        this._setupErrorHandling();
        this._setupGlobalShortcuts();
    }

    /**
     * Initialize the application
     */
    async init() {
        router.start();
    }

    /**
     * Set up router
     */
    _setupRouter() {
        router.register('/', () => this._showHome());
        router.register('/login', () => this._showLogin());
        router.register('/board/:id', (params) => this._showBoard(params.id));
    }

    /**
     * Set up global error handling
     */
    _setupErrorHandling() {
        // Handle save errors
        eventBus.on(Events.SAVE_ERROR, (error) => {
            Toast.error('Failed to save changes. Will retry automatically.');
        });

        // Handle unhandled errors
        window.addEventListener('error', (e) => {
            console.error('Unhandled error:', e.error);
            Toast.error('An unexpected error occurred.');
        });

        // Handle unhandled promise rejections
        window.addEventListener('unhandledrejection', (e) => {
            console.error('Unhandled rejection:', e.reason);
            Toast.error('An unexpected error occurred.');
        });
    }

    /**
     * Show the home/landing page
     */
    _showHome() {
        if (this.store) {
            this._showDashboardGallery();
            return;
        }

        router.navigate('/login');
    }

    /**
     * Render the dedicated login page
     */
    _showLogin() {
        if (this.store) {
            router.navigate('/');
            return;
        }

        this._destroyCurrentView();

        const app = document.getElementById('app');
        app.innerHTML = '';

        this.currentView = new LoginComponent(app, async (username, password) => {
            // Show loading overlay
            this._showLoading('Unlocking your vault...');

            try {
                const data = await this.blindBase.init(username, password);

                this.store = new AppStore(this.blindBase);
                this.store.init(data);

                this._hideLoading();
                router.navigate('/');

                Toast.success('Vault unlocked successfully!');
            } catch (error) {
                this._hideLoading();
                throw error;
            }
        });
    }

    /**
     * Show dashboard gallery view
     */
    _showDashboardGallery() {
        if (!this.store) {
            router.navigate('/login');
            return;
        }

        this._destroyCurrentView();

        const app = document.getElementById('app');
        app.innerHTML = '';

        const layout = DOM.create('div', { className: 'app-layout' }, [
            DOM.create('div', { id: 'header' }),
            DOM.create('div', { className: 'app-content', id: 'content' })
        ]);
        app.appendChild(layout);

        // Render header
        this.headerComponent = new HeaderComponent(document.getElementById('header'), {
            title: 'noc7is',
            showBack: false,
            onSearch: () => this._openSearch(),
            onLogout: () => this._logout()
        });

        // Render gallery
        this.currentView = new DashboardGalleryComponent(
            document.getElementById('content'),
            this.store
        );
    }

    /**
     * Show board view
     * @param {string} dashboardId
     */
    _showBoard(dashboardId) {
        if (!this.store) {
            router.navigate('/');
            return;
        }

        const dashboard = this.store.getDashboard(dashboardId);
        if (!dashboard) {
            Toast.error('Dashboard not found.');
            router.navigate('/');
            return;
        }

        this._destroyCurrentView();

        const app = document.getElementById('app');
        app.innerHTML = '';

        const layout = DOM.create('div', { className: 'app-layout' }, [
            DOM.create('div', { id: 'header' }),
            DOM.create('div', { className: 'app-content', id: 'content' })
        ]);
        app.appendChild(layout);

        // Render header with editable title
        this.headerComponent = new HeaderComponent(document.getElementById('header'), {
            title: dashboard.title,
            showBack: true,
            editableTitle: true,
            onBack: () => router.navigate('/'),
            onSearch: () => this._openSearch(),
            onTitleChange: (newTitle) => {
                this.store.updateDashboard(dashboardId, { title: newTitle });
                Toast.success('Dashboard renamed!');
            },
            onLogout: () => this._logout()
        });

        // Render board
        this.currentView = new BoardViewComponent(
            document.getElementById('content'),
            this.store,
            dashboardId
        );

        // Apply a pending highlight if we navigated here from search
        this._applyPendingHighlight();

        // Update header when dashboard title changes
        this._dashboardUpdateUnsubscribe = this.store.subscribe((state) => {
            const updatedDashboard = this.store.getDashboard(dashboardId);
            if (updatedDashboard && this.headerComponent) {
                this.headerComponent.updateTitle(updatedDashboard.title);
            }
        });
    }

    /**
     * Set up global keyboard shortcuts
     */
    _setupGlobalShortcuts() {
        document.addEventListener('keydown', (e) => {
            // Ctrl/Cmd+K opens search when logged in
            if ((e.ctrlKey || e.metaKey) && (e.key === 'k' || e.key === 'K')) {
                if (this.store) {
                    e.preventDefault();
                    this._openSearch();
                }
            }
        });
    }

    /**
     * Open the cross-board search overlay
     */
    _openSearch() {
        if (!this.store) return;
        if (this.searchComponent) return; // already open

        this.searchComponent = new SearchComponent(this.store, {
            onSelect: (result) => this._handleSearchResult(result),
            onClose: () => { this.searchComponent = null; }
        });
    }

    /**
     * Navigate to a search result and queue a highlight
     * @param {Object} result
     */
    _handleSearchResult(result) {
        if (!result || !result.dashboardId) return;

        this._pendingHighlight = {
            dashboardId: result.dashboardId,
            listId: result.listId || null,
            itemId: result.itemId || null,
            isFolder: !!result.isFolder,
            openItem: result.type === 'item'
        };

        const onSameBoard =
            router.getCurrentRoute() === '/board/:id' &&
            router.getParams().id === result.dashboardId;

        if (onSameBoard) {
            // Hash won't change, so apply the highlight directly
            this._applyPendingHighlight();
        } else {
            router.navigate(`/board/${result.dashboardId}`);
        }
    }

    /**
     * Apply a queued highlight to the current board view (if it matches)
     */
    _applyPendingHighlight() {
        const target = this._pendingHighlight;
        if (!target) return;
        if (!(this.currentView instanceof BoardViewComponent)) return;
        if (this.currentView.dashboardId !== target.dashboardId) return;

        this._pendingHighlight = null;
        this.currentView.focusTarget(target);
    }

    /**
     * Destroy current view and clean up
     */
    _destroyCurrentView() {
        if (this.currentView?.destroy) {
            this.currentView.destroy();
        }
        this.currentView = null;

        if (this.headerComponent?.destroy) {
            this.headerComponent.destroy();
        }
        this.headerComponent = null;

        if (this._dashboardUpdateUnsubscribe) {
            this._dashboardUpdateUnsubscribe();
            this._dashboardUpdateUnsubscribe = null;
        }
    }

    /**
     * Log out
     */
    _logout() {
        if (this.store?.saveStatus === 'saving') {
            Toast.warning('Please wait for save to complete.');
            return;
        }

        this.blindBase.logout();
    }

    /**
     * Show loading overlay
     * @param {string} message
     */
    _showLoading(message) {
        // Remove existing loading overlay
        this._hideLoading();

        const overlay = DOM.create('div', { className: 'loading-overlay', id: 'loading-overlay' }, [
            DOM.create('div', { className: 'spinner spinner--lg' }),
            DOM.create('p', { className: 'loading-overlay__text' }, [message])
        ]);

        document.body.appendChild(overlay);
    }

    /**
     * Hide loading overlay
     */
    _hideLoading() {
        const overlay = document.getElementById('loading-overlay');
        if (overlay) {
            overlay.parentNode.removeChild(overlay);
        }
    }
}

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    const app = new App();
    app.init();
});
