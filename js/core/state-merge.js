/**
 * State Merge
 *
 * Reconciles two versions of the vault that were edited at the same time on
 * different screens. This runs in the browser because it has to: the server is
 * blind - it only ever holds ciphertext - so it cannot merge anything itself.
 *
 * Strategy: last-write-wins per entity, using `updatedAt`.
 *
 *   - Every record (dashboard, list, item) is compared independently, so edits
 *     to different cards on different screens all survive.
 *   - Deletes are tombstones (`deleted: true`), never removals, so a delete on
 *     one screen is not resurrected by a peer that still remembers the record.
 *   - Ordering arrays travel with the record that owns them, then get repaired
 *     so entries created by the losing side are not dropped.
 *
 * Known limit: granularity is the record. If two screens edit the *same* card's
 * title concurrently, the later edit wins outright - there is no text-level
 * merge. Anything finer would need CRDTs and a different state shape.
 */
class StateMerge {
    /**
     * Entity collections that are merged record-by-record
     */
    static ENTITY_MAPS = ['dashboards', 'lists', 'items'];

    /**
     * Merge two vault states into one.
     *
     * Neither input is mutated.
     *
     * @param {Object} local - This screen's state
     * @param {Object} remote - State just loaded from the server
     * @returns {{state: Object, changed: boolean}} Merged state, and whether it
     *          differs from `local` (i.e. whether the UI needs to re-render)
     */
    static merge(local, remote) {
        if (!remote) return { state: local, changed: false };
        if (!local) return { state: remote, changed: true };

        const merged = {
            version: Math.max(local.version || 1, remote.version || 1),
            dashboards: {},
            lists: {},
            items: {},
            dashboardOrder: [],
            tagLibrary: {}
        };

        // Records: newest wins, per entity
        for (const mapName of StateMerge.ENTITY_MAPS) {
            merged[mapName] = StateMerge._mergeEntityMap(
                local[mapName] || {},
                remote[mapName] || {}
            );
        }

        // Child ordering rides along with the winning parent, then is repaired
        // against the merged records so nothing created on either side is lost.
        for (const dashboard of Object.values(merged.dashboards)) {
            dashboard.listIds = StateMerge._mergeOrder(
                dashboard.listIds,
                (local.dashboards || {})[dashboard.id]?.listIds,
                (remote.dashboards || {})[dashboard.id]?.listIds,
                merged.lists
            );
        }

        for (const list of Object.values(merged.lists)) {
            list.itemIds = StateMerge._mergeOrder(
                list.itemIds,
                (local.lists || {})[list.id]?.itemIds,
                (remote.lists || {})[list.id]?.itemIds,
                merged.items
            );
        }

        for (const item of Object.values(merged.items)) {
            if (item.type !== 'folder' || !item.subItemIds) continue;
            item.subItemIds = StateMerge._mergeOrder(
                item.subItemIds,
                (local.items || {})[item.id]?.subItemIds,
                (remote.items || {})[item.id]?.subItemIds,
                merged.items
            );
        }

        // Top-level dashboard ordering, timestamped by its own marker
        const localOrderAt = local.orderUpdatedAt || 0;
        const remoteOrderAt = remote.orderUpdatedAt || 0;
        const winningOrder = remoteOrderAt > localOrderAt ? remote.dashboardOrder : local.dashboardOrder;

        merged.orderUpdatedAt = Math.max(localOrderAt, remoteOrderAt);
        merged.dashboardOrder = StateMerge._mergeOrder(
            winningOrder,
            local.dashboardOrder,
            remote.dashboardOrder,
            merged.dashboards
        );

        merged.tagLibrary = StateMerge._mergeTagLibrary(local.tagLibrary, remote.tagLibrary);

        return {
            state: merged,
            changed: !StateMerge._equivalent(merged, local)
        };
    }

    /**
     * Structural comparison, insensitive to key order.
     *
     * The merged object is rebuilt from scratch, so its keys rarely land in the
     * same order as the original. Comparing serialised forms would therefore
     * report a change on every merge and re-render the board for nothing.
     *
     * @private
     */
    static _equivalent(a, b) {
        if (a === b) return true;
        if (a === null || b === null || typeof a !== 'object' || typeof b !== 'object') {
            return a === b;
        }

        if (Array.isArray(a) || Array.isArray(b)) {
            if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
            return a.every((value, i) => StateMerge._equivalent(value, b[i]));
        }

        // Keys explicitly set to undefined are treated as absent
        const keysOf = (o) => Object.keys(o).filter(k => o[k] !== undefined);
        const aKeys = keysOf(a);
        const bKeys = keysOf(b);
        if (aKeys.length !== bKeys.length) return false;

        return aKeys.every(key =>
            Object.prototype.hasOwnProperty.call(b, key) && StateMerge._equivalent(a[key], b[key])
        );
    }

