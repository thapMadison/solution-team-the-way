# Technical Solution Team — Delivery Center

Static site mô tả roles, request process, và một Request Log app dùng Firebase Realtime Database.
Deploy lên GitHub Pages (`solution-way.madlab.tech`).

## Pages

| File | Mô tả |
|------|------|
| [index.html](index.html) | Roles & Responsibilities — sứ mệnh, trách nhiệm, lộ trình |
| [request-process.html](request-process.html) | Quy trình tiếp nhận request: template, cost model, priority, workflow |
| [requests-log.html](requests-log.html) | Request Log — CRUD + real-time sync qua Firebase + Resource Allocation Timeline |

## Project layout

```
.
├── index.html
├── request-process.html
├── requests-log.html
├── CNAME
├── assets/                       # Static images
├── css/                          # Stylesheets (design tokens in style.css)
│   ├── style.css                 # Base + design tokens + shared nav + theme
│   ├── auth.css                  # Auth UI (login modal, user menu)
│   ├── charter.css               # Shared charter sections (used on index + request-process)
│   ├── roles.css                 # index.html-specific
│   ├── request-process.css       # request-process.html-specific
│   ├── requests-log.css          # requests-log.html-specific
│   └── allocation-timeline.css   # Resource Allocation Timeline
├── js/                           # ES Modules (loaded via <script type="module">)
│   ├── config/                   # Constants & configuration
│   │   ├── constants.js          # STATUS/PRIORITY/TYPE labels, validation rules, projects, hues
│   │   ├── firebase.js           # Firebase project config + DB paths
│   │   ├── auth.js               # Tenant ID, mock users, cache TTL
│   │   ├── timeline.js           # TODAY anchor + timeline layout constants
│   │   └── app-check-debug.js    # Local-only App Check debug token (gitignored)
│   ├── core/                     # Generic, framework-agnostic utilities
│   │   ├── format.js             # escapeHtml, formatDate, initials, statusInfo, …
│   │   ├── validation.js         # isValidEmail
│   │   ├── notifications.js      # showNotification (toast)
│   │   ├── dates.js              # parseDate, toISO, daysBetween, addDays, buildMonths
│   │   └── bootstrap.js          # onReady(fn) helper
│   ├── data/                     # Persistence layer
│   │   ├── firebase-init.js      # firebase.initializeApp + appCheck → exports firebaseDb
│   │   └── firebase-api.js       # CRUD operations on requests/allocations/users
│   ├── features/                 # Feature modules
│   │   ├── auth/                 # auth-service, auth-ui, access-control
│   │   ├── requests/             # state, icons, index (controller + render + form + modal)
│   │   ├── allocation/           # data (domain helpers), icons, index (timeline UI)
│   │   ├── charter/              # section-nav (right-rail), template-copy
│   │   └── roles/                # responsibility-modal
│   ├── ui/                       # Cross-cutting UI behaviors
│   │   ├── theme.js              # Dark/light toggle (localStorage)
│   │   ├── fade-in.js            # IntersectionObserver reveal
│   │   ├── scroll-spy.js         # Sub-nav active link spy
│   │   └── mobile-nav.js         # Hamburger menu + mobile panel
│   └── pages/                    # Page entry points (one per HTML file)
│       ├── index.js              # → index.html
│       ├── request-process.js    # → request-process.html
│       └── requests-log.js       # → requests-log.html
└── docs/
    ├── ROLES.md                  # Source content for index.html
    ├── AUTH_SETUP.md             # Microsoft OAuth + Firebase Auth setup
    └── FIREBASE_SETUP.md         # Firebase Realtime Database rules + App Check
```

## How it loads (any page)

```html
<!-- Firebase compat SDK (classic scripts — populate window.firebase synchronously) -->
<script src="firebase-app-compat.js"></script>
<script src="firebase-database-compat.js"></script>
<script src="firebase-auth-compat.js"></script>
<script src="firebase-app-check-compat.js"></script>

<!-- Local dev only: debug token injected before modules run -->
<script>if(['localhost','127.0.0.1',''].includes(location.hostname)||location.protocol==='file:')
  document.write('<script src="js/config/app-check-debug.js"><\/script>')</script>

<!-- Single ES module entry per page — runs deferred, after classic scripts -->
<script type="module" src="js/pages/<page>.js"></script>
```

The page entry imports each feature's `init…()` and calls them in order on `DOMContentLoaded`. Firebase compat scripts MUST stay as classic `<script src>` because they install a global `firebase` namespace that the modules read directly.

## Adding a new request field

1. Update the form in [requests-log.html](requests-log.html) (`#newRequestModal`).
2. Wire it into `collectFormData()` in [js/features/requests/index.js](js/features/requests/index.js).
3. If it is an enum-like field, add the labels to [js/config/constants.js](js/config/constants.js).
4. Render it in `renderRequestDetail()` and add to `saveRequest()`'s diff if it is editable.

## Adding a new page

1. Create the HTML file. Include the Firebase compat scripts + a single `<script type="module" src="js/pages/<name>.js">`.
2. Create `js/pages/<name>.js` and import the `init…()` functions from each feature/UI module the page needs.

## Design tokens

CSS variables live in `:root` in [css/style.css](css/style.css) and follow these scales:

| Token family | Values |
|---|---|
| Spacing  | `--space-1` (4 px) → `--space-9` (56 px) |
| Radii    | `--radius-xs`, `--radius-sm`, `--radius`, `--radius-lg`, `--radius-pill` |
| Typography | `--text-xs` (11 px) → `--text-4xl` (44 px) |
| Shadows  | `--shadow-sm`, `--shadow`, `--shadow-lg`, `--glow` |
| Motion   | `--ease`, `--duration-fast`, `--duration`, `--duration-slow` |
| z-index  | `--z-nav`, `--z-modal`, `--z-toast`, `--z-menu` |

Colors are theme-aware: defaults in `:root`, overrides in `[data-theme="light"]`.

## Local dev

No build step. Serve the working directory with any static server:

```bash
python -m http.server 8765
# open http://127.0.0.1:8765/
```

The localhost detection (`localhost`, `127.0.0.1`, `file:`) injects `js/config/app-check-debug.js` automatically, so Firebase App Check accepts the local origin.

## Security note

The Firebase API key in [js/config/firebase.js](js/config/firebase.js) is intentionally public — see [docs/FIREBASE_SETUP.md](docs/FIREBASE_SETUP.md) for why and how Database Rules enforce real access control.
