# Ava Ivy desktop

Windows UI for Ava chat panes (Discord / Telegram) with rewrite-before-send via local Ava :8787.

## Laptop kit (recommended)

Built kit lives on E:

`E:\.1 Work Stations\RootMC\Ava Laptop\Start-Ava-Laptop.cmd`

That starts the Ava brain + `AvaIvy\Ava Ivy.exe`.

## Dev

```bat
cd "Web Files\rootmc-ava-desktop"
start-ava-desktop.bat
```

## Rebuild kit

```bat
powershell -File "Web Files\rootmc-ava-desktop\scripts\build-laptop-kit.ps1"
```

`signAndEditExecutable` is off so builds work without admin symlink privileges for winCodeSign.
