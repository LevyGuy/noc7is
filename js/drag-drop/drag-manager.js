/**
 * Drag Manager
 * Handles drag and drop for both desktop (HTML5 DnD) and mobile (touch events)
 */
class DragManager {
    /**
     * Create drag manager
     * @param {HTMLElement} container - Board container
     * @param {AppStore} store
     * @param {string} dashboardId
     */
    constructor(container, store, dashboardId) {
        this.container = container;
        this.store = store;
        this.dashboardId = dashboardId;

        this.draggedElement = null;
        this.dragType = null; // 'item' | 'list'
        this.draggedId = null;
        this.sourceListId = null;
        this.ghost = null;

        // Touch drag state
        this.touchStartPos = null;
        this.longPressTimer = null;
        this.isTouchDragging = false;

        // Guard against processing the same drop multiple times
        this._lastProcessedDropId = null;

        // Zoom state
        this._isZoomedOut = false;

        // Store bound handlers for cleanup
        this._boundHandlers = {};

        this._bindDesktopEvents();
        this._bindTouchEvents();
    }

    /**
     * Set zoomed-out state
     * @param {boolean} isZoomedOut
     */
    setZoomedOut(isZoomedOut) {
        this._isZoomedOut = isZoomedOut;
    }

    // =========================================================================
    // DESKTOP DRAG AND DROP (HTML5 API)
    // =========================================================================

    /**
     * Bind desktop drag events
     */
    _bindDesktopEvents() {
        // Item drag start
        this._boundHandlers.dragstart = (e) => {
            const item = e.target.closest('.item');
            const listHeader = e.target.closest('.list__header');

            if (item) {
                this._startDrag(e, 'item', item, item.dataset.itemId);
            } else if (listHeader) {
                this._startDrag(e, 'list', listHeader.closest('.list'), listHeader.dataset.listId);
            }
        };
        this.container.addEventListener('dragstart', this._boundHandlers.dragstart);

        // Drag end
        this._boundHandlers.dragend = (e) => {
            this._endDrag();
        };
        this.container.addEventListener('dragend', this._boundHandlers.dragend);

        // Drag over (for drop zones)
        this._boundHandlers.dragover = (e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';

            if (this.dragType === 'item') {
                this._handleItemDragOver(e);
            } else if (this.dragType === 'list') {
                this._handleListDragOver(e);
            }
        };
        this.container.addEventListener('dragover', this._boundHandlers.dragover);

        // Drag leave
        this._boundHandlers.dragleave = (e) => {
            const dropZone = e.target.closest('.list__items');
            if (dropZone && !dropZone.contains(e.relatedTarget)) {
                dropZone.classList.remove('list__items--drag-over');
            }
        };
        this.container.addEventListener('dragleave', this._boundHandlers.dragleave);

        // Drop
        this._boundHandlers.drop = (e) => {
            e.preventDefault();

            if (this.dragType === 'item') {
                this._handleItemDrop(e);
            } else if (this.dragType === 'list') {
                this._handleListDrop(e);
            }

            this._endDrag();
        };
        this.container.addEventListener('drop', this._boundHandlers.drop);
    }

    /**
     * Start a drag operation
     */
    _startDrag(e, type, element, id) {
        this.dragType = type;
        this.draggedElement = element;
        this.draggedId = id;

        if (type === 'item') {
            this.sourceListId = this.store.findListContainingItem(id);
        }

        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', id);

        // Add dragging class after a frame to allow the drag image to be captured
        requestAnimationFrame(() => {
            element.classList.add('item--dragging');
        });

        eventBus.emit(Events.DRAG_START, { type, id });
    }

    /**
     * Check if the dragged item is a folder
     * @returns {boolean}
     */
    _isDraggedItemFolder() {
        if (!this.draggedId) return false;
        const item = this.store.getItem(this.draggedId);
        return item && item.type === 'folder';
    }

