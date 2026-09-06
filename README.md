# Pocket Jukebox V3

Mobile-first jukebox web app for GitHub Pages.

## New in V3

- Press **Play** and the jukebox enters an immersive fullscreen view.
- Press **Play Visualization** and it also enters the immersive fullscreen view.
- A tiny semi-transparent **X** appears in the top-left to exit fullscreen/immersive mode.
- Visualization mode hides the song progress bar and elapsed/remaining time.
- Visualization mode keeps running until **Stop Visualization** is pressed.
- Exiting fullscreen does not stop the visualization.
- Extra animations were added: rotating rays, sparkles, floating music notes, record glow, pulsing record label, display glow, breathing jukebox brightness, animated equalizer, arch bulbs and spinning record.

## Fullscreen note for iPhone

The app asks the browser for native fullscreen where supported. Some iPhone/Safari versions restrict true webpage fullscreen. The app therefore also has its own immersive layout that fills the visible browser window, so the jukebox still behaves like a fullscreen display even when native fullscreen is unavailable.

## Existing features

- iPhone and Android friendly.
- Add multiple local audio songs.
- Queue, previous, play/pause, next, seek and volume.
- Spotify PKCE login without storing a Client Secret.
- Spotify song search and Web Playback SDK support.
- Neon, Classic, Chrome and Sunset skins.
- Custom photo skin from the phone's photo library.
- Installable PWA support.

## Visualization mode

Use **Play Visualization** when music is actually playing from another source such as Spotify's app, Apple Music, YouTube Music, Bluetooth, another phone, or a stereo.

The website does not need to play the audio. The animation keeps going until **Stop Visualization** is pressed.

While visualization mode is active, song progress is intentionally hidden.

## GitHub Pages installation

1. Upload all files from this folder to the root of your GitHub repository.
2. Open **Settings → Pages**.
3. Choose **Deploy from a branch**.
4. Select `main`.
5. Select `/ (root)`.
6. Save.

Your address will normally be:

`https://YOUR-USERNAME.github.io/YOUR-REPOSITORY/`

## Spotify

1. Create an app in Spotify Developer Dashboard.
2. Add your exact GitHub Pages HTTPS URL as a Redirect URI.
3. Copy the Client ID.
4. Open the jukebox and tap **Connect Spotify**.
5. Paste the Client ID and sign in.

Do not put a Spotify Client Secret in this project.

Spotify Web Playback requires Spotify Premium.
