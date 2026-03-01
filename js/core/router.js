/**
 * Simple Hash-Based Router
 * Handles client-side navigation using URL hash
 */
class Router {
    constructor() {
        this.routes = new Map();
        this.currentRoute = null;
        this.currentParams = {};

        // Listen for hash changes
        window.addEventListener('hashchange', () => this._handleRoute());
    }

    /**
     * Register a route handler
     * @param {string} pattern - Route pattern (e.g., '/board/:id')
     * @param {Function} handler - Handler function receiving params
     */
    register(pattern, handler) {
        this.routes.set(pattern, handler);
    }

    /**
     * Navigate to a route
     * @param {string} path - Path to navigate to
     */
    navigate(path) {
        window.location.hash = path;
    }

    /**
     * Start the router (handle current hash)
     */
    start() {
        this._handleRoute();
    }

    /**
     * Get current route params
     * @returns {Object}
     */
    getParams() {
        return { ...this.currentParams };
    }

    /**
     * Get current route pattern
     * @returns {string|null}
     */
    getCurrentRoute() {
        return this.currentRoute;
    }

    /**
     * Handle route change
     * @private
     */
    _handleRoute() {
        const hash = window.location.hash.slice(1) || '/';

        for (const [pattern, handler] of this.routes) {
            const match = this._matchPattern(pattern, hash);
            if (match) {
                this.currentRoute = pattern;
                this.currentParams = match.params;

                eventBus.emit(Events.ROUTE_CHANGED, {
                    pattern,
                    params: match.params,
                    path: hash
                });

                handler(match.params);
                return;
            }
        }

        // No match - redirect to home
        this.navigate('/');
    }

    /**
     * Match a route pattern against a path
     * @param {string} pattern - Route pattern with :params
     * @param {string} path - Actual path
     * @returns {Object|null} Match result with params, or null
     * @private
     */
    _matchPattern(pattern, path) {
        const patternParts = pattern.split('/').filter(Boolean);
        const pathParts = path.split('/').filter(Boolean);

        if (patternParts.length !== pathParts.length) {
            return null;
        }

        const params = {};

        for (let i = 0; i < patternParts.length; i++) {
            const patternPart = patternParts[i];
            const pathPart = pathParts[i];

            if (patternPart.startsWith(':')) {
                // This is a parameter
                const paramName = patternPart.slice(1);
                params[paramName] = decodeURIComponent(pathPart);
            } else if (patternPart !== pathPart) {
                // Static part doesn't match
                return null;
            }
        }

        return { params };
    }
}

// Create singleton instance
const router = new Router();

// Make available globally
window.router = router;
