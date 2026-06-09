/**
 * Search Component
 * Full-text search across all dashboards, lists, and items.
 * Selecting a result navigates to the matching board and highlights it.
 */
class SearchComponent {
    /**
     * @param {AppStore} store
     * @param {Object} options
     * @param {Function} options.onSelect - Called with a result object when chosen
     * @param {Function} options.onClose - Called when the overlay closes
     */
    constructor(store, options = {}) {
        this.store = store;
        this.options = {
            onSelect: null,
            onClose: null,
            ...options
        };

        this.results = [];
        this.activeIndex = 0;
        this.query = '';

        this._boundKeyHandler = this._handleKeyDown.bind(this);

        this.render();
    }

    /**
     * Build and mount the search overlay
     */
    render() {
        this.input = DOM.create('input', {
            className: 'search-panel__input',
            type: 'text',
            placeholder: 'Search all boards…',
            autocomplete: 'off',
            spellcheck: 'false',
            id: 'search-input'
        });
        this.input.addEventListener('input', () => this._onQueryChange());

        this.resultsEl = DOM.create('div', { className: 'search-panel__results', id: 'search-results' });

        this.countEl = DOM.create('span', { className: 'search-panel__count' });

        const panel = DOM.create('div', { className: 'search-panel' }, [
            DOM.create('div', { className: 'search-panel__header' }, [
                DOM.create('span', { className: 'search-panel__icon' }, ['🔍']),
                this.input,
                DOM.create('button', {
                    className: 'search-panel__close',
                    title: 'Close',
                    onClick: () => this.close()
                }, ['×'])
            ]),
            this.resultsEl,
            DOM.create('div', { className: 'search-panel__footer' }, [
                DOM.create('span', { className: 'search-panel__hint' }, [
                    '↑↓ to navigate • Enter to open • Esc to close'
                ]),
                this.countEl
            ])
        ]);

        this.backdrop = DOM.create('div', {
            className: 'search-overlay',
            onClick: (e) => {
                if (e.target === this.backdrop) this.close();
            }
        }, [panel]);

        document.body.appendChild(this.backdrop);
        document.addEventListener('keydown', this._boundKeyHandler);

        this._renderResults();
        this.input.focus();
    }

    /**
     * Handle query input changes
     */
    _onQueryChange() {
        this.query = this.input.value;
        this.results = this._search(this.query);
        this.activeIndex = 0;
        this._renderResults();
    }

    /**
     * Search all boards for the given query
     * @param {string} rawQuery
     * @returns {Object[]}
     */
    _search(rawQuery) {
        const q = rawQuery.trim().toLowerCase();
        if (!q) return [];

        const results = [];
        const dashboards = this.store.getActiveDashboards();

        for (const dash of dashboards) {
            if (dash.title && dash.title.toLowerCase().includes(q)) {
                results.push({
                    type: 'board',
                    dashboardId: dash.id,
                    dashboardTitle: dash.title,
                    title: dash.title
                });
            }

            // Include snoozed lists/items so nothing is hidden from search
            const lists = this.store.getListsForDashboard(dash.id, true);
            for (const list of lists) {
                if (list.title && list.title.toLowerCase().includes(q)) {
                    results.push({
                        type: 'list',
                        dashboardId: dash.id,
                        dashboardTitle: dash.title,
                        listId: list.id,
                        listTitle: list.title,
                        title: list.title
                    });
                }

                const items = this.store.getItemsForList(list.id, true);
                for (const item of items) {
                    this._matchItem(item, q, results, dash, list, null);

                    if (item.type === 'folder') {
                        const subItems = this.store.getItemsForFolder(item.id, true);
                        for (const sub of subItems) {
                            this._matchItem(sub, q, results, dash, list, item);
                        }
                    }
                }
            }
        }

        return results;
    }

    /**
     * Test a single item (or sub-item) against the query and push a result
     */
    _matchItem(item, q, results, dash, list, folder) {
        if (!item || (item.title || '').trim() === '---') return;

        const titleMatch = item.title && item.title.toLowerCase().includes(q);
        const descMatch = item.desc && item.desc.toLowerCase().includes(q);
        if (!titleMatch && !descMatch) return;

        results.push({
            type: 'item',
            dashboardId: dash.id,
            dashboardTitle: dash.title,
            listId: list.id,
            listTitle: list.title,
            folderId: folder ? folder.id : null,
            folderTitle: folder ? folder.title : null,
            itemId: item.id,
            isFolder: item.type === 'folder',
            title: item.title || '(untitled)',
            desc: item.desc || '',
            descOnly: !titleMatch && descMatch
        });
    }

    /**
     * Render the results list
     */
    _renderResults() {
        DOM.clear(this.resultsEl);

        if (!this.query.trim()) {
            this.resultsEl.appendChild(DOM.create('div', { className: 'search-panel__empty' }, [
                DOM.create('div', { className: 'search-panel__empty-icon' }, ['🔍']),
                DOM.create('p', {}, ['Search across every board for cards, lists and dashboards.'])
            ]));
            Sanitize.text(this.countEl, '');
            return;
        }

        if (this.results.length === 0) {
            this.resultsEl.appendChild(DOM.create('div', { className: 'search-panel__empty' }, [
                DOM.create('div', { className: 'search-panel__empty-icon' }, ['🤷']),
                DOM.create('p', {}, [`No matches for “${this.query.trim()}”`])
            ]));
            Sanitize.text(this.countEl, '0 results');
            return;
        }

        const MAX = 100;
        const shown = this.results.slice(0, MAX);

        shown.forEach((result, index) => {
            this.resultsEl.appendChild(this._renderResultRow(result, index));
        });

        const total = this.results.length;
        let countText = `${total} result${total !== 1 ? 's' : ''}`;
        if (total > MAX) countText = `Showing ${MAX} of ${total} results`;
        Sanitize.text(this.countEl, countText);
    }

