# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Static site for Technical Solution Team delivery center. Three HTML pages with Firebase Realtime Database for request management. Deployed to GitHub Pages at `solution-way.madlab.tech`.

## Local Development

No build step. Serve with any static server:

```bash
python -m http.server 8765
# open http://127.0.0.1:8765/
```

Localhost auto-injects `js/config/app-check-debug.js` for Firebase App Check.

## Architecture

**Page Entry Pattern**: Each HTML page loads Firebase compat SDK as classic scripts (for `window.firebase` global), then a single ES module entry point:

```
requests-log.html → js/pages/requests-log.js → imports feature init() functions
```

**Module Organization**:
- `js/config/` — constants, Firebase config, auth config
- `js/core/` — framework-agnostic utilities (dates, format, validation, notifications)
- `js/data/` — Firebase persistence layer (`firebase-api.js` is the only DB access point)
- `js/features/` — feature modules (auth, requests, allocation, charter, roles)
- `js/ui/` — cross-cutting UI (theme, fade-in, scroll-spy, mobile-nav)
- `js/pages/` — one entry point per HTML page

**Key Constraint**: Firebase compat scripts MUST remain as classic `<script src>` tags, not ES modules, because features read from `window.firebase` directly.

## Common Tasks

**Add a new request field**:
1. Add form field to `requests-log.html` (`#newRequestModal`)
2. Wire into `collectFormData()` in `js/features/requests/index.js`
3. If enum, add labels to `js/config/constants.js`
4. Render in `renderRequestDetail()` and add to `saveRequest()` diff

**Add a new page**:
1. Create HTML with Firebase compat scripts + `<script type="module" src="js/pages/<name>.js">`
2. Create `js/pages/<name>.js` importing needed feature `init()` functions

## Design Tokens

CSS variables in `:root` of `css/style.css`:
- Spacing: `--space-1` (4px) to `--space-9` (56px)
- Typography: `--text-xs` (11px) to `--text-4xl` (44px)
- Colors: theme-aware, defaults in `:root`, light mode in `[data-theme="light"]`
