const STORAGE_KEYS = ["citeMode", "workEnvMode", "readerMode", "darkMode", "notes", "activeNote"];

let state = {
  citeMode: false,
  workEnvMode: false,
  readerMode: false,
  darkMode: false,
  notes: {},
  activeNote: null
};

let timerInterval = null;
let timerSeconds = 25 * 60;
let timerRunning = false;
let selectedMinutes = 25;

async function loadState() {
  const result = await chrome.storage.local.get(STORAGE_KEYS);
  state = { ...state, ...result };
  if (!state.notes) state.notes = {};
}

function saveState(keys) {
  const toSave = {};
  keys.forEach(k => { toSave[k] = state[k]; });
  chrome.storage.local.set(toSave);
}

function setDot(id, on) {
  const dot = document.getElementById(id);
  if (!dot) return;
  dot.className = "status-dot " + (on ? "on" : "off");
}

function updateToggleUI() {
  document.getElementById("toggle-cite").checked = state.citeMode;
  document.getElementById("toggle-work").checked = state.workEnvMode;
  document.getElementById("toggle-reader").checked = state.readerMode;
  document.getElementById("toggle-dark").checked = state.darkMode;
  setDot("dot-cite", state.citeMode);
  setDot("dot-work", state.workEnvMode);
  setDot("dot-reader", state.readerMode);
  setDot("dot-dark", state.darkMode);
}

function renderNotesList() {
  const list = document.getElementById("notes-list");
  list.innerHTML = "";
  const noteIds = Object.keys(state.notes);
  if (noteIds.length === 0) {
    list.innerHTML = '<div style="font-size:12px;color:#888;padding:8px 0;">No note files yet. Create one below.</div>';
    document.getElementById("note-entries-area").style.display = "none";
    return;
  }
  noteIds.forEach(id => {
    const note = state.notes[id];
    const item = document.createElement("div");
    item.className = "note-item" + (state.activeNote === id ? " selected" : "");
    item.innerHTML = `
      <span class="note-item-name">${note.name}</span>
      <span class="note-item-count">${(note.entries || []).length} entries</span>
      <button class="note-delete" data-id="${id}" title="Delete">×</button>
    `;
    item.addEventListener("click", (e) => {
      if (e.target.classList.contains("note-delete")) return;
      state.activeNote = id;
      saveState(["activeNote"]);
      renderNotesList();
      renderNoteEntries(id);
    });
    item.querySelector(".note-delete").addEventListener("click", (e) => {
      e.stopPropagation();
      deleteNote(id);
    });
    list.appendChild(item);
  });

  if (state.activeNote && state.notes[state.activeNote]) {
    document.getElementById("note-entries-area").style.display = "block";
    renderNoteEntries(state.activeNote);
  } else {
    document.getElementById("note-entries-area").style.display = "none";
  }
}

function renderNoteEntries(noteId) {
  const note = state.notes[noteId];
  if (!note) return;
  document.getElementById("note-entries-label").textContent = note.name + " — Entries";
  const list = document.getElementById("note-entries-list");
  const entries = note.entries || [];
  if (entries.length === 0) {
    list.innerHTML = '<div style="font-size:11px;color:#aaa;">No entries yet.</div>';
    return;
  }
  list.innerHTML = "";
  entries.forEach((entry, i) => {
    const div = document.createElement("div");
    div.className = "note-entry-item";
    div.innerHTML = `<span class="note-entry-text">${entry}</span><button class="note-entry-del" data-idx="${i}">×</button>`;
    div.querySelector(".note-entry-del").addEventListener("click", () => {
      state.notes[noteId].entries.splice(i, 1);
      saveState(["notes"]);
      renderNoteEntries(noteId);
      renderNotesList();
    });
    list.appendChild(div);
  });
}

function deleteNote(id) {
  delete state.notes[id];
  if (state.activeNote === id) state.activeNote = null;
  saveState(["notes", "activeNote"]);
  renderNotesList();
}

function applyModeToActiveTab(mode, value) {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (!tabs[0] || !tabs[0].id) return;
    const tabId = tabs[0].id;
    const url = tabs[0].url || "";
    if (url.startsWith("chrome://") || url.startsWith("chrome-extension://")) return;

    if (mode === "readerMode") {
      if (value) {
        chrome.scripting.insertCSS({
          target: { tabId },
          css: `
            body { max-width: 720px !important; margin: 40px auto !important; font-family: 'Georgia', serif !important; font-size: 18px !important; line-height: 1.8 !important; color: #1a1a1a !important; background: #fffef0 !important; }
            header, footer, nav, aside, .sidebar, .ad, [class*="ad-"], [id*="sidebar"] { display: none !important; }
            img { max-width: 100% !important; }
          `
        }).catch(() => {});
      }
    }

    if (mode === "darkMode") {
      if (value) {
        chrome.scripting.insertCSS({
          target: { tabId },
          css: `html { filter: invert(1) hue-rotate(180deg) !important; } img, video, canvas, svg { filter: invert(1) hue-rotate(180deg) !important; }`
        }).catch(() => {});
      }
    }
  });
}

