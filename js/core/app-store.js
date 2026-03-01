/**
 * App Store
 * Central state management with persistence to BlindBase
 */
class AppStore {
    constructor(blindBaseClient) {
        this.client = blindBaseClient;
        this.state = null;
        this.subscribers = new Set();
        this.saveStatus = 'idle'; // idle | saving | saved | error

        // Debounced save function (2 second delay)
        this._debouncedSave = debounce(() => this._persistState(), 2000);
    }

    /**
     * Initialize store with loaded data or empty state
     * @param {Object|null} loadedData - Data from BlindBase
     */
    init(loadedData) {
        this.state = loadedData || this._getEmptyState();
        this._cleanupDuplicateItemIds();
        this._notify();
        eventBus.emit(Events.STATE_LOADED, this.state);
    }

    /**
     * Remove duplicate item IDs from all lists and folder subItemIds
     * Fixes any corrupted state from previous bugs
     */
    _cleanupDuplicateItemIds() {
        let hadDuplicates = false;
        const seenItems = new Set();

        for (const list of Object.values(this.state.lists)) {
            if (list.deleted) continue;

            // Deduplicate within this list
            const uniqueIds = [];
            for (const itemId of list.itemIds) {
                if (!uniqueIds.includes(itemId)) {
                    uniqueIds.push(itemId);
                } else {
                    hadDuplicates = true;
                }
            }
            list.itemIds = uniqueIds;

            // Also ensure each item only appears in one list
            for (let i = list.itemIds.length - 1; i >= 0; i--) {
                const itemId = list.itemIds[i];
                if (seenItems.has(itemId)) {
                    // Item already in another list, remove from this one
                    list.itemIds.splice(i, 1);
                    hadDuplicates = true;
                } else {
                    seenItems.add(itemId);
                }
            }
        }

        // Deduplicate within folder subItemIds
        for (const item of Object.values(this.state.items)) {
            if (item.deleted || item.type !== 'folder' || !item.subItemIds) continue;

            const uniqueSubIds = [];
            for (const subId of item.subItemIds) {
                if (!uniqueSubIds.includes(subId)) {
                    uniqueSubIds.push(subId);
                } else {
                    hadDuplicates = true;
                }
            }
            item.subItemIds = uniqueSubIds;

            // Ensure sub-items don't also appear in list.itemIds or other folders
            for (let i = item.subItemIds.length - 1; i >= 0; i--) {
                const subId = item.subItemIds[i];
                if (seenItems.has(subId)) {
                    item.subItemIds.splice(i, 1);
                    hadDuplicates = true;
                } else {
                    seenItems.add(subId);
                }
            }
        }

        if (hadDuplicates) {
            console.log('Cleaned up duplicate item IDs in lists');
            this._triggerSave();
        }
    }

    /**
     * Get empty initial state
     * @returns {Object}
     */
    _getEmptyState() {
        return {
            version: 1,
            dashboards: {},
            lists: {},
            items: {},
            dashboardOrder: []
        };
    }

    // =========================================================================
    // SUBSCRIPTION
    // =========================================================================

    /**
     * Subscribe to state changes
     * @param {Function} callback
     * @returns {Function} Unsubscribe function
     */
    subscribe(callback) {
        this.subscribers.add(callback);
        return () => this.subscribers.delete(callback);
    }

    /**
     * Notify all subscribers of state change
     */
    _notify() {
        this.subscribers.forEach(callback => {
            try {
                callback(this.state);
            } catch (error) {
                console.error('Error in store subscriber:', error);
            }
        });
        eventBus.emit(Events.STATE_CHANGED, this.state);
    }

    /**
     * Trigger save operation (debounced)
     */
    _triggerSave() {
        this.saveStatus = 'saving';
        eventBus.emit(Events.SAVE_STATUS, this.saveStatus);
        this._debouncedSave();
    }

