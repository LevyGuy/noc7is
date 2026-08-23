/**
 * Regression test for moving a folder to a different dashboard.
 *
 * Bug: folders could only be dragged between lists on the same board - the
 * "Move to Dashboard" flow was only wired up for plain items, so a folder
 * could never leave its board. The store's moveItem already handles folders,
 * so this pins down that a folder move carries its sub-items along and leaves
 * no trace in the source list.
 *
 * Run with: node tests/folder-move.test.js
 */
const fs = require('fs');
const path = require('path');
const assert = require('assert');

// Load the real AppStore with minimal browser stubs
const source = fs.readFileSync(path.join(__dirname, '../js/core/app-store.js'), 'utf8');
const windowStub = {};
new Function('window', 'eventBus', 'Events', 'debounce', 'IdGenerator', source)(
    windowStub,
    { on() {}, emit() {} },
    {},
    (fn) => fn,
    { item: () => 'item-generated' }
);
const AppStore = windowStub.AppStore;

function makeStore() {
    const store = new AppStore(null);
    const now = Date.now();
    store.state = {
        dashboards: {
            'dash-a': { id: 'dash-a', title: 'A', listIds: ['list-a'], deleted: false, updatedAt: now },
            'dash-b': { id: 'dash-b', title: 'B', listIds: ['list-b'], deleted: false, updatedAt: now }
        },
        lists: {
            'list-a': { id: 'list-a', title: 'Todo', itemIds: ['item-1', 'folder-1'], deleted: false, updatedAt: now },
            'list-b': { id: 'list-b', title: 'Later', itemIds: ['item-2'], deleted: false, updatedAt: now }
        },
        items: {
            'item-1': { id: 'item-1', title: 'One', deleted: false, updatedAt: now },
            'item-2': { id: 'item-2', title: 'Two', deleted: false, updatedAt: now },
            'folder-1': {
                id: 'folder-1', type: 'folder', title: 'Folder', deleted: false,
                updatedAt: now, subItemIds: ['sub-1', 'sub-2']
            },
            'sub-1': { id: 'sub-1', title: 'Sub one', deleted: false, updatedAt: now },
            'sub-2': { id: 'sub-2', title: 'Sub two', deleted: false, updatedAt: now }
        }
    };
    store._triggerSave = () => {};
    return store;
}

// A folder moves to a list on another dashboard, sub-items and all
{
    const store = makeStore();
    store.moveItem('folder-1', 'list-a', 'list-b');

    assert.deepStrictEqual(store.state.lists['list-a'].itemIds, ['item-1'],
        'folder should be gone from the source list');
    assert.deepStrictEqual(store.state.lists['list-b'].itemIds, ['item-2', 'folder-1'],
        'folder should be appended to the target list');
    assert.deepStrictEqual(store.state.items['folder-1'].subItemIds, ['sub-1', 'sub-2'],
        'sub-items should travel with the folder');
    assert.strictEqual(store.findDashboardContainingList(store.findListContainingItem('folder-1')), 'dash-b',
        'folder should now live on the target dashboard');
}

// The move honours an explicit index, like an item move does
{
    const store = makeStore();
    store.moveItem('folder-1', 'list-a', 'list-b', 0);
    assert.deepStrictEqual(store.state.lists['list-b'].itemIds, ['folder-1', 'item-2'],
        'folder should land at the requested position');
}

// Sub-items stay reachable through the folder after the move
{
    const store = makeStore();
    store.moveItem('folder-1', 'list-a', 'list-b');
    const subItems = store.getItemsForFolder('folder-1').map(i => i.id);
    assert.deepStrictEqual(subItems, ['sub-1', 'sub-2'],
        'folder contents should be unchanged by the move');
    assert.strictEqual(store.findListContainingItem('sub-1'), null,
        'sub-items should not be loose in any list');
}

console.log('folder-move: all assertions passed');
