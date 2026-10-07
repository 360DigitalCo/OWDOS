# OWDOS

Ordbit Web Distro Operating System is a browser-native operating system foundation.

## What is in the current build

- Supabase email/password accounts and persistent sessions
- Real Bash through the Wasmer browser runtime
- Per-account local virtual filesystem
- Files app with editing and file management
- Proxied web browser using Jina Reader
- OWD Store with GitHub-friendly app registry structure
- Window manager, taskbar, launcher, themes and system monitor
- Bootloader
- Recovery environment
- Filesystem repair
- OOBE first-run setup
- Powerwash that wipes local OWDOS data without deleting the Supabase account
- Local system settings and kernel diagnostics

## Storage model

Supabase is used for authentication only. OWDOS files, installed applications and system settings stay in the browser's local storage. No service-role key is shipped to the client.

## App registry

Apps can be added through pull requests using the registry format in `apps.json`.

```json
{
  "id": "example",
  "name": "Example App",
  "version": "1.0.0",
  "author": "Your Name",
  "icon": "EX",
  "description": "An OWDOS app.",
  "entry": "apps/example.html"
}
```

## Browser

The browser uses `https://r.jina.ai/<url>` as its server-side reader. This avoids depending on public CORS relays that routinely rate-limit or omit CORS headers. Jina's current public Reader endpoint is rate-limited without an API key, so some heavy or restricted sites may still refuse automated fetching.

## Recovery controls

Press **Esc** during boot to enter the bootloader.

From the bootloader:

- Boot OWDOS
- Recovery mode
- Power off

Recovery mode can repair missing local filesystem directories, reset OWDOS settings, powerwash the current account, or return to the bootloader.

## Development

The code intentionally stays compact. The core system currently lives in `index.html`, `style.css` and `main.js`, with only the runtime support files around them.


## Firmware, recovery, and developer mode

OWDOS exposes a local firmware layer with a persistent device ID, firmware and bootloader versions, kernel versions, and a virtual TPM version.

Recovery is always available with the `1` + `4` + `=` chord. During OOBE, `Ctrl` + `Alt` + `Shift` + `R` opens the recovery actions; pressing `R` twice quickly selects the revert path.

Developer mode is available from the bootloader. The developer environment includes an ownership-protected Admin Console that requires the exact device ID before provisioning the local device. The exploit lab contains emulated OWDOS-only firmware test cases such as `sh1ttyoobe`, `bootbreak`, `tpmglitch`, and `devunlock`. They change the simulated OWDOS state only and are not real-world exploit code.

Powerwash resets local device and user state without deleting the Supabase account. Revert restores the last local recovery snapshot.