    /**
     * Persist state to BlindBase
     */
    async _persistState() {
        try {
            await this.client.save(this.state);
            this.saveStatus = 'saved';
            eventBus.emit(Events.SAVE_STATUS, this.saveStatus);

            // Reset to idle after 2 seconds
            setTimeout(() => {
                if (this.saveStatus === 'saved') {
                    this.saveStatus = 'idle';
                    eventBus.emit(Events.SAVE_STATUS, this.saveStatus);
                }
            }, 2000);
        } catch (error) {
            console.error('Save failed:', error);
            this.saveStatus = 'error';
            eventBus.emit(Events.SAVE_STATUS, this.saveStatus);
            eventBus.emit(Events.SAVE_ERROR, error);

            // Retry after 5 seconds
            setTimeout(() => this._debouncedSave(), 5000);
        }
    }

    // =========================================================================
    // DASHBOARD OPERATIONS
    // =========================================================================

    /**
     * Add a new dashboard
     * @param {string} title
     * @returns {string} New dashboard ID
     */
    addDashboard(title) {
        const id = IdGenerator.dashboard();
        const now = Date.now();

        this.state.dashboards[id] = {
            id,
            title: title.trim(),
            listIds: [],
            deleted: false,
            createdAt: now
        };
        this.state.dashboardOrder.push(id);

        this._notify();
        this._triggerSave();
        return id;
    }

    /**
     * Update a dashboard
     * @param {string} id - Dashboard ID
     * @param {Object} updates - Fields to update
     */
    updateDashboard(id, updates) {
        if (!this.state.dashboards[id]) return;

        Object.assign(this.state.dashboards[id], updates);

        this._notify();
        this._triggerSave();
    }

    /**
     * Soft delete a dashboard
     * @param {string} id - Dashboard ID
     */
    deleteDashboard(id) {
        if (!this.state.dashboards[id]) return;

        this.state.dashboards[id].deleted = true;

        // Also soft delete all lists and items in this dashboard
        const dashboard = this.state.dashboards[id];
        dashboard.listIds.forEach(listId => {
            if (this.state.lists[listId]) {
                this.state.lists[listId].deleted = true;
                this.state.lists[listId].itemIds.forEach(itemId => {
                    if (this.state.items[itemId]) {
                        const item = this.state.items[itemId];
                        // If folder, also delete sub-items
                        if (item.type === 'folder' && item.subItemIds) {
                            item.subItemIds.forEach(subId => {
                                if (this.state.items[subId]) {
                                    this.state.items[subId].deleted = true;
                                }
                            });
                        }
                        item.deleted = true;
                    }
                });
            }
        });

        this._notify();
        this._triggerSave();
    }

    /**
     * Reorder dashboards
     * @param {string[]} newOrder - New dashboard ID order
     */
    reorderDashboards(newOrder) {
        this.state.dashboardOrder = newOrder;

        this._notify();
        this._triggerSave();
    }

    // =========================================================================
    // LIST OPERATIONS
    // =========================================================================

    /**
     * Add a new list to a dashboard
     * @param {string} dashboardId
     * @param {string} title
     * @returns {string} New list ID
     */
    addList(dashboardId, title) {
        const dashboard = this.state.dashboards[dashboardId];
        if (!dashboard) return null;

        const id = IdGenerator.list();
        const now = Date.now();

        this.state.lists[id] = {
            id,
            title: title.trim(),
            itemIds: [],
            deleted: false,
            createdAt: now
        };
        dashboard.listIds.push(id);

        this._notify();
        this._triggerSave();
        return id;
    }

    /**
     * Update a list
     * @param {string} id - List ID
     * @param {Object} updates - Fields to update
     */
    updateList(id, updates) {
        if (!this.state.lists[id]) return;

        Object.assign(this.state.lists[id], updates);

        this._notify();
        this._triggerSave();
    }

