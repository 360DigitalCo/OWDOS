# OWDOS

OWDOS (Ordbit Web Distro Operating System) is a browser-native operating system project. It has a local virtual filesystem, interactive Bash, a desktop, web browsing, an app registry, recovery tools, developer mode, and a device-style boot chain.

## Pages

- `index.html` — firmware boot sequence and bootloader
- `oobe.html` — first-boot setup
- `welcome.html` — session chooser
- `user.html` — signed-in user session
- `login.html` / `signup.html` — Supabase email/password account flows
- `guest.html` — temporary Guest session
- `recovery.html` — recovery environment
- `devmode.html` — developer firmware environment
- `admin.html` — device administration and OWDOS-only exploit lab
- `desktop.html` — OWDOS desktop

## Accounts

Supabase Auth is used only for account identity and email/password authentication. Local OS files, installed apps, device state, recovery snapshots, and settings remain in browser storage. No service-role key is shipped to the client.

## Device model

Each browser profile gets a unique local device ID. The bootloader exposes firmware, bootloader, kernel, and virtual TPM versions. Developer mode and exploit-lab entries modify only the OWDOS device model. They are intentionally simulated and are not real-world exploit payloads.

## Recovery

Recovery is always reachable with `1 + 4 + =`. OOBE accepts `Ctrl + Alt + Shift + R` for recovery actions, with a rapid second press selecting the revert path.

## Apps

Community apps live in the registry and can be added through GitHub pull requests. Each app has a manifest and web entrypoint and is installed locally per OWDOS session.
