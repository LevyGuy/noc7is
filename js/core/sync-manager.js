/**
 * Sync Manager
 *
 * Keeps every screen showing the same board. Two channels, because the two
 * cases have very different costs:
 *
 *   - Other tabs in this browser: a BroadcastChannel carrying nothing but a
 *     username and a revision number. Instant, no network, and deliberately
 *     free of vault contents - a tab signed in as somebody else can see the
 *     message and learn nothing from it. Each tab fetches and decrypts with its
 *     own key, so plaintext never crosses the channel.
 *
 *   - Other devices: polling a tiny endpoint that answers only "what revision
 *     are you on?". One tab per browser does the polling (elected with the Web
 *     Locks API) and relays the answer to its siblings, and polling stops while
 *     the page is hidden - so an idle laptop costs nothing.
 *
 * When the revision moves, the screen loads the new version and merges it into
 * whatever the user has locally (see StateMerge). Nothing is overwritten.
 */
class SyncManager {
    /**
     * How often to ask the server for the current revision, while visible
     */
    static POLL_INTERVAL_MS = 4000;

    /**
     * Cadence for the polling tab while its own page is hidden. It keeps going
     * at a slow rate rather than stopping, because sibling tabs that may still
     * be on screen depend on it for news from other devices.
     */
    static POLL_HIDDEN_MS = 20000;

    /**
     * Slower cadence after a failure, so a server outage is not hammered
     */
    static POLL_BACKOFF_MS = 30000;

    /**
     * Cadence when Web Locks is unavailable and each visible tab must poll for
     * itself. Slower, since several tabs may be doing it at once.
     */
    static POLL_UNELECTED_MS = 15000;

    /**
     * @param {BlindBase} client - Unlocked vault client
     * @param {AppStore} store - Store to merge incoming changes into
     */
    constructor(client, store) {
        this.client = client;
        this.store = store;
        this.username = client.getUsername();

        this._channel = null;
        this._timer = null;
        this._destroyed = false;
        this._isLeader = false;
        this._pullInFlight = false;
        this._releaseLock = null;

        this._openChannel();
        this._electLeader();

        // Our own writes: tell the other tabs immediately rather than making
        // them wait for a poll to notice.
        this._unsubscribeSaved = eventBus.on(Events.SAVE_COMMITTED, (rev) => {
            this._broadcast(rev);
        });

        this._onVisibilityChange = () => {
            if (document.visibilityState !== 'visible') return;

            // Coming back to a screen: check immediately rather than showing
            // stale content until the next tick.
            if (this._shouldPoll()) {
                this._schedule(0);
            } else {
                this._pollOnce();
            }
        };
        document.addEventListener('visibilitychange', this._onVisibilityChange);
        window.addEventListener('focus', this._onVisibilityChange);
    }

    // =========================================================================
    // CROSS-TAB CHANNEL
    // =========================================================================

    /**
     * @private
     */
    _openChannel() {
        if (typeof BroadcastChannel === 'undefined') return;

        this._channel = new BroadcastChannel('noc7is-sync');
        this._channel.onmessage = (event) => {
            const message = event.data;
            if (!message || message.type !== 'rev') return;

            // Only react to our own account. A tab signed in as someone else
            // shares this channel and must be ignored.
            if (message.username !== this.username) return;

            if (Number(message.rev) > this.client.rev) {
                this._pull();
            }
        };
    }

    /**
     * Tell sibling tabs which revision is current. Carries no vault data.
     * @private
     */
    _broadcast(rev) {
        if (!this._channel) return;

        try {
            this._channel.postMessage({ type: 'rev', username: this.username, rev });
        } catch (e) {
            // Channel closed underneath us (tab going away) - nothing to do
        }
    }

    // =========================================================================
    // POLLING
    // =========================================================================

    /**
     * Elect a single poller per browser so ten open tabs cost one request, not
     * ten. Without Web Locks every visible tab polls, just more slowly.
     * @private
     */
    _electLeader() {
        this._locksSupported = !!(navigator.locks && navigator.locks.request);

        if (!this._locksSupported) {
            // No election possible: every visible tab polls for itself, slowly
            this._schedule(0);
            return;
        }

        // Until this tab holds the lock it does not poll at all - the elected
        // tab broadcasts what it finds. A catch-up poll still runs whenever
        // this tab becomes visible.
        this._pollOnce();

        navigator.locks.request('noc7is-poll', () => {
            if (this._destroyed) return Promise.resolve();

            this._isLeader = true;
            this._schedule(0);

            // Hold the lock until this tab goes away, so exactly one tab polls.
            // Whichever sibling is waiting takes over automatically.
            return new Promise((resolve) => {
                this._releaseLock = resolve;
            });
        }).catch(() => {
            // Lock unavailable (private mode, older browser) - poll solo
            this._locksSupported = false;
            this._schedule(0);
        });
    }