    /**
     * Soft delete a list (cascades to folder sub-items)
     * @param {string} id - List ID
     */
    deleteList(id) {
        if (!this.state.lists[id]) return;

        this.state.lists[id].deleted = true;

        // Also soft delete all items in this list
        this.state.lists[id].itemIds.forEach(itemId => {
            if (this.state.items[itemId]) {
                // If folder, also delete sub-items
                const item = this.state.items[itemId];
                if (item.type === 'folder' && item.subItemIds) {
                    item.subItemIds.forEach(subId => {
                        if (this.state.items[subId]) {
                            this.state.items[subId].deleted = true;
                        }
                    });
                }
                item.deleted = true;
            }
        });

        this._notify();
        this._triggerSave();
    }

    /**
     * Move a list to another dashboard
     * @param {string} listId
     * @param {string} fromDashboardId
     * @param {string} toDashboardId
     * @param {number} newIndex - Position in target dashboard
     */
    moveListToDashboard(listId, fromDashboardId, toDashboardId, newIndex = -1) {
        const fromDashboard = this.state.dashboards[fromDashboardId];
        const toDashboard = this.state.dashboards[toDashboardId];

        if (!fromDashboard || !toDashboard) return;

        // Remove from source
        const oldIndex = fromDashboard.listIds.indexOf(listId);
        if (oldIndex > -1) {
            fromDashboard.listIds.splice(oldIndex, 1);
        }

        // Add to target
        if (newIndex === -1 || newIndex >= toDashboard.listIds.length) {
            toDashboard.listIds.push(listId);
        } else {
            toDashboard.listIds.splice(newIndex, 0, listId);
        }

        this._notify();
        this._triggerSave();
    }

    /**
     * Reorder lists within a dashboard
     * @param {string} dashboardId
     * @param {number} oldIndex
     * @param {number} newIndex
     */
    reorderList(dashboardId, oldIndex, newIndex) {
        const dashboard = this.state.dashboards[dashboardId];
        if (!dashboard) return;

        const [removed] = dashboard.listIds.splice(oldIndex, 1);
        dashboard.listIds.splice(newIndex, 0, removed);

        this._notify();
        this._triggerSave();
    }

    // =========================================================================
    // ITEM OPERATIONS
    // =========================================================================

    /**
     * Add a new item to a list
     * @param {string} listId
     * @param {string} title
     * @param {string} [desc='']
     * @param {boolean} [addToTop=false] - Add item at the top of the list
     * @returns {string} New item ID
     */
    addItem(listId, title, desc = '', addToTop = false) {
        const list = this.state.lists[listId];
        if (!list) return null;

        const id = IdGenerator.item();
        const now = Date.now();

        this.state.items[id] = {
            id,
            title: title.trim(),
            desc: desc.trim(),
            deleted: false,
            createdAt: now,
            updatedAt: now
        };

        if (addToTop) {
            list.itemIds.unshift(id);
        } else {
            list.itemIds.push(id);
        }

        this._notify();
        this._triggerSave();
        return id;
    }

    /**
     * Update an item
     * @param {string} id - Item ID
     * @param {Object} updates - Fields to update
     */
    updateItem(id, updates) {
        if (!this.state.items[id]) return;

        Object.assign(this.state.items[id], updates, {
            updatedAt: Date.now()
        });

        this._notify();
        this._triggerSave();
    }

    /**
     * Soft delete an item (cascades to sub-items if folder)
     * @param {string} id - Item ID
     */
    deleteItem(id) {
        if (!this.state.items[id]) return;

        const now = Date.now();
        const item = this.state.items[id];

        // If this is a folder, cascade delete to all sub-items
        if (item.type === 'folder' && item.subItemIds) {
            item.subItemIds.forEach(subId => {
                if (this.state.items[subId]) {
                    this.state.items[subId].deleted = true;
                    this.state.items[subId].updatedAt = now;
                }
            });
        }

        item.deleted = true;
        item.updatedAt = now;

        this._notify();
        this._triggerSave();
    }

