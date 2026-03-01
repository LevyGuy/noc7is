/**
 * List Component
 * Kanban list column
 */
class ListComponent {
    /**
     * Render a list column
     * @param {Object} list - List data
     * @param {Object[]} items - Items in this list
     * @param {Object} callbacks - Event callbacks
     * @returns {HTMLElement}
     */
    static render(list, items, callbacks = {}) {
        const isSnoozed = callbacks.snoozedUntil && callbacks.snoozedUntil > Date.now();

        const headerChildren = [
            DOM.create('h3', {
                className: 'list__title',
                dataset: { editable: 'true', listId: list.id }
            }, [list.title]),
            DOM.create('button', {
                className: 'list__menu',
                dataset: { action: 'list-menu', listId: list.id }
            }, ['\u22EE'])
        ];

        const listEl = DOM.create('div', {
            className: 'list' + (isSnoozed ? ' list--snoozed' : ''),
            dataset: { listId: list.id }
        }, [
            // Header
            DOM.create('div', {
                className: 'list__header',
                draggable: 'true',
                dataset: { listId: list.id, dragType: 'list' }
            }, headerChildren),

            // Snooze indicator (shown below header when list is snoozed)
            isSnoozed ? DOM.create('div', { className: 'list__snooze-indicator' }, [
                '\u23F0 Snoozed until ' + DateUtil.formatDateTime(callbacks.snoozedUntil)
            ]) : null,

            // Items container
            DOM.create('div', {
                className: 'list__items',
                dataset: { listId: list.id }
            }, items.map(item => ItemComponent.render(item, {
                onClick: (id) => callbacks.onItemClick && callbacks.onItemClick(id),
                onFolderClick: (id) => callbacks.onFolderClick && callbacks.onFolderClick(id),
                onDeleteFolder: callbacks.onDeleteFolder || null,
                folderItemCount: callbacks.getFolderItemCount ? callbacks.getFolderItemCount(item.id) : undefined
            }))),

            // Footer
            DOM.create('div', { className: 'list__footer' }, [
                DOM.create('button', {
                    className: 'list__add-item',
                    dataset: { action: 'add-item', listId: list.id }
                }, ['+ Add item'])
            ])
        ]);

        return listEl;
    }

    /**
     * Render the "add item" form
     * @param {string} listId
     * @param {Function} onSave - Called with (title, addToTop)
     * @param {Function} onCancel
     * @param {Function} [onSaveFolder] - Called with (title, addToTop) for folder creation
     * @returns {HTMLElement}
     */
    static renderAddItemForm(listId, onSave, onCancel, onSaveFolder) {
        const buttons = [
            DOM.create('button', {
                className: 'btn btn--primary btn--sm',
                onClick: () => {
                    const input = document.getElementById(`add-item-input-${listId}`);
                    const title = input.value.trim();
                    if (title) onSave(title, false);
                }
            }, ['Add']),
            DOM.create('button', {
                className: 'btn btn--secondary btn--sm',
                onClick: () => {
                    const input = document.getElementById(`add-item-input-${listId}`);
                    const title = input.value.trim();
                    if (title) onSave(title, true);
                }
            }, ['Add to Top'])
        ];

        if (onSaveFolder) {
            buttons.push(DOM.create('button', {
                className: 'btn btn--folder btn--sm',
                onClick: () => {
                    const input = document.getElementById(`add-item-input-${listId}`);
                    const title = input.value.trim();
                    if (title) onSaveFolder(title, false);
                }
            }, ['\uD83D\uDCC1 Folder']));
        }

        buttons.push(DOM.create('button', {
            className: 'btn btn--ghost btn--sm',
            onClick: onCancel
        }, ['\u00D7']));

        const form = DOM.create('div', { className: 'list__add-input' }, [
            DOM.create('input', {
                className: 'form-input',
                type: 'text',
                placeholder: 'Enter item title',
                id: `add-item-input-${listId}`
            }),
            DOM.create('div', { className: 'flex gap-xs flex-wrap' }, buttons)
        ]);

        // Handle keyboard (Enter adds to bottom by default)
        form.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                const input = document.getElementById(`add-item-input-${listId}`);
                const title = input.value.trim();
                if (title) onSave(title, false);
            } else if (e.key === 'Escape') {
                onCancel();
            }
        });

        return form;
    }
}

// Make available globally
window.ListComponent = ListComponent;
