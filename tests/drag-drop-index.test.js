/**
 * Regression test for drag-and-drop drop-position bugs.
 *
 * Bug: the drop handlers computed the insertion index from visible DOM rows
 * and applied it to the store's full itemIds/listIds arrays, which also
 * contain hidden entries (snoozed and soft-deleted ids). It also subtracted
 * one extra position on downward same-list moves. Items landed above the
 * position the user dropped them at.
 *
 * Run with: node tests/drag-drop-index.test.js
 */
const fs = require('fs');
const path = require('path');

// Load the real DragManager with minimal browser stubs
const source = fs.readFileSync(path.join(__dirname, '../js/drag-drop/drag-manager.js'), 'utf8');
const windowStub = {};
new Function('window', 'eventBus', 'Events', source)(
    windowStub,
    { emit() {} },
    { DRAG_START: 'drag:start', DRAG_END: 'drag:end' }
);
const DragManager = windowStub.DragManager;

// Fake store mirroring app-store.js semantics exactly:
// - itemIds may contain ids of snoozed/soft-deleted items (not rendered)
// - reorderItem/reorderList: splice out oldIndex, then insert at newIndex
// - moveItem: remove from all lists, then splice at newIndex (or push)
function makeStore(lists) {
    return {
        lists,
        getList(id) { return this.lists[id]; },
        getItem() { return { type: 'task' }; },
        reorderItem(listId, oldIndex, newIndex) {
            const a = this.lists[listId].itemIds;
            const [removed] = a.splice(oldIndex, 1);
            a.splice(newIndex, 0, removed);
        },
        moveItem(itemId, fromListId, toListId, newIndex) {
            for (const list of Object.values(this.lists)) {
                const i = list.itemIds.indexOf(itemId);
                if (i > -1) list.itemIds.splice(i, 1);
            }
            const t = this.lists[toListId].itemIds;
            if (newIndex === undefined || newIndex >= t.length) {
                t.push(itemId);
            } else {
                t.splice(newIndex, 0, itemId);
            }
        }
    };
}

// Fake DOM: a drop zone rendering only the visible items, 40px tall each,
// with the dragged item excluded (it carries .item--dragging during drops)
const ITEM_HEIGHT = 40;
function makeDropZone(listId, visibleIds, draggedId) {
    const rendered = visibleIds.filter(id => id !== draggedId);
    const elements = rendered.map((id, i) => ({
        dataset: { itemId: id },
        getBoundingClientRect() {
            return { top: i * ITEM_HEIGHT, height: ITEM_HEIGHT };
        }
    }));
    return {
        dataset: { listId },
        querySelectorAll(selector) {
            if (selector !== '.item:not(.item--dragging)') {
                throw new Error(`unexpected selector: ${selector}`);
            }
            return elements;
        }
    };
}

// Build a DragManager mid-drag without running the DOM-binding constructor
function makeManager(store, draggedId, sourceListId) {
    const m = Object.create(DragManager.prototype);
    m.store = store;
    m.dragType = 'item';
    m.draggedId = draggedId;
    m.sourceListId = sourceListId;
    m._lastProcessedDropId = null;
    return m;
}

// Simulate a desktop drop at the visual gap above the given rendered row
// (rowIndex === rendered count drops at the end of the list)
function drop(manager, dropZone, rowIndex) {
    const e = {
        clientY: rowIndex * ITEM_HEIGHT + 1,
        target: {
            closest(selector) {
                return selector === '.list__items' ? dropZone : null;
            }
        }
    };
    manager._handleItemDrop(e);
}

