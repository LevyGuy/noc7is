/**
 * Date Utility
 * Helper functions for date formatting
 */
const DateUtil = {
    /**
     * Format timestamp to readable date
     * @param {number} timestamp - Unix timestamp in milliseconds
     * @returns {string} Formatted date string
     */
    format(timestamp) {
        if (!timestamp) return '';

        const date = new Date(timestamp);
        const now = new Date();
        const diffMs = now - date;
        const diffSecs = Math.floor(diffMs / 1000);
        const diffMins = Math.floor(diffSecs / 60);
        const diffHours = Math.floor(diffMins / 60);
        const diffDays = Math.floor(diffHours / 24);

        // Just now (< 1 minute)
        if (diffMins < 1) {
            return 'Just now';
        }

        // Minutes ago (< 1 hour)
        if (diffHours < 1) {
            return `${diffMins} minute${diffMins !== 1 ? 's' : ''} ago`;
        }

        // Hours ago (< 24 hours)
        if (diffDays < 1) {
            return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
        }

        // Days ago (< 7 days)
        if (diffDays < 7) {
            return `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`;
        }

        // Full date
        return this.formatFull(timestamp);
    },

    /**
     * Format timestamp to full date string
     * @param {number} timestamp - Unix timestamp in milliseconds
     * @returns {string} Full date string
     */
    formatFull(timestamp) {
        if (!timestamp) return '';

        const date = new Date(timestamp);
        const options = {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        };

        return date.toLocaleDateString(undefined, options);
    },

    /**
     * Format timestamp to date only (no time)
     * @param {number} timestamp - Unix timestamp in milliseconds
     * @returns {string} Date string
     */
    formatDate(timestamp) {
        if (!timestamp) return '';

        const date = new Date(timestamp);
        const options = {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        };

        return date.toLocaleDateString(undefined, options);
    },

    /**
     * Format timestamp to time only
     * @param {number} timestamp - Unix timestamp in milliseconds
     * @returns {string} Time string
     */
    formatTime(timestamp) {
        if (!timestamp) return '';

        const date = new Date(timestamp);
        const options = {
            hour: '2-digit',
            minute: '2-digit'
        };

        return date.toLocaleTimeString(undefined, options);
    },

    /**
     * Check if two timestamps are on the same day
     * @param {number} ts1 - First timestamp
     * @param {number} ts2 - Second timestamp
     * @returns {boolean}
     */
    isSameDay(ts1, ts2) {
        const d1 = new Date(ts1);
        const d2 = new Date(ts2);
        return (
            d1.getFullYear() === d2.getFullYear() &&
            d1.getMonth() === d2.getMonth() &&
            d1.getDate() === d2.getDate()
        );
    },

    /**
     * Check if timestamp is today
     * @param {number} timestamp
     * @returns {boolean}
     */
    isToday(timestamp) {
        return this.isSameDay(timestamp, Date.now());
    },

    /**
     * Format timestamp to readable date and time for display
     * @param {number} timestamp - Unix timestamp in milliseconds
     * @returns {string} Formatted date/time string
     */
    formatDateTime(timestamp) {
        if (!timestamp) return '';

        const date = new Date(timestamp);
        const now = new Date();

        // Check if same day
        if (this.isSameDay(timestamp, now.getTime())) {
            return `Today at ${this.formatTime(timestamp)}`;
        }

        // Check if tomorrow
        const tomorrow = new Date(now);
        tomorrow.setDate(tomorrow.getDate() + 1);
        if (this.isSameDay(timestamp, tomorrow.getTime())) {
            return `Tomorrow at ${this.formatTime(timestamp)}`;
        }

        // Otherwise show full date and time
        return this.formatFull(timestamp);
    }
};

// Make available globally
window.DateUtil = DateUtil;
