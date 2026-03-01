/**
 * Dashboard Gallery Component
 * Shows grid of all dashboards (home view)
 */
class DashboardGalleryComponent {
    /**
     * Create dashboard gallery
     * @param {HTMLElement} container
     * @param {AppStore} store
     */
    constructor(container, store) {
        this.container = container;
        this.store = store;

        this.render();
        this._unsubscribe = this.store.subscribe(() => this.render());
    }

    /**
     * Render the gallery
     */
    render() {
        const dashboards = this.store.getActiveDashboards();

        this.container.innerHTML = '';

        const gallery = DOM.create('div', { className: 'gallery' }, [
            DOM.create('div', { className: 'gallery__header' }, [
                DOM.create('h2', { className: 'gallery__title' }, ['Your Dashboards']),
                DOM.create('div', { className: 'gallery__actions' }, [
                    DOM.create('button', {
                        className: 'btn btn--secondary btn--sm',
                        id: 'export-btn'
                    }, ['Export']),
                    DOM.create('button', {
                        className: 'btn btn--secondary btn--sm',
                        id: 'import-btn'
                    }, ['Import']),
                    DOM.create('button', {
                        className: 'btn btn--secondary btn--sm',
                        id: 'import-trello-btn'
                    }, ['Import Trello'])
                ])
            ]),
            DOM.create('div', { className: 'gallery__grid', id: 'dashboard-grid' })
        ]);

        this.container.appendChild(gallery);

        // Bind export button
        const exportBtn = document.getElementById('export-btn');
        if (exportBtn) {
            exportBtn.addEventListener('click', () => this._exportDashboards());
        }

        // Bind import button
        const importBtn = document.getElementById('import-btn');
        if (importBtn) {
            importBtn.addEventListener('click', () => this._showImportBlindBoardModal());
        }

        // Bind Trello import button
        const importTrelloBtn = document.getElementById('import-trello-btn');
        if (importTrelloBtn) {
            importTrelloBtn.addEventListener('click', () => this._showImportTrelloModal());
        }

        const grid = document.getElementById('dashboard-grid');

        // Render dashboard cards
        dashboards.forEach(dashboard => {
            const listCount = this.store.getListsForDashboard(dashboard.id).length;
            const card = DashboardCardComponent.render(dashboard, listCount, {
                onClick: (id) => router.navigate(`/board/${id}`),
                onMenu: (id, anchor) => this._showMenu(id, anchor)
            });
            grid.appendChild(card);
        });

        // Render new dashboard card
        const newCard = DashboardCardComponent.renderNewCard((title) => {
            const id = this.store.addDashboard(title);
            Toast.success(`Dashboard "${title}" created!`);
        });
        grid.appendChild(newCard);

        // Show empty state if no dashboards
        if (dashboards.length === 0) {
            const emptyState = DOM.create('div', { className: 'empty-state' }, [
                DOM.create('div', { className: 'empty-state__icon' }, ['\uD83D\uDCCB']),
                DOM.create('h3', { className: 'empty-state__title' }, ['No Dashboards Yet']),
                DOM.create('p', { className: 'empty-state__text' }, [
                    'Create your first dashboard to get started organizing your tasks.'
                ])
            ]);
            gallery.insertBefore(emptyState, grid);
        }
    }

