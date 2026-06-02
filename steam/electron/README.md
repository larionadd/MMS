# Steam Desktop Wrapper

This folder contains the first desktop wrapper for the Steam build of Medieval Merchant Simulator.

## Local Test

```powershell
npm install
npm run steam:dev
```

The wrapper opens the existing `index.html` in a desktop window and keeps browser internals isolated from game code.

## Windows Package

```powershell
npm run steam:dist
```

Output will be created in:

```text
dist/steam/
```

Use the packaged executable as the Steam launch option, then upload the resulting content folder through SteamPipe.

## Still Needed Before Public Steam Release

- Add a real `.ico` app icon.
- Test save/load behavior inside the packaged app.
- Create Steam capsules, library art, screenshots, and trailer/media.
- Upload to a private Steam branch first and test through the Steam client.
