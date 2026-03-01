/**
 * ID Generator Utility
 * Generates unique, collision-resistant IDs for entities
 */
const IdGenerator = {
    /**
     * Generate a unique ID with prefix
     * Format: {prefix}_{timestamp}_{random}
     * @param {string} prefix - ID prefix (d, l, i)
     * @returns {string}
     */
    generate(prefix) {
        const timestamp = Date.now();
        const random = Math.random().toString(36).slice(2, 8);
        return `${prefix}_${timestamp}_${random}`;
    },

    /** Generate dashboard ID */
    dashboard() {
        return this.generate('d');
    },

    /** Generate list ID */
    list() {
        return this.generate('l');
    },

    /** Generate item ID */
    item() {
        return this.generate('i');
    }
};

// Make available globally
window.IdGenerator = IdGenerator;
