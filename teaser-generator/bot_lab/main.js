// bot_lab/main.js
// ------------------------------------------------------------
// Minimal browser harness to poke the CrosSwords FastAPI server without touching the Expo app.
// Supports: create/join, submit words/ready, bot join/move via internal endpoints, and auto bot turns.

const API_BASE_URL = "http://10.0.0.153:8000";
const DEFAULT_API_KEY = "2dcc942f5a819c6f6d40fdf684c13e1877cda611eec4c3ab"; // from crosswords_mobile/.env
const DEFAULT_BOT_API_KEY = ""; // optional second user key if you want manual bot
const DEFAULT_BOT_TOKEN = "dev-bot-token"; // X-Bot-Token for internal bot endpoints
// Must satisfy server validate_wordset: two 4-letter, two 5-letter, one 6-letter (matched to server config)
const DEFAULT_BOT_WORDS = ["LIME", "BOAT", "APPLE", "TRAIN", "ORANGE"];
// P1 defaults also match required lengths (2x4, 2x5, 1x6)
const DEFAULT_P1_WORDS = "MIST,WORD,APPLE,BREAD,ORANGE";
const DEFAULT_P2_WORDS = DEFAULT_BOT_WORDS.join(",");
const POLL_MS = 1500;

const el = (id) => document.getElementById(id);
const logEl = el("eventLog");
const stateLogEl = el("stateLog");
const serverUrlEl = el("server-url");
serverUrlEl.textContent = API_BASE_URL;

let autoBotEnabled = false;
let pollTimer = null;
let botUserId = null;

function log(message) {
  const stamp = new Date().toLocaleTimeString();
  logEl.textContent = `[${stamp}] ${message}\n` + logEl.textContent;
}

async function handleResponse(res) {
  if (!res.ok) {
    let detail = await res.text();
    try {
      const parsed = JSON.parse(detail);
      detail = parsed.detail || JSON.stringify(parsed, null, 2);
    } catch {
      // keep text
    }
    throw new Error(`${res.status} ${res.statusText} - ${detail}`);
  }
  if (res.status === 204) return null;
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function headers(apiKey) {
  return {
    Accept: "application/json",
    "Content-Type": "application/json",
    ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
  };
}

async function createGame(apiKey) {
  const res = await fetch(`${API_BASE_URL}/games/create`, {
    method: "POST",
    headers: headers(apiKey),
  });
  return handleResponse(res);
}

async function joinGame(apiKey, gameId) {
  const res = await fetch(`${API_BASE_URL}/games/join`, {
    method: "POST",
    headers: headers(apiKey),
    body: JSON.stringify({ game_id: Number(gameId) }),
  });
  return handleResponse(res);
}

async function submitGuess(apiKey, gameId, targetIndex, guess) {
  const res = await fetch(`${API_BASE_URL}/games/${gameId}/guess`, {
    method: "POST",
    headers: headers(apiKey),
    body: JSON.stringify({ target_index: Number(targetIndex), guess }),
  });
  return handleResponse(res);
}

async function submitWords(apiKey, gameId, wordsCsv) {
  const words = (wordsCsv || "")
    .split(",")
    .map((w) => w.trim().toUpperCase())
    .filter(Boolean);
  const res = await fetch(`${API_BASE_URL}/games/${gameId}/submit_words`, {
    method: "POST",
    headers: headers(apiKey),
    body: JSON.stringify({ words }),
  });
  return handleResponse(res);
}

async function markReady(apiKey, gameId) {
  const res = await fetch(`${API_BASE_URL}/games/${gameId}/ready`, {
    method: "POST",
    headers: headers(apiKey),
  });
  return handleResponse(res);
}

async function fetchState(apiKey, gameId) {
  const res = await fetch(`${API_BASE_URL}/games/${gameId}/state`, {
    method: "GET",
    headers: headers(apiKey),
  });
  return handleResponse(res);
}

async function botJoinInternal(gameId, botToken) {
  const res = await fetch(`${API_BASE_URL}/games/${gameId}/bot_join`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      "X-Bot-Token": botToken,
    },
  });
  return handleResponse(res);
}

