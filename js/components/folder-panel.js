/**
 * Folder Panel Component
 * Slide-out panel for viewing and managing folder sub-items
 */
class FolderPanelComponent {
    /**
     * Create and show folder panel
     * @param {Object} options
     * @param {AppStore} options.store
     * @param {string} options.folderId
     * @param {string} options.listId - The list containing this folder
     * @param {Object} options.callbacks
     * @param {Function} options.callbacks.onItemClick - Called when a sub-item is clicked
     * @param {Function} [options.callbacks.onClose] - Called when panel is closed
     */
    constructor(options) {
        this.store = options.store;
        this.folderId = options.folderId;
        this.listId = options.listId;
        this.callbacks = options.callbacks || {};
        this._showSnoozed = false;

        this.backdrop = null;
        this.panel = null;
        this.dragManager = null;
        this._boundKeyHandler = this._handleKeyDown.bind(this);
        this._unsubscribe = null;

        this.render();
        this._unsubscribe = this.store.subscribe(() => this._refresh());
    }

    /**
     * Render the panel
     */
    render() {
        const folder = this.store.getItem(this.folderId);
        if (!folder || folder.type !== 'folder') return;

        const items = this.store.getItemsForFolder(this.folderId, this._showSnoozed);

        // Backdrop
        this.backdrop = DOM.create('div', {
            className: 'folder-panel-backdrop',
            onClick: (e) => {
                if (e.target === this.backdrop) this.close();
            }
        });

        // Panel
        this.panel = DOM.create('div', { className: 'folder-panel' }, [
            // Header
            this._renderHeader(folder),
            // Items
            this._renderItems(items),
            // Footer
            this._renderFooter()
        ]);

        this.backdrop.appendChild(this.panel);
        document.body.appendChild(this.backdrop);

        // Animate in
        requestAnimationFrame(() => {
            this.backdrop.classList.add('folder-panel-backdrop--visible');
            this.panel.classList.add('folder-panel--visible');
        });

        // Keyboard listener
        document.addEventListener('keydown', this._boundKeyHandler);

        // Initialize drag for the panel items
        this._initDrag();
    }

    /**
     * Render panel header
     * @param {Object} folder
     * @returns {HTMLElement}
     */
    _renderHeader(folder) {
        return DOM.create('div', { className: 'folder-panel__header' }, [
            DOM.create('div', { className: 'folder-panel__header-left' }, [
                DOM.create('button', {
                    className: 'folder-panel__close',
                    onClick: () => this.close()
                }, ['\u2190']),
                DOM.create('span', { className: 'folder-panel__icon' }, ['\uD83D\uDCC1']),
                DOM.create('h3', {
                    className: 'folder-panel__title',
                    dataset: { editable: 'true' },
                    onClick: () => this._editTitle()
                }, [folder.title])
            ]),
            DOM.create('button', {
                className: 'folder-panel__menu-btn',
                onClick: (e) => this._showMenu(e.target)
            }, ['\u22EE'])
        ]);
    }

    /**
     * Render items area
     * @param {Object[]} items
     * @returns {HTMLElement}
     */
    _renderItems(items) {
        const container = DOM.create('div', {
            className: 'folder-panel__items',
            dataset: { folderId: this.folderId }
        });

        if (items.length === 0) {
            container.appendChild(DOM.create('div', { className: 'folder-panel__empty' }, [
                'No items yet. Add an item below.'
            ]));
        } else {
            items.forEach(item => {
                const el = ItemComponent.render(item, {
                    onClick: (id) => {
                        if (this.callbacks.onItemClick) {
                            this.callbacks.onItemClick(id);
                        }
                    }
                });
                container.appendChild(el);
            });
        }

        return container;
    }

    /**
     * Render footer with add item form
     * @returns {HTMLElement}
     */
    _renderFooter() {
        const footer = DOM.create('div', { className: 'folder-panel__footer' }, [
            DOM.create('button', {
                className: 'list__add-item',
                onClick: () => this._showAddItemForm()
            }, ['+ Add item'])
        ]);

        return footer;
    }