    /**
     * Whether this tab is responsible for polling the server
     * @private
     */
    _shouldPoll() {
        return this._isLeader || !this._locksSupported;
    }

    /**
     * @private
     */
    _schedule(delay) {
        if (this._destroyed) return;
        this._clearTimer();
        if (!this._shouldPoll()) return;

        let interval = delay;
        if (interval === undefined) {
            if (document.visibilityState === 'hidden') {
                // Keep a slow heartbeat: sibling tabs may still be on screen
                interval = SyncManager.POLL_HIDDEN_MS;
            } else {
                interval = this._isLeader
                    ? SyncManager.POLL_INTERVAL_MS
                    : SyncManager.POLL_UNELECTED_MS;
            }
        }

        this._timer = setTimeout(() => this._poll(), interval);
    }

    /**
     * One catch-up check that does not start a polling loop. Used by tabs that
     * are not the elected poller when they come back into view.
     * @private
     */
    async _pollOnce() {
        if (this._destroyed) return;

        try {
            const rev = await this.client.fetchRev();
            if (rev > this.client.rev) {
                await this._pull();
                this._broadcast(rev);
            }
        } catch (error) {
            // A failed catch-up is not worth reporting: the elected tab is
            // polling anyway, and saves surface their own errors.
        }
    }

    /**
     * @private
     */
    _clearTimer() {
        if (this._timer) {
            clearTimeout(this._timer);
            this._timer = null;
        }
    }

    /**
     * Ask the server for the current revision and pull if it moved
     * @private
     */
    async _poll() {
        if (this._destroyed) return;

        try {
            const rev = await this.client.fetchRev();

            if (rev > this.client.rev) {
                await this._pull();
                this._broadcast(rev);
            }

            eventBus.emit(Events.SYNC_STATUS, 'synced');
            this._schedule();
        } catch (error) {
            // Offline, rate limited, or the server is down. Back off; the local
            // copy stays usable and saves keep retrying on their own.
            eventBus.emit(Events.SYNC_STATUS, 'offline');
            this._schedule(SyncManager.POLL_BACKOFF_MS);
        }
    }

    /**
     * Load the current vault and merge it into this screen
     * @private
     */
    async _pull() {
        if (this._pullInFlight) return;
        this._pullInFlight = true;

        try {
            // Remember the revision the snapshot came from: load() updates
            // client.rev, and the store needs to know what it merged.
            const before = this.client.rev;
            const remoteState = await this.client.load();
            const rev = this.client.rev;

            // A save of ours may have landed while this request was in flight;
            // don't let an older snapshot walk the revision backwards, or the
            // next save would be rejected for no reason.
            if (before > rev) {
                this.client.rev = before;
            }

            if (remoteState) {
                const applied = this.store.applyRemoteState(remoteState, rev);

                // The store is holding it back until the user finishes what
                // they are doing. Leave the revision where it was so the next
                // poll fetches again - otherwise this snapshot would be treated
                // as consumed and any later change would go unnoticed.
                if (!applied) {
                    this.client.rev = before;
                }
            }
        } catch (error) {
            console.error('Sync pull failed:', error);
            eventBus.emit(Events.SYNC_STATUS, 'offline');
        } finally {
            this._pullInFlight = false;
        }
    }

    /**
     * Check for remote changes right now (e.g. after coming back to the tab)
     */
    syncNow() {
        this._schedule(0);
    }

    /**
     * Stop syncing and release the polling lock for another tab to take
     */
    destroy() {
        this._destroyed = true;
        this._clearTimer();

        if (this._releaseLock) {
            this._releaseLock();
            this._releaseLock = null;
        }

        if (this._channel) {
            this._channel.close();
            this._channel = null;
        }

        if (this._unsubscribeSaved) {
            this._unsubscribeSaved();
            this._unsubscribeSaved = null;
        }

        document.removeEventListener('visibilitychange', this._onVisibilityChange);
        window.removeEventListener('focus', this._onVisibilityChange);
    }
}

// Make available globally
window.SyncManager = SyncManager;
