/**
 * Dashboard Exporter
 * Exports dashboards to clean JSON format
 */
const DashboardExporter = {
    /**
     * Export all dashboards to a single JSON object
     * @param {AppStore} store
     * @returns {Object} Exported data
     */
    exportAll(store) {
        const dashboards = store.getActiveDashboards();
        const exportedDashboards = dashboards.map(dashboard => this._exportDashboard(store, dashboard));

        return {
            exportedAt: new Date().toISOString(),
            version: 1,
            dashboards: exportedDashboards
        };
    },

    /**
     * Export a single dashboard
     * @param {AppStore} store
     * @param {Object} dashboard
     * @returns {Object}
     */
    _exportDashboard(store, dashboard) {
        const lists = store.getListsForDashboard(dashboard.id);

        return {
            title: dashboard.title,
            createdAt: dashboard.createdAt,
            lists: lists.map(list => this._exportList(store, list))
        };
    },

    /**
     * Export a single list
     * @param {AppStore} store
     * @param {Object} list
     * @returns {Object}
     */
    _exportList(store, list) {
        // Get all items including snoozed
        const items = store.getItemsForList(list.id, true);

        return {
            title: list.title,
            createdAt: list.createdAt,
            items: items.map(item => this._exportItem(item, store))
        };
    },

    /**
     * Export a single item
     * @param {Object} item
     * @param {AppStore} [store] - Store reference (needed for folder sub-items)
     * @returns {Object}
     */
    _exportItem(item, store) {
        const exported = {
            title: item.title,
            createdAt: item.createdAt,
            updatedAt: item.updatedAt
        };

        // Only include description if it exists
        if (item.desc) {
            exported.description = item.desc;
        }

        // Include tags array if set
        if (item.tags && item.tags.length > 0) {
            exported.tags = item.tags;
        } else if (item.tag) {
            // Legacy fallback for old data not yet migrated
            exported.tag = item.tag;
        }

        // Only include snooze info if set
        if (item.snoozedUntil) {
            exported.snoozedUntil = item.snoozedUntil;
            exported.snoozedUntilFormatted = new Date(item.snoozedUntil).toISOString();
        }

        // Export folder-specific data
        if (item.type === 'folder') {
            exported.type = 'folder';
            if (store) {
                const subItems = store.getItemsForFolder(item.id, true);
                exported.subItems = subItems.map(subItem => this._exportItem(subItem));
            } else {
                exported.subItems = [];
            }
        }

        return exported;
    },

    /**
     * Download data as a JSON file
     * @param {Object} data - Data to export
     * @param {string} filename - Filename without extension
     */
    download(data, filename) {
        const json = JSON.stringify(data, null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);

        const link = document.createElement('a');
        link.href = url;
        link.download = `${filename}.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        URL.revokeObjectURL(url);
    },

    /**
     * Export all dashboards and trigger download
     * @param {AppStore} store
     */
    exportAndDownload(store) {
        const data = this.exportAll(store);
        const date = new Date().toISOString().split('T')[0];
        this.download(data, `noc7is-export-${date}`);
    }
};

// Make available globally
window.DashboardExporter = DashboardExporter;