    /**
     * Show dashboard menu
     * @param {string} dashboardId
     * @param {HTMLElement} anchor
     */
    _showMenu(dashboardId, anchor) {
        // Remove existing menu
        const existingMenu = document.querySelector('.dropdown-menu');
        if (existingMenu) existingMenu.remove();

        const dashboard = this.store.getDashboard(dashboardId);
        const listCount = this.store.getListsForDashboard(dashboardId).length;

        const menu = DOM.create('div', { className: 'dropdown-menu' }, [
            DOM.create('button', {
                className: 'dropdown-menu__item',
                onClick: () => {
                    menu.remove();
                    this._editDashboard(dashboardId);
                }
            }, ['Edit Title']),
            DOM.create('div', { className: 'dropdown-menu__divider' }),
            DOM.create('button', {
                className: 'dropdown-menu__item dropdown-menu__item--danger',
                onClick: async () => {
                    menu.remove();
                    await this._deleteDashboard(dashboardId, dashboard.title, listCount);
                }
            }, ['Delete'])
        ]);

        // Position menu
        const rect = anchor.getBoundingClientRect();
        menu.style.position = 'fixed';
        menu.style.top = `${rect.bottom + 4}px`;
        menu.style.left = `${rect.left}px`;

        document.body.appendChild(menu);

        // Close on outside click
        const closeMenu = (e) => {
            if (!menu.contains(e.target)) {
                menu.remove();
                document.removeEventListener('click', closeMenu);
            }
        };
        setTimeout(() => document.addEventListener('click', closeMenu), 0);
    }

    /**
     * Edit dashboard title
     * @param {string} id
     */
    _editDashboard(id) {
        const dashboard = this.store.getDashboard(id);
        if (!dashboard) return;

        const content = DOM.create('div', { className: 'form-group' }, [
            DOM.create('label', { className: 'form-label' }, ['Dashboard Name']),
            DOM.create('input', {
                className: 'form-input',
                type: 'text',
                id: 'edit-dashboard-input',
                value: dashboard.title
            })
        ]);

        const modal = new Modal({
            title: 'Edit Dashboard',
            content,
            buttons: [
                {
                    text: 'Cancel',
                    className: 'btn--secondary',
                    onClick: (m) => m.close()
                },
                {
                    text: 'Save',
                    className: 'btn--primary',
                    onClick: (m) => {
                        const input = document.getElementById('edit-dashboard-input');
                        const newTitle = input.value.trim();
                        if (newTitle) {
                            this.store.updateDashboard(id, { title: newTitle });
                            Toast.success('Dashboard updated!');
                        }
                        m.close();
                    }
                }
            ]
        });

        // Focus and select input
        setTimeout(() => {
            const input = document.getElementById('edit-dashboard-input');
            DOM.focusAndSelect(input);
        }, 100);
    }

    /**
     * Delete dashboard with confirmation
     * @param {string} id
     * @param {string} title
     * @param {number} listCount
     */
    async _deleteDashboard(id, title, listCount) {
        let message = `Delete "${title}"?`;
        if (listCount > 0) {
            message += ` This will also delete ${listCount} list${listCount !== 1 ? 's' : ''} and all their items.`;
        }

        const confirmed = await ConfirmDialog.show({
            title: 'Delete Dashboard',
            message,
            confirmText: 'Delete',
            danger: true
        });

        if (confirmed) {
            this.store.deleteDashboard(id);
            Toast.success(`Dashboard "${title}" deleted.`);
        }
    }

    /**
     * Export all dashboards
     */
    _exportDashboards() {
        const dashboards = this.store.getActiveDashboards();

        if (dashboards.length === 0) {
            Toast.warning('No dashboards to export.');
            return;
        }

        DashboardExporter.exportAndDownload(this.store);
        Toast.success(`Exported ${dashboards.length} dashboard${dashboards.length !== 1 ? 's' : ''}!`);
    }