    /**
     * End drag operation
     */
    _endDrag() {
        if (this.draggedElement) {
            this.draggedElement.classList.remove('item--dragging');
        }

        // Clear all drag-over states
        this.container.querySelectorAll('.list__items--drag-over').forEach(el => {
            el.classList.remove('list__items--drag-over');
        });
        this.container.querySelectorAll('.item--drag-over').forEach(el => {
            el.classList.remove('item--drag-over');
        });
        // Clear folder drop-target highlights
        this.container.querySelectorAll('.item--folder-drop-target').forEach(el => {
            el.classList.remove('item--folder-drop-target');
        });

        this.draggedElement = null;
        this.dragType = null;
        this.draggedId = null;
        this.sourceListId = null;
        this._lastProcessedDropId = null;

        eventBus.emit(Events.DRAG_END);
    }

    /**
     * Handle item drag over
     */
    _handleItemDragOver(e) {
        const dropZone = e.target.closest('.list__items');
        if (!dropZone) return;

        // Clear previous folder drop-target highlights
        this.container.querySelectorAll('.item--folder-drop-target').forEach(el => {
            el.classList.remove('item--folder-drop-target');
        });

        // Check if hovering over a folder item (only for non-folder drags)
        if (!this._isDraggedItemFolder()) {
            const folderItem = e.target.closest('.item--folder');
            if (folderItem && folderItem.dataset.itemId !== this.draggedId) {
                // Highlight the folder as a drop target
                folderItem.classList.add('item--folder-drop-target');
                // Don't show regular drop indicators when targeting a folder
                this.container.querySelectorAll('.item--drag-over').forEach(el => {
                    el.classList.remove('item--drag-over');
                });
                return;
            }
        }

        // Highlight drop zone
        this.container.querySelectorAll('.list__items--drag-over').forEach(el => {
            if (el !== dropZone) el.classList.remove('list__items--drag-over');
        });
        dropZone.classList.add('list__items--drag-over');

        // Find insertion point
        const items = Array.from(dropZone.querySelectorAll('.item:not(.item--dragging)'));
        this.container.querySelectorAll('.item--drag-over').forEach(el => {
            el.classList.remove('item--drag-over');
        });

        for (const item of items) {
            const rect = item.getBoundingClientRect();
            if (e.clientY < rect.top + rect.height / 2) {
                item.classList.add('item--drag-over');
                break;
            }
        }
    }

    /**
     * Handle item drop
     */
    _handleItemDrop(e) {
        const dropZone = e.target.closest('.list__items');
        if (!dropZone || !this.draggedId) return;

        // Guard against processing the same drop twice (touch + desktop events)
        const dropId = `${this.draggedId}-${Date.now()}`;
        if (this._lastProcessedDropId === this.draggedId) return;
        this._lastProcessedDropId = this.draggedId;

        // Check if dropped onto a folder item
        if (!this._isDraggedItemFolder()) {
            const folderTarget = e.target.closest('.item--folder');
            if (folderTarget && folderTarget.dataset.itemId !== this.draggedId) {
                this.store.moveItemToFolder(this.draggedId, folderTarget.dataset.itemId);
                return;
            }
        }

        const toListId = dropZone.dataset.listId;
        const fromListId = this.sourceListId;

        if (!toListId || !fromListId) return;

        // Calculate new index
        const items = Array.from(dropZone.querySelectorAll('.item:not(.item--dragging)'));
        let newIndex = items.length;

        for (let i = 0; i < items.length; i++) {
            const rect = items[i].getBoundingClientRect();
            if (e.clientY < rect.top + rect.height / 2) {
                newIndex = i;
                break;
            }
        }

        // Adjust index if moving within same list and moving down
        if (fromListId === toListId) {
            const list = this.store.getList(fromListId);
            const oldIndex = list.itemIds.indexOf(this.draggedId);
            if (oldIndex < newIndex) {
                newIndex--;
            }
            if (oldIndex !== newIndex) {
                this.store.reorderItem(fromListId, oldIndex, newIndex);
            }
        } else {
            this.store.moveItem(this.draggedId, fromListId, toListId, newIndex);
        }
    }

