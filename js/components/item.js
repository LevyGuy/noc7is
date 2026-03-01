/**
 * Item Component
 * Individual kanban item card
 */
class ItemComponent {
    /**
     * Normalize tags from item data, handling legacy formats
     * @param {Object} item
     * @returns {Array<{color: string|null, label: string}>}
     */
    static normalizeTags(item) {
        if (Array.isArray(item.tags)) return item.tags;
        const tag = item.tag;
        if (typeof tag === 'string') return [{ color: tag, label: '' }];
        if (tag && typeof tag === 'object') return [{ color: tag.color || null, label: tag.label || '' }];
        return [];
    }

    /**
     * Render an item card
     * @param {Object} item - Item data
     * @param {Object} callbacks - Event callbacks
     * @returns {HTMLElement}
     */
    static render(item, callbacks = {}) {
        // Folder items get a distinct rendering
        if (item.type === 'folder') {
            return ItemComponent.renderFolder(item, callbacks);
        }

        // Check if item is currently snoozed
        const isSnoozed = item.snoozedUntil && item.snoozedUntil > Date.now();

        // Check if this is a divider item (--- like in Trello)
        if (item.title.trim() === '---') {
            return DOM.create('div', {
                className: 'item item--divider',
                draggable: 'true',
                dataset: { itemId: item.id },
                onClick: (e) => {
                    if (!e.target.closest('.item--dragging') && callbacks.onClick) {
                        callbacks.onClick(item.id);
                    }
                }
            }, [
                DOM.create('hr', { className: 'item__hr' })
            ]);
        }

        const tags = ItemComponent.normalizeTags(item);
        const firstTagColor = tags.length > 0 ? tags[0].color : null;

        const indicators = [];
        tags.forEach(tag => {
            if (tag.label) {
                indicators.push(DOM.create('span', {
                    className: 'item__tag-label' + (tag.color ? ` item__tag-label--${tag.color}` : '')
                }, [tag.label]));
            }
        });
        if (item.desc) {
            indicators.push(DOM.create('span', { className: 'item__desc-indicator' }, ['\uD83D\uDCDD']));
        }
        if (isSnoozed) {
            indicators.push(DOM.create('span', { className: 'item__snooze-indicator' }, [
                '\u23F0 ' + DateUtil.formatDateTime(item.snoozedUntil)
            ]));
        }

        const card = DOM.create('div', {
            className: 'item' + (isSnoozed ? ' item--snoozed' : ''),
            draggable: 'true',
            dataset: { itemId: item.id },
            onClick: (e) => {
                // Don't open modal if we just finished dragging
                if (!e.target.closest('.item--dragging') && callbacks.onClick) {
                    callbacks.onClick(item.id);
                }
            }
        }, [
            firstTagColor ? DOM.create('div', { className: `item__tag-bar item__tag-bar--${firstTagColor}` }) : null,
            DOM.create('span', { className: 'item__title' }, [item.title]),
            indicators.length > 0 ? DOM.create('div', { className: 'item__indicators' }, indicators) : null
        ].filter(Boolean));

        return card;
    }

    /**
     * Render a folder item card
     * @param {Object} item - Folder item data
     * @param {Object} callbacks - Event callbacks (includes folderItemCount)
     * @returns {HTMLElement}
     */
    static renderFolder(item, callbacks = {}) {
        const subItemCount = callbacks.folderItemCount !== undefined
            ? callbacks.folderItemCount
            : (item.subItemIds ? item.subItemIds.length : 0);

        const tags = ItemComponent.normalizeTags(item);
        const firstTagColor = tags.length > 0 ? tags[0].color : null;

        const indicators = [];
        if (item.desc) {
            indicators.push(DOM.create('span', { className: 'item__desc-indicator' }, ['\uD83D\uDCDD']));
        }

        const countText = subItemCount === 1 ? '1 item' : `${subItemCount} items`;

        const card = DOM.create('div', {
            className: 'item item--folder',
            draggable: 'true',
            dataset: { itemId: item.id, itemType: 'folder' },
            onClick: (e) => {
                if (e.target.closest('.item__folder-menu-btn')) return;
                if (!e.target.closest('.item--dragging') && callbacks.onFolderClick) {
                    callbacks.onFolderClick(item.id);
                }
            }
        }, [
            firstTagColor ? DOM.create('div', { className: `item__tag-bar item__tag-bar--${firstTagColor}` }) : null,
            DOM.create('div', { className: 'item__folder-content' }, [
                DOM.create('span', { className: 'item__folder-icon' }, ['\uD83D\uDCC1']),
                DOM.create('div', { className: 'item__folder-info' }, [
                    DOM.create('span', { className: 'item__title' }, [item.title]),
                    DOM.create('span', { className: 'item__folder-count' }, [countText])
                ]),
                callbacks.onDeleteFolder ? DOM.create('button', {
                    className: 'item__folder-menu-btn',
                    onClick: (e) => {
                        e.stopPropagation();
                        callbacks.onDeleteFolder(item.id);
                    }
                }, ['\u00D7']) : null
            ].filter(Boolean)),
            indicators.length > 0 ? DOM.create('div', { className: 'item__indicators' }, indicators) : null
        ].filter(Boolean));

        return card;
    }
}

// Make available globally
window.ItemComponent = ItemComponent;