    /**
     * Merge one collection of records, newest `updatedAt` wins.
     *
     * A tombstone wins ties: when both sides carry the same timestamp but one
     * says deleted, the delete stands. Removing something twice is harmless;
     * resurrecting it is not.
     *
     * @private
     */
    static _mergeEntityMap(localMap, remoteMap) {
        const merged = {};
        const ids = new Set([...Object.keys(localMap), ...Object.keys(remoteMap)]);

        for (const id of ids) {
            const localRecord = localMap[id];
            const remoteRecord = remoteMap[id];

            if (!localRecord) {
                merged[id] = StateMerge._clone(remoteRecord);
                continue;
            }
            if (!remoteRecord) {
                merged[id] = StateMerge._clone(localRecord);
                continue;
            }

            const localAt = StateMerge._stamp(localRecord);
            const remoteAt = StateMerge._stamp(remoteRecord);

            let winner;
            if (remoteAt > localAt) {
                winner = remoteRecord;
            } else if (localAt > remoteAt) {
                winner = localRecord;
            } else {
                // Same timestamp: prefer whichever side deleted it
                winner = remoteRecord.deleted ? remoteRecord : localRecord;
            }

            merged[id] = StateMerge._clone(winner);

            // A delete from either side always sticks, even if the other side
            // has a newer edit - the user asked for it to be gone.
            if (localRecord.deleted || remoteRecord.deleted) {
                merged[id].deleted = true;
            }
        }

        return merged;
    }

    /**
     * Reconcile an ordering array.
     *
     * Takes the winning side's order as the baseline, drops ids that no longer
     * point at a live record, then re-inserts ids that exist only in the other
     * version - placed after the neighbour they followed there, so a card added
     * on the losing screen lands where it was put rather than at the bottom.
     *
     * @param {string[]} winning - Order from the record that won the merge
     * @param {string[]} localOrder - Order as this screen had it
     * @param {string[]} remoteOrder - Order as the server had it
     * @param {Object} entities - Merged records this order points into
     * @private
     */
    static _mergeOrder(winning, localOrder, remoteOrder, entities) {
        const isLive = (id) => entities[id] && !entities[id].deleted;

        const result = (winning || []).filter(isLive);
        const present = new Set(result);

        // Re-insertion is idempotent (ids already present are skipped), so both
        // sides can be replayed over the baseline without tracking which one won.
        for (const source of [localOrder || [], remoteOrder || []]) {
            source.forEach((id, index) => {
                if (present.has(id) || !isLive(id)) return;

                // Slot in right after the nearest preceding entry that made it
                // into the result; fall back to the end.
                let insertAt = result.length;
                for (let i = index - 1; i >= 0; i--) {
                    const anchor = result.indexOf(source[i]);
                    if (anchor > -1) {
                        insertAt = anchor + 1;
                        break;
                    }
                }

                result.splice(insertAt, 0, id);
                present.add(id);
            });
        }

        return result;
    }

    /**
     * Merge remembered tags, keeping the most recent sighting of each label
     * @private
     */
    static _mergeTagLibrary(localLibrary, remoteLibrary) {
        const merged = {};

        for (const [key, tag] of Object.entries(localLibrary || {})) {
            if (tag) merged[key] = StateMerge._clone(tag);
        }

        for (const [key, tag] of Object.entries(remoteLibrary || {})) {
            if (!tag) continue;
            const existing = merged[key];
            if (!existing || (tag.lastUsed || 0) > (existing.lastUsed || 0)) {
                merged[key] = StateMerge._clone(tag);
            }
        }

        return merged;
    }

    /**
     * Timestamp used to rank a record. Falls back to creation time for records
     * written before every mutation stamped `updatedAt`.
     * @private
     */
    static _stamp(record) {
        return record.updatedAt || record.createdAt || 0;
    }

    /**
     * @private
     */
    static _clone(value) {
        return JSON.parse(JSON.stringify(value));
    }
}

// Make available globally
window.StateMerge = StateMerge;
