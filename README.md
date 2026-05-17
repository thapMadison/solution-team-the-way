# Technical Solution Team — Delivery Center

Static site mô tả roles, request process, và một Request Log app dùng Firebase Realtime Database.
Deploy lên GitHub Pages (`solution-way.madlab.tech`).

## Pages

| File | Mô tả |
|------|------|
| [index.html](index.html) | Roles & Responsibilities — sứ mệnh, trách nhiệm, lộ trình |
| [request-process.html](request-process.html) | Quy trình tiếp nhận request: template, cost model, priority, workflow |
| [requests-log.html](requests-log.html) | Request Log — CRUD + real-time sync qua Firebase |

## Project layout

```
.
├── index.html
├── request-process.html
├── requests-log.html
├── CNAME
├── assets/                  # Static images
├── css/
│   ├── style.css            # Base + shared content styles
│   └── requests-log.css         # Requests page only
├── js/
│   ├── config.js            # Constants: STATUS / PRIORITY / TYPE / TEAM_MEMBERS
│   ├── utils.js             # escapeHtml, formatDate, notifications
│   ├── firebase-config.js   # Firebase init (public config — see docs)
│   ├── firebase-api.js      # Data access layer (FirebaseAPI.*)
│   ├── common.js            # Theme toggle + scroll spy + fade-in observer
│   ├── template-copy.js     # Template copy/select widget (request-process.html)
│   └── requests-app.js      # Requests page controller
└── docs/
    ├── ROLES.md             # Source content for index.html
    └── FIREBASE_SETUP.md    # Firebase Realtime Database setup
```

## Script load order (requests-log.html)

```
firebase-app-compat.js → firebase-database-compat.js
→ config.js → utils.js → firebase-config.js → firebase-api.js → common.js → requests-app.js
```

`config.js` and `utils.js` expose `window.AppConfig` and `window.Utils`. `firebase-config.js` initializes
the SDK and exposes `window.firebaseDb`. `firebase-api.js` exposes `window.FirebaseAPI`.

## Adding a new request field

1. Update the form in `requests-log.html` (`#newRequestModal`).
2. Wire it into `collectFormData()` in `js/requests-app.js`.
3. If it is an enum-like field, add the labels to `js/config.js`.
4. Render it in `renderRequestDetail()` and add to `saveRequest()`'s diff if it's editable.

## Local dev

No build step. Open `requests-log.html` via a static server (any tool that serves the working directory).

## Security note

The Firebase API key in `js/firebase-config.js` is intentionally public — see
[docs/FIREBASE_SETUP.md](docs/FIREBASE_SETUP.md) for why and how Database Rules enforce real access control.