    /**
     * Soft delete all items in a list (cascades to folder sub-items)
     * @param {string} listId - List ID
     */
    clearListItems(listId) {
        const list = this.state.lists[listId];
        if (!list) return;

        const now = Date.now();
        list.itemIds.forEach(itemId => {
            const item = this.state.items[itemId];
            if (item && !item.deleted) {
                // If folder, also delete sub-items
                if (item.type === 'folder' && item.subItemIds) {
                    item.subItemIds.forEach(subId => {
                        if (this.state.items[subId]) {
                            this.state.items[subId].deleted = true;
                            this.state.items[subId].updatedAt = now;
                        }
                    });
                }
                item.deleted = true;
                item.updatedAt = now;
            }
        });

        this._notify();
        this._triggerSave();
    }

    /**
     * Move an item to another list
     * @param {string} itemId
     * @param {string} fromListId
     * @param {string} toListId
     * @param {number} newIndex - Position in target list
     */
    moveItem(itemId, fromListId, toListId, newIndex) {
        const toList = this.state.lists[toListId];

        if (!toList) return;

        // Remove item from ALL lists to prevent duplicates
        // This handles cases where the item might be in multiple lists due to race conditions
        for (const list of Object.values(this.state.lists)) {
            if (list.deleted) continue;
            const index = list.itemIds.indexOf(itemId);
            if (index > -1) {
                list.itemIds.splice(index, 1);
            }
        }

        // Also remove from any folder's subItemIds
        for (const item of Object.values(this.state.items)) {
            if (item.deleted || item.type !== 'folder' || !item.subItemIds) continue;
            const index = item.subItemIds.indexOf(itemId);
            if (index > -1) {
                item.subItemIds.splice(index, 1);
            }
        }

        // Only add to target if not already there (defensive check)
        if (!toList.itemIds.includes(itemId)) {
            if (newIndex === undefined || newIndex >= toList.itemIds.length) {
                toList.itemIds.push(itemId);
            } else {
                toList.itemIds.splice(newIndex, 0, itemId);
            }
        }

        this.state.items[itemId].updatedAt = Date.now();

        this._notify();
        this._triggerSave();
    }

    /**
     * Reorder items within a list
     * @param {string} listId
     * @param {number} oldIndex
     * @param {number} newIndex
     */
    reorderItem(listId, oldIndex, newIndex) {
        const list = this.state.lists[listId];
        if (!list) return;

        const [removed] = list.itemIds.splice(oldIndex, 1);
        list.itemIds.splice(newIndex, 0, removed);

        this._notify();
        this._triggerSave();
    }

    /**
     * Move all items from one list to another
     * @param {string} fromListId - Source list
     * @param {string} toListId - Target list
     */
    moveAllItems(fromListId, toListId) {
        const fromList = this.state.lists[fromListId];
        const toList = this.state.lists[toListId];

        if (!fromList || !toList) return;
        if (fromListId === toListId) return;

        // Get all non-deleted item IDs from source list
        const itemIdsToMove = fromList.itemIds.filter(id => {
            const item = this.state.items[id];
            return item && !item.deleted;
        });

        if (itemIdsToMove.length === 0) return;

        const now = Date.now();

        // Remove items from source and add to target
        itemIdsToMove.forEach(itemId => {
            // Remove from source
            const index = fromList.itemIds.indexOf(itemId);
            if (index > -1) {
                fromList.itemIds.splice(index, 1);
            }

            // Add to target (at the end)
            if (!toList.itemIds.includes(itemId)) {
                toList.itemIds.push(itemId);
            }

            // Update timestamp
            this.state.items[itemId].updatedAt = now;
        });

        this._notify();
        this._triggerSave();

        return itemIdsToMove.length;
    }

    // =========================================================================
    // FOLDER OPERATIONS
    // =========================================================================

    /**
     * Add a new folder item to a list
     * @param {string} listId
     * @param {string} title
     * @param {boolean} [addToTop=false]
     * @returns {string} New folder item ID
     */
    addFolder(listId, title, addToTop = false) {
        const list = this.state.lists[listId];
        if (!list) return null;

        const id = IdGenerator.item();
        const now = Date.now();

        this.state.items[id] = {
            id,
            type: 'folder',
            title: title.trim(),
            desc: '',
            deleted: false,
            createdAt: now,
            updatedAt: now,
            subItemIds: []
        };

        if (addToTop) {
            list.itemIds.unshift(id);
        } else {
            list.itemIds.push(id);
        }

        this._notify();
        this._triggerSave();
        return id;
    }