    /**
     * Handle list drag over
     */
    _handleListDragOver(e) {
        // Highlight potential drop position
        const canvas = this.container.querySelector('.board__canvas');
        if (!canvas) return;

        const wrappers = Array.from(canvas.querySelectorAll('.board__list-wrapper'));
        wrappers.forEach(w => w.style.opacity = '1');

        for (const wrapper of wrappers) {
            if (wrapper.dataset.listId === this.draggedId) continue;
            const rect = wrapper.getBoundingClientRect();
            if (e.clientX < rect.left + rect.width / 2) {
                wrapper.style.opacity = '0.5';
                break;
            }
        }
    }

    /**
     * Handle list drop
     */
    _handleListDrop(e) {
        if (!this.draggedId) return;

        const canvas = this.container.querySelector('.board__canvas');
        const wrappers = Array.from(canvas.querySelectorAll('.board__list-wrapper'));

        const dashboard = this.store.getDashboard(this.dashboardId);
        const oldIndex = dashboard.listIds.indexOf(this.draggedId);

        let newIndex = wrappers.length - 1;
        for (let i = 0; i < wrappers.length; i++) {
            if (wrappers[i].dataset.listId === this.draggedId) continue;
            const rect = wrappers[i].getBoundingClientRect();
            if (e.clientX < rect.left + rect.width / 2) {
                newIndex = i;
                break;
            }
        }

        // Adjust for removal
        if (oldIndex < newIndex) newIndex--;

        if (oldIndex !== newIndex && oldIndex >= 0) {
            this.store.reorderList(this.dashboardId, oldIndex, newIndex);
        }

        // Reset opacity
        wrappers.forEach(w => w.style.opacity = '1');
    }

    // =========================================================================
    // MOBILE TOUCH DRAG AND DROP
    // =========================================================================

    /**
     * Bind touch events for mobile
     */
    _bindTouchEvents() {
        this._boundHandlers.touchstart = (e) => this._handleTouchStart(e);
        this._boundHandlers.touchmove = (e) => this._handleTouchMove(e);
        this._boundHandlers.touchend = (e) => this._handleTouchEnd(e);
        this._boundHandlers.touchcancel = (e) => this._handleTouchEnd(e);

        this.container.addEventListener('touchstart', this._boundHandlers.touchstart, { passive: true });
        this.container.addEventListener('touchmove', this._boundHandlers.touchmove, { passive: false });
        this.container.addEventListener('touchend', this._boundHandlers.touchend);
        this.container.addEventListener('touchcancel', this._boundHandlers.touchcancel);
    }

    /**
     * Handle touch start
     */
    _handleTouchStart(e) {
        const target = e.target;
        const item = target.closest('.item');
        const listHeader = target.closest('.list__header');

        if (!item && !listHeader) return;

        this.touchStartPos = {
            x: e.touches[0].clientX,
            y: e.touches[0].clientY
        };

        // Long press to initiate drag (shorter delay in zoomed-out mode)
        const longPressDelay = this._isZoomedOut ? 150 : 300;
        this.longPressTimer = setTimeout(() => {
            if (item) {
                this._startTouchDrag('item', item, item.dataset.itemId);
            } else if (listHeader) {
                this._startTouchDrag('list', listHeader.closest('.list'), listHeader.dataset.listId);
            }
        }, longPressDelay);
    }

    /**
     * Handle touch move
     */
    _handleTouchMove(e) {
        // Cancel long press if moved too much before triggering
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

        // Update ghost position
        if (this.ghost) {
            this.ghost.style.left = `${touch.clientX - this.ghost.offsetWidth / 2}px`;
            this.ghost.style.top = `${touch.clientY - 20}px`;
        }

        // Highlight drop zones
        this._highlightTouchDropZone(touch.clientX, touch.clientY);
    }

