/**
 * Confirm Dialog Component
 * Shows a confirmation dialog before destructive actions
 */
class ConfirmDialog {
    /**
     * Show a confirmation dialog
     * @param {Object} options
     * @param {string} options.title - Dialog title
     * @param {string} options.message - Confirmation message
     * @param {string} options.confirmText - Confirm button text (default: 'Confirm')
     * @param {string} options.cancelText - Cancel button text (default: 'Cancel')
     * @param {boolean} options.danger - Use danger styling (default: false)
     * @returns {Promise<boolean>} Resolves true if confirmed, false if cancelled
     */
    static show(options = {}) {
        const {
            title = 'Confirm',
            message = 'Are you sure?',
            confirmText = 'Confirm',
            cancelText = 'Cancel',
            danger = false
        } = options;

        return new Promise((resolve) => {
            const content = DOM.create('p', {}, [message]);

            const modal = new Modal({
                title,
                content,
                closeOnBackdrop: false,
                buttons: [
                    {
                        text: cancelText,
                        className: 'btn--secondary',
                        onClick: (m) => {
                            resolve(false);
                            m.close();
                        }
                    },
                    {
                        text: confirmText,
                        className: danger ? 'btn--danger' : 'btn--primary',
                        onClick: (m) => {
                            resolve(true);
                            m.close();
                        }
                    }
                ],
                onClose: () => resolve(false)
            });
        });
    }

    /**
     * Show a delete confirmation dialog
     * @param {string} itemName - Name of item being deleted
     * @returns {Promise<boolean>}
     */
    static delete(itemName) {
        return ConfirmDialog.show({
            title: 'Delete',
            message: `Are you sure you want to delete "${itemName}"? This action cannot be undone.`,
            confirmText: 'Delete',
            danger: true
        });
    }
}

// Make available globally
window.ConfirmDialog = ConfirmDialog;
