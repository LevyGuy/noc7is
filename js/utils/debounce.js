/**
 * Debounce Utility
 * Delays function execution until after a period of inactivity
 */

/**
 * Create a debounced version of a function
 * @param {Function} fn - Function to debounce
 * @param {number} delay - Delay in milliseconds
 * @returns {Function} Debounced function
 */
function debounce(fn, delay) {
    let timeoutId = null;

    const debounced = function(...args) {
        if (timeoutId) {
            clearTimeout(timeoutId);
        }

        timeoutId = setTimeout(() => {
            fn.apply(this, args);
            timeoutId = null;
        }, delay);
    };

    /**
     * Cancel any pending execution
     */
    debounced.cancel = function() {
        if (timeoutId) {
            clearTimeout(timeoutId);
            timeoutId = null;
        }
    };

    /**
     * Execute immediately and cancel any pending execution
     */
    debounced.flush = function(...args) {
        debounced.cancel();
        fn.apply(this, args);
    };

    return debounced;
}

/**
 * Create a throttled version of a function
 * @param {Function} fn - Function to throttle
 * @param {number} limit - Minimum time between executions in milliseconds
 * @returns {Function} Throttled function
 */
function throttle(fn, limit) {
    let lastCall = 0;
    let timeoutId = null;

    return function(...args) {
        const now = Date.now();

        if (now - lastCall >= limit) {
            lastCall = now;
            fn.apply(this, args);
        } else {
            // Schedule for the remaining time
            if (timeoutId) {
                clearTimeout(timeoutId);
            }

            timeoutId = setTimeout(() => {
                lastCall = Date.now();
                fn.apply(this, args);
            }, limit - (now - lastCall));
        }
    };
}

// Make available globally
window.debounce = debounce;
window.throttle = throttle;