    /**
     * Show the add item form in the footer
     */
    _showAddItemForm() {
        const footer = this.panel.querySelector('.folder-panel__footer');
        if (!footer) return;

        const addBtn = footer.querySelector('.list__add-item');
        if (addBtn) DOM.hide(addBtn);

        const inputId = `add-folder-item-input-${this.folderId}`;

        const form = DOM.create('div', { className: 'list__add-input' }, [
            DOM.create('input', {
                className: 'form-input',
                type: 'text',
                placeholder: 'Enter item title',
                id: inputId
            }),
            DOM.create('div', { className: 'flex gap-xs flex-wrap' }, [
                DOM.create('button', {
                    className: 'btn btn--primary btn--sm',
                    onClick: () => {
                        const input = document.getElementById(inputId);
                        const title = input.value.trim();
                        if (title) {
                            this.store.addItemToFolder(this.folderId, title);
                            input.value = '';
                            input.focus();
                            Toast.success('Item added!');
                        }
                    }
                }, ['Add']),
                DOM.create('button', {
                    className: 'btn btn--secondary btn--sm',
                    onClick: () => {
                        const input = document.getElementById(inputId);
                        const title = input.value.trim();
                        if (title) {
                            this.store.addItemToFolder(this.folderId, title, '', true);
                            input.value = '';
                            input.focus();
                            Toast.success('Item added!');
                        }
                    }
                }, ['Add to Top']),
                DOM.create('button', {
                    className: 'btn btn--ghost btn--sm',
                    onClick: () => {
                        const existingForm = footer.querySelector('.list__add-input');
                        if (existingForm) existingForm.remove();
                        if (addBtn) DOM.show(addBtn);
                    }
                }, ['\u00D7'])
            ])
        ]);

        // Handle keyboard
        form.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                const input = document.getElementById(inputId);
                const title = input.value.trim();
                if (title) {
                    this.store.addItemToFolder(this.folderId, title);
                    input.value = '';
                    input.focus();
                    Toast.success('Item added!');
                }
            } else if (e.key === 'Escape') {
                const existingForm = footer.querySelector('.list__add-input');
                if (existingForm) existingForm.remove();
                if (addBtn) DOM.show(addBtn);
            }
        });

        footer.appendChild(form);
        document.getElementById(inputId).focus();
    }

    /**
     * Refresh the panel content (on state change)
     */
    _refresh() {
        const folder = this.store.getItem(this.folderId);
        if (!folder || folder.deleted) {
            this.close();
            return;
        }

        // Update title
        const titleEl = this.panel.querySelector('.folder-panel__title');
        if (titleEl) titleEl.textContent = folder.title;

        // Save scroll position
        const itemsContainer = this.panel.querySelector('.folder-panel__items');
        const scrollTop = itemsContainer ? itemsContainer.scrollTop : 0;

        // Re-render items
        const items = this.store.getItemsForFolder(this.folderId, this._showSnoozed);
        const newItemsContainer = this._renderItems(items);

        if (itemsContainer && itemsContainer.parentNode) {
            itemsContainer.parentNode.replaceChild(newItemsContainer, itemsContainer);
        }

        // Restore scroll
        setTimeout(() => {
            newItemsContainer.scrollTop = scrollTop;
        }, 0);

        // Re-init drag
        this._initDrag();
    }

    /**
     * Initialize drag and drop within the panel
     */
    _initDrag() {
        if (this.dragManager) {
            this.dragManager.destroy();
        }
        this.dragManager = new FolderDragManager(this.panel, this.store, this.folderId, this.listId);
    }

    /**
     * Edit folder title inline
     */
    _editTitle() {
        const folder = this.store.getItem(this.folderId);
        if (!folder) return;

        const titleEl = this.panel.querySelector('.folder-panel__title');
        if (!titleEl) return;

        const currentTitle = folder.title;
        const input = DOM.create('input', {
            className: 'folder-panel__title-input',
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
                this.store.updateItem(this.folderId, { title: newTitle });
            }
            finish();
        };

        const finish = () => {
            if (input.parentNode) input.parentNode.removeChild(input);
            titleEl.classList.remove('hidden');
        };

        input.addEventListener('blur', save);
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') save();
            else if (e.key === 'Escape') finish();
        });
    }

    /**
     * Show folder context menu
     * @param {HTMLElement} anchor
     */
    _showMenu(anchor) {
        const existingMenu = document.querySelector('.dropdown-menu');
        if (existingMenu) existingMenu.remove();

        const folder = this.store.getItem(this.folderId);
        const items = this.store.getItemsForFolder(this.folderId, true);
        const snoozedCount = items.filter(i => this.store.isItemSnoozed(i.id)).length;

        const menu = DOM.create('div', { className: 'dropdown-menu' }, [
            snoozedCount > 0 ? DOM.create('button', {
                className: 'dropdown-menu__item',
                onClick: () => {
                    menu.remove();
                    this._showSnoozed = !this._showSnoozed;
                    this._refresh();
                }
            }, [this._showSnoozed ? 'Hide Snoozed Items' : `Show Snoozed (${snoozedCount})`]) : null,
            DOM.create('button', {
                className: 'dropdown-menu__item',
                onClick: () => {
                    menu.remove();
                    this._editFolderDetails();
                }
            }, ['Edit Folder Details']),
            DOM.create('button', {
                className: 'dropdown-menu__item',
                onClick: async () => {
                    menu.remove();
                    await this._ungroupFolder();
                }
            }, ['Ungroup Items']),
            DOM.create('div', { className: 'dropdown-menu__divider' }),
            DOM.create('button', {
                className: 'dropdown-menu__item dropdown-menu__item--danger',
                onClick: async () => {
                    menu.remove();
                    await this._deleteFolder();
                }
            }, ['Delete Folder'])
        ].filter(Boolean));

        const rect = anchor.getBoundingClientRect();
        menu.style.position = 'fixed';
        menu.style.top = `${rect.bottom + 4}px`;
        menu.style.right = '16px';
        menu.style.zIndex = '510';

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
     * Edit folder details (opens ItemDetailModal for the folder)
     */
    _editFolderDetails() {
        const folder = this.store.getItem(this.folderId);
        if (!folder) return;

        new ItemDetailModal(folder, {
            onSave: (updates) => {
                this.store.updateItem(this.folderId, updates);
                Toast.success('Folder updated!');
            },
            onDelete: async () => {
                const itemCount = this.store.getFolderItemCount(this.folderId);
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
                    this.store.deleteItem(this.folderId);
                    Toast.success('Folder deleted.');
                    this.close();
                    return true;
                }
                return false;
            },
            onSnooze: (until) => {
                this.store.snoozeItem(this.folderId, until);
            },
            onUnsnooze: () => {
                this.store.unsnoozeItem(this.folderId);
            }
        });
    }

    /**
     * Ungroup folder - dissolve into parent list
     */
    async _ungroupFolder() {
        const folder = this.store.getItem(this.folderId);
        const itemCount = this.store.getFolderItemCount(this.folderId);

        const confirmed = await ConfirmDialog.show({
            title: 'Ungroup Folder',
            message: `Move ${itemCount} item${itemCount !== 1 ? 's' : ''} from "${folder.title}" back to the list and remove the folder?`,
            confirmText: 'Ungroup',
            danger: false
        });

        if (confirmed) {
            this.store.ungroupFolder(this.folderId, this.listId);
            Toast.success('Folder ungrouped.');
            this.close();
        }
    }

    /**
     * Delete folder with confirmation
     */
    async _deleteFolder() {
        const folder = this.store.getItem(this.folderId);
        const itemCount = this.store.getFolderItemCount(this.folderId);

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
            this.store.deleteItem(this.folderId);
            Toast.success('Folder deleted.');
            this.close();
        }
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
     * Close and destroy the panel
     */
    close() {
        document.removeEventListener('keydown', this._boundKeyHandler);

        if (this._unsubscribe) {
            this._unsubscribe();
            this._unsubscribe = null;
        }

        if (this.dragManager) {
            this.dragManager.destroy();
            this.dragManager = null;
        }

        // Animate out
        if (this.panel) this.panel.classList.remove('folder-panel--visible');
        if (this.backdrop) this.backdrop.classList.remove('folder-panel-backdrop--visible');

        setTimeout(() => {
            if (this.backdrop && this.backdrop.parentNode) {
                this.backdrop.parentNode.removeChild(this.backdrop);
            }
            if (this.callbacks.onClose) {
                this.callbacks.onClose();
            }
        }, 200);
    }
}

