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
     * @param {Object} [options] - Extra options
     * @param {AppStore} [options.store] - Store used to suggest previously used tags
     */
    static TAG_COLORS = ['red', 'orange', 'yellow', 'green', 'teal', 'blue', 'purple', 'pink'];

    constructor(item, callbacks = {}, options = {}) {
        this.item = item;
        this.callbacks = callbacks;
        this.store = options.store || null;
        this._tags = ItemDetailModal.normalizeTags(item);
        this._activeColorPopup = null;

        // Previously used tags, most used first (empty when no store is provided)
        this._knownTags = (this.store && typeof this.store.getKnownTags === 'function')
            ? this.store.getKnownTags()
            : [];
        this._suggestionsEl = null;
        this._suggestionOptions = [];
        this._highlightIndex = -1;

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
            onClose: () => this._cleanup(),
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

        // Close any color popup / tag suggestions when clicking outside
        document.addEventListener('mousedown', this._onDocumentClick = (e) => {
            if (this._activeColorPopup && !this._activeColorPopup.contains(e.target) && !e.target.classList.contains('tag-chip__color-dot')) {
                this._closeColorPopup();
            }
            if (this._suggestionsEl && !this._suggestionsEl.contains(e.target) &&
                (!this._tagField || !this._tagField.contains(e.target))) {
                this._closeSuggestions();
            }
        });

        // Keep the suggestions dropdown anchored to the input
        this._onReposition = () => this._positionSuggestions();
        window.addEventListener('resize', this._onReposition);
        document.addEventListener('scroll', this._onReposition, true);

        // Focus title input
        setTimeout(() => {
            const ti = document.getElementById('item-title');
            DOM.focusAndSelect(ti);
        }, 100);
    }

    /**
     * Render the tag chip input area with the saved-tags dropdown
     * @returns {HTMLElement}
     */
    _renderTagInput() {
        this._tagInputWrapper = DOM.create('div', {
            className: 'tag-input-wrapper',
            onClick: () => {
                this._tagInput.focus();
                this._openSuggestions();
            }
        });

        this._tagInput = this._createTagInput();

        // Toggle button to browse previously used tags
        this._suggestToggle = DOM.create('button', {
            className: 'tag-input-wrapper__toggle',
            type: 'button',
            title: 'Show previously used tags',
            onClick: (e) => {
                e.stopPropagation();
                if (this._suggestionsEl) {
                    this._closeSuggestions();
                } else {
                    this._tagInput.focus();
                    this._openSuggestions(true);
                }
            }
        }, ['▾']);

        this._tagField = DOM.create('div', { className: 'tag-field' }, [this._tagInputWrapper]);

        this._refreshTagChips();
        return this._tagField;
    }

    /**
     * Create the text input used to type new tags (created once, reused on refresh)
     * @returns {HTMLInputElement}
     */
    _createTagInput() {
        const input = DOM.create('input', {
            className: 'tag-input-wrapper__input',
            type: 'text',
            autocomplete: 'off'
        });

        input.addEventListener('focus', () => this._openSuggestions());

        input.addEventListener('keydown', (e) => {
            if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
                if (!this._suggestionsEl) {
                    this._openSuggestions(true);
                    if (this._suggestionOptions.length > 0) {
                        e.preventDefault();
                        this._setHighlight(e.key === 'ArrowDown' ? 0 : this._suggestionOptions.length - 1);
                    }
                    return;
                }
                if (this._suggestionOptions.length > 0) {
                    e.preventDefault();
                    this._moveHighlight(e.key === 'ArrowDown' ? 1 : -1);
                }
                return;
            }

            if (e.key === 'Escape') {
                if (this._suggestionsEl) {
                    // Close the dropdown without closing the whole modal
                    e.preventDefault();
                    e.stopPropagation();
                    this._closeSuggestions();
                }
                return;
            }

            if (e.key === 'Enter' || e.key === ',') {
                e.preventDefault();
                const highlighted = this._getHighlightedSuggestion();
                if (e.key === 'Enter' && highlighted) {
                    this._selectSuggestion(highlighted);
                } else {
                    this._addTagFromInput(input);
                }
                return;
            }

            if (e.key === 'Tab') {
                const highlighted = this._getHighlightedSuggestion();
                if (highlighted) {
                    e.preventDefault();
                    this._selectSuggestion(highlighted);
                } else if (input.value.trim()) {
                    e.preventDefault();
                    this._addTagFromInput(input);
                }
                return;
            }

            if (e.key === 'Backspace' && input.value === '' && this._tags.length > 0) {
                this._tags.pop();
                this._refreshTagChips();
            }
        });

        // Handle typing (filters suggestions) and paste with commas
        input.addEventListener('input', () => {
            const val = input.value;
            if (val.includes(',')) {
                val.split(',').forEach(part => this._addTag(part, null, true));
                input.value = '';
                this._refreshTagChips();
            }
            this._openSuggestions();
        });

        return input;
    }

    /**
     * Rebuild the chip display inside the wrapper
     */
    _refreshTagChips() {
        const hadFocus = document.activeElement === this._tagInput;
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

        // Text input for adding new tags (manual entry always available)
        this._tagInput.placeholder = this._tags.length === 0
            ? 'Type a tag and press Enter, or pick a saved one...'
            : 'Add more...';
        this._tagInputWrapper.appendChild(this._tagInput);

        // Dropdown toggle, only useful when there are saved tags to browse
        if (this._knownTags.length > 0) {
            this._tagInputWrapper.appendChild(this._suggestToggle);
        }

        if (hadFocus) this._tagInput.focus();

        // Keep the open dropdown in sync with the tags just added/removed
        if (this._suggestionsEl) this._renderSuggestions();
    }

    /**
     * Add a tag from the text input value
     * @param {HTMLInputElement} input
     */
    _addTagFromInput(input) {
        const label = input.value.replace(/,/g, '').trim();
        if (!label) return;
        if (this._addTag(label)) {
            input.value = '';
            this._refreshTagChips();
            this._openSuggestions();
        } else {
            input.value = '';
        }
    }

    /**
     * Add a tag to the current item
     * @param {string} label
     * @param {string|null} [color=null]
     * @param {boolean} [silent=false] - Skip the duplicate warning
     * @returns {boolean} True if the tag was added
     */
    _addTag(label, color = null, silent = false) {
        const trimmed = (label || '').trim();
        if (!trimmed) return false;

        if (this._hasTag(trimmed)) {
            if (!silent) Toast.warning('Tag already exists.');
            return false;
        }

        this._tags.push({ color: color || null, label: trimmed });
        return true;
    }

    /**
     * Check whether a label is already attached to this item (case-insensitive)
     * @param {string} label
     * @returns {boolean}
     */
    _hasTag(label) {
        const key = (label || '').trim().toLowerCase();
        return this._tags.some(t => (t.label || '').trim().toLowerCase() === key);
    }

    // =========================================================================
    // TAG SUGGESTIONS DROPDOWN
    // =========================================================================

    /**
     * Previously used tags that aren't on this item yet, filtered by typed text
     * @returns {Array<{label: string, color: string|null, count: number}>}
     */
    _getSuggestions() {
        const filter = (this._tagInput ? this._tagInput.value : '').trim().toLowerCase();

        return this._knownTags.filter(tag => {
            if (this._hasTag(tag.label)) return false;
            if (!filter) return true;
            return tag.label.toLowerCase().includes(filter);
        });
    }

    /**
     * Open (or refresh) the saved-tags dropdown
     * @param {boolean} [force=false] - Open even when there is nothing to show
     */
    _openSuggestions(force = false) {
        if (this._knownTags.length === 0 && !force) return;

        if (!this._suggestionsEl) {
            this._suggestionsEl = DOM.create('div', {
                className: 'tag-suggestions',
                // Keep focus in the input when interacting with the dropdown
                onMouseDown: (e) => e.preventDefault()
            });
            document.body.appendChild(this._suggestionsEl);
        }

        this._renderSuggestions();
    }

    /**
     * Render the dropdown contents for the current filter
     */
    _renderSuggestions() {
        if (!this._suggestionsEl) return;

        const suggestions = this._getSuggestions();
        const typed = (this._tagInput ? this._tagInput.value : '').replace(/,/g, '').trim();

        this._suggestionsEl.innerHTML = '';
        this._suggestionOptions = [];
        this._highlightIndex = -1;

        suggestions.forEach(tag => {
            const dotClass = tag.color ? ` tag-suggestions__dot--${tag.color}` : '';
            const option = DOM.create('button', {
                className: 'tag-suggestions__option',
                type: 'button',
                onClick: () => this._selectSuggestion(tag)
            }, [
                DOM.create('span', { className: `tag-suggestions__dot${dotClass}` }),
                DOM.create('span', { className: 'tag-suggestions__label' }, [tag.label]),
                tag.count > 0
                    ? DOM.create('span', { className: 'tag-suggestions__count' }, [String(tag.count)])
                    : null
            ].filter(Boolean));

            this._suggestionsEl.appendChild(option);
            this._suggestionOptions.push({ el: option, tag });
        });

        // Always show how to add a brand new tag by hand
        let hint = '';
        if (suggestions.length === 0 && this._knownTags.length === 0) {
            hint = 'No saved tags yet — type a tag and press Enter to create one.';
        } else if (suggestions.length === 0 && typed) {
            hint = `No match — press Enter to create "${typed}".`;
        } else if (suggestions.length === 0) {
            hint = 'All saved tags are already added.';
        } else if (typed) {
            hint = `Press Enter to create "${typed}" instead.`;
        }

        if (hint) {
            this._suggestionsEl.appendChild(
                DOM.create('div', { className: 'tag-suggestions__hint' }, [hint])
            );
        }

        this._positionSuggestions();
    }

    /**
     * Position the dropdown under the tag input (flips above when short on space)
     */
    _positionSuggestions() {
        if (!this._suggestionsEl || !this._tagInputWrapper) return;

        const rect = this._tagInputWrapper.getBoundingClientRect();
        this._suggestionsEl.style.width = rect.width + 'px';
        this._suggestionsEl.style.left = rect.left + 'px';
        this._suggestionsEl.style.top = (rect.bottom + 4) + 'px';

        const dropdownHeight = this._suggestionsEl.offsetHeight;
        if (rect.bottom + 4 + dropdownHeight > window.innerHeight && rect.top - 4 - dropdownHeight > 0) {
            this._suggestionsEl.style.top = (rect.top - 4 - dropdownHeight) + 'px';
        }
    }

    /**
     * Add a tag picked from the dropdown
     * @param {{label: string, color: string|null}} tag
     */
    _selectSuggestion(tag) {
        this._addTag(tag.label, tag.color);
        this._tagInput.value = '';
        this._tagInput.focus();
        this._refreshTagChips();
        this._openSuggestions();
    }

    /**
     * Get the currently highlighted suggestion, if any
     * @returns {Object|null}
     */
    _getHighlightedSuggestion() {
        if (this._highlightIndex < 0) return null;
        const option = this._suggestionOptions[this._highlightIndex];
        return option ? option.tag : null;
    }

    /**
     * Move the keyboard highlight through the dropdown
     * @param {number} delta
     */
    _moveHighlight(delta) {
        const count = this._suggestionOptions.length;
        if (count === 0) return;

        let next = this._highlightIndex + delta;
        if (next < 0) next = count - 1;
        if (next >= count) next = 0;
        this._setHighlight(next);
    }

    /**
     * Highlight a specific suggestion
     * @param {number} index
     */
    _setHighlight(index) {
        this._suggestionOptions.forEach((option, i) => {
            option.el.classList.toggle('tag-suggestions__option--active', i === index);
        });
        this._highlightIndex = index;

        const active = this._suggestionOptions[index];
        if (active) active.el.scrollIntoView({ block: 'nearest' });
    }

    /**
     * Close the saved-tags dropdown
     */
    _closeSuggestions() {
        if (this._suggestionsEl) {
            this._suggestionsEl.remove();
            this._suggestionsEl = null;
        }
        this._suggestionOptions = [];
        this._highlightIndex = -1;
    }

    /**
     * Show color picker popup for a specific tag chip
     * @param {number} tagIndex
     * @param {HTMLElement} dotEl
     */
    _showColorPopup(tagIndex, dotEl) {
        this._closeColorPopup();
        this._closeSuggestions();

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
     * Tear down anything attached outside the modal (called on close)
     */
    _cleanup() {
        this._closeColorPopup();
        this._closeSuggestions();

        if (this._onDocumentClick) {
            document.removeEventListener('mousedown', this._onDocumentClick);
            this._onDocumentClick = null;
        }
        if (this._onReposition) {
            window.removeEventListener('resize', this._onReposition);
            document.removeEventListener('scroll', this._onReposition, true);
            this._onReposition = null;
        }
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
        if (this._tagInput) {
            this._addTag(this._tagInput.value.replace(/,/g, ''), null, true);
        }

        // Build tags array, filtering out empty labels
        const tags = this._tags.filter(t => t.label);

        if (this.callbacks.onSave) {
            // Clear legacy tag property, replace with tags array
            this.callbacks.onSave({ title, desc, tags, tag: null });
        }

        modal.close();
    }
}

// Make available globally
window.ItemDetailModal = ItemDetailModal;
