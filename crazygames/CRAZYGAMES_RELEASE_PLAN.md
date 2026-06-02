# Medieval Merchant Simulator - CrazyGames Release Plan

## Current Web Build

The CrazyGames build is the same static HTML5 game used for itch.io and GitHub Pages:

- `index.html`
- `game.js`
- `style.css`
- `assets/`

Do not include Steam/Electron files in the CrazyGames upload package.

## SDK Integration

The game now loads CrazyGames SDK v3 from `index.html`:

```html
<script src="https://sdk.crazygames.com/crazygames-sdk-v3.js"></script>
```

The game uses a safe platform bridge in `game.js`:

- `game.loadingStart()` when the script begins.
- `game.loadingStop()` after the first render.
- `game.gameplayStart()` when an existing game is loaded or the player starts a new campaign.
- `game.happytime()` when an achievement is unlocked.

The bridge is optional and no-op outside CrazyGames, so local, GitHub Pages, and itch.io builds keep working.

## Package Contents

Upload only:

```text
index.html
game.js
style.css
assets/
```

Recommended zip name:

```text
medieval_merchant_v039_crazygames.zip
```

## Pre-Submission Checklist

- Open `index.html` locally and confirm the game starts.
- Confirm the character creation flow works.
- Confirm the mobile layout scrolls after the welcome screen.
- Confirm the travel modal fits on a phone screen.
- Confirm no external download buttons are shown inside the game.
- Confirm the language toggle works.
- Confirm all required image assets are inside `assets/`.
- Run `node tests/smoke.test.mjs` before packaging.

## Known Platform Notes

- CrazyGames runs the game inside a web container, so avoid hardcoded `file://` paths.
- The game should continue to use relative asset paths such as `assets/map/europe_1205.png`.
- If ads are added later, call gameplay stop/start around ad pauses. This build does not add ads yet.

## Official References

- CrazyGames SDK intro: https://docs.crazygames.com/sdk/intro/
- CrazyGames game events: https://docs.crazygames.com/sdk/game/
- CrazyGames technical requirements: https://docs.crazygames.com/requirements/technical/
- CrazyGames gameplay requirements: https://docs.crazygames.com/requirements/gameplay/
