# OWDOS

Ordbit Web Distro Operating System.

OWDOS is a browser-native operating system inspired by the system flow of ChromeOS and the windowed desktop model of AnuraOS. The desktop is a web application, the local disk is virtualized in browser storage, and Supabase is used only for email/password authentication.

## System

- Firmware-style boot sequence and bootloader
- ChromeOS-inspired OOBE
- User and Guest sessions
- Recovery and Developer Mode
- Device ownership Admin Console
- Simulated OWDOS exploit lab
- Local virtual filesystem
- Desktop window manager
- Files, Terminal, Browser, Settings, System Monitor and OWD Store
- Community app registry through `apps.json`

## Accounts

Supabase Auth handles account identity. OWDOS never stores account passwords in its own tables.

Project: `https://tojtsvnjbebdjxdtuhxq.supabase.co`

The browser client uses a publishable key. Never replace it with a service-role key.

## Browser

The Browser app uses a direct cross-origin iframe for normal web pages because the browser should not rewrite a site's CSS into OWDOS markup. Sites that prohibit framing can be opened externally or read through the optional reader path.

## Apps

An app entry in `apps.json` points to a local HTML source. Submit new apps as pull requests.

Keep third-party apps sandboxed and review them before merging.
