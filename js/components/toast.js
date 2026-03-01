/**
 * Toast Notification Component
 * Shows temporary notifications to the user
 */
class Toast {
    static container = null;

    /**
     * Initialize toast container
     */
    static init() {
        if (!Toast.container) {
            Toast.container = DOM.create('div', { className: 'toast-container' });
            document.body.appendChild(Toast.container);
        }
    }

    /**
     * Show a toast notification
     * @param {string} message - Message to display
     * @param {string} type - Type: 'info' | 'success' | 'error' | 'warning'
     * @param {number} duration - Duration in ms (0 for manual close)
     */
    static show(message, type = 'info', duration = 4000) {
        Toast.init();

        const toast = DOM.create('div', { className: `toast toast--${type}` }, [
            DOM.create('span', { className: 'toast__message' }, [message]),
            DOM.create('button', {
                className: 'toast__close',
                onClick: () => Toast.dismiss(toast)
            }, ['\u00D7'])
        ]);

        Toast.container.appendChild(toast);

        if (duration > 0) {
            setTimeout(() => Toast.dismiss(toast), duration);
        }

        return toast;
    }

    /**
     * Dismiss a toast
     * @param {HTMLElement} toast
     */
    static dismiss(toast) {
        if (toast && toast.parentNode) {
            toast.style.opacity = '0';
            toast.style.transform = 'translateX(100%)';
            setTimeout(() => {
                if (toast.parentNode) {
                    toast.parentNode.removeChild(toast);
                }
            }, 200);
        }
    }

    /** Show success toast */
    static success(message, duration) {
        return Toast.show(message, 'success', duration);
    }

    /** Show error toast */
    static error(message, duration = 6000) {
        return Toast.show(message, 'error', duration);
    }

    /** Show warning toast */
    static warning(message, duration) {
        return Toast.show(message, 'warning', duration);
    }

    /** Show info toast */
    static info(message, duration) {
        return Toast.show(message, 'info', duration);
    }
}

// Listen for toast events
eventBus.on(Events.TOAST_SHOW, ({ message, type, duration }) => {
    Toast.show(message, type, duration);
});

// Make available globally
window.Toast = Toast;