    /**
     * Add a new item as a sub-item of a folder
     * @param {string} folderId
     * @param {string} title
     * @param {string} [desc='']
     * @param {boolean} [addToTop=false]
     * @returns {string} New item ID
     */
    addItemToFolder(folderId, title, desc = '', addToTop = false) {
        const folder = this.state.items[folderId];
        if (!folder || folder.deleted || folder.type !== 'folder') return null;

        const id = IdGenerator.item();
        const now = Date.now();

        this.state.items[id] = {
            id,
            title: title.trim(),
            desc: desc.trim(),
            deleted: false,
            createdAt: now,
            updatedAt: now
        };

        if (addToTop) {
            folder.subItemIds.unshift(id);
        } else {
            folder.subItemIds.push(id);
        }

        folder.updatedAt = now;

        this._notify();
        this._triggerSave();
        return id;
    }

    /**
     * Move an existing item into a folder's subItemIds
     * @param {string} itemId
     * @param {string} folderId
     */
    moveItemToFolder(itemId, folderId) {
        const item = this.state.items[itemId];
        const folder = this.state.items[folderId];

        if (!item || item.deleted) return;
        if (!folder || folder.deleted || folder.type !== 'folder') return;
        // Prevent folders from being nested
        if (item.type === 'folder') return;

        // Remove from all lists
        for (const list of Object.values(this.state.lists)) {
            if (list.deleted) continue;
            const index = list.itemIds.indexOf(itemId);
            if (index > -1) {
                list.itemIds.splice(index, 1);
            }
        }

        // Remove from any other folder's subItemIds
        for (const otherItem of Object.values(this.state.items)) {
            if (otherItem.deleted || otherItem.type !== 'folder' || !otherItem.subItemIds) continue;
            const index = otherItem.subItemIds.indexOf(itemId);
            if (index > -1) {
                otherItem.subItemIds.splice(index, 1);
            }
        }

        // Add to target folder
        if (!folder.subItemIds.includes(itemId)) {
            folder.subItemIds.push(itemId);
        }

        const now = Date.now();
        item.updatedAt = now;
        folder.updatedAt = now;

        this._notify();
        this._triggerSave();
    }

    /**
     * Move an item from a folder back to a list
     * @param {string} itemId
     * @param {string} folderId
     * @param {string} targetListId
     * @param {number} [index] - Position in target list (defaults to after the folder)
     */
    removeItemFromFolder(itemId, folderId, targetListId, index) {
        const folder = this.state.items[folderId];
        const targetList = this.state.lists[targetListId];

        if (!folder || folder.type !== 'folder' || !targetList) return;

        // Remove from folder
        const subIndex = folder.subItemIds.indexOf(itemId);
        if (subIndex > -1) {
            folder.subItemIds.splice(subIndex, 1);
        }

        // If no explicit index, place after the folder in the target list
        if (index === undefined) {
            const folderIndex = targetList.itemIds.indexOf(folderId);
            index = folderIndex > -1 ? folderIndex + 1 : targetList.itemIds.length;
        }

        // Add to target list
        if (!targetList.itemIds.includes(itemId)) {
            if (index >= targetList.itemIds.length) {
                targetList.itemIds.push(itemId);
            } else {
                targetList.itemIds.splice(index, 0, itemId);
            }
        }

        const now = Date.now();
        this.state.items[itemId].updatedAt = now;
        folder.updatedAt = now;

        this._notify();
        this._triggerSave();
    }

