/**
 * Item Detail Modal Component
 * Modal for editing item title and description
 */
class ItemDetailModal {
    /**
     * Create and show item detail modal
     * @param {Object} item - Item data
     * @param {Object} callbacks - Event callbacks
     * @param {Function} callbacks.onSave - Called with {title, desc, tags} when saved
     * @param {Function} callbacks.onDelete - Called when delete is confirmed
     * @param {Function} callbacks.onSnooze - Called with timestamp when snoozing
     * @param {Function} callbacks.onUnsnooze - Called when removing snooze
     * @param {Function} callbacks.onMove - Called when move button is clicked
     */
    static TAG_COLORS = ['red', 'orange', 'yellow', 'green', 'teal', 'blue', 'purple', 'pink'];

    constructor(item, callbacks = {}) {
        this.item = item;
        this.callbacks = callbacks;
        this._tags = ItemDetailModal.normalizeTags(item);
        this._activeColorPopup = null;

        this.show();
    }

    /**
     * Normalize legacy tag formats into a tags array
     * @param {Object} item
     * @returns {Array<{color: string|null, label: string}>}
     */
    static normalizeTags(item) {
        // New format: item.tags array
        if (Array.isArray(item.tags)) {
            return item.tags.map(t => ({ color: t.color || null, label: t.label || '' }));
        }
        // Legacy: item.tag as string (just a color)
        const tag = item.tag;
        if (typeof tag === 'string') {
            return [{ color: tag, label: tag }];
        }
        // Legacy: item.tag as object {color, label}
        if (tag && typeof tag === 'object') {
            return [{ color: tag.color || null, label: tag.label || '' }];
        }
        return [];
    }

    /**
     * Show the modal
     */
    show() {
        const isSnoozed = this.item.snoozedUntil && this.item.snoozedUntil > Date.now();

        const content = DOM.create('div', {}, [
            // Title
            DOM.create('div', { className: 'form-group' }, [
                DOM.create('label', { className: 'form-label', for: 'item-title' }, ['Title']),
                DOM.create('input', {
                    className: 'form-input',
                    type: 'text',
                    id: 'item-title',
                    value: this.item.title
                })
            ]),

            // Description
            DOM.create('div', { className: 'form-group' }, [
                DOM.create('label', { className: 'form-label', for: 'item-desc' }, ['Description']),
                DOM.create('textarea', {
                    className: 'form-input form-textarea',
                    id: 'item-desc',
                    placeholder: 'Add a more detailed description...'
                })
            ]),

            // Tags section
            DOM.create('div', { className: 'form-group' }, [
                DOM.create('label', { className: 'form-label' }, ['Tags']),
                this._renderTagInput()
            ]),

            // Snooze section
            DOM.create('div', { className: 'form-group' }, [
                DOM.create('label', { className: 'form-label' }, ['Snooze']),
                isSnoozed
                    ? DOM.create('div', { className: 'snooze-info' }, [
                        DOM.create('span', { className: 'snooze-info__text' }, [
                            `Snoozed until ${DateUtil.formatDateTime(this.item.snoozedUntil)}`
                        ]),
                        DOM.create('button', {
                            className: 'btn btn--sm btn--secondary ml-sm',
                            onClick: () => this._handleUnsnooze()
                        }, ['Remove Snooze'])
                    ])
                    : DOM.create('div', { className: 'snooze-controls' }, [
                        DOM.create('input', {
                            type: 'datetime-local',
                            className: 'form-input',
                            id: 'snooze-datetime',
                            min: this._getMinDateTime()
                        }),
                        DOM.create('button', {
                            className: 'btn btn--sm btn--secondary ml-sm',
                            onClick: () => this._handleSnooze()
                        }, ['Snooze'])
                    ])
            ]),

            // Meta
            DOM.create('div', { className: 'item-detail__meta' }, [
                `Created: ${DateUtil.format(this.item.createdAt)}`,
                this.item.updatedAt !== this.item.createdAt
                    ? ` | Updated: ${DateUtil.format(this.item.updatedAt)}`
                    : ''
            ])
        ]);

        // Set description value after creating element
        const descTextarea = content.querySelector('#item-desc');
        descTextarea.value = this.item.desc || '';

        this.modal = new Modal({
            title: 'Edit Item',
            content,
            buttons: [
                {
                    text: 'Delete',
                    className: 'btn--danger',
                    onClick: async (m) => {
                        if (this.callbacks.onDelete) {
                            const deleted = await this.callbacks.onDelete();
                            if (deleted) m.close();
                        }
                    }
                },
                this.callbacks.onMove ? {
                    text: 'Move to',
                    className: 'btn--secondary',
                    onClick: (m) => {
                        m.close();
                        this.callbacks.onMove();
                    }
                } : null,
                {
                    text: 'Cancel',
                    className: 'btn--secondary',
                    onClick: (m) => m.close()
                },
                {
                    text: 'Save',
                    className: 'btn--primary',
                    onClick: (m) => this._save(m)
                }
            ].filter(Boolean)
        });

        // Enter key on title triggers save
        const titleInput = content.querySelector('#item-title');
        const enterHandler = (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                this._save(this.modal);
            }
        };
        if (titleInput) titleInput.addEventListener('keydown', enterHandler);