    /**
     * Handle touch end
     */
    _handleTouchEnd(e) {
        clearTimeout(this.longPressTimer);
        this.longPressTimer = null;

        if (!this.isTouchDragging) return;

        const touch = e.changedTouches[0];
        this._handleTouchDrop(touch.clientX, touch.clientY);

        this._endTouchDrag();
    }

    /**
     * Start touch drag
     */
    _startTouchDrag(type, element, id) {
        this.isTouchDragging = true;
        this.dragType = type;
        this.draggedElement = element;
        this.draggedId = id;

        if (type === 'item') {
            this.sourceListId = this.store.findListContainingItem(id);
        }

        element.classList.add('item--dragging');

        // Create ghost
        this.ghost = element.cloneNode(true);
        this.ghost.classList.add('drag-ghost');
        this.ghost.classList.remove('item--dragging');
        this.ghost.style.width = `${element.offsetWidth}px`;
        if (this._isZoomedOut) {
            this.ghost.style.maxWidth = '160px';
            this.ghost.style.fontSize = '10px';
            this.ghost.style.opacity = '0.85';
        }
        document.body.appendChild(this.ghost);

        // Position ghost at touch position
        if (this.touchStartPos) {
            this.ghost.style.left = `${this.touchStartPos.x - this.ghost.offsetWidth / 2}px`;
            this.ghost.style.top = `${this.touchStartPos.y - 20}px`;
        }

        // Vibrate for feedback (if supported)
        if (navigator.vibrate) {
            navigator.vibrate(50);
        }

        eventBus.emit(Events.DRAG_START, { type, id });
    }

    /**
     * End touch drag
     */
    _endTouchDrag() {
        this.isTouchDragging = false;

        if (this.draggedElement) {
            this.draggedElement.classList.remove('item--dragging');
        }

        if (this.ghost && this.ghost.parentNode) {
            this.ghost.parentNode.removeChild(this.ghost);
        }
        this.ghost = null;

        // Clear highlights
        this.container.querySelectorAll('.list__items--drag-over').forEach(el => {
            el.classList.remove('list__items--drag-over');
        });
        this.container.querySelectorAll('.item--folder-drop-target').forEach(el => {
            el.classList.remove('item--folder-drop-target');
        });

        this.draggedElement = null;
        this.dragType = null;
        this.draggedId = null;
        this.sourceListId = null;
        this.touchStartPos = null;
        this._lastProcessedDropId = null;

        eventBus.emit(Events.DRAG_END);
    }

    /**
     * Highlight drop zone during touch drag
     */
    _highlightTouchDropZone(x, y) {
        // Clear previous highlights
        this.container.querySelectorAll('.list__items--drag-over').forEach(el => {
            el.classList.remove('list__items--drag-over');
        });
        this.container.querySelectorAll('.item--folder-drop-target').forEach(el => {
            el.classList.remove('item--folder-drop-target');
        });

        // Find element under touch point (excluding ghost)
        if (this.ghost) this.ghost.style.pointerEvents = 'none';
        const elementUnder = document.elementFromPoint(x, y);
        if (this.ghost) this.ghost.style.pointerEvents = '';

        if (!elementUnder) return;

        if (this.dragType === 'item') {
            // Check if hovering over a folder (for non-folder drags)
            if (!this._isDraggedItemFolder()) {
                const folderItem = elementUnder.closest('.item--folder');
                if (folderItem && folderItem.dataset.itemId !== this.draggedId) {
                    folderItem.classList.add('item--folder-drop-target');
                    return;
                }
            }

            const dropZone = elementUnder.closest('.list__items');
            if (dropZone) {
                dropZone.classList.add('list__items--drag-over');
            }
        }
    }