let failures = 0;
function check(name, actual, expected) {
    const ok = JSON.stringify(actual) === JSON.stringify(expected);
    if (!ok) failures++;
    console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}`);
    if (!ok) {
        console.log(`      expected: [${expected}]`);
        console.log(`      actual:   [${actual}]`);
    }
}

// -- Case 1: clean list, downward move (old code was off by one) ------------
{
    const store = makeStore({ L: { itemIds: ['A', 'B', 'C', 'D', 'E', 'F'] } });
    const m = makeManager(store, 'A', 'L');
    const zone = makeDropZone('L', ['A', 'B', 'C', 'D', 'E', 'F'], 'A');
    drop(m, zone, 4); // between E and F
    check('clean list: drag A to between E and F',
        store.lists.L.itemIds, ['B', 'C', 'D', 'E', 'A', 'F']);
}

// -- Case 2: clean list, upward move (was already correct) -------------------
{
    const store = makeStore({ L: { itemIds: ['A', 'B', 'C', 'D', 'E', 'F'] } });
    const m = makeManager(store, 'F', 'L');
    const zone = makeDropZone('L', ['A', 'B', 'C', 'D', 'E', 'F'], 'F');
    drop(m, zone, 1); // before B
    check('clean list: drag F to before B',
        store.lists.L.itemIds, ['A', 'F', 'B', 'C', 'D', 'E']);
}

// -- Case 3: soft-deleted ids linger in itemIds (the reported "5 -> 3") -----
{
    const store = makeStore({ L: { itemIds: ['x1', 'x2', 'A', 'B', 'C', 'D', 'E', 'F'] } });
    const m = makeManager(store, 'F', 'L');
    // x1/x2 are deleted: not rendered
    const zone = makeDropZone('L', ['A', 'B', 'C', 'D', 'E', 'F'], 'F');
    drop(m, zone, 4); // visible position 5: before E
    check('2 deleted ids in itemIds: drag F to visible position 5 (before E)',
        store.lists.L.itemIds, ['x1', 'x2', 'A', 'B', 'C', 'D', 'F', 'E']);
}

// -- Case 4: snoozed item hidden mid-list ------------------------------------
{
    const store = makeStore({ L: { itemIds: ['A', 'B', 's1', 'C', 'D', 'E'] } });
    const m = makeManager(store, 'A', 'L');
    // s1 is snoozed: not rendered
    const zone = makeDropZone('L', ['A', 'B', 'C', 'D', 'E'], 'A');
    drop(m, zone, 2); // between C and D
    check('snoozed id mid-array: drag A to between C and D',
        store.lists.L.itemIds, ['B', 's1', 'C', 'A', 'D', 'E']);
}

// -- Case 5: drop at the end of the list ------------------------------------
{
    const store = makeStore({ L: { itemIds: ['A', 'B', 'C'] } });
    const m = makeManager(store, 'A', 'L');
    const zone = makeDropZone('L', ['A', 'B', 'C'], 'A');
    drop(m, zone, 2); // below C
    check('drop at end of list',
        store.lists.L.itemIds, ['B', 'C', 'A']);
}

// -- Case 6: cross-list move into a list with hidden ids ---------------------
{
    const store = makeStore({
        L1: { itemIds: ['X', 'Y'] },
        L2: { itemIds: ['y1', 'P', 'Q'] } // y1 deleted: not rendered
    });
    const m = makeManager(store, 'X', 'L1');
    const zone = makeDropZone('L2', ['P', 'Q'], 'X');
    drop(m, zone, 1); // before Q
    check('cross-list: drop X before Q in list with a hidden id',
        store.lists.L2.itemIds, ['y1', 'P', 'X', 'Q']);
    check('cross-list: X removed from source list',
        store.lists.L1.itemIds, ['Y']);
}

// -- Case 7: no-op drop back onto own position leaves order unchanged --------
{
    const store = makeStore({ L: { itemIds: ['A', 'B', 'C'] } });
    const m = makeManager(store, 'B', 'L');
    const zone = makeDropZone('L', ['A', 'B', 'C'], 'B');
    drop(m, zone, 1); // back between A and C
    check('no-op drop keeps order',
        store.lists.L.itemIds, ['A', 'B', 'C']);
}

// -- Case 8: list reorder with hidden (snoozed/deleted) lists ----------------
{
    const store = makeStore({});
    store.getDashboard = () => ({ listIds: ['d1', 'L1', 'L2', 'L3'] }); // d1 deleted
    store.reorderList = (dashId, oldIndex, newIndex) => {
        const a = store._dash;
        const [removed] = a.splice(oldIndex, 1);
        a.splice(newIndex, 0, removed);
    };
    store._dash = ['d1', 'L1', 'L2', 'L3'];
    store.getDashboard = () => ({ listIds: store._dash });

    const m = Object.create(DragManager.prototype);
    m.store = store;
    m.dashboardId = 'D';
    m.dragType = 'list';
    m.draggedId = 'L1';
    m._dropDraggedList('L3'); // drop L1 before L3
    check('list reorder: drag L1 before L3 with a hidden list id',
        store._dash, ['d1', 'L2', 'L1', 'L3']);
}

console.log();
if (failures > 0) {
    console.log(`${failures} test(s) FAILED`);
    process.exit(1);
}
console.log('All tests passed');
