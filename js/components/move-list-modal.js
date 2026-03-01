/**
 * Move List Modal Component
 * Modal for moving a list to a different dashboard
 */
class MoveListModal {
    /**
     * Create and show move list modal
     * @param {AppStore} store
     * @param {string} listId - List to move
     * @param {string} currentDashboardId - Current dashboard
     */
    constructor(store, listId, currentDashboardId) {
        this.store = store;
        this.listId = listId;
        this.currentDashboardId = currentDashboardId;
        this.selectedDashboardId = null;

        this.show();
    }

    /**
     * Show the modal
     */
    show() {
        const list = this.store.getList(this.listId);
        const dashboards = this.store.getActiveDashboards()
            .filter(d => d.id !== this.currentDashboardId);

        if (dashboards.length === 0) {
            Toast.info('No other dashboards available. Create a new dashboard first.');
            return;
        }

        const content = DOM.create('div', {}, [
            DOM.create('p', { style: { marginBottom: 'var(--space-md)' } }, [
                `Move "${list.title}" to:`
            ]),
            DOM.create('div', { className: 'dashboard-select', id: 'dashboard-select' })
        ]);

        this.modal = new Modal({
            title: 'Move List',
            content,
            buttons: [
                {
                    text: 'Cancel',
                    className: 'btn--secondary',
                    onClick: (m) => m.close()
                },
                {
                    text: 'Move',
                    className: 'btn--primary',
                    onClick: (m) => this._move(m)
                }
            ]
        });

        // Render dashboard options
        this._renderOptions(dashboards);
    }

    /**
     * Render dashboard selection options
     * @param {Object[]} dashboards
     */
    _renderOptions(dashboards) {
        const container = document.getElementById('dashboard-select');
        if (!container) return;

        dashboards.forEach(dashboard => {
            const listCount = this.store.getListsForDashboard(dashboard.id).length;

            const option = DOM.create('div', {
                className: 'dashboard-select__option',
                dataset: { dashboardId: dashboard.id },
                onClick: () => this._selectDashboard(dashboard.id)
            }, [
                DOM.create('div', {}, [
                    DOM.create('div', { className: 'dashboard-select__option-title' }, [dashboard.title]),
                    DOM.create('div', { className: 'dashboard-select__option-meta' }, [
                        `${listCount} list${listCount !== 1 ? 's' : ''}`
                    ])
                ])
            ]);

            container.appendChild(option);
        });

        // Select first by default
        if (dashboards.length > 0) {
            this._selectDashboard(dashboards[0].id);
        }
    }

    /**
     * Select a dashboard
     * @param {string} dashboardId
     */
    _selectDashboard(dashboardId) {
        this.selectedDashboardId = dashboardId;

        // Update visual selection
        const options = document.querySelectorAll('.dashboard-select__option');
        options.forEach(opt => {
            if (opt.dataset.dashboardId === dashboardId) {
                opt.classList.add('dashboard-select__option--selected');
            } else {
                opt.classList.remove('dashboard-select__option--selected');
            }
        });
    }

    /**
     * Move the list
     * @param {Modal} modal
     */
    _move(modal) {
        if (!this.selectedDashboardId) {
            Toast.warning('Please select a dashboard.');
            return;
        }

        const targetDashboard = this.store.getDashboard(this.selectedDashboardId);
        const list = this.store.getList(this.listId);

        this.store.moveListToDashboard(
            this.listId,
            this.currentDashboardId,
            this.selectedDashboardId
        );

        Toast.success(`Moved "${list.title}" to "${targetDashboard.title}".`);
        modal.close();
    }
}

// Make available globally
window.MoveListModal = MoveListModal;
