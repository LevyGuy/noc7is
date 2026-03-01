/**
 * Dashboard Importer
 * Imports dashboards from noc7is JSON export
 */
const DashboardImporter = {
    /**
     * Read a file and parse as JSON
     * @param {File} file
     * @returns {Promise<Object>}
     */
    readFile(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const data = JSON.parse(e.target.result);
                    resolve(data);
                } catch (err) {
                    reject(new Error('Invalid JSON file'));
                }
            };
            reader.onerror = () => reject(new Error('Failed to read file'));
            reader.readAsText(file);
        });
    },

    /**
     * Validate that the data is a valid noc7is export
     * @param {Object} data
     * @returns {boolean}
     */
    isValidExport(data) {
        return (
            data &&
            typeof data === 'object' &&
            data.version &&
            Array.isArray(data.dashboards) &&
            data.dashboards.every(d =>
                d.title &&
                Array.isArray(d.lists)
            )
        );
    },

    /**
     * Normalize tags from imported item (handles both new tags array and legacy tag)
     * @param {Object} item - Imported item data
     * @returns {Array<{color: string|null, label: string}>}
     */
    _normalizeTags(item) {
        if (Array.isArray(item.tags)) return item.tags;
        const tag = item.tag;
        if (typeof tag === 'string') return [{ color: tag, label: tag }];
        if (tag && typeof tag === 'object') return [{ color: tag.color || null, label: tag.label || '' }];
        return [];
    },

    /**
     * Import dashboards from export data
     * @param {AppStore} store
     * @param {Object} data - Exported data
     * @returns {Object} Import result
     */
    import(store, data) {
        let dashboardsImported = 0;
        let listsImported = 0;
        let itemsImported = 0;

        data.dashboards.forEach(dashboard => {
            // Create dashboard
            const dashboardId = store.addDashboard(dashboard.title);
            dashboardsImported++;

            // Create lists
            dashboard.lists.forEach(list => {
                const listId = store.addList(dashboardId, list.title);
                listsImported++;

                // Create items
                list.items.forEach(item => {
                    if (item.type === 'folder') {
                        // Create folder
                        const folderId = store.addFolder(listId, item.title);
                        itemsImported++;

                        // Restore folder properties
                        const folderTags = DashboardImporter._normalizeTags(item);
                        if (item.description || folderTags.length > 0) {
                            store.updateItem(folderId, {
                                desc: item.description || '',
                                tags: folderTags
                            });
                        }

                        // Create sub-items
                        if (item.subItems && Array.isArray(item.subItems)) {
                            item.subItems.forEach(subItem => {
                                const subId = store.addItemToFolder(folderId, subItem.title, subItem.description || '');
                                itemsImported++;

                                const subTags = DashboardImporter._normalizeTags(subItem);
                                if (subTags.length > 0) {
                                    store.updateItem(subId, { tags: subTags });
                                }

                                if (subItem.snoozedUntil && subItem.snoozedUntil > Date.now()) {
                                    store.snoozeItem(subId, subItem.snoozedUntil);
                                }
                            });
                        }

                        // Restore folder snooze
                        if (item.snoozedUntil && item.snoozedUntil > Date.now()) {
                            store.snoozeItem(folderId, item.snoozedUntil);
                        }
                    } else {
                        const itemId = store.addItem(listId, item.title, item.description || '');
                        itemsImported++;

                        // Restore tags if present
                        const itemTags = DashboardImporter._normalizeTags(item);
                        if (itemTags.length > 0) {
                            store.updateItem(itemId, { tags: itemTags });
                        }

                        // Restore snooze if present
                        if (item.snoozedUntil && item.snoozedUntil > Date.now()) {
                            store.snoozeItem(itemId, item.snoozedUntil);
                        }
                    }
                });
            });
        });

        return {
            dashboardsImported,
            listsImported,
            itemsImported
        };
    }
};

// Make available globally
window.DashboardImporter = DashboardImporter;