/**
 * Drag Manager for folder panel sub-items
 * Supports reordering within folder AND dragging items out to board lists
 */
class FolderDragManager {
    constructor(panel, store, folderId, listId) {
        this.panel = panel;
        this.store = store;
        this.folderId = folderId;
        this.listId = listId;

        this.draggedElement = null;
        this.draggedId = null;
        this.ghost = null;
        this.isTouchDragging = false;
        this.touchStartPos = null;
        this.longPressTimer = null;
        this._lastProcessedDropId = null;
        this._boundHandlers = {};
        this._boardDropHandlers = [];

        this._bindDesktopEvents();
        this._bindTouchEvents();
    }

    /**
     * Find the board list drop zone under a point, ignoring the folder panel overlay
     */
    _findBoardListAt(x, y) {
        const backdrop = this.panel.closest('.folder-panel-backdrop');
        if (!backdrop) return null;

        // Temporarily hide overlay to find board elements underneath
        const origPanelPointer = this.panel.style.pointerEvents;
        const origBackdropPointer = backdrop.style.pointerEvents;
        this.panel.style.pointerEvents = 'none';
        backdrop.style.pointerEvents = 'none';
        if (this.ghost) this.ghost.style.pointerEvents = 'none';

        const el = document.elementFromPoint(x, y);

        this.panel.style.pointerEvents = origPanelPointer;
        backdrop.style.pointerEvents = origBackdropPointer;
        if (this.ghost) this.ghost.style.pointerEvents = '';

        if (!el) return null;
        return el.closest('.list__items');
    }

