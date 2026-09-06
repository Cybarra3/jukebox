# Pocket Jukebox

Mobile-first jukebox web app for GitHub Pages.

## Features
- Dedicated **Play Visualization** button that keeps the jukebox animated even when audio is playing from another app/device. Press it again to stop the visualization.
- Pick multiple local audio files from iPhone, iPad, Android, or desktop.
- Queue, previous/next, seek, volume, animated record and visualizer.
- Four built-in skins: Neon, Classic, Chrome, Sunset.
- Custom photo skin with automatic resizing/cropping.
- Spotify sign-in using Authorization Code with PKCE (no Client Secret in the browser).
- Spotify search, queue, and playback through Spotify Web Playback SDK.
- Installable PWA on supported phones.

## Important Spotify notes
- Spotify Web Playback requires Spotify Premium.
- Your GitHub Pages URL must be added as an exact HTTPS Redirect URI in the Spotify Developer Dashboard.
- Do NOT place a Spotify Client Secret in this project.
- Local music files are never uploaded by this app. Browser-selected local files need to be selected again after a full page reload.

## GitHub Pages
Upload the contents of this folder to a public GitHub repository, then enable Pages from the `main` branch and `/ (root)`.

Typical URL:
`https://YOUR-USERNAME.github.io/YOUR-REPOSITORY/`

Use that exact URL, including the trailing slash if shown, as the Spotify Redirect URI.

## Spotify setup
1. Create an app at the Spotify Developer Dashboard.
2. Add your GitHub Pages URL as a Redirect URI.
3. Select Web API and Web Playback SDK if prompted.
4. Copy the app's Client ID.
5. Open Pocket Jukebox, tap Connect Spotify, paste the Client ID, and sign in.

No build tools are required.


## Play Visualization mode
Tap **Play Visualization** when you want the jukebox to look active while music is actually playing from another source, such as Apple Music, YouTube Music, Spotify's native app, a Bluetooth speaker, or another device.

While this mode is on:
- The record keeps spinning.
- The equalizer keeps moving.
- The jukebox lights keep flashing.
- The glow keeps pulsing.
- The website does not need to be playing audio itself.

The animation stays on until **Stop Visualization** is pressed. Starting or stopping local/Spotify audio does not automatically turn this visualization mode off.
