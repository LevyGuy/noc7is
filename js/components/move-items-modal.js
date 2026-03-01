/**
 * Move Items Modal Component
 * Modal for moving all items from one list to another within the same dashboard
 */
class MoveItemsModal {
    /**
     * Create and show move items modal
     * @param {AppStore} store
     * @param {string} fromListId - Source list
     * @param {string} dashboardId - Current dashboard
     */
    constructor(store, fromListId, dashboardId) {
        this.store = store;
        this.fromListId = fromListId;
        this.dashboardId = dashboardId;
        this.selectedListId = null;

        this.show();
    }

    /**
     * Show the modal
     */
    show() {
        const fromList = this.store.getList(this.fromListId);
        const lists = this.store.getListsForDashboard(this.dashboardId)
            .filter(l => l.id !== this.fromListId);

        if (lists.length === 0) {
            Toast.info('No other lists available. Create another list first.');
            return;
        }

        const itemCount = this.store.getItemsForList(this.fromListId, true).length;

        const content = DOM.create('div', {}, [
            DOM.create('p', { style: { marginBottom: 'var(--space-md)' } }, [
                `Move ${itemCount} item${itemCount !== 1 ? 's' : ''} from "${fromList.title}" to:`
            ]),
            DOM.create('div', { className: 'list-select', id: 'list-select' })
        ]);

        this.modal = new Modal({
            title: 'Move All Items',
            content,
            buttons: [
                {
                    text: 'Cancel',
                    className: 'btn--secondary',
                    onClick: (m) => m.close()
                },
                {
                    text: 'Move All',
                    className: 'btn--primary',
                    onClick: (m) => this._move(m)
                }
            ]
        });

        // Render list options
        this._renderOptions(lists);
    }

    /**
     * Render list selection options
     * @param {Object[]} lists
     */
    _renderOptions(lists) {
        const container = document.getElementById('list-select');
        if (!container) return;

        lists.forEach(list => {
            const itemCount = this.store.getItemsForList(list.id, true).length;

            const option = DOM.create('div', {
                className: 'list-select__option',
                dataset: { listId: list.id },
                onClick: () => this._selectList(list.id)
            }, [
                DOM.create('div', {}, [
                    DOM.create('div', { className: 'list-select__option-title' }, [list.title]),
                    DOM.create('div', { className: 'list-select__option-meta' }, [
                        `${itemCount} item${itemCount !== 1 ? 's' : ''}`
                    ])
                ])
            ]);

            container.appendChild(option);
        });

        // Select first by default
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
        const options = document.querySelectorAll('.list-select__option');
        options.forEach(opt => {
            if (opt.dataset.listId === listId) {
                opt.classList.add('list-select__option--selected');
            } else {
                opt.classList.remove('list-select__option--selected');
            }
        });
    }

    /**
     * Move all items
     * @param {Modal} modal
     */
    _move(modal) {
        if (!this.selectedListId) {
            Toast.warning('Please select a destination list.');
            return;
        }

        const fromList = this.store.getList(this.fromListId);
        const toList = this.store.getList(this.selectedListId);

        const movedCount = this.store.moveAllItems(this.fromListId, this.selectedListId);

        if (movedCount > 0) {
            Toast.success(`Moved ${movedCount} item${movedCount !== 1 ? 's' : ''} to "${toList.title}".`);
        } else {
            Toast.info('No items to move.');
        }

        modal.close();
    }
}

// Make available globally
window.MoveItemsModal = MoveItemsModal;