    /**
     * Calculate drop index within a board list
     */
    _calcDropIndex(dropZone, y) {
        const items = Array.from(dropZone.querySelectorAll('.item'));
        let newIndex = items.length;
        for (let i = 0; i < items.length; i++) {
            const rect = items[i].getBoundingClientRect();
            if (y < rect.top + rect.height / 2) {
                newIndex = i;
                break;
            }
        }
        return newIndex;
    }

    /**
     * Highlight board lists during drag (show where the item would land)
     */
    _highlightBoardDrop(x, y) {
        // Clear previous board highlights
        document.querySelectorAll('.list__items--drag-over').forEach(el => {
            el.classList.remove('list__items--drag-over');
        });

        const dropZone = this._findBoardListAt(x, y);
        if (dropZone) {
            dropZone.classList.add('list__items--drag-over');
        }
    }

    /**
     * Clear all board drop highlights
     */
    _clearBoardHighlights() {
        document.querySelectorAll('.list__items--drag-over').forEach(el => {
            el.classList.remove('list__items--drag-over');
        });
    }

    /**
     * Handle dropping an item onto a board list (removing from folder)
     */
    _dropOnBoard(x, y) {
        const dropZone = this._findBoardListAt(x, y);
        if (!dropZone) return false;

        const targetListId = dropZone.dataset.listId;
        if (!targetListId || !this.draggedId) return false;

        const newIndex = this._calcDropIndex(dropZone, y);
        this.store.removeItemFromFolder(this.draggedId, this.folderId, targetListId, newIndex);
        return true;
    }

    _bindDesktopEvents() {
        const container = this.panel.querySelector('.folder-panel__items');
        if (!container) return;

        this._boundHandlers.dragstart = (e) => {
            const item = e.target.closest('.item');
            if (!item) return;
            this.draggedElement = item;
            this.draggedId = item.dataset.itemId;
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/plain', this.draggedId);
            requestAnimationFrame(() => item.classList.add('item--dragging'));

            // Make backdrop transparent to pointer events so board lists receive drag events
            const backdrop = this.panel.closest('.folder-panel-backdrop');
            if (backdrop) backdrop.style.pointerEvents = 'none';
            this.panel.style.pointerEvents = 'auto';

            // Allow dropping on board lists by adding temporary handlers
            this._bindBoardDropZones();
        };

        this._boundHandlers.dragover = (e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
            if (!this.draggedId) return;

            const items = Array.from(container.querySelectorAll('.item:not(.item--dragging)'));
            container.querySelectorAll('.item--drag-over').forEach(el => el.classList.remove('item--drag-over'));

            for (const item of items) {
                const rect = item.getBoundingClientRect();
                if (e.clientY < rect.top + rect.height / 2) {
                    item.classList.add('item--drag-over');
                    break;
                }
            }
        };

        this._boundHandlers.drop = (e) => {
            e.preventDefault();
            if (!this.draggedId) return;
            if (this._lastProcessedDropId === this.draggedId) return;
            this._lastProcessedDropId = this.draggedId;

            const items = Array.from(container.querySelectorAll('.item:not(.item--dragging)'));
            let newIndex = items.length;

            for (let i = 0; i < items.length; i++) {
                const rect = items[i].getBoundingClientRect();
                if (e.clientY < rect.top + rect.height / 2) {
                    newIndex = i;
                    break;
                }
            }

            const folder = this.store.getItem(this.folderId);
            if (folder && folder.subItemIds) {
                const oldIndex = folder.subItemIds.indexOf(this.draggedId);
                if (oldIndex < newIndex) newIndex--;
                if (oldIndex !== newIndex && oldIndex >= 0) {
                    this.store.reorderFolderItem(this.folderId, oldIndex, newIndex);
                }
            }

            this._endDrag();
        };

        this._boundHandlers.dragend = () => this._endDrag();

        container.addEventListener('dragstart', this._boundHandlers.dragstart);
        container.addEventListener('dragover', this._boundHandlers.dragover);
        container.addEventListener('drop', this._boundHandlers.drop);
        container.addEventListener('dragend', this._boundHandlers.dragend);
    }