    /**
     * Dissolve a folder: move all sub-items back to parent list, then delete the folder
     * @param {string} folderId
     * @param {string} listId - The list containing the folder
     */
    ungroupFolder(folderId, listId) {
        const folder = this.state.items[folderId];
        const list = this.state.lists[listId];

        if (!folder || folder.type !== 'folder' || !list) return;

        const folderIndex = list.itemIds.indexOf(folderId);
        if (folderIndex === -1) return;

        const now = Date.now();

        // Get active sub-items
        const activeSubItemIds = folder.subItemIds.filter(id => {
            const item = this.state.items[id];
            return item && !item.deleted;
        });

        // Insert sub-items at folder's position (replacing the folder)
        list.itemIds.splice(folderIndex, 1, ...activeSubItemIds);

        // Update timestamps
        activeSubItemIds.forEach(id => {
            this.state.items[id].updatedAt = now;
        });

        // Clear folder's subItemIds and soft delete it
        folder.subItemIds = [];
        folder.deleted = true;
        folder.updatedAt = now;

        this._notify();
        this._triggerSave();
    }

    /**
     * Get active items for a folder
     * @param {string} folderId
     * @param {boolean} [showSnoozed=false]
     * @returns {Object[]}
     */
    getItemsForFolder(folderId, showSnoozed = false) {
        const folder = this.state.items[folderId];
        if (!folder || folder.type !== 'folder' || !folder.subItemIds) return [];

        const now = Date.now();
        return folder.subItemIds
            .map(id => this.state.items[id])
            .filter(i => {
                if (!i || i.deleted) return false;
                if (showSnoozed) return true;
                if (i.snoozedUntil && i.snoozedUntil > now) return false;
                return true;
            });
    }

    /**
     * Reorder items within a folder
     * @param {string} folderId
     * @param {number} oldIndex
     * @param {number} newIndex
     */
    reorderFolderItem(folderId, oldIndex, newIndex) {
        const folder = this.state.items[folderId];
        if (!folder || folder.type !== 'folder' || !folder.subItemIds) return;

        const [removed] = folder.subItemIds.splice(oldIndex, 1);
        folder.subItemIds.splice(newIndex, 0, removed);

        folder.updatedAt = Date.now();

        this._notify();
        this._triggerSave();
    }

    /**
     * Find which folder contains a given item
     * @param {string} itemId
     * @returns {string|null} Folder item ID or null
     */
    findFolderContainingItem(itemId) {
        for (const [id, item] of Object.entries(this.state.items)) {
            if (item.deleted || item.type !== 'folder' || !item.subItemIds) continue;
            if (item.subItemIds.includes(itemId)) {
                return id;
            }
        }
        return null;
    }

    /**
     * Get the count of active sub-items in a folder
     * @param {string} folderId
     * @returns {number}
     */
    getFolderItemCount(folderId) {
        const folder = this.state.items[folderId];
        if (!folder || folder.type !== 'folder' || !folder.subItemIds) return 0;

        return folder.subItemIds.filter(id => {
            const item = this.state.items[id];
            return item && !item.deleted;
        }).length;
    }

    // =========================================================================
    // GETTERS (Filter deleted items)
    // =========================================================================

    /**
     * Get all active dashboards in order
     * @returns {Object[]}
     */
    getActiveDashboards() {
        return this.state.dashboardOrder
            .map(id => this.state.dashboards[id])
            .filter(d => d && !d.deleted);
    }

    /**
     * Get a dashboard by ID (if not deleted)
     * @param {string} id
     * @returns {Object|null}
     */
    getDashboard(id) {
        const d = this.state.dashboards[id];
        return (d && !d.deleted) ? d : null;
    }

    /**
     * Get all active lists for a dashboard
     * @param {string} dashboardId
     * @param {boolean} [showSnoozed=false] - Include snoozed lists
     * @returns {Object[]}
     */
    getListsForDashboard(dashboardId, showSnoozed = false) {
        const dashboard = this.state.dashboards[dashboardId];
        if (!dashboard) return [];

        const now = Date.now();
        return dashboard.listIds
            .map(id => this.state.lists[id])
            .filter(l => {
                if (!l || l.deleted) return false;
                if (showSnoozed) return true;
                if (l.snoozedUntil && l.snoozedUntil > now) return false;
                return true;
            });
    }