async function botMoveInternal(gameId, botToken) {
  const res = await fetch(`${API_BASE_URL}/games/${gameId}/bot_move`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      "X-Bot-Token": botToken,
    },
  });
  return handleResponse(res);
}

async function maybeBotMove(botToken, gameId) {
  if (!botToken) {
    alert("Bot token required.");
    return;
  }
  const apiKey = el("apiKey").value.trim();
  const state = await fetchState(apiKey, gameId);
  if (!botUserId) {
    log("Bot user id unknown. Run Bot join (internal) first.");
    return;
  }
  if (state.current_turn_user_id !== botUserId) {
    log("Bot move skipped: waiting for bot turn.");
    return;
  }
  const result = await botMoveInternal(gameId, botToken);
  log(`🤖 Bot guessed "${result.guess}" slot ${result.target_index} → ${JSON.stringify(result.codes || [])}`);
  await refreshState(apiKey, gameId);
}

async function refreshState(apiKey, gameId) {
  try {
    const state = await fetchState(apiKey, gameId);
    stateLogEl.textContent = JSON.stringify(state, null, 2);
    const status = state.status || "unknown";
    const myTurn = state.current_turn_user_id === (state.me && state.me.user_id);
    el("stateSummary").textContent = `Status: ${status} | Your turn: ${myTurn ? "Yes" : "No"}`;
  } catch (err) {
    stateLogEl.textContent = `Error: ${err.message}`;
  }
}

function ensurePoll(apiKey, gameId) {
  if (pollTimer) clearInterval(pollTimer);
  pollTimer = setInterval(() => refreshState(apiKey, gameId), POLL_MS);
}