    /**
     * Handle touch drop
     */
    _handleTouchDrop(x, y) {
        // Find element under touch point
        if (this.ghost) this.ghost.style.pointerEvents = 'none';
        const elementUnder = document.elementFromPoint(x, y);
        if (this.ghost) this.ghost.style.pointerEvents = '';

        if (!elementUnder || !this.draggedId) return;

        if (this.dragType === 'item') {
            // Guard against processing the same drop twice (touch + desktop events)
            if (this._lastProcessedDropId === this.draggedId) return;
            this._lastProcessedDropId = this.draggedId;

            // Check if dropped onto a folder item
            if (!this._isDraggedItemFolder()) {
                const folderTarget = elementUnder.closest('.item--folder');
                if (folderTarget && folderTarget.dataset.itemId !== this.draggedId) {
                    this.store.moveItemToFolder(this.draggedId, folderTarget.dataset.itemId);
                    return;
                }
            }

            const dropZone = elementUnder.closest('.list__items');
            if (!dropZone) return;

            const toListId = dropZone.dataset.listId;
            const fromListId = this.sourceListId;

            if (!toListId || !fromListId) return;

            // Calculate new index
            const items = Array.from(dropZone.querySelectorAll('.item:not(.item--dragging)'));
            let newIndex = items.length;

            for (let i = 0; i < items.length; i++) {
                const rect = items[i].getBoundingClientRect();
                if (y < rect.top + rect.height / 2) {
                    newIndex = i;
                    break;
                }
            }

            if (fromListId === toListId) {
                const list = this.store.getList(fromListId);
                const oldIndex = list.itemIds.indexOf(this.draggedId);
                if (oldIndex < newIndex) newIndex--;
                if (oldIndex !== newIndex) {
                    this.store.reorderItem(fromListId, oldIndex, newIndex);
                }
            } else {
                this.store.moveItem(this.draggedId, fromListId, toListId, newIndex);
            }
        } else if (this.dragType === 'list') {
            const canvas = this.container.querySelector('.board__canvas');
            const wrappers = Array.from(canvas.querySelectorAll('.board__list-wrapper'));

            const dashboard = this.store.getDashboard(this.dashboardId);
            const oldIndex = dashboard.listIds.indexOf(this.draggedId);

            let newIndex = wrappers.length - 1;
            for (let i = 0; i < wrappers.length; i++) {
                if (wrappers[i].dataset.listId === this.draggedId) continue;
                const rect = wrappers[i].getBoundingClientRect();
                if (x < rect.left + rect.width / 2) {
                    newIndex = i;
                    break;
                }
            }

            if (oldIndex < newIndex) newIndex--;

            if (oldIndex !== newIndex && oldIndex >= 0) {
                this.store.reorderList(this.dashboardId, oldIndex, newIndex);
            }
        }
    }

    /**
     * Clean up
     */
    destroy() {
        this._endDrag();
        this._endTouchDrag();

        // Remove all event listeners
        if (this._boundHandlers.dragstart) {
            this.container.removeEventListener('dragstart', this._boundHandlers.dragstart);
        }
        if (this._boundHandlers.dragend) {
            this.container.removeEventListener('dragend', this._boundHandlers.dragend);
        }
        if (this._boundHandlers.dragover) {
            this.container.removeEventListener('dragover', this._boundHandlers.dragover);
        }
        if (this._boundHandlers.dragleave) {
            this.container.removeEventListener('dragleave', this._boundHandlers.dragleave);
        }
        if (this._boundHandlers.drop) {
            this.container.removeEventListener('drop', this._boundHandlers.drop);
        }
        if (this._boundHandlers.touchstart) {
            this.container.removeEventListener('touchstart', this._boundHandlers.touchstart);
        }
        if (this._boundHandlers.touchmove) {
            this.container.removeEventListener('touchmove', this._boundHandlers.touchmove);
        }
        if (this._boundHandlers.touchend) {
            this.container.removeEventListener('touchend', this._boundHandlers.touchend);
        }
        if (this._boundHandlers.touchcancel) {
            this.container.removeEventListener('touchcancel', this._boundHandlers.touchcancel);
        }

        this._boundHandlers = {};
    }
}

// Make available globally
window.DragManager = DragManager;
