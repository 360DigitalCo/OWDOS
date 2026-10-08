# OWDOS

OWDOS (Ordbit Web Distro Operating System) is a browser-native operating system inspired by the structure of cros.sim and the windowing/application experience of AnuraOS.

## Included
- Firmware-style boot flow and bootloader
- ChromeOS-inspired OOBE flow
- User and Guest sessions
- Supabase email/password authentication for accounts only
- Local browser filesystem
- Real Bash runtime through the Wasmer browser SDK
- Files, browser, settings, calculator, editor, media, system monitor, help, and app store surfaces
- Recovery, developer mode, device diagnostics, Powerwash, and local snapshot revert
- AnuraOS-inspired desktop window behavior and taskbar interactions

## References
The UI and flow are based on the supplied `cros.sim` reference. Window management ideas are informed by the supplied AnuraOS project. The implementation remains OWDOS-specific.
