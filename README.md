# Pocket Jukebox V4

Mobile-first jukebox app for GitHub Pages.

## What's fixed in V4

- Previous and Next now work against the jukebox queue.
- Previous follows normal media-player behavior:
  - if a song is more than 3 seconds in, it restarts the current song
  - otherwise it moves to the previous queued song
- Volume slider controls audio played by the jukebox:
  - local audio files
  - Spotify Web Playback SDK audio
- Added browser Media Session integration so supported phones can show:
  - Play
  - Pause
  - Previous
  - Next
  - Seek backward
  - Seek forward
  - track title / artist
  - album artwork when available
- Lock-screen / notification media controls are connected to the jukebox player when supported.

## Important phone limitation

A normal website cannot control the phone's master system volume and cannot take over music playing in a separate app such as Apple Music, Spotify's native app, or YouTube Music.

The jukebox's volume control affects music being played by the jukebox webpage itself.

If you use Play Visualization while another app is actually playing the music, the jukebox can look active, but its Previous / Next / Volume controls cannot control that separate app.

## Fullscreen / visualization

- Play enters immersive fullscreen.
- Play Visualization enters immersive fullscreen.
- Tiny transparent X exits fullscreen.
- Visualization hides song progress.
- Visualization continues until Stop Visualization is pressed.
- Extra rays, sparkles, floating notes, record glow, pulsing display and other animations remain included.

## GitHub Pages

Upload all files in this ZIP to the root of your existing repository and replace the older files.

Then keep:

Settings → Pages → Deploy from a branch → main → / (root)

The service worker cache is now `pocket-jukebox-v4` so phones should retrieve the updated version.

## Spotify

Spotify playback still uses PKCE and the Spotify Web Playback SDK.

Spotify Premium is required for Web Playback.
Do not put your Spotify Client Secret into this project.