        // Close any color popup when clicking outside
        document.addEventListener('mousedown', this._onDocumentClick = (e) => {
            if (this._activeColorPopup && !this._activeColorPopup.contains(e.target) && !e.target.classList.contains('tag-chip__color-dot')) {
                this._closeColorPopup();
            }
        });

        // Focus title input
        setTimeout(() => {
            const ti = document.getElementById('item-title');
            DOM.focusAndSelect(ti);
        }, 100);
    }

    /**
     * Render the tag chip input area
     * @returns {HTMLElement}
     */
    _renderTagInput() {
        this._tagInputWrapper = DOM.create('div', {
            className: 'tag-input-wrapper',
            onClick: () => {
                const input = this._tagInputWrapper.querySelector('.tag-input-wrapper__input');
                if (input) input.focus();
            }
        });

        this._refreshTagChips();
        return this._tagInputWrapper;
    }

    /**
     * Rebuild the chip display inside the wrapper
     */
    _refreshTagChips() {
        this._tagInputWrapper.innerHTML = '';

        // Render each tag as a chip
        this._tags.forEach((tag, index) => {
            const colorClass = tag.color ? ` tag-chip--${tag.color}` : '';
            const dotColorClass = tag.color ? ` tag-chip__color-dot--${tag.color}` : '';

            const chip = DOM.create('span', { className: `tag-chip${colorClass}` }, [
                DOM.create('span', {
                    className: `tag-chip__color-dot${dotColorClass}`,
                    title: 'Change color',
                    onClick: (e) => {
                        e.stopPropagation();
                        this._showColorPopup(index, e.target);
                    }
                }),
                tag.label,
                DOM.create('span', {
                    className: 'tag-chip__remove',
                    title: 'Remove tag',
                    onClick: (e) => {
                        e.stopPropagation();
                        this._tags.splice(index, 1);
                        this._refreshTagChips();
                    }
                }, ['\u00d7'])
            ]);
            this._tagInputWrapper.appendChild(chip);
        });

        // Text input for adding new tags
        const input = DOM.create('input', {
            className: 'tag-input-wrapper__input',
            type: 'text',
            placeholder: this._tags.length === 0 ? 'Type a tag and press Enter or comma...' : 'Add more...'
        });

        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ',') {
                e.preventDefault();
                this._addTagFromInput(input);
            } else if (e.key === 'Tab') {
                const val = input.value.trim();
                if (val) {
                    e.preventDefault();
                    this._addTagFromInput(input);
                }
            } else if (e.key === 'Backspace' && input.value === '' && this._tags.length > 0) {
                this._tags.pop();
                this._refreshTagChips();
            }
        });

        // Also handle paste with commas
        input.addEventListener('input', () => {
            const val = input.value;
            if (val.includes(',')) {
                const parts = val.split(',');
                parts.forEach((part, i) => {
                    const label = part.trim();
                    if (label && !this._tags.some(t => t.label === label)) {
                        this._tags.push({ color: null, label });
                    }
                });
                input.value = '';
                this._refreshTagChips();
            }
        });

        this._tagInputWrapper.appendChild(input);
    }

    /**
     * Add a tag from the text input value
     * @param {HTMLInputElement} input
     */
    _addTagFromInput(input) {
        const label = input.value.replace(/,/g, '').trim();
        if (!label) return;
        if (this._tags.some(t => t.label === label)) {
            Toast.warning('Tag already exists.');
            input.value = '';
            return;
        }
        this._tags.push({ color: null, label });
        input.value = '';
        this._refreshTagChips();
    }

    /**
     * Show color picker popup for a specific tag chip
     * @param {number} tagIndex
     * @param {HTMLElement} dotEl
     */
    _showColorPopup(tagIndex, dotEl) {
        this._closeColorPopup();

        const popup = DOM.create('div', { className: 'tag-chip__color-popup' });

        ItemDetailModal.TAG_COLORS.forEach(color => {
            const isSelected = this._tags[tagIndex].color === color;
            const swatch = DOM.create('button', {
                className: `tag-chip__color-popup__swatch tag-chip__color-popup__swatch--${color}` + (isSelected ? ' tag-chip__color-popup__swatch--selected' : ''),
                type: 'button',
                title: color.charAt(0).toUpperCase() + color.slice(1),
                onClick: (e) => {
                    e.stopPropagation();
                    this._tags[tagIndex].color = color;
                    this._closeColorPopup();
                    this._refreshTagChips();
                }
            });
            popup.appendChild(swatch);
        });

        // Clear color button
        const clearBtn = DOM.create('button', {
            className: 'tag-chip__color-popup__clear',
            type: 'button',
            title: 'No color',
            onClick: (e) => {
                e.stopPropagation();
                this._tags[tagIndex].color = null;
                this._closeColorPopup();
                this._refreshTagChips();
            }
        }, ['\u00d7']);
        popup.appendChild(clearBtn);

        // Position popup near the dot
        document.body.appendChild(popup);
        const dotRect = dotEl.getBoundingClientRect();
        popup.style.top = (dotRect.bottom + 4) + 'px';
        popup.style.left = dotRect.left + 'px';

        // Ensure popup stays in viewport
        requestAnimationFrame(() => {
            const popupRect = popup.getBoundingClientRect();
            if (popupRect.right > window.innerWidth) {
                popup.style.left = (window.innerWidth - popupRect.width - 8) + 'px';
            }
        });

        this._activeColorPopup = popup;
    }

    /**
     * Close any open color popup
     */
    _closeColorPopup() {
        if (this._activeColorPopup) {
            this._activeColorPopup.remove();
            this._activeColorPopup = null;
        }
    }

    /**
     * Get minimum datetime for snooze picker (now)
     * @returns {string}
     */
    _getMinDateTime() {
        const now = new Date();
        now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
        return now.toISOString().slice(0, 16);
    }

    /**
     * Handle snooze button click
     */
    _handleSnooze() {
        const input = document.getElementById('snooze-datetime');
        if (!input || !input.value) {
            Toast.warning('Please select a date and time.');
            return;
        }

        const snoozeUntil = new Date(input.value).getTime();
        if (snoozeUntil <= Date.now()) {
            Toast.warning('Please select a future date and time.');
            return;
        }

        if (this.callbacks.onSnooze) {
            this.callbacks.onSnooze(snoozeUntil);
        }
        this.modal.close();
        Toast.success('Item snoozed!');
    }

    /**
     * Handle unsnooze button click
     */
    _handleUnsnooze() {
        if (this.callbacks.onUnsnooze) {
            this.callbacks.onUnsnooze();
        }
        this.modal.close();
        Toast.success('Snooze removed!');
    }

    /**
     * Save changes
     * @param {Modal} modal
     */
    _save(modal) {
        const titleInput = document.getElementById('item-title');
        const descTextarea = document.getElementById('item-desc');

        const title = titleInput.value.trim();
        const desc = descTextarea.value.trim();

        if (!title) {
            Toast.warning('Title is required.');
            titleInput.focus();
            return;
        }

        // Also capture any text still in the input that hasn't been committed as a chip
        const tagInput = this._tagInputWrapper ? this._tagInputWrapper.querySelector('.tag-input-wrapper__input') : null;
        if (tagInput) {
            const remaining = tagInput.value.trim().replace(/,/g, '');
            if (remaining && !this._tags.some(t => t.label === remaining)) {
                this._tags.push({ color: null, label: remaining });
            }
        }

        // Build tags array, filtering out empty labels
        const tags = this._tags.filter(t => t.label);

        this._closeColorPopup();
        if (this._onDocumentClick) {
            document.removeEventListener('mousedown', this._onDocumentClick);
        }

        if (this.callbacks.onSave) {
            // Clear legacy tag property, replace with tags array
            this.callbacks.onSave({ title, desc, tags, tag: null });
        }

        modal.close();
    }
}

// Make available globally
window.ItemDetailModal = ItemDetailModal;
