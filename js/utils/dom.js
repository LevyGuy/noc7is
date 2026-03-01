/**
 * DOM Utility
 * Helper functions for DOM manipulation
 */
const DOM = {
    /**
     * Create an element with attributes and children
     * @param {string} tag - HTML tag name
     * @param {Object} attrs - Attributes and properties
     * @param {Array} children - Child elements or text
     * @returns {HTMLElement}
     */
    create(tag, attrs = {}, children = []) {
        const el = document.createElement(tag);

        Object.entries(attrs).forEach(([key, value]) => {
            if (key === 'className') {
                el.className = value;
            } else if (key === 'dataset') {
                Object.assign(el.dataset, value);
            } else if (key === 'style' && typeof value === 'object') {
                Object.assign(el.style, value);
            } else if (key.startsWith('on') && typeof value === 'function') {
                const eventName = key.slice(2).toLowerCase();
                el.addEventListener(eventName, value);
            } else if (key === 'innerHTML') {
                // Avoid innerHTML for security - use textContent instead
                console.warn('Avoid using innerHTML - use textContent for safety');
                el.textContent = Sanitize.stripTags(value);
            } else if (value !== null && value !== undefined && value !== false) {
                el.setAttribute(key, value);
            }
        });

        children.forEach(child => {
            if (child === null || child === undefined) return;
            if (typeof child === 'string' || typeof child === 'number') {
                el.appendChild(document.createTextNode(String(child)));
            } else if (child instanceof Node) {
                el.appendChild(child);
            }
        });

        return el;
    },

    /**
     * Query selector shorthand
     * @param {string} selector - CSS selector
     * @param {Element} context - Context element (default: document)
     * @returns {Element|null}
     */
    $(selector, context = document) {
        return context.querySelector(selector);
    },

    /**
     * Query selector all shorthand
     * @param {string} selector - CSS selector
     * @param {Element} context - Context element (default: document)
     * @returns {Element[]}
     */
    $$(selector, context = document) {
        return Array.from(context.querySelectorAll(selector));
    },

    /**
     * Remove all children from an element
     * @param {HTMLElement} element
     */
    clear(element) {
        while (element.firstChild) {
            element.removeChild(element.firstChild);
        }
    },

    /**
     * Show an element (remove hidden class)
     * @param {HTMLElement} element
     */
    show(element) {
        if (element) element.classList.remove('hidden');
    },

    /**
     * Hide an element (add hidden class)
     * @param {HTMLElement} element
     */
    hide(element) {
        if (element) element.classList.add('hidden');
    },

    /**
     * Toggle element visibility
     * @param {HTMLElement} element
     * @param {boolean} [force] - Force show/hide
     */
    toggle(element, force) {
        if (element) element.classList.toggle('hidden', force !== undefined ? !force : undefined);
    },

    /**
     * Add event listener with automatic cleanup
     * @param {HTMLElement} element
     * @param {string} event
     * @param {Function} handler
     * @param {Object} options
     * @returns {Function} Cleanup function
     */
    on(element, event, handler, options) {
        element.addEventListener(event, handler, options);
        return () => element.removeEventListener(event, handler, options);
    },

    /**
     * Add delegated event listener
     * @param {HTMLElement} container
     * @param {string} event
     * @param {string} selector
     * @param {Function} handler
     * @returns {Function} Cleanup function
     */
    delegate(container, event, selector, handler) {
        const delegatedHandler = (e) => {
            const target = e.target.closest(selector);
            if (target && container.contains(target)) {
                handler.call(target, e, target);
            }
        };
        container.addEventListener(event, delegatedHandler);
        return () => container.removeEventListener(event, delegatedHandler);
    },

    /**
     * Wait for next animation frame
     * @returns {Promise}
     */
    nextFrame() {
        return new Promise(resolve => requestAnimationFrame(resolve));
    },

    /**
     * Get element's position relative to viewport
     * @param {HTMLElement} element
     * @returns {DOMRect}
     */
    getRect(element) {
        return element.getBoundingClientRect();
    },

    /**
     * Check if element is in viewport
     * @param {HTMLElement} element
     * @returns {boolean}
     */
    isInViewport(element) {
        const rect = element.getBoundingClientRect();
        return (
            rect.top >= 0 &&
            rect.left >= 0 &&
            rect.bottom <= window.innerHeight &&
            rect.right <= window.innerWidth
        );
    },

    /**
     * Focus an element and select its contents if it's an input
     * @param {HTMLElement} element
     */
    focusAndSelect(element) {
        element.focus();
        if (element.select) {
            element.select();
        }
    }
};

// Make available globally
window.DOM = DOM;
