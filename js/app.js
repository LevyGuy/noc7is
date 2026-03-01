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

        this._setupRouter();
        this._setupErrorHandling();
    }

    /**
     * Initialize the application
     */
    async init() {
        this._renderLogin();
    }

    /**
     * Set up router
     */
    _setupRouter() {
        router.register('/', () => this._showDashboardGallery());
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
     * Render the login screen
     */
    _renderLogin() {
        const app = document.getElementById('app');
        app.innerHTML = '';

        new LoginComponent(app, async (username, password) => {
            // Show loading overlay
            this._showLoading('Unlocking your vault...');

            try {
                const data = await this.blindBase.init(username, password);

                this.store = new AppStore(this.blindBase);
                this.store.init(data);

                this._hideLoading();
                router.start();

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
            this._renderLogin();
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

        // Update header when dashboard title changes
        this._dashboardUpdateUnsubscribe = this.store.subscribe((state) => {
            const updatedDashboard = this.store.getDashboard(dashboardId);
            if (updatedDashboard && this.headerComponent) {
                this.headerComponent.updateTitle(updatedDashboard.title);
            }
        });
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
