# Medieval Merchant Simulator - Steam Release Plan

## Current State

Medieval Merchant Simulator is currently a static browser game:

- Entry point: `index.html`
- Game logic: `game.js`
- Styles: `style.css`
- Assets: `assets/`
- Current public web build: GitHub Pages / itch.io style HTML package

Steam should not be treated like itch.io. For Steam, the game should be packaged as a desktop application with a real executable, then uploaded through SteamPipe.

## Recommended Technical Path

Use an Electron or Tauri wrapper for the Steam build.

Preferred first path: Electron, because it is straightforward for an existing HTML game.

Target output:

- Windows: `Medieval Merchant Simulator.exe`
- Optional later: Linux build
- Optional later: macOS build

The Steam launch option should point to the executable, not directly to `index.html`.

## Steamworks Setup Checklist

1. Create / complete Steamworks partner onboarding.
2. Pay the Steam Direct fee for the app credit.
3. Create the Steam app and note the AppID.
4. Set General Installation Settings.
5. Create at least one depot, for example Windows Content.
6. Define launch option, for example:
   - Executable: `Medieval Merchant Simulator.exe`
   - Platform: Windows
7. Upload build through SteamPipe.
8. Set the uploaded build live on a private beta branch first.
9. Test install and launch through the Steam client.
10. Only after testing, move toward store review / release review.

## Store Assets Needed

Required store assets:

- Header Capsule: `920x430`
- Small Capsule: `462x174`
- Main Capsule: `1232x706`
- Vertical Capsule: `748x896`
- Screenshots: at least `1920x1080`, 16:9

Required client / library assets:

- Shortcut Icon: `256x256`, `.ico` or `.png`
- App Icon: `184x184`, `.jpg`
- Library Capsule: `600x900`
- Library Hero: `3840x1240`, `.png`
- Library Logo: `1280px wide and/or 720px tall`, transparent `.png`
- Library Header Capsule: `920x430`

Capsules should contain only game artwork, the game name, and an official subtitle. Avoid review quotes, discount text, awards, update text, or promotional labels on base capsule images.

## Store Page Copy

Short description draft:

Medieval Merchant Simulator is a browser-style medieval trade and household management game set in Europe in 1205. Travel between historical cities, trade local goods, build your headquarters, manage workers and bonded NPCs, and survive road events, reputation shifts, quests, and tactical encounters.

Long description draft:

Build a merchant house in early 13th-century Europe. Start with a handful of coins, choose your home city, and travel across a network of historical trade centers. Every city has its own market, reputation, quests, and local opportunities.

Buy and sell goods, restore rooms in your headquarters, assign workers to workshops, manage food and wages, develop NPCs, complete guild and council contracts, and face danger on the road. Your people have names, ages, traits, relationships, personal histories, and evolving roles within your household.

The game is currently in active development. Systems are being expanded regularly, including regional NPC identity, travel-map routes, combat, hidden encounters, achievements, and headquarters progression.

## Tags To Consider

- Trading
- Economy
- Management
- Strategy
- Historical
- Medieval
- Simulation
- Resource Management
- Singleplayer
- 2D
- Early Access

## Pre-Release Technical Tasks

1. Build desktop wrapper.
2. Confirm local save behavior inside the wrapper.
3. Add an app icon.
4. Add a proper window title and minimum window size.
5. Disable or adapt browser-only notes.
6. Create Steam-ready build folder.
7. Smoke-test wrapped build.
8. Package through SteamPipe.
9. Test launch through Steam client.

## Known Risks Before Steam

- The game is still mostly one large `game.js` file.
- Some English localization is still incomplete.
- Some NPC image sets are incomplete.
- Steam users expect a desktop executable and stable fullscreen/window behavior.
- The game needs a clearer Early Access scope if released before full content completion.

## Immediate Next Step

Create an Electron wrapper and produce the first Windows desktop build. After that, test the build locally and prepare the first SteamPipe-ready content folder.
