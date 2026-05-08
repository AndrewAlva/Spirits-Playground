import { scroll } from './scroll.js';

// Only active when ?debug is present in the URL — zero overhead otherwise.
if (new URLSearchParams(window.location.search).has('debug')) {
  // ─── Styles ────────────────────────────────────────────────────────────────

  const style = document.createElement('style');
  style.textContent = `
    #debug-panel {
      position: fixed;
      top: 1rem;
      right: 1rem;
      z-index: 9999;
      background: rgba(0, 0, 0, 0.72);
      border: 1px solid rgba(255, 255, 255, 0.12);
      border-radius: 6px;
      padding: 0;
      font-family: ui-monospace, 'Cascadia Code', 'Fira Mono', monospace;
      font-size: 11px;
      color: #e0e0e0;
      min-width: 220px;
      backdrop-filter: blur(6px);
      -webkit-backdrop-filter: blur(6px);
      user-select: none;
      pointer-events: none;
    }

    #debug-panel .dbg-header {
      padding: 5px 10px 4px;
      font-size: 9px;
      letter-spacing: 0.15em;
      text-transform: uppercase;
      color: rgba(255,255,255,0.35);
      border-bottom: 1px solid rgba(255,255,255,0.08);
    }

    #debug-panel .dbg-row {
      display: grid;
      grid-template-columns: 1fr auto;
      column-gap: 1.5rem;
      padding: 4px 10px;
      border-bottom: 1px solid rgba(255,255,255,0.05);
    }

    #debug-panel .dbg-row:last-child {
      border-bottom: none;
    }

    #debug-panel .dbg-label {
      color: rgba(255,255,255,0.45);
      white-space: nowrap;
    }

    #debug-panel .dbg-value {
      color: #7dd3fc;
      text-align: right;
      white-space: nowrap;
    }
  `;
  document.head.appendChild(style);

  // ─── Panel DOM ─────────────────────────────────────────────────────────────

  const panel = document.createElement('div');
  panel.id = 'debug-panel';
  panel.innerHTML = `<div class="dbg-header">Debug</div>`;
  document.body.appendChild(panel);

  // ─── Row registry ──────────────────────────────────────────────────────────
  // Each entry is { valueEl, getter } — call register() to add more rows.

  const rows = [];

  function register(label, getter) {
    const row = document.createElement('div');
    row.className = 'dbg-row';

    const labelEl = document.createElement('span');
    labelEl.className = 'dbg-label';
    labelEl.textContent = label;

    const valueEl = document.createElement('span');
    valueEl.className = 'dbg-value';

    row.appendChild(labelEl);
    row.appendChild(valueEl);
    panel.appendChild(row);

    rows.push({ valueEl, getter });
  }

  function fmt(v) {
    if (typeof v === 'number') return v.toFixed(4);
    return String(v);
  }

  // ─── Registered values ─────────────────────────────────────────────────────

  register('sectionProgress', () => scroll.sectionProgress);

  // ─── Update loop ───────────────────────────────────────────────────────────

  function update() {
    requestAnimationFrame(update);
    for (const { valueEl, getter } of rows) {
      valueEl.textContent = fmt(getter());
    }
  }

  update();
}