function wireUi() {
  el("botWords").value = DEFAULT_BOT_WORDS.join(", ");
  const savedKey = window.localStorage.getItem("botlab_api_key") || DEFAULT_API_KEY;
  el("apiKey").value = savedKey;
  const savedBotKey = window.localStorage.getItem("botlab_api_key_bot") || DEFAULT_BOT_API_KEY;
  el("botApiKey").value = savedBotKey;
  const savedBotToken = window.localStorage.getItem("botlab_bot_token") || DEFAULT_BOT_TOKEN;
  el("botToken").value = savedBotToken;
  el("p1Words").value = DEFAULT_P1_WORDS;
  el("p2Words").value = DEFAULT_P2_WORDS;

  el("btnCreate").onclick = async () => {
    const apiKey = el("apiKey").value.trim();
    if (!apiKey) return alert("Enter API key first");
    window.localStorage.setItem("botlab_api_key", apiKey);
    try {
      const data = await createGame(apiKey);
      const gameId = data.game_id;
      el("gameId").value = gameId;
      el("connectionStatus").textContent = `Created game ${gameId}`;
      log(`Created game ${gameId}`);
      ensurePoll(apiKey, gameId);
    } catch (err) {
      alert(err.message);
    }
  };

  el("btnJoin").onclick = async () => {
    const apiKey = el("apiKey").value.trim();
    const gameId = el("gameId").value.trim();
    if (!apiKey || !gameId) return alert("API key and game id required");
    window.localStorage.setItem("botlab_api_key", apiKey);
    try {
      await joinGame(apiKey, gameId);
      el("connectionStatus").textContent = `Joined game ${gameId}`;
      log(`Joined game ${gameId}`);
      ensurePoll(apiKey, gameId);
    } catch (err) {
      alert(err.message);
    }
  };

  el("btnJoinBot").onclick = async () => {
    const apiKey = el("botApiKey").value.trim();
    const gameId = el("gameId").value.trim();
    if (!apiKey || !gameId) return alert("Bot API key and game id required");
    window.localStorage.setItem("botlab_api_key_bot", apiKey);
    try {
      await joinGame(apiKey, gameId);
      el("connectionStatus").textContent = `Bot joined game ${gameId}`;
      log(`Bot (P2) joined game ${gameId}`);
      ensurePoll(apiKey, gameId);
    } catch (err) {
      alert(err.message);
    }
  };

  el("btnSubmitWordsP1").onclick = async () => {
    const apiKey = el("apiKey").value.trim();
    const gameId = el("gameId").value.trim();
    if (!apiKey || !gameId) return alert("P1 API key and game id required");
    try {
      await submitWords(apiKey, gameId, el("p1Words").value);
      log("P1 submitted words");
    } catch (err) {
      alert(err.message);
    }
  };

  el("btnSubmitWordsP2").onclick = async () => {
    const apiKey = el("botApiKey").value.trim();
    const gameId = el("gameId").value.trim();
    if (!apiKey || !gameId) return alert("P2 API key and game id required");
    try {
      await submitWords(apiKey, gameId, el("p2Words").value);
      log("P2 submitted words");
    } catch (err) {
      alert(err.message);
    }
  };

  el("btnReadyP1").onclick = async () => {
    const apiKey = el("apiKey").value.trim();
    const gameId = el("gameId").value.trim();
    if (!apiKey || !gameId) return alert("P1 API key and game id required");
    try {
      await markReady(apiKey, gameId);
      log("P1 marked ready");
    } catch (err) {
      alert(err.message);
    }
  };

  el("btnReadyP2").onclick = async () => {
    const apiKey = el("botApiKey").value.trim();
    const gameId = el("gameId").value.trim();
    if (!apiKey || !gameId) return alert("P2 API key and game id required");
    try {
      await markReady(apiKey, gameId);
      log("P2 marked ready");
    } catch (err) {
      alert(err.message);
    }
  };

  el("btnSubmitGuess").onclick = async () => {
    const apiKey = el("apiKey").value.trim();
    const gameId = el("gameId").value.trim();
    const targetIndex = el("targetIndex").value;
    const guess = (el("guessText").value || "").toUpperCase();
    if (!apiKey || !gameId || !guess) return alert("Fill API key, game id, guess");
    window.localStorage.setItem("botlab_api_key", apiKey);
    try {
      const res = await submitGuess(apiKey, gameId, targetIndex, guess);
      log(`You guessed "${guess}" slot ${targetIndex} → ${JSON.stringify(res.codes || [])}`);
      await refreshState(apiKey, gameId);
      if (autoBotEnabled) {
        const botToken = el("botToken").value.trim();
        setTimeout(() => {
          maybeBotMove(botToken, gameId).catch((err) => log(`Bot auto error: ${err.message}`));
        }, 500);
      }
    } catch (err) {
      alert(err.message);
    }
  };

  el("btnBotMove").onclick = async () => {
    const botToken = el("botToken").value.trim();
    const gameId = el("gameId").value.trim();
    if (!botToken || !gameId) return alert("Bot token and game id required");
    window.localStorage.setItem("botlab_bot_token", botToken);
    await maybeBotMove(botToken, gameId);
  };

  el("btnBotJoinInternal").onclick = async () => {
    const botToken = el("botToken").value.trim();
    const gameId = el("gameId").value.trim();
    if (!botToken || !gameId) return alert("Bot token and game id required");
    window.localStorage.setItem("botlab_bot_token", botToken);
    try {
      const res = await botJoinInternal(gameId, botToken);
      botUserId = res.bot_user_id || botUserId;
      log(`Bot joined and readied via internal endpoint (user ${botUserId || "unknown"})`);
      await refreshState(el("apiKey").value.trim(), gameId);
    } catch (err) {
      alert(err.message);
    }
  };

  el("btnRefresh").onclick = async () => {
    const apiKey = el("apiKey").value.trim();
    const gameId = el("gameId").value.trim();
    if (!apiKey || !gameId) return alert("API key and game id required");
    await refreshState(apiKey, gameId);
  };

  el("autoBot").onchange = (e) => {
    autoBotEnabled = e.target.checked;
    el("botStatus").textContent = autoBotEnabled ? "Auto bot: ON" : "Auto bot: OFF";
  };
}

wireUi();
