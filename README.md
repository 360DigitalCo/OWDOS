# OWDOS

OWDOS (Ordbit Web Distro Operating System) is a browser-native operating system built around a real desktop, a local virtual filesystem, a real Bash runtime, a web browser, and a community app registry.

## Current foundation

- Email/password accounts through Supabase Auth
- Local-first OWDOS filesystem stored in browser storage
- Real Bash 1.0.25 through Wasmer WASIX
- xterm.js terminal UI
- Window manager with move, minimize, maximize, close, taskbar, and launcher
- Files app with folders, text files, editor, rename, delete, and local persistence
- Browser app with address bar, navigation, reload, and iframe isolation
- OWD Store backed by `apps.json`
- Installable third-party apps stored locally
- GitHub-PR-friendly app registry format
- PWA manifest

Supabase is intentionally used only for account authentication. OWDOS files, installed apps, and desktop state stay on the user's device.

## Files

The foundation intentionally stays small. There is no framework, bundler, generated component tree, or giant dependency directory.

## Static hosting

OWDOS uses Wasmer's browser runtime, which requires a cross-origin-isolated page. `coi-serviceworker.js` adds the required headers for static hosts such as GitHub Pages. The first visit may reload once after the service worker takes control.

## Adding an app

Add an entry to `apps.json`:

```json
{
  "id": "my-app",
  "name": "My App",
  "version": "1.0.0",
  "author": "your-name",
  "icon": "★",
  "description": "What the app does.",
  "entry": "apps/my-app.html"
}
```

Add the app HTML at the referenced path and submit a pull request. The OWD Store will fetch the source, store it locally, and launch it in a sandboxed iframe.
