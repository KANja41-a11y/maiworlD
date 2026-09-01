# MAIWORLD ✦

A cute pastel pixel online world starter made for GitHub Pages.

## Included

- Pixel-art characters generated locally with Canvas — no copyrighted image hotlinks required.
- Character creator: nickname, skin, hair, eyes, mouth, top, bottom, dress, shoes, accessories and bags.
- Worlds: plaza, park, school, cafe, studio, beach, library, arcade, fairy garden and concert stage.
- Interactable objects.
- World chat + emote bar (wave, dance, heart, laugh, sleep, sparkle, etc.).
- Online player list.
- WASD / arrow-key movement + mobile controls.
- Relaxing ambient music generated with Web Audio after pressing the music button.
- JSON data files for worlds, items and character options.
- Optional Firebase Realtime Database multiplayer.

## Important multiplayer note

GitHub Pages is static hosting. It can host this frontend, but it cannot itself act as the realtime multiplayer server. This project therefore includes Firebase Realtime Database integration.

Without Firebase config, the site runs in local demo mode.
After adding Firebase config + enabling Anonymous Auth + Realtime Database rules, different devices can share the same world.

## Firebase setup

1. Create a Firebase project.
2. Add a Web App.
3. Enable Authentication > Sign-in method > Anonymous.
4. Create a Realtime Database.
5. Copy the Firebase web config into `firebase-config.js`.
6. Paste the rules from `firebase-rules.json` into Realtime Database > Rules.
7. Deploy the folder to GitHub Pages.

Official docs:
- https://firebase.google.com/docs/auth/web/anonymous-auth
- https://firebase.google.com/docs/database/web/start
- https://docs.github.com/en/pages/getting-started-with-github-pages/creating-a-github-pages-site

## Deploy

Put all files at the root of your repository, with `index.html` at the root.

GitHub:
Settings > Pages > Build and deployment > Source: Deploy from a branch > main > /root.

Then open the generated GitHub Pages URL.

## Asset/licensing choice

MAIWORLD intentionally draws its pixel characters, furniture and world scenery with Canvas instead of hotlinking third-party artwork. That avoids broken external image URLs and copyright/licensing ambiguity. If you later add external sprites, verify their license and keep the license/credit in the repository.

## Customization

The easiest places to customize:
- `data/world.json` — worlds
- `data/items.json` — interactable objects
- `data/characters.json` — character choices
- `script.js` — world rendering, movement and interactions
- `style.css` — visual design

## Current scope
This is a polished static-front-end prototype with a Firebase multiplayer layer. For a large public game, add server-side moderation/rate limiting, abuse reporting, stronger account persistence, and a production multiplayer architecture as player counts grow.