    /**
     * Get a list by ID (if not deleted)
     * @param {string} id
     * @returns {Object|null}
     */
    getList(id) {
        const l = this.state.lists[id];
        return (l && !l.deleted) ? l : null;
    }

    /**
     * Get all active items for a list
     * @param {string} listId
     * @param {boolean} [showSnoozed=false] - Include snoozed items
     * @returns {Object[]}
     */
    getItemsForList(listId, showSnoozed = false) {
        const list = this.state.lists[listId];
        if (!list) return [];

        const now = Date.now();
        return list.itemIds
            .map(id => this.state.items[id])
            .filter(i => {
                if (!i || i.deleted) return false;
                // If showSnoozed is true, include all non-deleted items
                if (showSnoozed) return true;
                // Otherwise, filter out items that are currently snoozed
                if (i.snoozedUntil && i.snoozedUntil > now) return false;
                return true;
            });
    }

    /**
     * Check if an item is currently snoozed
     * @param {string} id - Item ID
     * @returns {boolean}
     */
    isItemSnoozed(id) {
        const item = this.state.items[id];
        if (!item || item.deleted) return false;
        return item.snoozedUntil && item.snoozedUntil > Date.now();
    }

    /**
     * Snooze an item until a specific time
     * @param {string} id - Item ID
     * @param {number} until - Timestamp when snooze ends
     */
    snoozeItem(id, until) {
        if (!this.state.items[id]) return;

        this.state.items[id].snoozedUntil = until;
        this.state.items[id].updatedAt = Date.now();

        this._notify();
        this._triggerSave();
    }

    /**
     * Remove snooze from an item
     * @param {string} id - Item ID
     */
    unsnoozeItem(id) {
        if (!this.state.items[id]) return;

        this.state.items[id].snoozedUntil = null;
        this.state.items[id].updatedAt = Date.now();

        this._notify();
        this._triggerSave();
    }

    /**
     * Check if a list is currently snoozed
     * @param {string} id - List ID
     * @returns {boolean}
     */
    isListSnoozed(id) {
        const list = this.state.lists[id];
        if (!list || list.deleted) return false;
        return list.snoozedUntil && list.snoozedUntil > Date.now();
    }

    /**
     * Snooze a list until a specific time
     * @param {string} id - List ID
     * @param {number} until - Timestamp when snooze ends
     */
    snoozeList(id, until) {
        if (!this.state.lists[id]) return;

        this.state.lists[id].snoozedUntil = until;

        this._notify();
        this._triggerSave();
    }

    /**
     * Remove snooze from a list
     * @param {string} id - List ID
     */
    unsnoozeList(id) {
        if (!this.state.lists[id]) return;

        this.state.lists[id].snoozedUntil = null;

        this._notify();
        this._triggerSave();
    }

    /**
     * Get an item by ID (if not deleted)
     * @param {string} id
     * @returns {Object|null}
     */
    getItem(id) {
        const i = this.state.items[id];
        return (i && !i.deleted) ? i : null;
    }

    /**
     * Find which list contains a given item
     * @param {string} itemId
     * @returns {string|null} List ID or null
     */
    findListContainingItem(itemId) {
        for (const [listId, list] of Object.entries(this.state.lists)) {
            if (!list.deleted && list.itemIds.includes(itemId)) {
                return listId;
            }
        }
        return null;
    }

    /**
     * Find which dashboard contains a given list
     * @param {string} listId
     * @returns {string|null} Dashboard ID or null
     */
    findDashboardContainingList(listId) {
        for (const [dashboardId, dashboard] of Object.entries(this.state.dashboards)) {
            if (!dashboard.deleted && dashboard.listIds.includes(listId)) {
                return dashboardId;
            }
        }
        return null;
    }
}

// Make available globally
window.AppStore = AppStore;