    /**
     * Render a single result row
     */
    _renderResultRow(result, index) {
        const typeLabel = result.type === 'board' ? 'Board'
            : result.type === 'list' ? 'List'
            : result.isFolder ? 'Folder' : 'Card';

        // Breadcrumb path (board > list > folder)
        const crumbs = [result.dashboardTitle];
        if (result.listTitle) crumbs.push(result.listTitle);
        if (result.folderTitle) crumbs.push(result.folderTitle);

        const children = [
            DOM.create('span', { className: `search-result__type search-result__type--${result.type}` }, [typeLabel]),
            DOM.create('div', { className: 'search-result__main' }, [
                DOM.create('div', { className: 'search-result__title' }, [
                    this._highlight(result.title, this.query)
                ]),
                DOM.create('div', { className: 'search-result__path' }, [crumbs.join('  ›  ')])
            ])
        ];

        // Show a description snippet when the match is in the description
        if (result.type === 'item' && result.descOnly && result.desc) {
            children[1].appendChild(DOM.create('div', { className: 'search-result__snippet' }, [
                this._highlight(this._snippet(result.desc, this.query), this.query)
            ]));
        }

        const row = DOM.create('div', {
            className: 'search-result' + (index === this.activeIndex ? ' search-result--active' : ''),
            dataset: { index: String(index) },
            onClick: () => this._select(result),
            onMouseenter: () => this._setActive(index)
        }, children);

        return row;
    }

    /**
     * Build a DocumentFragment with the query occurrences wrapped in <mark>
     * @param {string} text
     * @param {string} query
     * @returns {DocumentFragment}
     */
    _highlight(text, query) {
        const frag = document.createDocumentFragment();
        const q = query.trim();
        if (!q) {
            frag.appendChild(document.createTextNode(text));
            return frag;
        }

        const lower = text.toLowerCase();
        const needle = q.toLowerCase();
        let from = 0;
        let pos;

        while ((pos = lower.indexOf(needle, from)) !== -1) {
            if (pos > from) {
                frag.appendChild(document.createTextNode(text.slice(from, pos)));
            }
            const mark = DOM.create('mark', { className: 'search-result__match' }, [
                text.slice(pos, pos + needle.length)
            ]);
            frag.appendChild(mark);
            from = pos + needle.length;
        }
        if (from < text.length) {
            frag.appendChild(document.createTextNode(text.slice(from)));
        }
        return frag;
    }

    /**
     * Extract a snippet of text centered on the first query match
     * @param {string} text
     * @param {string} query
     * @returns {string}
     */
    _snippet(text, query) {
        const needle = query.trim().toLowerCase();
        const pos = text.toLowerCase().indexOf(needle);
        if (pos === -1) return Sanitize.truncate(text, 120);

        const before = 40;
        const after = 80;
        let start = Math.max(0, pos - before);
        let end = Math.min(text.length, pos + needle.length + after);

        let snippet = text.slice(start, end).trim();
        if (start > 0) snippet = '…' + snippet;
        if (end < text.length) snippet = snippet + '…';
        return snippet;
    }

    /**
     * Update the active (keyboard-highlighted) row
     */
    _setActive(index) {
        if (index === this.activeIndex) return;
        this.activeIndex = index;
        const rows = this.resultsEl.querySelectorAll('.search-result');
        rows.forEach((row, i) => {
            row.classList.toggle('search-result--active', i === this.activeIndex);
        });
    }

    /**
     * Move the active selection by a delta and scroll it into view
     */
    _moveActive(delta) {
        const max = Math.min(this.results.length, 100);
        if (max === 0) return;
        let next = this.activeIndex + delta;
        if (next < 0) next = max - 1;
        if (next >= max) next = 0;
        this._setActive(next);

        const activeRow = this.resultsEl.querySelector('.search-result--active');
        if (activeRow) activeRow.scrollIntoView({ block: 'nearest' });
    }

    /**
     * Choose a result: close and notify the caller
     */
    _select(result) {
        if (this.options.onSelect) {
            this.options.onSelect(result);
        }
        this.close();
    }

    /**
     * Keyboard handling
     */
    _handleKeyDown(e) {
        switch (e.key) {
            case 'Escape':
                e.preventDefault();
                this.close();
                break;
            case 'ArrowDown':
                e.preventDefault();
                this._moveActive(1);
                break;
            case 'ArrowUp':
                e.preventDefault();
                this._moveActive(-1);
                break;
            case 'Enter': {
                e.preventDefault();
                const result = this.results[this.activeIndex];
                if (result) this._select(result);
                break;
            }
        }
    }

    /**
     * Tear down the overlay
     */
    close() {
        document.removeEventListener('keydown', this._boundKeyHandler);
        if (this.backdrop && this.backdrop.parentNode) {
            this.backdrop.parentNode.removeChild(this.backdrop);
        }
        if (this.options.onClose) {
            this.options.onClose();
        }
    }
}

// Make available globally
window.SearchComponent = SearchComponent;
