let citeMode = false;
let activeNote = null;
let contextMenuEl = null;
let dropupEl = null;
let selectedRange = null;

async function loadSettings() {
  const result = await chrome.storage.local.get(["citeMode", "activeNote"]);
  citeMode = !!result.citeMode;
  activeNote = result.activeNote || null;
}

loadSettings();

chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === "SETTINGS_CHANGED") loadSettings();
});

function removeMenus() {
  if (contextMenuEl) { contextMenuEl.remove(); contextMenuEl = null; }
  if (dropupEl) { dropupEl.remove(); dropupEl = null; }
}

function createDropup(items, anchorEl, onSelect) {
  if (dropupEl) { dropupEl.remove(); dropupEl = null; }

  const rect = anchorEl.getBoundingClientRect();
  const drop = document.createElement("div");
  drop.className = "nbep-dropup";
  drop.style.cssText = `
    position: fixed;
    left: ${rect.left}px;
    top: ${rect.top - (items.length * 36) - 8}px;
    background: #fffef0;
    border: 2px solid #000;
    box-shadow: 3px -3px 0 #000;
    min-width: 160px;
    z-index: 2147483646;
    font-family: 'DM Sans', Arial, sans-serif;
  `;

  items.forEach(item => {
    const btn = document.createElement("div");
    btn.style.cssText = `
      padding: 9px 14px;
      font-size: 13px;
      font-weight: 600;
      color: #111;
      cursor: pointer;
      border-bottom: 1px solid #e8e6d8;
      display: flex;
      align-items: center;
      gap: 8px;
      transition: background 0.1s;
    `;
    btn.innerHTML = item.html;
    btn.addEventListener("mouseenter", () => { btn.style.background = "#f0eedc"; });
    btn.addEventListener("mouseleave", () => { btn.style.background = ""; });
    btn.addEventListener("mousedown", (e) => {
      e.preventDefault();
      e.stopPropagation();
      onSelect(item.value);
      removeMenus();
    });
    drop.appendChild(btn);
  });

  document.body.appendChild(drop);
  dropupEl = drop;
}

function applyHighlight(color) {
  if (!selectedRange) return;
  const colorMap = {
    green: "#b2f2bb",
    yellow: "#fff3b0",
    pink: "#ffc0cb",
    blue: "#b3d9ff"
  };
  const mark = document.createElement("mark");
  mark.style.backgroundColor = colorMap[color] || colorMap.yellow;
  mark.style.borderRadius = "2px";
  mark.dataset.nbepHighlight = color;
  try {
    selectedRange.surroundContents(mark);
  } catch {
    const frag = selectedRange.extractContents();
    mark.appendChild(frag);
    selectedRange.insertNode(mark);
  }
  window.getSelection().removeAllRanges();
}

async function applyNote(noteId) {
  if (!selectedRange) return;
  const result = await chrome.storage.local.get(["notes"]);
  const notes = result.notes || {};
  const note = notes[noteId];
  if (!note) return;

  const span = document.createElement("span");
  span.style.cssText = "border-bottom: 2px dashed #1f2f5a; cursor: help; position: relative;";
  span.title = "[" + note.name + "] " + (note.entries || []).join(" | ");
  span.dataset.nbepNote = noteId;
  try {
    selectedRange.surroundContents(span);
  } catch {
    const frag = selectedRange.extractContents();
    span.appendChild(frag);
    selectedRange.insertNode(span);
  }
  window.getSelection().removeAllRanges();
}

function applyStyle(style) {
  if (!selectedRange) return;
  const styleMap = {
    bold: ["strong", ""],
    underline: ["span", "text-decoration: underline;"],
    strikethrough: ["span", "text-decoration: line-through;"],
    "color-red": ["span", "color: #cc0000;"],
    "color-navy": ["span", "color: #1f2f5a;"],
    "color-gold": ["span", "color: #b8960c;"]
  };
  const [tag, css] = styleMap[style] || ["span", ""];
  const el = document.createElement(tag);
  if (css) el.style.cssText = css;
  try {
    selectedRange.surroundContents(el);
  } catch {
    const frag = selectedRange.extractContents();
    el.appendChild(frag);
    selectedRange.insertNode(el);
  }
  window.getSelection().removeAllRanges();
}

