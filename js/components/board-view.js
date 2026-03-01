/**
 * Board View Component
 * Kanban board with lists and items
 */
class BoardViewComponent {
    /**
     * Create board view
     * @param {HTMLElement} container
     * @param {AppStore} store
     * @param {string} dashboardId
     */
    constructor(container, store, dashboardId) {
        this.container = container;
        this.store = store;
        this.dashboardId = dashboardId;
        this.dragManager = null;
        this._boundClickHandler = null;
        this._showSnoozedLists = {}; // Track which lists show snoozed items
        this._showSnoozedListsOnBoard = false; // Track whether snoozed lists are visible
        this._isZoomedOut = false; // Track zoom state for mobile list reordering

        this.render();
        this._unsubscribe = this.store.subscribe(() => this.render());
    }

    /**
     * Render the board
     */
    render() {
        const dashboard = this.store.getDashboard(this.dashboardId);

        if (!dashboard) {
            router.navigate('/');
            return;
        }

        const lists = this.store.getListsForDashboard(this.dashboardId, this._showSnoozedListsOnBoard);

        // Count snoozed lists for the toggle button
        const allLists = this.store.getListsForDashboard(this.dashboardId, true);
        const snoozedListCount = allLists.filter(l => this.store.isListSnoozed(l.id)).length;

        // Save scroll positions before re-render
        const existingBoard = this.container.querySelector('.board');
        const scrollLeft = existingBoard ? existingBoard.scrollLeft : 0;

        // Save vertical scroll positions of each list
        const listScrollPositions = {};
        if (existingBoard) {
            existingBoard.querySelectorAll('.list__items').forEach(listItems => {
                const listId = listItems.dataset.listId;
                if (listId && listItems.scrollTop > 0) {
                    listScrollPositions[listId] = listItems.scrollTop;
                }
            });
        }

        this.container.innerHTML = '';

        const boardClassName = this._isZoomedOut ? 'board board--zoomed-out' : 'board';
        const board = DOM.create('div', { className: boardClassName }, [
            DOM.create('div', { className: 'board__canvas', id: 'board-canvas' })
        ]);

        this.container.appendChild(board);

        // Render zoom toggle button (visible on mobile only via CSS)
        const zoomIcon = this._isZoomedOut ? '\u2296' : '\u2295';
        const zoomBtn = DOM.create('button', {
            className: this._isZoomedOut ? 'board__zoom-toggle board__zoom-toggle--active' : 'board__zoom-toggle',
            id: 'board-zoom-toggle',
            title: this._isZoomedOut ? 'Zoom in' : 'Zoom out to reorder lists'
        }, [zoomIcon]);
        this.container.appendChild(zoomBtn);

        // Render snoozed lists toggle button (only if there are snoozed lists)
        if (snoozedListCount > 0) {
            const snoozeToggleBtn = DOM.create('button', {
                className: 'board__snoozed-toggle' + (this._showSnoozedListsOnBoard ? ' board__snoozed-toggle--active' : ''),
                id: 'board-snoozed-toggle',
                title: this._showSnoozedListsOnBoard ? 'Hide snoozed lists' : `Show snoozed lists (${snoozedListCount})`
            }, [this._showSnoozedListsOnBoard ? `Hide Snoozed (${snoozedListCount})` : `Show Snoozed Lists (${snoozedListCount})`]);
            this.container.appendChild(snoozeToggleBtn);
        }

        const canvas = document.getElementById('board-canvas');

        // Render lists
        lists.forEach(list => {
            const isListSnoozed = this.store.isListSnoozed(list.id);
            const showSnoozed = !!this._showSnoozedLists[list.id];
            const items = this.store.getItemsForList(list.id, showSnoozed);
            const wrapper = DOM.create('div', {
                className: 'board__list-wrapper' + (isListSnoozed ? ' board__list-wrapper--snoozed' : ''),
                dataset: { listId: list.id }
            });
            const listEl = ListComponent.render(list, items, {
                onItemClick: (id) => this._openItemModal(id),
                onFolderClick: (id) => this._openFolderPanel(id, list.id),
                onDeleteFolder: (id) => this._deleteFolder(id),
                getFolderItemCount: (id) => this.store.getFolderItemCount(id),
                showSnoozed: showSnoozed,
                snoozedUntil: isListSnoozed ? list.snoozedUntil : null
            });
            wrapper.appendChild(listEl);
            canvas.appendChild(wrapper);
        });

        // Render new list button/form
        const newList = this._renderNewList();
        canvas.appendChild(newList);

        // Restore scroll positions after content is rendered
        setTimeout(() => {
            // Restore board horizontal scroll
            if (scrollLeft > 0) {
                board.scrollLeft = scrollLeft;
            }

            // Restore list vertical scroll positions
            Object.entries(listScrollPositions).forEach(([listId, scrollTop]) => {
                const listItems = board.querySelector(`.list__items[data-list-id="${listId}"]`);
                if (listItems) {
                    listItems.scrollTop = scrollTop;
                }
            });
        }, 0);

        // Bind events
        this._bindEvents();

        // Initialize drag manager
        if (this.dragManager) {
            this.dragManager.destroy();
        }
        this.dragManager = new DragManager(this.container, this.store, this.dashboardId);
        this.dragManager.setZoomedOut(this._isZoomedOut);
    }