    /**
     * Bind temporary drop handlers on board lists for desktop drag
     */
    _bindBoardDropZones() {
        this._unbindBoardDropZones();

        const boardLists = document.querySelectorAll('.board .list__items');
        boardLists.forEach(listEl => {
            const handlers = {
                dragover: (e) => {
                    e.preventDefault();
                    e.dataTransfer.dropEffect = 'move';
                    listEl.classList.add('list__items--drag-over');
                },
                dragleave: (e) => {
                    if (!listEl.contains(e.relatedTarget)) {
                        listEl.classList.remove('list__items--drag-over');
                    }
                },
                drop: (e) => {
                    e.preventDefault();
                    if (!this.draggedId) return;
                    if (this._lastProcessedDropId === this.draggedId) return;
                    this._lastProcessedDropId = this.draggedId;

                    const targetListId = listEl.dataset.listId;
                    if (!targetListId) return;

                    const newIndex = this._calcDropIndex(listEl, e.clientY);
                    this.store.removeItemFromFolder(this.draggedId, this.folderId, targetListId, newIndex);
                    this._endDrag();
                }
            };

            listEl.addEventListener('dragover', handlers.dragover);
            listEl.addEventListener('dragleave', handlers.dragleave);
            listEl.addEventListener('drop', handlers.drop);

            this._boardDropHandlers.push({ el: listEl, handlers });
        });
    }

    /**
     * Remove temporary board drop handlers
     */
    _unbindBoardDropZones() {
        this._boardDropHandlers.forEach(({ el, handlers }) => {
            el.removeEventListener('dragover', handlers.dragover);
            el.removeEventListener('dragleave', handlers.dragleave);
            el.removeEventListener('drop', handlers.drop);
        });
        this._boardDropHandlers = [];
    }