function formatTime(seconds) {
  const m = Math.floor(seconds / 60).toString().padStart(2, "0");
  const s = (seconds % 60).toString().padStart(2, "0");
  return m + ":" + s;
}

function updateTimerDisplay() {
  document.getElementById("timer-display").textContent = formatTime(timerSeconds);
}

function startTimer() {
  if (timerRunning) return;
  timerRunning = true;
  document.getElementById("btn-timer-start").disabled = true;
  document.getElementById("btn-timer-pause").disabled = false;
  timerInterval = setInterval(() => {
    if (timerSeconds <= 0) {
      clearInterval(timerInterval);
      timerRunning = false;
      document.getElementById("timer-display").textContent = "DONE!";
      document.getElementById("btn-timer-start").disabled = false;
      document.getElementById("btn-timer-pause").disabled = true;
      return;
    }
    timerSeconds--;
    updateTimerDisplay();
  }, 1000);
}

function pauseTimer() {
  clearInterval(timerInterval);
  timerRunning = false;
  document.getElementById("btn-timer-start").disabled = false;
  document.getElementById("btn-timer-pause").disabled = true;
}

function resetTimer() {
  clearInterval(timerInterval);
  timerRunning = false;
  timerSeconds = selectedMinutes * 60;
  updateTimerDisplay();
  document.getElementById("btn-timer-start").disabled = false;
  document.getElementById("btn-timer-pause").disabled = true;
}

async function init() {
  await loadState();
  updateToggleUI();
  renderNotesList();
  updateTimerDisplay();

  document.querySelectorAll(".tab-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
      document.querySelectorAll(".tab-content").forEach(c => c.classList.remove("active"));
      btn.classList.add("active");
      document.getElementById("tab-" + btn.dataset.tab).classList.add("active");
    });
  });

  document.getElementById("toggle-cite").addEventListener("change", (e) => {
    state.citeMode = e.target.checked;
    saveState(["citeMode"]);
    setDot("dot-cite", state.citeMode);
  });

  document.getElementById("toggle-work").addEventListener("change", (e) => {
    state.workEnvMode = e.target.checked;
    saveState(["workEnvMode"]);
    setDot("dot-work", state.workEnvMode);
  });

  document.getElementById("toggle-reader").addEventListener("change", (e) => {
    state.readerMode = e.target.checked;
    saveState(["readerMode"]);
    setDot("dot-reader", state.readerMode);
    applyModeToActiveTab("readerMode", state.readerMode);
  });

  document.getElementById("toggle-dark").addEventListener("change", (e) => {
    state.darkMode = e.target.checked;
    saveState(["darkMode"]);
    setDot("dot-dark", state.darkMode);
    applyModeToActiveTab("darkMode", state.darkMode);
  });

  document.getElementById("btn-create-note").addEventListener("click", () => {
    const nameInput = document.getElementById("new-note-name");
    const name = nameInput.value.trim();
    if (!name) return;
    const id = "note_" + Date.now();
    state.notes[id] = { name, entries: [] };
    state.activeNote = id;
    saveState(["notes", "activeNote"]);
    nameInput.value = "";
    renderNotesList();
  });

  document.getElementById("new-note-name").addEventListener("keydown", (e) => {
    if (e.key === "Enter") document.getElementById("btn-create-note").click();
  });

  document.getElementById("btn-delete-note").addEventListener("click", () => {
    if (state.activeNote) deleteNote(state.activeNote);
  });

  document.getElementById("btn-add-entry").addEventListener("click", () => {
    if (!state.activeNote) return;
    const input = document.getElementById("new-entry-text");
    const text = input.value.trim();
    if (!text) return;
    if (!state.notes[state.activeNote].entries) state.notes[state.activeNote].entries = [];
    state.notes[state.activeNote].entries.push(text);
    saveState(["notes"]);
    input.value = "";
    renderNoteEntries(state.activeNote);
    renderNotesList();
  });

  document.getElementById("new-entry-text").addEventListener("keydown", (e) => {
    if (e.key === "Enter") document.getElementById("btn-add-entry").click();
  });

  document.querySelectorAll(".focus-preset-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".focus-preset-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      selectedMinutes = parseInt(btn.dataset.minutes);
      resetTimer();
    });
  });

  document.getElementById("btn-timer-start").addEventListener("click", startTimer);
  document.getElementById("btn-timer-pause").addEventListener("click", pauseTimer);
  document.getElementById("btn-timer-reset").addEventListener("click", resetTimer);
}

init();
