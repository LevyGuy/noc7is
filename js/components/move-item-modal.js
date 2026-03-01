/**
 * Move Item Modal Component
 * Modal for moving a single item to a different dashboard and list
 */
class MoveItemModal {
    /**
     * Create and show move item modal
     * @param {AppStore} store
     * @param {string} itemId - Item to move
     * @param {string} currentDashboardId - Current dashboard containing the item
     */
    constructor(store, itemId, currentDashboardId) {
        this.store = store;
        this.itemId = itemId;
        this.currentDashboardId = currentDashboardId;
        this.selectedDashboardId = null;
        this.selectedListId = null;

        this.show();
    }

    /**
     * Show the modal
     */
    show() {
        const item = this.store.getItem(this.itemId);
        if (!item) return;

        const dashboards = this.store.getActiveDashboards();

        if (dashboards.length === 0) {
            Toast.info('No dashboards available.');
            return;
        }

        const content = DOM.create('div', {}, [
            DOM.create('p', { style: { marginBottom: 'var(--space-md)' } }, [
                `Move "${item.title}" to:`
            ]),
            // Dashboard selection
            DOM.create('div', { className: 'form-group' }, [
                DOM.create('label', { className: 'form-label' }, ['Dashboard']),
                DOM.create('div', { className: 'move-item-select', id: 'move-item-dashboard-select' })
            ]),
            // List selection (populated when dashboard is selected)
            DOM.create('div', { className: 'form-group' }, [
                DOM.create('label', { className: 'form-label' }, ['List']),
                DOM.create('div', { className: 'move-item-select', id: 'move-item-list-select' })
            ])
        ]);

        this.modal = new Modal({
            title: 'Move Item',
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

        this._renderDashboardOptions(dashboards);
    }

    /**
     * Render dashboard selection options
     * @param {Object[]} dashboards
     */
    _renderDashboardOptions(dashboards) {
        const container = document.getElementById('move-item-dashboard-select');
        if (!container) return;

        dashboards.forEach(dashboard => {
            const listCount = this.store.getListsForDashboard(dashboard.id).length;
            const isCurrent = dashboard.id === this.currentDashboardId;

            const option = DOM.create('div', {
                className: 'move-item-select__option' + (isCurrent ? ' move-item-select__option--current' : ''),
                dataset: { dashboardId: dashboard.id },
                onClick: () => this._selectDashboard(dashboard.id)
            }, [
                DOM.create('div', {}, [
                    DOM.create('div', { className: 'move-item-select__option-title' }, [
                        dashboard.title + (isCurrent ? ' (current)' : '')
                    ]),
                    DOM.create('div', { className: 'move-item-select__option-meta' }, [
                        `${listCount} list${listCount !== 1 ? 's' : ''}`
                    ])
                ])
            ]);

            container.appendChild(option);
        });

        // Select current dashboard by default
        this._selectDashboard(this.currentDashboardId);
    }

    /**
     * Select a dashboard and populate lists
     * @param {string} dashboardId
     */
    _selectDashboard(dashboardId) {
        this.selectedDashboardId = dashboardId;
        this.selectedListId = null;

        // Update dashboard visual selection
        const dashboardOptions = document.querySelectorAll('#move-item-dashboard-select .move-item-select__option');
        dashboardOptions.forEach(opt => {
            if (opt.dataset.dashboardId === dashboardId) {
                opt.classList.add('move-item-select__option--selected');
            } else {
                opt.classList.remove('move-item-select__option--selected');
            }
        });

        // Populate list options for this dashboard
        this._renderListOptions(dashboardId);
    }

    /**
     * Render list options for the selected dashboard
     * @param {string} dashboardId
     */
    _renderListOptions(dashboardId) {
        const container = document.getElementById('move-item-list-select');
        if (!container) return;

        container.innerHTML = '';

        // Find which list currently contains this item
        const currentListId = this.store.findListContainingItem(this.itemId);

        const lists = this.store.getListsForDashboard(dashboardId);

        if (lists.length === 0) {
            container.appendChild(
                DOM.create('div', { className: 'move-item-select__empty' }, [
                    'No lists in this dashboard.'
                ])
            );
            return;
        }

        lists.forEach(list => {
            const itemCount = this.store.getItemsForList(list.id, true).length;
            const isCurrent = list.id === currentListId;

            const option = DOM.create('div', {
                className: 'move-item-select__option' + (isCurrent ? ' move-item-select__option--current' : ''),
                dataset: { listId: list.id },
                onClick: () => this._selectList(list.id)
            }, [
                DOM.create('div', {}, [
                    DOM.create('div', { className: 'move-item-select__option-title' }, [
                        list.title + (isCurrent ? ' (current)' : '')
                    ]),
                    DOM.create('div', { className: 'move-item-select__option-meta' }, [
                        `${itemCount} item${itemCount !== 1 ? 's' : ''}`
                    ])
                ])
            ]);

            container.appendChild(option);
        });

        // Select first list by default
        if (lists.length > 0) {
            this._selectList(lists[0].id);
        }
    }

    /**
     * Select a list
     * @param {string} listId
     */
    _selectList(listId) {
        this.selectedListId = listId;

        // Update visual selection
        const listOptions = document.querySelectorAll('#move-item-list-select .move-item-select__option');
        listOptions.forEach(opt => {
            if (opt.dataset.listId === listId) {
                opt.classList.add('move-item-select__option--selected');
            } else {
                opt.classList.remove('move-item-select__option--selected');
            }
        });
    }

    /**
     * Move the item
     * @param {Modal} modal
     */
    _move(modal) {
        if (!this.selectedListId) {
            Toast.warning('Please select a destination list.');
            return;
        }

        const currentListId = this.store.findListContainingItem(this.itemId);

        if (this.selectedListId === currentListId) {
            Toast.info('Item is already in that list.');
            modal.close();
            return;
        }

        const item = this.store.getItem(this.itemId);
        const targetList = this.store.getList(this.selectedListId);
        const targetDashboard = this.store.getDashboard(this.selectedDashboardId);

        this.store.moveItem(this.itemId, currentListId, this.selectedListId);

        Toast.success(`Moved "${item.title}" to "${targetList.title}" in "${targetDashboard.title}".`);
        modal.close();
    }
}

// Make available globally
window.MoveItemModal = MoveItemModal;