    _bindTouchEvents() {
        const container = this.panel.querySelector('.folder-panel__items');
        if (!container) return;

        this._boundHandlers.touchstart = (e) => {
            const item = e.target.closest('.item');
            if (!item) return;

            this.touchStartPos = { x: e.touches[0].clientX, y: e.touches[0].clientY };
            this.longPressTimer = setTimeout(() => {
                this.isTouchDragging = true;
                this.draggedElement = item;
                this.draggedId = item.dataset.itemId;
                item.classList.add('item--dragging');

                this.ghost = item.cloneNode(true);
                this.ghost.classList.add('drag-ghost');
                this.ghost.classList.remove('item--dragging');
                this.ghost.style.width = `${item.offsetWidth}px`;
                document.body.appendChild(this.ghost);

                if (this.touchStartPos) {
                    this.ghost.style.left = `${this.touchStartPos.x - this.ghost.offsetWidth / 2}px`;
                    this.ghost.style.top = `${this.touchStartPos.y - 20}px`;
                }

                if (navigator.vibrate) navigator.vibrate(50);
            }, 300);
        };

        this._boundHandlers.touchmove = (e) => {
            if (this.longPressTimer && this.touchStartPos) {
                const dx = e.touches[0].clientX - this.touchStartPos.x;
                const dy = e.touches[0].clientY - this.touchStartPos.y;
                if (Math.abs(dx) > 10 || Math.abs(dy) > 10) {
                    clearTimeout(this.longPressTimer);
                    this.longPressTimer = null;
                }
            }
            if (!this.isTouchDragging) return;
            e.preventDefault();

            const touch = e.touches[0];
            if (this.ghost) {
                this.ghost.style.left = `${touch.clientX - this.ghost.offsetWidth / 2}px`;
                this.ghost.style.top = `${touch.clientY - 20}px`;
            }

            // Check if dragging outside the panel to highlight board lists
            const panelRect = this.panel.getBoundingClientRect();
            if (touch.clientX < panelRect.left) {
                this._highlightBoardDrop(touch.clientX, touch.clientY);
            } else {
                this._clearBoardHighlights();
            }
        };

        this._boundHandlers.touchend = (e) => {
            clearTimeout(this.longPressTimer);
            this.longPressTimer = null;
            if (!this.isTouchDragging) return;

            const touch = e.changedTouches[0];

            // Check if dropped outside the panel (onto a board list)
            const panelRect = this.panel.getBoundingClientRect();
            if (touch.clientX < panelRect.left && this.draggedId) {
                if (this._lastProcessedDropId !== this.draggedId) {
                    this._lastProcessedDropId = this.draggedId;
                    this._dropOnBoard(touch.clientX, touch.clientY);
                }
                this._clearBoardHighlights();
                this._endTouchDrag();
                return;
            }

            // Otherwise handle as reorder within folder
            if (this.ghost) this.ghost.style.pointerEvents = 'none';
            const elementUnder = document.elementFromPoint(touch.clientX, touch.clientY);
            if (this.ghost) this.ghost.style.pointerEvents = '';

            if (elementUnder && this.draggedId) {
                const dropZone = elementUnder.closest('.folder-panel__items');
                if (dropZone) {
                    if (this._lastProcessedDropId === this.draggedId) { this._endTouchDrag(); return; }
                    this._lastProcessedDropId = this.draggedId;

                    const items = Array.from(dropZone.querySelectorAll('.item:not(.item--dragging)'));
                    let newIndex = items.length;

                    for (let i = 0; i < items.length; i++) {
                        const rect = items[i].getBoundingClientRect();
                        if (touch.clientY < rect.top + rect.height / 2) {
                            newIndex = i;
                            break;
                        }
                    }

                    const folder = this.store.getItem(this.folderId);
                    if (folder && folder.subItemIds) {
                        const oldIndex = folder.subItemIds.indexOf(this.draggedId);
                        if (oldIndex < newIndex) newIndex--;
                        if (oldIndex !== newIndex && oldIndex >= 0) {
                            this.store.reorderFolderItem(this.folderId, oldIndex, newIndex);
                        }
                    }
                }
            }

            this._endTouchDrag();
        };

        this._boundHandlers.touchcancel = () => {
            clearTimeout(this.longPressTimer);
            this._clearBoardHighlights();
            this._endTouchDrag();
        };

        container.addEventListener('touchstart', this._boundHandlers.touchstart, { passive: true });
        container.addEventListener('touchmove', this._boundHandlers.touchmove, { passive: false });
        container.addEventListener('touchend', this._boundHandlers.touchend);
        container.addEventListener('touchcancel', this._boundHandlers.touchcancel);
    }

    _endDrag() {
        if (this.draggedElement) this.draggedElement.classList.remove('item--dragging');
        const container = this.panel.querySelector('.folder-panel__items');
        if (container) {
            container.querySelectorAll('.item--drag-over').forEach(el => el.classList.remove('item--drag-over'));
        }
        // Restore backdrop pointer events
        const backdrop = this.panel.closest('.folder-panel-backdrop');
        if (backdrop) backdrop.style.pointerEvents = '';
        this.panel.style.pointerEvents = '';

        this._clearBoardHighlights();
        this._unbindBoardDropZones();
        this.draggedElement = null;
        this.draggedId = null;
        this._lastProcessedDropId = null;
    }

    _endTouchDrag() {
        this.isTouchDragging = false;
        if (this.draggedElement) this.draggedElement.classList.remove('item--dragging');
        if (this.ghost && this.ghost.parentNode) this.ghost.parentNode.removeChild(this.ghost);
        this.ghost = null;
        this.draggedElement = null;
        this.draggedId = null;
        this.touchStartPos = null;
        this._lastProcessedDropId = null;
        this._clearBoardHighlights();
    }

    destroy() {
        this._endDrag();
        this._endTouchDrag();
        this._unbindBoardDropZones();
        const container = this.panel.querySelector('.folder-panel__items');
        if (!container) return;

        Object.entries(this._boundHandlers).forEach(([event, handler]) => {
            container.removeEventListener(event, handler);
        });
        this._boundHandlers = {};
    }
}

// Make available globally
window.FolderPanelComponent = FolderPanelComponent;
window.FolderDragManager = FolderDragManager;