    /**
     * Render new list button/form
     * @returns {HTMLElement}
     */
    _renderNewList() {
        const wrapper = DOM.create('div', { className: 'board__new-list' }, [
            DOM.create('button', {
                className: 'new-list-btn',
                id: 'new-list-btn'
            }, ['+ Add list']),
            DOM.create('div', {
                className: 'new-list-form hidden',
                id: 'new-list-form'
            }, [
                DOM.create('input', {
                    className: 'form-input',
                    type: 'text',
                    placeholder: 'List name',
                    id: 'new-list-input'
                }),
                DOM.create('div', { className: 'new-list-form__actions' }, [
                    DOM.create('button', {
                        className: 'btn btn--primary btn--sm',
                        id: 'new-list-save'
                    }, ['Add List']),
                    DOM.create('button', {
                        className: 'btn btn--ghost btn--sm',
                        id: 'new-list-cancel'
                    }, ['\u00D7'])
                ])
            ])
        ]);

        return wrapper;
    }

    /**
     * Bind event handlers
     */
    _bindEvents() {
        // New list
        const newListBtn = document.getElementById('new-list-btn');
        const newListForm = document.getElementById('new-list-form');
        const newListInput = document.getElementById('new-list-input');
        const newListSave = document.getElementById('new-list-save');
        const newListCancel = document.getElementById('new-list-cancel');

        const showNewListForm = () => {
            DOM.hide(newListBtn);
            DOM.show(newListForm);
            newListInput.value = '';
            newListInput.focus();
        };

        const hideNewListForm = () => {
            DOM.show(newListBtn);
            DOM.hide(newListForm);
        };

        const saveNewList = () => {
            const title = newListInput.value.trim();
            if (title) {
                this.store.addList(this.dashboardId, title);
                Toast.success(`List "${title}" created!`);
            }
            hideNewListForm();
        };

        newListBtn?.addEventListener('click', showNewListForm);
        newListSave?.addEventListener('click', saveNewList);
        newListCancel?.addEventListener('click', hideNewListForm);
        newListInput?.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') saveNewList();
            else if (e.key === 'Escape') hideNewListForm();
        });

        // Zoom toggle
        const zoomToggle = document.getElementById('board-zoom-toggle');
        zoomToggle?.addEventListener('click', () => {
            this._isZoomedOut = !this._isZoomedOut;
            this.render();
        });

        // Snoozed lists toggle
        const snoozedToggle = document.getElementById('board-snoozed-toggle');
        snoozedToggle?.addEventListener('click', () => {
            this._showSnoozedListsOnBoard = !this._showSnoozedListsOnBoard;
            this.render();
        });

        // Delegate events for list items
        // Remove old listener if exists to prevent duplicates on re-render
        if (this._boundClickHandler) {
            this.container.removeEventListener('click', this._boundClickHandler);
        }

        this._boundClickHandler = (e) => {
            const target = e.target;

            // Add item button
            if (target.matches('[data-action="add-item"]')) {
                this._showAddItemForm(target.dataset.listId);
            }

            // List menu
            if (target.matches('[data-action="list-menu"]')) {
                e.stopPropagation();
                this._showListMenu(target.dataset.listId, target);
            }

            // Editable title
            if (target.matches('[data-editable="true"]')) {
                this._editListTitle(target.dataset.listId, target);
            }
        };

        this.container.addEventListener('click', this._boundClickHandler);
    }

    /**
     * Show add item form
     * @param {string} listId
     */
    _showAddItemForm(listId) {
        const footer = this.container.querySelector(`.list[data-list-id="${listId}"] .list__footer`);
        if (!footer) return;

        const addBtn = footer.querySelector('.list__add-item');
        if (addBtn) DOM.hide(addBtn);

        const form = ListComponent.renderAddItemForm(
            listId,
            (title, addToTop) => {
                this.store.addItem(listId, title, '', addToTop);
                Toast.success('Item added!');
            },
            () => {
                const existingForm = footer.querySelector('.list__add-input');
                if (existingForm) existingForm.remove();
                if (addBtn) DOM.show(addBtn);
            },
            (title, addToTop) => {
                this.store.addFolder(listId, title, addToTop);
                Toast.success(`Folder "${title}" created!`);
            }
        );

        footer.appendChild(form);
        document.getElementById(`add-item-input-${listId}`).focus();
    }

    /**
     * Show list menu
     * @param {string} listId
     * @param {HTMLElement} anchor
     */
    _showListMenu(listId, anchor) {
        const existingMenu = document.querySelector('.dropdown-menu');
        if (existingMenu) existingMenu.remove();

        const list = this.store.getList(listId);
        const isListSnoozed = this.store.isListSnoozed(listId);
        const showSnoozed = !!this._showSnoozedLists[listId];
        const items = this.store.getItemsForList(listId, showSnoozed);

        // Count snoozed items in this list
        const allItems = this.store.getItemsForList(listId, true);
        const snoozedCount = allItems.filter(i => this.store.isItemSnoozed(i.id)).length;

        const menu = DOM.create('div', { className: 'dropdown-menu' }, [
            snoozedCount > 0 ? DOM.create('button', {
                className: 'dropdown-menu__item',
                onClick: () => {
                    menu.remove();
                    this._showSnoozedLists[listId] = !showSnoozed;
                    this.render();
                }
            }, [showSnoozed ? 'Hide Snoozed Items' : `Show Snoozed (${snoozedCount})`]) : null,
            isListSnoozed
                ? DOM.create('button', {
                    className: 'dropdown-menu__item',
                    onClick: () => {
                        menu.remove();
                        this.store.unsnoozeList(listId);
                        Toast.success('List snooze removed!');
                    }
                }, ['Remove List Snooze'])
                : DOM.create('button', {
                    className: 'dropdown-menu__item',
                    onClick: () => {
                        menu.remove();
                        this._showSnoozeListModal(listId);
                    }
                }, ['Snooze List']),
            DOM.create('button', {
                className: 'dropdown-menu__item',
                onClick: () => {
                    menu.remove();
                    this._moveList(listId);
                }
            }, ['Move to Dashboard']),
            items.length > 0 ? DOM.create('button', {
                className: 'dropdown-menu__item',
                onClick: () => {
                    menu.remove();
                    this._moveAllItems(listId);
                }
            }, ['Move All Items']) : null,
            items.length > 0 ? DOM.create('button', {
                className: 'dropdown-menu__item dropdown-menu__item--danger',
                onClick: async () => {
                    menu.remove();
                    await this._clearListItems(listId, list.title, items.length);
                }
            }, ['Clear All Items']) : null,
            DOM.create('div', { className: 'dropdown-menu__divider' }),
            DOM.create('button', {
                className: 'dropdown-menu__item dropdown-menu__item--danger',
                onClick: async () => {
                    menu.remove();
                    await this._deleteList(listId, list.title, items.length);
                }
            }, ['Delete List'])
        ].filter(Boolean));

        const rect = anchor.getBoundingClientRect();
        menu.style.position = 'fixed';
        menu.style.top = `${rect.bottom + 4}px`;
        menu.style.left = `${rect.left}px`;

        document.body.appendChild(menu);

        const closeMenu = (e) => {
            if (!menu.contains(e.target)) {
                menu.remove();
                document.removeEventListener('click', closeMenu);
            }
        };
        setTimeout(() => document.addEventListener('click', closeMenu), 0);
    }

    /**
     * Edit list title inline
     * @param {string} listId
     * @param {HTMLElement} titleEl
     */
    _editListTitle(listId, titleEl) {
        const list = this.store.getList(listId);
        if (!list) return;

        const currentTitle = list.title;
        const input = DOM.create('input', {
            className: 'list__title-input',
            type: 'text',
            value: currentTitle
        });

        titleEl.classList.add('hidden');
        titleEl.parentNode.insertBefore(input, titleEl.nextSibling);
        input.focus();
        input.select();

        const save = () => {
            const newTitle = input.value.trim();
            if (newTitle && newTitle !== currentTitle) {
                this.store.updateList(listId, { title: newTitle });
            }
            finish();
        };

        const finish = () => {
            if (input.parentNode) {
                input.parentNode.removeChild(input);
            }
            titleEl.classList.remove('hidden');
        };

        input.addEventListener('blur', save);
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') save();
            else if (e.key === 'Escape') finish();
        });
    }

    /**
     * Open move list modal
     * @param {string} listId
     */
    _moveList(listId) {
        new MoveListModal(this.store, listId, this.dashboardId);
    }

    /**
     * Open move all items modal
     * @param {string} listId
     */
    _moveAllItems(listId) {
        new MoveItemsModal(this.store, listId, this.dashboardId);
    }

    /**
     * Delete list with confirmation
     * @param {string} listId
     * @param {string} title
     * @param {number} itemCount
     */
    async _deleteList(listId, title, itemCount) {
        let message = `Delete "${title}"?`;
        if (itemCount > 0) {
            message += ` This will also delete ${itemCount} item${itemCount !== 1 ? 's' : ''}.`;
        }

        const confirmed = await ConfirmDialog.show({
            title: 'Delete List',
            message,
            confirmText: 'Delete',
            danger: true
        });

        if (confirmed) {
            this.store.deleteList(listId);
            Toast.success(`List "${title}" deleted.`);
        }
    }

    /**
     * Clear all items in a list with confirmation
     * @param {string} listId
     * @param {string} title
     * @param {number} itemCount
     */
    async _clearListItems(listId, title, itemCount) {
        const confirmed = await ConfirmDialog.show({
            title: 'Clear All Items',
            message: `Delete all ${itemCount} item${itemCount !== 1 ? 's' : ''} from "${title}"?`,
            confirmText: 'Clear All',
            danger: true
        });

        if (confirmed) {
            this.store.clearListItems(listId);
            Toast.success(`Cleared ${itemCount} item${itemCount !== 1 ? 's' : ''} from "${title}".`);
        }
    }

    /**
     * Delete a folder with confirmation
     * @param {string} folderId
     */
    async _deleteFolder(folderId) {
        const folder = this.store.getItem(folderId);
        if (!folder) return;

        const itemCount = this.store.getFolderItemCount(folderId);
        let message = `Delete folder "${folder.title}"?`;
        if (itemCount > 0) {
            message += ` This will also delete ${itemCount} sub-item${itemCount !== 1 ? 's' : ''}.`;
        }

        const confirmed = await ConfirmDialog.show({
            title: 'Delete Folder',
            message,
            confirmText: 'Delete',
            danger: true
        });

        if (confirmed) {
            this.store.deleteItem(folderId);
            Toast.success('Folder deleted.');
        }
    }

    /**
     * Show snooze list modal with datetime picker
     * @param {string} listId
     */
    _showSnoozeListModal(listId) {
        const list = this.store.getList(listId);
        if (!list) return;

        // Get min datetime (now)
        const now = new Date();
        now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
        const minDateTime = now.toISOString().slice(0, 16);

        const content = DOM.create('div', {}, [
            DOM.create('p', { className: 'mb-md' }, [
                `Snooze "${list.title}" until a specific date and time. The list will be hidden from the board until then.`
            ]),
            DOM.create('div', { className: 'form-group' }, [
                DOM.create('label', { className: 'form-label', for: 'snooze-list-datetime' }, ['Snooze until']),
                DOM.create('input', {
                    type: 'datetime-local',
                    className: 'form-input',
                    id: 'snooze-list-datetime',
                    min: minDateTime
                })
            ])
        ]);

        new Modal({
            title: 'Snooze List',
            content,
            buttons: [
                {
                    text: 'Cancel',
                    className: 'btn--secondary',
                    onClick: (m) => m.close()
                },
                {
                    text: 'Snooze',
                    className: 'btn--primary',
                    onClick: (m) => {
                        const input = document.getElementById('snooze-list-datetime');
                        if (!input || !input.value) {
                            Toast.warning('Please select a date and time.');
                            return;
                        }

                        const snoozeUntil = new Date(input.value).getTime();
                        if (snoozeUntil <= Date.now()) {
                            Toast.warning('Please select a future date and time.');
                            return;
                        }

                        this.store.snoozeList(listId, snoozeUntil);
                        m.close();
                        Toast.success(`List "${list.title}" snoozed until ${DateUtil.formatDateTime(snoozeUntil)}`);
                    }
                }
            ]
        });

        // Focus datetime input
        setTimeout(() => {
            const input = document.getElementById('snooze-list-datetime');
            if (input) input.focus();
        }, 100);
    }

    /**
     * Open folder slide-out panel
     * @param {string} folderId
     * @param {string} listId
     */
    _openFolderPanel(folderId, listId) {
        const folder = this.store.getItem(folderId);
        if (!folder || folder.type !== 'folder') return;

        new FolderPanelComponent({
            store: this.store,
            folderId,
            listId,
            callbacks: {
                onItemClick: (id) => this._openItemModal(id)
            }
        });
    }

    /**
     * Open item detail modal
     * @param {string} itemId
     */
    _openItemModal(itemId) {
        const item = this.store.getItem(itemId);
        if (!item) return;

        new ItemDetailModal(item, {
            onSave: (updates) => {
                this.store.updateItem(itemId, updates);
                Toast.success('Item updated!');
            },
            onDelete: async () => {
                const confirmed = await ConfirmDialog.delete(item.title);
                if (confirmed) {
                    this.store.deleteItem(itemId);
                    Toast.success('Item deleted.');
                    return true;
                }
                return false;
            },
            onSnooze: (until) => {
                this.store.snoozeItem(itemId, until);
            },
            onUnsnooze: () => {
                this.store.unsnoozeItem(itemId);
            },
            onMove: () => {
                new MoveItemModal(this.store, itemId, this.dashboardId);
            }
        });
    }

    /**
     * Clean up component
     */
    destroy() {
        if (this._unsubscribe) {
            this._unsubscribe();
        }
        if (this.dragManager) {
            this.dragManager.destroy();
        }
        if (this._boundClickHandler) {
            this.container.removeEventListener('click', this._boundClickHandler);
            this._boundClickHandler = null;
        }
        DOM.clear(this.container);
    }
}

// Make available globally
window.BoardViewComponent = BoardViewComponent;
