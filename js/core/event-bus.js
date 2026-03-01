/**
 * Event Bus
 * Simple publish/subscribe pattern for app-wide events
 */
class EventBus {
    constructor() {
        this.listeners = new Map();
    }

    /**
     * Subscribe to an event
     * @param {string} event - Event name
     * @param {Function} callback - Event handler
     * @returns {Function} Unsubscribe function
     */
    on(event, callback) {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, new Set());
        }
        this.listeners.get(event).add(callback);

        // Return unsubscribe function
        return () => this.off(event, callback);
    }

    /**
     * Subscribe to an event only once
     * @param {string} event - Event name
     * @param {Function} callback - Event handler
     * @returns {Function} Unsubscribe function
     */
    once(event, callback) {
        const wrapper = (data) => {
            this.off(event, wrapper);
            callback(data);
        };
        return this.on(event, wrapper);
    }

    /**
     * Unsubscribe from an event
     * @param {string} event - Event name
     * @param {Function} callback - Event handler to remove
     */
    off(event, callback) {
        if (this.listeners.has(event)) {
            this.listeners.get(event).delete(callback);
        }
    }

    /**
     * Emit an event to all subscribers
     * @param {string} event - Event name
     * @param {*} data - Data to pass to handlers
     */
    emit(event, data) {
        if (this.listeners.has(event)) {
            this.listeners.get(event).forEach(callback => {
                try {
                    callback(data);
                } catch (error) {
                    console.error(`Error in event handler for "${event}":`, error);
                }
            });
        }
    }

    /**
     * Remove all listeners for an event or all events
     * @param {string} [event] - Event name (optional)
     */
    clear(event) {
        if (event) {
            this.listeners.delete(event);
        } else {
            this.listeners.clear();
        }
    }

    /**
     * Get listener count for an event
     * @param {string} event - Event name
     * @returns {number}
     */
    listenerCount(event) {
        return this.listeners.has(event) ? this.listeners.get(event).size : 0;
    }
}

// Create singleton instance
const eventBus = new EventBus();

// Event name constants
const Events = {
    // State events
    STATE_CHANGED: 'state:changed',
    STATE_LOADED: 'state:loaded',

    // Save status events
    SAVE_STATUS: 'save:status',
    SAVE_ERROR: 'save:error',

    // Navigation events
    ROUTE_CHANGED: 'route:changed',

    // UI events
    TOAST_SHOW: 'toast:show',
    MODAL_OPEN: 'modal:open',
    MODAL_CLOSE: 'modal:close',

    // Drag events
    DRAG_START: 'drag:start',
    DRAG_END: 'drag:end'
};

// Make available globally
window.eventBus = eventBus;
window.Events = Events;
