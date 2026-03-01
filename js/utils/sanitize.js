/**
 * Sanitization Utility
 * Prevents XSS attacks by safely handling user input
 */
const Sanitize = {
    /**
     * Escape HTML special characters to prevent XSS
     * @param {string} str - String to escape
     * @returns {string} Escaped string safe for HTML insertion
     */
    html(str) {
        if (str === null || str === undefined) return '';
        if (typeof str !== 'string') str = String(str);

        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    },

    /**
     * Safely set text content of an element
     * @param {HTMLElement} element - Target element
     * @param {string} str - Text to set
     */
    text(element, str) {
        if (element && element.textContent !== undefined) {
            element.textContent = str || '';
        }
    },

    /**
     * Safely set value of an input element
     * @param {HTMLInputElement|HTMLTextAreaElement} element - Target element
     * @param {string} str - Value to set
     */
    value(element, str) {
        if (element && element.value !== undefined) {
            element.value = str || '';
        }
    },

    /**
     * Strip HTML tags from a string
     * @param {string} str - String with potential HTML
     * @returns {string} String with HTML tags removed
     */
    stripTags(str) {
        if (!str) return '';
        const div = document.createElement('div');
        div.innerHTML = str;
        return div.textContent || div.innerText || '';
    },

    /**
     * Truncate string to specified length with ellipsis
     * @param {string} str - String to truncate
     * @param {number} maxLength - Maximum length
     * @returns {string} Truncated string
     */
    truncate(str, maxLength = 100) {
        if (!str) return '';
        if (str.length <= maxLength) return str;
        return str.slice(0, maxLength - 3) + '...';
    },

    /**
     * Validate that a string is safe for use as a CSS class name
     * @param {string} str - Potential class name
     * @returns {string} Sanitized class name
     */
    className(str) {
        if (!str) return '';
        // Remove anything that's not alphanumeric, hyphen, or underscore
        return str.replace(/[^a-zA-Z0-9_-]/g, '');
    },

    /**
     * Validate and sanitize a URL
     * @param {string} url - URL to validate
     * @returns {string|null} Sanitized URL or null if invalid
     */
    url(url) {
        if (!url) return null;
        try {
            const parsed = new URL(url);
            // Only allow http and https protocols
            if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
                return null;
            }
            return parsed.href;
        } catch {
            return null;
        }
    }
};

// Make available globally
window.Sanitize = Sanitize;
