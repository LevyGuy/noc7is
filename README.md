# Noc7is

**Noc7is** is a privacy-first, zero-knowledge Kanban application. 

It allows you to manage tasks, projects, and ideas without ever exposing your data to the server. Built entirely in Vanilla JavaScript and PHP, it relies on the **BlindBase Framework** to ensure that your data is encrypted in the browser before it ever touches the network.

**The server is blind. Only you hold the key.**

## Features

* ** Zero-Knowledge Architecture:** Data is encrypted with AES-256-GCM in your browser using a key derived from your password. The server (and database) only ever sees encrypted blobs.
* ** Multi-Dashboard Support:** Create separate boards for Work, Home, or hobby projects.
* ** Drag & Drop Interface:** * Reorder lists within a dashboard.
    * Move tasks between lists or reorder them.
    * **Mobile Support:** Custom touch implementation for smooth drag-and-drop on phones and tablets.
* ** Fully Responsive:** Works on desktop, tablet, and mobile browsers.
* ** Lightweight:** Built with **zero** external frontend libraries. No React, no Vue, no jQuery, no npm bloat.
* ** Auto-Save:** Changes are transparently encrypted and synced to the server in the background.

* Add Dashboard 
![Add Dashboard](/screenshots/add_dashboard.png)
* Add Item
![Add Item](/screenshots/add_item.png)
* Add Folder
![Add Folder](/screenshots/add_folder.png)
![Add Folder](/screenshots/add_folder_items.png)
* Add Label
![Add Label](/screenshots/add_label.png)
* Snooze Item
![Snooze Item](/screenshots/snooze_item.png)
* Snooze List
![Snooze List](/screenshots/snooze_list.png)
* Add Separator
![Add Separator](/screenshots/add_separator.png)


## Tech Stack

* **Frontend:** HTML5, CSS3 (Grid/Flexbox), Vanilla JavaScript (ES6+).
* **Cryptography:** Native Browser `Web Crypto API` (Client).
* **Backend:** PHP 8.1+ (Acts as a blind storage vault).
* **Database:** Flat JSON files (default) or MySQL (adaptable via BlindBase).


## Security Model

Authentication and encryption are both derived from your password, client-side:

* PBKDF2-HMAC-SHA256 (600,000 iterations) stretches your password into 512 bits.
* The first half becomes a non-exportable AES-256-GCM **encryption key** that never leaves your browser.
* The second half is an **auth token** sent to the server to prove you know the password. The server stores only a hash of it and verifies it (constant-time) before any read or write. Because the two halves are independent PBKDF2 blocks, the auth token reveals nothing about the encryption key without the password.

This means a request cannot read or overwrite another account's vault without the password, and a leak of the server's stored files (verifier hashes + ciphertext) is no easier to crack than the encrypted data itself.

### What zero-knowledge does and does not protect

* **Protected:** A passive/honest server operator never sees your password, encryption key, or plaintext. A theft of the storage files alone does not reveal your data (it remains encrypted, and the per-user salt is not even stored — it is derived from the server secret).
* **Not protected:** Because the cryptography runs in JavaScript served by the same server, an **active, malicious, or compromised server can ship tampered code that captures your password on login**. This is inherent to all browser-delivered end-to-end encryption. Serve over HTTPS only, keep the deployment trusted, and review the source you deploy.

## Important Security Notice

**1. No Password Reset**
Because Noc7is is a Zero-Knowledge application, your password is your encryption key. **If you lose your password, your data is mathematically irretrievable.** There is no "Forgot Password" link.

**2. XSS Sensitivity**
The encryption key resides in your browser's memory (RAM) while you are logged in. This makes the application sensitive to Cross-Site Scripting (XSS).
* Do not install browser extensions you do not trust.
* If you modify the source code, ensure you maintain a strict Content Security Policy (CSP).

**3. The `BLINDBASE_SECRET` is critical and not rotatable**
This server secret is used for the second (server-side) encryption layer **and** to derive each user's salt. Losing or changing it makes every existing vault permanently unreadable — there is no built-in rotation path. Back it up securely and treat it as un-rotatable in production.

**4. Production Hardening Checklist**
* Set `BLINDBASE_ALLOWED_ORIGINS` in `.env` to your exact origin (example: `https://noc7is.com`).
* Keep `.env`, `.git`, and `storage/` inaccessible from the web. The bundled `.htaccess` files enforce this **on Apache only** — if you deploy behind **nginx, Caddy, or another server you must replicate these denials yourself**, or `storage/*.json` and `.env` may be served directly.
* Serve only over HTTPS and keep HSTS enabled.
* Ensure Apache modules `mod_headers` and `mod_rewrite` are enabled so CSP and hardening headers are actually applied.


## License

Distributed under the MIT License. See `LICENSE` for more information.
