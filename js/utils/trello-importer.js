/**
 * Trello Importer Utility
 * Parses Trello JSON export and creates dashboard with lists and items
 */
const TrelloImporter = {
    /**
     * Parse Trello JSON and extract relevant data
     * @param {Object} trelloData - Parsed Trello JSON export
     * @returns {Object} Normalized data for import
     */
    parse(trelloData) {
        // Extract board name
        const boardName = trelloData.name || 'Imported Dashboard';

        // Extract lists (filter out closed/archived lists)
        const lists = (trelloData.lists || [])
            .filter(list => !list.closed)
            .sort((a, b) => a.pos - b.pos)
            .map(list => ({
                id: list.id,
                name: list.name
            }));

        // Create a map of list IDs for quick lookup
        const listIdSet = new Set(lists.map(l => l.id));

        // Extract cards (filter out closed/archived cards and cards in closed lists)
        const cards = (trelloData.cards || [])
            .filter(card => !card.closed && listIdSet.has(card.idList))
            .sort((a, b) => a.pos - b.pos)
            .map(card => ({
                id: card.id,
                name: card.name,
                desc: card.desc || '',
                listId: card.idList
            }));

        // Group cards by list
        const cardsByList = {};
        lists.forEach(list => {
            cardsByList[list.id] = [];
        });
        cards.forEach(card => {
            if (cardsByList[card.listId]) {
                cardsByList[card.listId].push(card);
            }
        });

        return {
            boardName,
            lists,
            cardsByList,
            totalLists: lists.length,
            totalCards: cards.length
        };
    },

    /**
     * Import Trello data into the app store
     * @param {AppStore} store - The application store
     * @param {Object} trelloData - Parsed Trello JSON export
     * @returns {Object} Result with dashboard ID and counts
     */
    import(store, trelloData) {
        const parsed = this.parse(trelloData);

        // Create the dashboard
        const dashboardId = store.addDashboard(parsed.boardName);

        // Create lists and their items
        parsed.lists.forEach(list => {
            const listId = store.addList(dashboardId, list.name);

            // Add items to this list
            const cards = parsed.cardsByList[list.id] || [];
            cards.forEach(card => {
                store.addItem(listId, card.name, card.desc);
            });
        });

        return {
            dashboardId,
            boardName: parsed.boardName,
            listsImported: parsed.totalLists,
            cardsImported: parsed.totalCards
        };
    },

    /**
     * Read and parse a JSON file from a File object
     * @param {File} file - The file to read
     * @returns {Promise<Object>} Parsed JSON data
     */
    readFile(file) {
        return new Promise((resolve, reject) => {
            if (!file) {
                reject(new Error('No file provided'));
                return;
            }

            if (!file.name.endsWith('.json')) {
                reject(new Error('Please select a JSON file'));
                return;
            }

            const reader = new FileReader();

            reader.onload = (e) => {
                try {
                    const data = JSON.parse(e.target.result);
                    resolve(data);
                } catch (err) {
                    reject(new Error('Invalid JSON file'));
                }
            };

            reader.onerror = () => {
                reject(new Error('Failed to read file'));
            };

            reader.readAsText(file);
        });
    },

    /**
     * Validate that the data looks like a Trello export
     * @param {Object} data - Parsed JSON data
     * @returns {boolean} True if valid Trello export
     */
    isValidTrelloExport(data) {
        return (
            data &&
            typeof data === 'object' &&
            typeof data.name === 'string' &&
            Array.isArray(data.lists) &&
            Array.isArray(data.cards)
        );
    }
};

// Make available globally
window.TrelloImporter = TrelloImporter;