    /**
     * Show import noc7is export modal
     */
    _showImportBlindBoardModal() {
        const fileInput = DOM.create('input', {
            type: 'file',
            accept: '.json',
            id: 'import-file-input',
            className: 'hidden'
        });

        const content = DOM.create('div', {}, [
            DOM.create('p', { className: 'mb-md' }, [
                'Select a noc7is JSON export file to import your dashboards.'
            ]),
            DOM.create('div', { className: 'form-group' }, [
                DOM.create('label', {
                    className: 'btn btn--secondary',
                    for: 'import-file-input'
                }, ['Choose File']),
                fileInput,
                DOM.create('span', {
                    className: 'ml-sm',
                    id: 'import-selected-file-name'
                }, ['No file selected'])
            ])
        ]);

        let selectedFile = null;

        fileInput.addEventListener('change', (e) => {
            selectedFile = e.target.files[0];
            const fileNameSpan = document.getElementById('import-selected-file-name');
            if (selectedFile) {
                fileNameSpan.textContent = selectedFile.name;
            } else {
                fileNameSpan.textContent = 'No file selected';
            }
        });

        const modal = new Modal({
            title: 'Import Dashboards',
            content,
            buttons: [
                {
                    text: 'Cancel',
                    className: 'btn--secondary',
                    onClick: (m) => m.close()
                },
                {
                    text: 'Import',
                    className: 'btn--primary',
                    onClick: async (m) => {
                        if (!selectedFile) {
                            Toast.warning('Please select a file first.');
                            return;
                        }

                        try {
                            const data = await DashboardImporter.readFile(selectedFile);

                            if (!DashboardImporter.isValidExport(data)) {
                                Toast.error('This does not appear to be a valid noc7is export file.');
                                return;
                            }

                            const result = DashboardImporter.import(this.store, data);

                            m.close();
                            Toast.success(
                                `Imported ${result.dashboardsImported} dashboard${result.dashboardsImported !== 1 ? 's' : ''} with ${result.listsImported} lists and ${result.itemsImported} items!`
                            );
                        } catch (err) {
                            Toast.error(err.message || 'Failed to import file.');
                        }
                    }
                }
            ]
        });
    }

    /**
     * Show import from Trello modal
     */
    _showImportTrelloModal() {
        // Create hidden file input
        const fileInput = DOM.create('input', {
            type: 'file',
            accept: '.json',
            id: 'trello-file-input',
            className: 'hidden'
        });

        const content = DOM.create('div', {}, [
            DOM.create('p', { className: 'mb-md' }, [
                'Select a Trello JSON export file to import your board as a new dashboard.'
            ]),
            DOM.create('div', { className: 'form-group' }, [
                DOM.create('label', {
                    className: 'btn btn--secondary',
                    for: 'trello-file-input',
                    id: 'file-select-label'
                }, ['Choose File']),
                fileInput,
                DOM.create('span', {
                    className: 'ml-sm',
                    id: 'selected-file-name'
                }, ['No file selected'])
            ])
        ]);

        let selectedFile = null;

        // Handle file selection
        fileInput.addEventListener('change', (e) => {
            selectedFile = e.target.files[0];
            const fileNameSpan = document.getElementById('selected-file-name');
            if (selectedFile) {
                fileNameSpan.textContent = selectedFile.name;
            } else {
                fileNameSpan.textContent = 'No file selected';
            }
        });

        const modal = new Modal({
            title: 'Import from Trello',
            content,
            buttons: [
                {
                    text: 'Cancel',
                    className: 'btn--secondary',
                    onClick: (m) => m.close()
                },
                {
                    text: 'Import',
                    className: 'btn--primary',
                    onClick: async (m) => {
                        if (!selectedFile) {
                            Toast.warning('Please select a file first.');
                            return;
                        }

                        try {
                            const trelloData = await TrelloImporter.readFile(selectedFile);

                            if (!TrelloImporter.isValidTrelloExport(trelloData)) {
                                Toast.error('This does not appear to be a valid Trello export file.');
                                return;
                            }

                            const result = TrelloImporter.import(this.store, trelloData);

                            m.close();
                            Toast.success(
                                `Imported "${result.boardName}" with ${result.listsImported} lists and ${result.cardsImported} cards!`
                            );

                            // Navigate to the new dashboard
                            router.navigate(`/board/${result.dashboardId}`);
                        } catch (err) {
                            Toast.error(err.message || 'Failed to import file.');
                        }
                    }
                }
            ]
        });
    }

    /**
     * Clean up component
     */
    destroy() {
        if (this._unsubscribe) {
            this._unsubscribe();
        }
        DOM.clear(this.container);
    }
}

// Make available globally
window.DashboardGalleryComponent = DashboardGalleryComponent;
