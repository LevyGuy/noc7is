/**
 * Dashboard Card Component
 * Individual dashboard card in the gallery
 */
class DashboardCardComponent {
    /**
     * Create a dashboard card
     * @param {Object} dashboard - Dashboard data
     * @param {number} listCount - Number of lists in dashboard
     * @param {Object} callbacks - Event callbacks
     */
    static render(dashboard, listCount, callbacks = {}) {
        const card = DOM.create('div', {
            className: 'dashboard-card',
            dataset: { id: dashboard.id },
            onClick: (e) => {
                // Don't navigate if clicking menu
                if (e.target.closest('.dashboard-card__menu')) return;
                if (callbacks.onClick) callbacks.onClick(dashboard.id);
            }
        }, [
            DOM.create('div', { className: 'dashboard-card__header' }, [
                DOM.create('h3', { className: 'dashboard-card__title' }, [dashboard.title]),
                DOM.create('button', {
                    className: 'dashboard-card__menu',
                    onClick: (e) => {
                        e.stopPropagation();
                        if (callbacks.onMenu) callbacks.onMenu(dashboard.id, e.target);
                    }
                }, ['\u22EE'])
            ]),
            DOM.create('p', { className: 'dashboard-card__meta' }, [
                `${listCount} list${listCount !== 1 ? 's' : ''}`
            ])
        ]);

        return card;
    }

    /**
     * Render a "new dashboard" card
     * @param {Function} onCreate - Callback when dashboard is created
     */
    static renderNewCard(onCreate) {
        const wrapper = DOM.create('div');

        // Initial state - button
        const buttonCard = DOM.create('div', {
            className: 'dashboard-card dashboard-card--new',
            id: 'new-dashboard-btn',
            onClick: () => showForm()
        }, [
            DOM.create('span', { className: 'dashboard-card__icon' }, ['+']),
            DOM.create('span', {}, ['Create Dashboard'])
        ]);

        // Form state
        const formCard = DOM.create('div', {
            className: 'dashboard-card hidden',
            id: 'new-dashboard-form'
        }, [
            DOM.create('input', {
                className: 'dashboard-card__input form-input',
                type: 'text',
                placeholder: 'Dashboard name',
                id: 'new-dashboard-input'
            }),
            DOM.create('div', { className: 'dashboard-card__actions' }, [
                DOM.create('button', {
                    className: 'btn btn--primary btn--sm',
                    onClick: () => save()
                }, ['Create']),
                DOM.create('button', {
                    className: 'btn btn--ghost btn--sm',
                    onClick: () => hideForm()
                }, ['Cancel'])
            ])
        ]);

        wrapper.appendChild(buttonCard);
        wrapper.appendChild(formCard);

        function showForm() {
            DOM.hide(buttonCard);
            DOM.show(formCard);
            const input = document.getElementById('new-dashboard-input');
            input.value = '';
            input.focus();
        }

        function hideForm() {
            DOM.show(buttonCard);
            DOM.hide(formCard);
        }

        function save() {
            const input = document.getElementById('new-dashboard-input');
            const title = input.value.trim();
            if (title) {
                onCreate(title);
                hideForm();
            }
        }

        // Handle keyboard
        formCard.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                save();
            } else if (e.key === 'Escape') {
                hideForm();
            }
        });

        return wrapper;
    }
}

// Make available globally
window.DashboardCardComponent = DashboardCardComponent;
