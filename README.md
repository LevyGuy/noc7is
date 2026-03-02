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


## Important Security Notice

**1. No Password Reset**
Because Noc7is is a Zero-Knowledge application, your password is your encryption key. **If you lose your password, your data is mathematically irretrievable.** There is no "Forgot Password" link.

**2. XSS Vulnerability**
The encryption key resides in your browser's memory (RAM) while you are logged in. This makes the application sensitive to Cross-Site Scripting (XSS).
* Do not install browser extensions you do not trust.
* If you modify the source code, ensure you maintain a strict Content Security Policy (CSP).

**3. Production Hardening Checklist**
* Set `BLINDBASE_ALLOWED_ORIGINS` in `.env` to your exact origin (example: `https://noc7is.com`).
* Keep `.env` and `.git` inaccessible from the web (root `.htaccess` enforces this on Apache).
* Serve only over HTTPS and keep HSTS enabled.
* Ensure Apache modules `mod_headers` and `mod_rewrite` are enabled so CSP and hardening headers are actually applied.


## License

Distributed under the MIT License. See `LICENSE` for more information.
