(() => {
  "use strict";

  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => [...document.querySelectorAll(sel)];

  const els = {
    body: document.body,
    localAudio: $("#localAudio"),
    musicPicker: $("#musicPicker"),
    addMusicButton: $("#addMusicButton"),
    playButton: $("#playButton"),
    prevButton: $("#prevButton"),
    nextButton: $("#nextButton"),
    seekBar: $("#seekBar"),
    volumeBar: $("#volumeBar"),
    title: $("#trackTitle"),
    artist: $("#trackArtist"),
    currentTime: $("#currentTime"),
    duration: $("#duration"),
    sourceBadge: $("#sourceBadge"),
    record: $("#record"),
    visualizer: $("#visualizer"),
    queue: $("#queue"),
    clearQueueButton: $("#clearQueueButton"),
    skinButton: $("#skinButton"),
    skinDialog: $("#skinDialog"),
    skinPicker: $("#skinPicker"),
    customSkinButton: $("#customSkinButton"),
    customBackdrop: $("#customBackdrop"),
    removeCustomSkin: $("#removeCustomSkin"),
    spotifyButton: $("#spotifyButton"),
    spotifyButtonText: $("#spotifyButtonText"),
    spotifyPanel: $("#spotifyPanel"),
    spotifyDisconnect: $("#spotifyDisconnect"),
    spotifySearchForm: $("#spotifySearchForm"),
    spotifySearchInput: $("#spotifySearchInput"),
    spotifyResults: $("#spotifyResults"),
    spotifyStatus: $("#spotifyStatus"),
    spotifySetupDialog: $("#spotifySetupDialog"),
    spotifySetupForm: $("#spotifySetupForm"),
    spotifySetupClose: $("#spotifySetupClose"),
    spotifyClientId: $("#spotifyClientId"),
    redirectUri: $("#redirectUri"),
    copyRedirect: $("#copyRedirect"),
    toast: $("#toast"),
    visualizationButton: $("#visualizationButton"),
    jukeboxSection: $("#jukeboxSection"),
    fullscreenExitButton: $("#fullscreenExitButton"),
  };

  let queue = [];
  let currentIndex = -1;
  let currentSource = null; // "local" | "spotify"
  let localObjectUrl = null;
  let spotifyPlayer = null;
  let spotifyDeviceId = null;
  let spotifyState = null;
  let spotifyProgressTimer = null;
  let spotifySdkReady = false;
  let visualizationForced = false;
  let spotifyAccessToken = sessionStorage.getItem("spotify_access_token") || "";
  let spotifyRefreshToken = localStorage.getItem("spotify_refresh_token") || "";
  let spotifyTokenExpiresAt = Number(sessionStorage.getItem("spotify_token_expires_at") || 0);

  // ---------- Utilities ----------
  function toast(message) {
    els.toast.textContent = message;
    els.toast.classList.add("show");
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => els.toast.classList.remove("show"), 2600);
  }

  function formatTime(seconds) {
    if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${String(s).padStart(2, "0")}`;
  }

  function cleanFileName(name) {
    return name.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").trim();
  }

  function setPlayingUI(isPlaying) {
    const shouldAnimate = isPlaying || visualizationForced;
    els.body.classList.toggle("is-playing", shouldAnimate);
    els.record.classList.toggle("paused", !shouldAnimate);
    els.visualizer.classList.toggle("paused", !shouldAnimate);

    // The main play button reflects actual audio playback only.
    els.playButton.textContent = isPlaying ? "❚❚" : "▶";
    els.playButton.setAttribute("aria-label", isPlaying ? "Pause" : "Play");

    if (els.visualizationButton) {
      els.visualizationButton.setAttribute("aria-pressed", String(visualizationForced));
      const label = els.visualizationButton.querySelector("strong");
      const detail = els.visualizationButton.querySelector("small");
      if (label) label.textContent = visualizationForced ? "Stop Visualization" : "Play Visualization";
      if (detail) detail.textContent = visualizationForced
        ? "Visualization stays on until you press this again"
        : "Make the jukebox look like music is playing";
    }
  }

  function isPlaying() {
    if (currentSource === "local") return !els.localAudio.paused;
    if (currentSource === "spotify") return Boolean(spotifyState && !spotifyState.paused);
    return false;
  }

  function enterImmersiveMode() {
    els.body.classList.add("immersive-mode");

    try {
      if (!document.fullscreenElement && els.jukeboxSection?.requestFullscreen) {
        const result = els.jukeboxSection.requestFullscreen({ navigationUI: "hide" });
        if (result && typeof result.catch === "function") result.catch(() => {});
      }
    } catch {}
  }

  async function exitImmersiveMode() {
    els.body.classList.remove("immersive-mode");
    try {
      if (document.fullscreenElement && document.exitFullscreen) {
        await document.exitFullscreen();
      }
    } catch {}
  }

  document.addEventListener("fullscreenchange", () => {
    if (!document.fullscreenElement && els.body.classList.contains("immersive-mode")) {
      els.body.classList.remove("immersive-mode");
    }
  });

  function currentRedirectUri() {
    // Keep query/hash out of the OAuth callback URL.
    return `${location.origin}${location.pathname}`;
  }

  function saveSkin(skin) {
    localStorage.setItem("jukebox_skin", skin);
  }

  function loadSkin() {
    const skin = localStorage.getItem("jukebox_skin") || "neon";
    applySkin(skin);
    const custom = localStorage.getItem("jukebox_custom_skin");
    if (custom) applyCustomImage(custom, false);
  }

  function applySkin(skin) {
    ["neon", "classic", "chrome", "sunset"].forEach(s => els.body.classList.remove(`skin-${s}`));
    els.body.classList.add(`skin-${skin}`);
    saveSkin(skin);
  }

  function applyCustomImage(dataUrl, persist = true) {
    els.customBackdrop.style.backgroundImage = `url("${dataUrl}")`;
    els.body.classList.add("has-custom");
    if (persist) {
      try { localStorage.setItem("jukebox_custom_skin", dataUrl); }
      catch { toast("Photo applied, but it was too large to remember after refresh."); }
    }
  }

  function clearCustomImage() {
    els.customBackdrop.style.backgroundImage = "";
    els.body.classList.remove("has-custom");
    localStorage.removeItem("jukebox_custom_skin");
  }

  // Resize custom photos before saving so phone photos do not overwhelm localStorage.
  async function resizeSkinImage(file) {
    const bitmap = await createImageBitmap(file);
    const maxW = 900, maxH = 1600;
    const scale = Math.min(maxW / bitmap.width, maxH / bitmap.height, 1);
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const ctx = canvas.getContext("2d");
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", 0.72);
  }

  // ---------- Queue / local music ----------
  function renderQueue() {
    els.queue.innerHTML = "";
    if (!queue.length) {
      els.queue.innerHTML = '<p class="empty-state">No songs yet. Tap “Add Music” or connect Spotify.</p>';
      return;
    }

    queue.forEach((item, index) => {
      const row = document.createElement("div");
      row.className = `queue-item${index === currentIndex ? " active" : ""}`;

      const art = item.image
        ? `<img class="queue-art" alt="" src="${escapeHtml(item.image)}">`
        : `<div class="queue-art local">♫</div>`;

      row.innerHTML = `
        ${art}
        <div class="queue-meta">
          <strong>${escapeHtml(item.title)}</strong>
          <span>${escapeHtml(item.artist || (item.source === "local" ? "On this device" : "Spotify"))}</span>
        </div>
        <button type="button" aria-label="Play ${escapeHtml(item.title)}">▶</button>
      `;
      row.querySelector("button").addEventListener("click", () => playIndex(index));
      row.addEventListener("dblclick", () => playIndex(index));
      els.queue.appendChild(row);
    });
  }

  function escapeHtml(value = "") {
    return String(value).replace(/[&<>"']/g, ch => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
    })[ch]);
  }

  async function addLocalFiles(files) {
    const audioFiles = [...files].filter(file => file.type.startsWith("audio/") || /\.(mp3|m4a|aac|wav|ogg|flac)$/i.test(file.name));
    if (!audioFiles.length) return toast("No compatible audio files were selected.");

    const additions = audioFiles.map(file => ({
      id: crypto.randomUUID(),
      source: "local",
      title: cleanFileName(file.name),
      artist: "On this device",
      file
    }));
    queue.push(...additions);
    renderQueue();
    toast(`${additions.length} song${additions.length === 1 ? "" : "s"} added.`);
    if (currentIndex < 0) playIndex(0);
  }

  async function playIndex(index) {
    if (index < 0 || index >= queue.length) return;
    currentIndex = index;
    const item = queue[index];
    renderQueue();

    if (item.source === "local") {
      await playLocal(item);
    } else if (item.source === "spotify") {
      await playSpotifyItem(item);
    }
  }

  async function playLocal(item) {
    currentSource = "local";
    stopSpotifyProgressTimer();

    // Pause Spotify before local playback.
    try { if (spotifyPlayer && spotifyState && !spotifyState.paused) await spotifyPlayer.pause(); } catch {}

    if (localObjectUrl) URL.revokeObjectURL(localObjectUrl);
    localObjectUrl = URL.createObjectURL(item.file);
    els.localAudio.src = localObjectUrl;
    els.localAudio.volume = Number(els.volumeBar.value);
    updateTrackDisplay(item);
    els.seekBar.value = 0;

    try {
      await els.localAudio.play();
      setPlayingUI(true);
    } catch (err) {
      setPlayingUI(false);
      toast("Tap Play to start this song.");
    }
  }

  function updateTrackDisplay(item) {
    els.title.textContent = item?.title || "Choose some music";
    els.artist.textContent = item?.artist || "Local files or Spotify";
    els.sourceBadge.textContent = item?.source === "spotify" ? "SPOTIFY" : item?.source === "local" ? "ON THIS DEVICE" : "READY";
  }

  async function togglePlayback() {
    enterImmersiveMode();

    if (currentIndex < 0 && queue.length) return playIndex(0);
    if (currentIndex < 0) {
      setPlayingUI(false);
      return toast("Add a song, or use Play Visualization for display-only mode.");
    }

    if (currentSource === "local") {
      if (els.localAudio.paused) {
        try { await els.localAudio.play(); } catch { toast("Playback could not start."); }
      } else {
        els.localAudio.pause();
      }
      return;
    }

    if (currentSource === "spotify") {
      if (!spotifyPlayer) return toast("Spotify player is not ready yet.");
      try { await spotifyPlayer.togglePlay(); } catch { toast("Spotify could not change playback."); }
    }
  }

  function nextTrack() {
    if (!queue.length) return;
    playIndex((currentIndex + 1) % queue.length);
  }

  function previousTrack() {
    if (!queue.length) return;
    playIndex((currentIndex - 1 + queue.length) % queue.length);
  }

  els.localAudio.addEventListener("play", () => setPlayingUI(true));
  els.localAudio.addEventListener("pause", () => setPlayingUI(false));
  els.localAudio.addEventListener("ended", nextTrack);
  els.localAudio.addEventListener("loadedmetadata", () => {
    els.duration.textContent = formatTime(els.localAudio.duration);
  });
  els.localAudio.addEventListener("timeupdate", () => {
    if (currentSource !== "local") return;
    els.currentTime.textContent = formatTime(els.localAudio.currentTime);
    els.duration.textContent = formatTime(els.localAudio.duration);
    els.seekBar.value = els.localAudio.duration ? (els.localAudio.currentTime / els.localAudio.duration) * 100 : 0;
  });

  els.addMusicButton.addEventListener("click", () => els.musicPicker.click());
  els.musicPicker.addEventListener("change", e => {
    addLocalFiles(e.target.files);
    e.target.value = "";
  });
  els.playButton.addEventListener("click", togglePlayback);

  els.visualizationButton.addEventListener("click", () => {
    visualizationForced = !visualizationForced;
    els.body.classList.toggle("visualization-forced", visualizationForced);
    setPlayingUI(isPlaying());

    if (visualizationForced) {
      enterImmersiveMode();
      toast("Visualization is on. Song progress is hidden until visualization is turned off.");
    } else {
      toast("Visualization stopped.");
    }
  });

  els.fullscreenExitButton.addEventListener("click", exitImmersiveMode);
  els.prevButton.addEventListener("click", previousTrack);
  els.nextButton.addEventListener("click", nextTrack);
  els.volumeBar.addEventListener("input", async () => {
    const volume = Number(els.volumeBar.value);
    els.localAudio.volume = volume;
    try { if (spotifyPlayer) await spotifyPlayer.setVolume(volume); } catch {}
  });
  els.seekBar.addEventListener("input", async () => {
    const pct = Number(els.seekBar.value) / 100;
    if (currentSource === "local" && Number.isFinite(els.localAudio.duration)) {
      els.localAudio.currentTime = pct * els.localAudio.duration;
    } else if (currentSource === "spotify" && spotifyState) {
      try { await spotifyPlayer.seek(Math.round(pct * spotifyState.duration)); } catch {}
    }
  });

  els.clearQueueButton.addEventListener("click", () => {
    if (currentSource === "local") els.localAudio.pause();
    queue = [];
    currentIndex = -1;
    currentSource = null;
    updateTrackDisplay(null);
    els.currentTime.textContent = "0:00";
    els.duration.textContent = "0:00";
    els.seekBar.value = 0;
    setPlayingUI(false);
    renderQueue();
  });

  // ---------- Skins ----------
  els.skinButton.addEventListener("click", () => els.skinDialog.showModal());
  $$(".skin-choice").forEach(btn => btn.addEventListener("click", () => {
    applySkin(btn.dataset.skin);
    els.skinDialog.close();
  }));
  els.customSkinButton.addEventListener("click", () => els.skinPicker.click());
  els.skinPicker.addEventListener("change", async e => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const dataUrl = await resizeSkinImage(file);
      applyCustomImage(dataUrl);
      els.skinDialog.close();
      toast("Custom photo skin applied.");
    } catch {
      toast("That image could not be used.");
    } finally {
      e.target.value = "";
    }
  });
  els.removeCustomSkin.addEventListener("click", () => {
    clearCustomImage();
    toast("Custom photo removed.");
  });

  // ---------- Spotify PKCE ----------
  const SPOTIFY_SCOPES = [
    "streaming",
    "user-read-email",
    "user-read-private",
    "user-read-playback-state",
    "user-modify-playback-state"
  ];

  function base64UrlEncode(bytes) {
    return btoa(String.fromCharCode(...bytes))
      .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  }

  async function sha256(text) {
    return new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text)));
  }

  function randomString(length = 64) {
    const bytes = crypto.getRandomValues(new Uint8Array(length));
    return base64UrlEncode(bytes).slice(0, length);
  }

  async function startSpotifyLogin() {
    const clientId = localStorage.getItem("spotify_client_id");
    if (!clientId) {
      openSpotifySetup();
      return;
    }
    const verifier = randomString(64);
    const challenge = base64UrlEncode(await sha256(verifier));
    const state = randomString(24);
    sessionStorage.setItem("spotify_code_verifier", verifier);
    sessionStorage.setItem("spotify_oauth_state", state);

    const params = new URLSearchParams({
      client_id: clientId,
      response_type: "code",
      redirect_uri: currentRedirectUri(),
      scope: SPOTIFY_SCOPES.join(" "),
      code_challenge_method: "S256",
      code_challenge: challenge,
      state
    });
    location.assign(`https://accounts.spotify.com/authorize?${params.toString()}`);
  }

  async function handleSpotifyCallback() {
    const params = new URLSearchParams(location.search);
    const code = params.get("code");
    const error = params.get("error");
    if (error) {
      history.replaceState({}, "", currentRedirectUri());
      toast(`Spotify login was not completed: ${error}`);
      return;
    }
    if (!code) return;

    const returnedState = params.get("state");
    const savedState = sessionStorage.getItem("spotify_oauth_state");
    if (!savedState || returnedState !== savedState) {
      history.replaceState({}, "", currentRedirectUri());
      toast("Spotify sign-in check failed. Try connecting again.");
      return;
    }

    const clientId = localStorage.getItem("spotify_client_id");
    const verifier = sessionStorage.getItem("spotify_code_verifier");
    if (!clientId || !verifier) {
      history.replaceState({}, "", currentRedirectUri());
      toast("Spotify setup information is missing. Connect again.");
      return;
    }

    const body = new URLSearchParams({
      client_id: clientId,
      grant_type: "authorization_code",
      code,
      redirect_uri: currentRedirectUri(),
      code_verifier: verifier
    });

    try {
      const res = await fetch("https://accounts.spotify.com/api/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error_description || data.error || "Token request failed");
      storeSpotifyTokens(data);
      sessionStorage.removeItem("spotify_code_verifier");
      sessionStorage.removeItem("spotify_oauth_state");
      history.replaceState({}, "", currentRedirectUri());
      showSpotifyConnected();
      initSpotifyPlayer();
      toast("Spotify connected.");
    } catch (err) {
      history.replaceState({}, "", currentRedirectUri());
      toast(`Spotify connection failed: ${err.message}`);
    }
  }

  function storeSpotifyTokens(data) {
    spotifyAccessToken = data.access_token || spotifyAccessToken;
    if (data.refresh_token) {
      spotifyRefreshToken = data.refresh_token;
      localStorage.setItem("spotify_refresh_token", spotifyRefreshToken);
    }
    const expires = Date.now() + ((data.expires_in || 3600) - 60) * 1000;
    spotifyTokenExpiresAt = expires;
    sessionStorage.setItem("spotify_access_token", spotifyAccessToken);
    sessionStorage.setItem("spotify_token_expires_at", String(expires));
  }

  async function getSpotifyToken() {
    if (spotifyAccessToken && Date.now() < spotifyTokenExpiresAt) return spotifyAccessToken;
    if (!spotifyRefreshToken) return "";

    const clientId = localStorage.getItem("spotify_client_id");
    if (!clientId) return "";
    const body = new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: spotifyRefreshToken,
      client_id: clientId
    });
    const res = await fetch("https://accounts.spotify.com/api/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body
    });
    const data = await res.json();
    if (!res.ok) {
      disconnectSpotify(false);
      return "";
    }
    storeSpotifyTokens(data);
    return spotifyAccessToken;
  }

  async function spotifyFetch(path, options = {}, retry = true) {
    const token = await getSpotifyToken();
    if (!token) throw new Error("Spotify is not connected.");
    const res = await fetch(`https://api.spotify.com${path}`, {
      ...options,
      headers: {
        ...(options.body ? { "Content-Type": "application/json" } : {}),
        ...(options.headers || {}),
        Authorization: `Bearer ${token}`
      }
    });

    if (res.status === 401 && retry) {
      spotifyTokenExpiresAt = 0;
      return spotifyFetch(path, options, false);
    }
    if (res.status === 204) return null;
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const message = data?.error?.message || data?.error_description || `Spotify error ${res.status}`;
      throw new Error(message);
    }
    return data;
  }

  function showSpotifyConnected() {
    els.spotifyPanel.classList.remove("hidden");
    els.spotifyButtonText.textContent = "Connected — search and play";
  }

  function openSpotifySetup() {
    els.spotifyClientId.value = localStorage.getItem("spotify_client_id") || "";
    els.redirectUri.value = currentRedirectUri();
    els.spotifySetupDialog.showModal();
  }

  els.spotifyButton.addEventListener("click", async () => {
    if (spotifyAccessToken || spotifyRefreshToken) {
      showSpotifyConnected();
      initSpotifyPlayer();
      els.spotifyPanel.scrollIntoView({ behavior: "smooth", block: "start" });
    } else {
      openSpotifySetup();
    }
  });

  els.spotifySetupClose.addEventListener("click", () => els.spotifySetupDialog.close());
  els.spotifySetupForm.addEventListener("submit", async e => {
    e.preventDefault();
    const clientId = els.spotifyClientId.value.trim();
    if (!clientId) return;
    localStorage.setItem("spotify_client_id", clientId);
    els.spotifySetupDialog.close();
    await startSpotifyLogin();
  });

  els.copyRedirect.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(els.redirectUri.value);
      toast("Redirect URI copied.");
    } catch {
      els.redirectUri.select();
      document.execCommand("copy");
      toast("Redirect URI copied.");
    }
  });

  function disconnectSpotify(showToast = true) {
    try { spotifyPlayer?.disconnect(); } catch {}
    spotifyPlayer = null;
    spotifyDeviceId = null;
    spotifyState = null;
    spotifyAccessToken = "";
    spotifyRefreshToken = "";
    spotifyTokenExpiresAt = 0;
    sessionStorage.removeItem("spotify_access_token");
    sessionStorage.removeItem("spotify_token_expires_at");
    localStorage.removeItem("spotify_refresh_token");
    els.spotifyPanel.classList.add("hidden");
    els.spotifyButtonText.textContent = "Sign in and use Spotify Premium";
    if (showToast) toast("Spotify disconnected.");
  }

  els.spotifyDisconnect.addEventListener("click", () => disconnectSpotify());

  // The SDK invokes this global callback when its script is ready.
  window.onSpotifyWebPlaybackSDKReady = () => {
    spotifySdkReady = true;
    if (spotifyAccessToken || spotifyRefreshToken) initSpotifyPlayer();
  };

  async function initSpotifyPlayer() {
    if (spotifyPlayer) return;
    if (!spotifySdkReady || !window.Spotify) {
      els.spotifyStatus.textContent = "Loading Spotify player…";
      return;
    }
    const token = await getSpotifyToken();
    if (!token) return;

    spotifyPlayer = new Spotify.Player({
      name: "Pocket Jukebox",
      getOAuthToken: async cb => cb(await getSpotifyToken()),
      volume: Number(els.volumeBar.value)
    });

    spotifyPlayer.addListener("ready", ({ device_id }) => {
      spotifyDeviceId = device_id;
      els.spotifyStatus.textContent = "Pocket Jukebox is ready for Spotify.";
    });
    spotifyPlayer.addListener("not_ready", () => {
      els.spotifyStatus.textContent = "Spotify player went offline. Reopen the page if needed.";
    });
    spotifyPlayer.addListener("initialization_error", ({ message }) => {
      els.spotifyStatus.textContent = `Spotify player error: ${message}`;
    });
    spotifyPlayer.addListener("authentication_error", ({ message }) => {
      els.spotifyStatus.textContent = `Spotify sign-in error: ${message}`;
    });
    spotifyPlayer.addListener("account_error", ({ message }) => {
      els.spotifyStatus.textContent = `Spotify account error: ${message}. Premium is required for Web Playback.`;
    });
    spotifyPlayer.addListener("playback_error", ({ message }) => {
      els.spotifyStatus.textContent = `Spotify playback error: ${message}`;
    });
    spotifyPlayer.addListener("player_state_changed", state => {
      if (!state) return;
      spotifyState = state;
      if (currentSource === "spotify") updateSpotifyStateUI(state);
    });

    try {
      // Important on iOS: user interaction still may be required before playback starts.
      if (spotifyPlayer.activateElement) await spotifyPlayer.activateElement();
      await spotifyPlayer.connect();
    } catch (err) {
      els.spotifyStatus.textContent = `Could not start Spotify player: ${err.message}`;
    }
  }

  function updateSpotifyStateUI(state) {
    setPlayingUI(!state.paused);
    els.currentTime.textContent = formatTime(state.position / 1000);
    els.duration.textContent = formatTime(state.duration / 1000);
    els.seekBar.value = state.duration ? (state.position / state.duration) * 100 : 0;

    const sdkTrack = state.track_window?.current_track;
    if (sdkTrack) {
      els.title.textContent = sdkTrack.name;
      els.artist.textContent = sdkTrack.artists?.map(a => a.name).join(", ") || "Spotify";
      els.sourceBadge.textContent = "SPOTIFY";
    }

    if (!state.paused) startSpotifyProgressTimer();
    else stopSpotifyProgressTimer();
  }

  function startSpotifyProgressTimer() {
    stopSpotifyProgressTimer();
    spotifyProgressTimer = setInterval(() => {
      if (currentSource !== "spotify" || !spotifyState || spotifyState.paused) return;
      spotifyState = { ...spotifyState, position: Math.min(spotifyState.duration, spotifyState.position + 1000) };
      els.currentTime.textContent = formatTime(spotifyState.position / 1000);
      els.seekBar.value = spotifyState.duration ? (spotifyState.position / spotifyState.duration) * 100 : 0;
    }, 1000);
  }

  function stopSpotifyProgressTimer() {
    if (spotifyProgressTimer) clearInterval(spotifyProgressTimer);
    spotifyProgressTimer = null;
  }

  els.spotifySearchForm.addEventListener("submit", async e => {
    e.preventDefault();
    const q = els.spotifySearchInput.value.trim();
    if (!q) return;
    els.spotifyStatus.textContent = "Searching…";
    els.spotifyResults.innerHTML = "";

    try {
      const data = await spotifyFetch(`/v1/search?type=track&limit=12&q=${encodeURIComponent(q)}`);
      const tracks = data?.tracks?.items || [];
      renderSpotifyResults(tracks);
      els.spotifyStatus.textContent = tracks.length ? `${tracks.length} result${tracks.length === 1 ? "" : "s"}` : "No songs found.";
    } catch (err) {
      els.spotifyStatus.textContent = err.message;
    }
  });

  function renderSpotifyResults(tracks) {
    els.spotifyResults.innerHTML = "";
    tracks.forEach(track => {
      const item = document.createElement("div");
      item.className = "result-item";
      const image = track.album?.images?.[track.album.images.length - 1]?.url || track.album?.images?.[0]?.url || "";
      item.innerHTML = `
        ${image ? `<img src="${escapeHtml(image)}" alt="">` : '<div class="queue-art"></div>'}
        <div class="result-meta">
          <strong>${escapeHtml(track.name)}</strong>
          <span>${escapeHtml(track.artists?.map(a => a.name).join(", ") || "Spotify")}</span>
        </div>
        <button type="button" aria-label="Add ${escapeHtml(track.name)}">＋</button>
      `;
      item.querySelector("button").addEventListener("click", () => {
        queue.push({
          id: track.id,
          source: "spotify",
          title: track.name,
          artist: track.artists?.map(a => a.name).join(", ") || "Spotify",
          uri: track.uri,
          image
        });
        renderQueue();
        toast("Added to queue.");
        if (currentIndex < 0) playIndex(0);
      });
      els.spotifyResults.appendChild(item);
    });
  }

  async function playSpotifyItem(item) {
    currentSource = "spotify";
    els.localAudio.pause();
    updateTrackDisplay(item);
    setPlayingUI(false);

    await initSpotifyPlayer();
    if (!spotifyDeviceId) {
      els.spotifyStatus.textContent = "Spotify player is still starting. Tap the song again in a moment.";
      toast("Spotify player is starting.");
      return;
    }

    try {
      // Transfer playback to this web player first.
      await spotifyFetch("/v1/me/player", {
        method: "PUT",
        body: JSON.stringify({ device_ids: [spotifyDeviceId], play: false })
      });
      await spotifyFetch(`/v1/me/player/play?device_id=${encodeURIComponent(spotifyDeviceId)}`, {
        method: "PUT",
        body: JSON.stringify({ uris: [item.uri] })
      });
      setPlayingUI(true);
    } catch (err) {
      els.spotifyStatus.textContent = err.message;
      toast(err.message);
    }
  }

  // ---------- PWA ----------
  if ("serviceWorker" in navigator && location.protocol === "https:") {
    navigator.serviceWorker.register("./sw.js").catch(() => {});
  }

  // ---------- Startup ----------
  loadSkin();
  renderQueue();
  els.redirectUri.value = currentRedirectUri();
  setPlayingUI(false);

  if (spotifyAccessToken || spotifyRefreshToken) {
    showSpotifyConnected();
  }

  handleSpotifyCallback().then(() => {
    if (spotifyAccessToken || spotifyRefreshToken) initSpotifyPlayer();
  });
})();