async function showCiteMenu(x, y) {
  removeMenus();

  const result = await chrome.storage.local.get(["notes"]);
  const notes = result.notes || {};
  const noteIds = Object.keys(notes);

  const menu = document.createElement("div");
  menu.className = "nbep-context-menu";
  menu.style.cssText = `
    position: fixed;
    left: ${x}px;
    top: ${y}px;
    background: #fffef0;
    border: 2px solid #000;
    box-shadow: 3px 3px 0 #000;
    display: flex;
    flex-direction: row;
    z-index: 2147483647;
    font-family: 'DM Sans', Arial, sans-serif;
    overflow: visible;
  `;

  const buttons = [
    {
      id: "highlight-btn",
      label: "Highlight",
      icon: `<svg width="18" height="18" viewBox="0 0 18 18" fill="none"><rect x="2" y="10" width="14" height="5" rx="1" fill="#fff3b0" stroke="#000" stroke-width="1.5"/><rect x="5" y="3" width="8" height="8" rx="1" fill="#ffd900" stroke="#000" stroke-width="1.5"/></svg>`,
      action: () => {
        const items = [
          { html: '<span style="display:inline-block;width:14px;height:14px;background:#b2f2bb;border:1px solid #555;border-radius:2px;"></span> Green', value: "green" },
          { html: '<span style="display:inline-block;width:14px;height:14px;background:#fff3b0;border:1px solid #555;border-radius:2px;"></span> Yellow', value: "yellow" },
          { html: '<span style="display:inline-block;width:14px;height:14px;background:#ffc0cb;border:1px solid #555;border-radius:2px;"></span> Pink', value: "pink" },
          { html: '<span style="display:inline-block;width:14px;height:14px;background:#b3d9ff;border:1px solid #555;border-radius:2px;"></span> Blue', value: "blue" }
        ];
        createDropup(items, btn, applyHighlight);
      }
    },
    {
      id: "note-btn",
      label: "Note",
      icon: `<svg width="18" height="18" viewBox="0 0 18 18" fill="none"><rect x="2" y="2" width="14" height="14" rx="2" fill="#fffef0" stroke="#000" stroke-width="1.5"/><line x1="5" y1="6" x2="13" y2="6" stroke="#1f2f5a" stroke-width="1.5"/><line x1="5" y1="9" x2="13" y2="9" stroke="#1f2f5a" stroke-width="1.5"/><line x1="5" y1="12" x2="9" y2="12" stroke="#1f2f5a" stroke-width="1.5"/></svg>`,
      action: () => {
        if (noteIds.length === 0) {
          createDropup([{ html: "No note files yet", value: "__none__" }], btn, () => {});
          return;
        }
        const items = noteIds.map(id => ({
          html: `<svg width="12" height="12" viewBox="0 0 12 12"><rect width="12" height="12" rx="2" fill="#1f2f5a"/></svg> ${notes[id].name}`,
          value: id
        }));
        createDropup(items, btn, applyNote);
      }
    },
    {
      id: "style-btn",
      label: "Style",
      icon: `<svg width="18" height="18" viewBox="0 0 18 18" fill="none"><text x="2" y="14" font-family="Georgia,serif" font-size="13" font-weight="700" fill="#1f2f5a">A</text><text x="9" y="14" font-family="Georgia,serif" font-size="13" fill="#000" text-decoration="underline">a</text></svg>`,
      action: () => {
        const items = [
          { html: "<strong>Bold</strong>", value: "bold" },
          { html: "<span style='text-decoration:underline'>Underline</span>", value: "underline" },
          { html: "<span style='text-decoration:line-through'>Strikethrough</span>", value: "strikethrough" },
          { html: "<span style='color:#cc0000'>Color: Red</span>", value: "color-red" },
          { html: "<span style='color:#1f2f5a'>Color: Navy</span>", value: "color-navy" },
          { html: "<span style='color:#b8960c'>Color: Gold</span>", value: "color-gold" }
        ];
        createDropup(items, btn, applyStyle);
      }
    }
  ];

  buttons.forEach(def => {
    const btn = document.createElement("div");
    btn.id = def.id;
    btn.style.cssText = `
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 4px;
      padding: 10px 16px;
      cursor: pointer;
      border-right: 1px solid #e8e6d8;
      min-width: 70px;
      transition: background 0.1s;
      user-select: none;
    `;
    btn.innerHTML = def.icon + `<span style="font-size:11px;font-weight:700;color:#111;letter-spacing:0.5px;">${def.label}</span>`;
    btn.addEventListener("mouseenter", () => { btn.style.background = "#f0eedc"; });
    btn.addEventListener("mouseleave", () => { btn.style.background = ""; });
    btn.addEventListener("mousedown", (e) => {
      e.preventDefault();
      e.stopPropagation();
      def.action(btn);
    });
    btn.querySelector("span") || 0;
    const lastChild = btn.lastElementChild;
    def._btnEl = btn;
    Object.defineProperty(def, "btn", { get: () => btn });
    menu.appendChild(btn);
  });

  document.body.appendChild(menu);
  contextMenuEl = menu;

  const mw = menu.offsetWidth;
  const ww = window.innerWidth;
  if (x + mw > ww) menu.style.left = (ww - mw - 8) + "px";
}

document.addEventListener("contextmenu", async (e) => {
  if (!citeMode) return;

  const sel = window.getSelection();
  if (!sel || sel.isCollapsed || sel.toString().trim() === "") return;

  e.preventDefault();
  e.stopPropagation();

  selectedRange = sel.getRangeAt(0).cloneRange();
  await showCiteMenu(e.clientX, e.clientY);
}, true);

document.addEventListener("mousedown", (e) => {
  if (contextMenuEl && !contextMenuEl.contains(e.target) && (!dropupEl || !dropupEl.contains(e.target))) {
    removeMenus();
  }
});

document.addEventListener("scroll", () => removeMenus(), true);
document.addEventListener("keydown", (e) => { if (e.key === "Escape") removeMenus(); });
