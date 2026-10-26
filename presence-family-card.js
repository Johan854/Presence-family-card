/*
 * Presence Family Card (FR)
 * Une seule carte pour toute la famille : présence, depuis quand, position,
 * batterie (avec recharge) et Wi-Fi. Style verre, thème clair/sombre automatique.
 * Configuration en YAML (liste « people »).
 */

const CARD_VERSION = "1.1.0";

const DEFAULTS = {
  title: "Famille",
  theme: "auto", // auto (suit Home Assistant), light, dark
  columns: 0, // 0 = automatique (s'adapte à la largeur)
  show_location: true,
  show_battery: true,
  show_wifi: true,
  battery_warn: 30,
  battery_alert: 15,
  people: [],
};

const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

const isNum = (v) => v !== undefined && v !== null && v !== "" && !isNaN(Number(v));
const NONE = ["unavailable", "unknown", "none", "", "not connected", "<not connected>"];
const bad = (st) => !st || NONE.includes(String(st.state).toLowerCase());

function since(iso) {
  const t = Date.parse(iso);
  if (isNaN(t)) return "";
  const m = Math.max(0, Math.floor((Date.now() - t) / 60000));
  if (m < 1) return "à l'instant";
  if (m < 60) return `depuis ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `depuis ${h} h`;
  return `depuis ${Math.floor(h / 24)} j`;
}

function batteryIcon(level, charging) {
  if (!isNum(level)) return "mdi:battery-unknown";
  const n = Math.max(0, Math.min(100, Math.round(Number(level) / 10) * 10));
  if (charging) return n >= 100 ? "mdi:battery-charging-100" : n <= 0 ? "mdi:battery-charging-outline" : `mdi:battery-charging-${n}`;
  return n >= 100 ? "mdi:battery" : n <= 0 ? "mdi:battery-outline" : `mdi:battery-${n}`;
}

class PresenceFamilyCard extends HTMLElement {
  static getConfigElement() {
    return document.createElement("presence-family-card-editor");
  }

  static getStubConfig() {
    return {
      title: "Famille",
      people: [
        {
          name: "Prénom",
          tracker: "device_tracker.mon_telephone",
          battery: "sensor.mon_telephone_battery_level",
          wifi: "sensor.mon_telephone_ssid",
          location: "sensor.mon_telephone_geocoded_location",
        },
      ],
    };
  }

  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._sig = "";
    this._config = null;
  }

  setConfig(config) {
    if (!config || !Array.isArray(config.people)) {
      throw new Error("Ajoutez au moins une personne dans « people »");
    }
    // Les personnes sans « tracker » (en cours de saisie dans l'éditeur) sont ignorées
    const valid = config.people.filter((p) => p && p.tracker);
    if (valid.length === 0) {
      throw new Error("Ajoutez au moins une personne avec un « tracker » (device_tracker ou person)");
    }
    this._config = { ...DEFAULTS, ...config, people: valid };
    this._sig = "";
    if (this._hass) this._render();
  }

  set hass(hass) {
    this._hass = hass;
    if (!this._config) return;
    const sig = this._ids().map((e) => {
      const s = hass.states[e];
      return s ? s.state + "|" + s.last_changed : "x";
    }).join(";") + "#" + (this._isDark() ? "d" : "l") + "#" + Math.floor(Date.now() / 60000);
    if (sig !== this._sig) {
      this._sig = sig;
      this._render();
    }
  }

  getCardSize() {
    return 2 + this._config.people.length * 2;
  }

  _ids() {
    const out = [];
    this._config.people.forEach((p) => {
      [p.tracker, p.battery, p.battery_state, p.wifi, p.location].forEach((e) => e && out.push(e));
    });
    return out;
  }

  _isDark() {
    const t = this._config && this._config.theme;
    if (t === "dark") return true;
    if (t === "light") return false;
    const dm = this._hass && this._hass.themes && this._hass.themes.darkMode;
    if (typeof dm === "boolean") return dm;
    return !!(window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches);
  }

  _st(id) {
    return id && this._hass ? this._hass.states[id] : undefined;
  }

  _person(p) {
    const c = this._config;
    const tr = this._st(p.tracker);
    const known = !bad(tr);
    const state = known ? String(tr.state) : "";
    let cls = "off";
    let text = "Indisponible";
    if (known) {
      if (state === "home") { cls = "ok"; text = "À la maison"; }
      else if (state === "not_home") { cls = "away"; text = "Absent"; }
      else { cls = "zone"; text = state; }
    }
    const age = known ? since(tr.last_changed) : "";
    const name = p.name || (tr && tr.attributes.friendly_name) || p.tracker;
    const initials = String(name).trim().split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase();
    const pic = p.picture || (tr && tr.attributes.entity_picture) || "";

    // Position
    let locHtml = "";
    if (c.show_location && p.location) {
      const ls = this._st(p.location);
      if (!bad(ls)) {
        locHtml = `<button class="loc" data-more="${esc(p.location)}"><ha-icon icon="mdi:map-marker"></ha-icon><span>${esc(ls.state)}</span></button>`;
      }
    }

    // Batterie
    let batHtml = "";
    if (c.show_battery && p.battery) {
      const bs = this._st(p.battery);
      const ok = !bad(bs) && isNum(bs.state);
      const lvl = ok ? Math.round(Number(bs.state)) : null;
      const bst = p.battery_state ? this._st(p.battery_state) : null;
      const charging = bst ? /charg/i.test(bst.state) && !/not|discharg|unplug/i.test(bst.state) : false;
      let bc = "";
      if (charging) bc = "ok";
      else if (ok && lvl <= c.battery_alert) bc = "alert";
      else if (ok && lvl <= c.battery_warn) bc = "warn";
      batHtml = `<button class="chip ${bc}" data-more="${esc(p.battery)}"><ha-icon icon="${batteryIcon(lvl, charging)}"></ha-icon>${ok ? lvl + " %" : "—"}</button>`;
    }

    // Wi-Fi
    let wifiHtml = "";
    if (c.show_wifi && p.wifi) {
      const ws = this._st(p.wifi);
      const connected = !bad(ws);
      let label = "Hors Wi-Fi";
      if (connected) label = /unknown ssid/i.test(ws.state) ? "Wi-Fi" : String(ws.state);
      wifiHtml = `<button class="chip ${connected ? "" : "dim"}" data-more="${esc(p.wifi)}"><ha-icon icon="${connected ? "mdi:wifi" : "mdi:wifi-off"}"></ha-icon><span class="clip">${esc(label)}</span></button>`;
    }

    return {
      cls,
      home: state === "home",
      html: `
      <div class="person glass ${cls}">
        <button class="top" data-more="${esc(p.tracker)}">
          <span class="avatar">${pic ? `<img src="${esc(pic)}" alt="">` : ""}<span class="ini">${esc(initials)}</span></span>
          <span class="who">
            <b>${esc(name)}</b>
            <span class="st"><span class="dot"></span>${esc(text)}${age ? ` · ${esc(age)}` : ""}</span>
          </span>
        </button>
        ${locHtml}
        ${batHtml || wifiHtml ? `<div class="chips">${batHtml}${wifiHtml}</div>` : ""}
      </div>`,
    };
  }

  _render() {
    const c = this._config;
    if (!c || !this._hass) return;
    const dark = this._isDark();
    const people = c.people.map((p) => this._person(p));
    const homeN = people.filter((p) => p.home).length;
    const cols = Number(c.columns) > 0 ? `repeat(${Number(c.columns)}, 1fr)` : "repeat(auto-fit, minmax(15em, 1fr))";

    this.shadowRoot.innerHTML = `
      <style>
        * { box-sizing: border-box; }
        ha-card.dark {
          --fb-text: #f4f6fb; --fb-bg: linear-gradient(160deg, #1b1e32 0%, #241a2a 55%, #2d1519 100%);
          --fb-border: rgba(255,255,255,.14); --fb-shadow: 0 .6em 2em rgba(0,0,0,.35);
          --fb-glass: rgba(255,255,255,.07); --fb-glass-b: rgba(255,255,255,.13);
          --fb-fill: rgba(255,255,255,.09); --fb-fill-b: rgba(255,255,255,.16);
          --fb-ok: #3ddc84; --fb-warn: #ffb86b; --fb-alert: #ff5a5f; --fb-away: #7cc4ff; --fb-neutral: #8a8f9c;
        }
        ha-card.light {
          --fb-text: #1c2030; --fb-bg: linear-gradient(160deg, #f8f9fd 0%, #eef1f8 55%, #f8eff0 100%);
          --fb-border: rgba(20,24,40,.12); --fb-shadow: 0 .4em 1.4em rgba(20,24,40,.12);
          --fb-glass: rgba(255,255,255,.7); --fb-glass-b: rgba(20,24,40,.1);
          --fb-fill: rgba(20,24,40,.05); --fb-fill-b: rgba(20,24,40,.14);
          --fb-ok: #1a9d55; --fb-warn: #c77a14; --fb-alert: #d32f35; --fb-away: #1769c2; --fb-neutral: #8a8f9c;
        }
        ha-card { position: relative; overflow: hidden; color: var(--fb-text); border-radius: 1.5em; padding: 0;
          border: 1px solid var(--fb-border); background: var(--fb-bg); box-shadow: var(--fb-shadow); }
        .wrap { padding: 1.1em; display:flex; flex-direction:column; gap:.9em; }
        button { font: inherit; color: inherit; cursor: pointer; border: 0; background: none; padding: 0; text-align:left; -webkit-tap-highlight-color: transparent; }
        .head { display:flex; align-items:center; justify-content:space-between; gap:.8em; padding: 0 .2em; }
        .head b { font-size: 1.1em; font-weight: 650; }
        .count { font-size:.8em; opacity:.8; }
        .grid { display:grid; grid-template-columns: ${cols}; gap:.8em; }
        .glass { background: var(--fb-glass); backdrop-filter: blur(18px) saturate(140%); -webkit-backdrop-filter: blur(18px) saturate(140%);
          border: 1px solid var(--fb-glass-b); border-radius: 1.1em; }
        .person { padding: .9em; display:flex; flex-direction:column; gap:.7em; min-width:0; }
        .top { display:flex; align-items:center; gap:.8em; width:100%; min-width:0; }
        .avatar { position:relative; flex:none; width:3.1em; height:3.1em; border-radius:50%; display:flex; align-items:center; justify-content:center;
          background: var(--fb-fill); font-weight:700; overflow:hidden; border:2px solid var(--fb-neutral); }
        .avatar img { position:absolute; inset:0; width:100%; height:100%; object-fit:cover; }
        .person.ok .avatar { border-color: var(--fb-ok); }
        .person.away .avatar, .person.zone .avatar { border-color: var(--fb-away); }
        .who { display:flex; flex-direction:column; gap:.2em; min-width:0; }
        .who b { font-size:1.05em; font-weight:650; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
        .st { display:flex; align-items:center; gap:.45em; font-size:.82em; opacity:.92; min-width:0; }
        .dot { width:.6em; height:.6em; border-radius:50%; background:var(--fb-neutral); flex:none; }
        .ok .dot { background:var(--fb-ok); box-shadow:0 0 .6em var(--fb-ok); }
        .away .dot, .zone .dot { background:var(--fb-away); box-shadow:0 0 .6em var(--fb-away); }
        .loc { display:flex; align-items:flex-start; gap:.5em; font-size:.85em; opacity:.9; width:100%; }
        .loc ha-icon { --mdc-icon-size:1.2em; flex:none; margin-top:.05em; }
        .loc span { display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden; }
        .chips { display:flex; flex-wrap:wrap; gap:.5em; }
        .chip { display:inline-flex; align-items:center; gap:.4em; padding:.4em .75em; border-radius:2em; max-width:100%;
          background: var(--fb-fill); border:1px solid var(--fb-fill-b); font-size:.82em; font-weight:600; }
        .chip ha-icon { --mdc-icon-size:1.25em; flex:none; }
        .chip.ok { color: var(--fb-ok); border-color: var(--fb-ok); }
        .chip.warn { color: var(--fb-warn); border-color: var(--fb-warn); }
        .chip.alert { color: var(--fb-alert); border-color: var(--fb-alert); }
        .chip.dim { opacity:.6; }
        .clip { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
      </style>
      <ha-card class="${dark ? "dark" : "light"}">
        <div class="wrap">
          ${c.title ? `<div class="head"><b>${esc(c.title)}</b><span class="count">${homeN} / ${people.length} à la maison</span></div>` : ""}
          <div class="grid">${people.map((p) => p.html).join("")}</div>
        </div>
      </ha-card>`;

    this.shadowRoot.querySelectorAll("[data-more]").forEach((el) => {
      el.addEventListener("click", () => {
        this.dispatchEvent(new CustomEvent("hass-more-info", {
          bubbles: true, composed: true, detail: { entityId: el.dataset.more },
        }));
      });
    });
    this.shadowRoot.querySelectorAll(".avatar img").forEach((img) => {
      img.addEventListener("error", () => img.remove());
    });
  }
}

/* ---------- Éditeur visuel ---------- */
const LABELS = {
  title: "Titre (vide = aucun)", theme: "Thème", columns: "Colonnes (0 = automatique)",
  show_location: "Afficher la position", show_battery: "Afficher la batterie", show_wifi: "Afficher le Wi-Fi",
  battery_warn: "Batterie : seuil orange (%)", battery_alert: "Batterie : seuil rouge (%)",
  name: "Prénom", tracker: "Suivi (device_tracker ou person)", picture: "Photo (ex. /local/johan.jpg)",
  battery: "Niveau de batterie", battery_state: "État de la batterie (pour « en charge »)",
  wifi: "Wi-Fi (SSID)", location: "Position (géocodée)",
};

class PresenceFamilyCardEditor extends HTMLElement {
  constructor() {
    super();
    this._personForms = [];
    this._titles = [];
    this._count = -1;
  }

  setConfig(config) {
    this._config = { ...DEFAULTS, ...config, people: (config.people || []).map((p) => ({ ...p })) };
    if (this._globalForm && this._count === this._config.people.length) this._sync();
    else this._build();
  }

  set hass(hass) {
    this._hass = hass;
    [this._globalForm, ...this._personForms].forEach((f) => { if (f) f.hass = hass; });
  }

  _emit() {
    this.dispatchEvent(new CustomEvent("config-changed", {
      detail: { config: this._config }, bubbles: true, composed: true,
    }));
  }

  _el(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined) e.textContent = text;
    return e;
  }

  _globalSchema() {
    return [
      { name: "title", selector: { text: {} } },
      {
        type: "grid", name: "", schema: [
          {
            name: "theme", selector: {
              select: {
                mode: "dropdown", options: [
                  { value: "auto", label: "Automatique (thème de Home Assistant)" },
                  { value: "light", label: "Clair" },
                  { value: "dark", label: "Sombre" },
                ],
              },
            },
          },
          { name: "columns", selector: { number: { min: 0, max: 6, mode: "box" } } },
        ],
      },
      {
        type: "grid", name: "", schema: [
          { name: "show_location", selector: { boolean: {} } },
          { name: "show_battery", selector: { boolean: {} } },
          { name: "show_wifi", selector: { boolean: {} } },
        ],
      },
      {
        type: "grid", name: "", schema: [
          { name: "battery_warn", selector: { number: { min: 1, max: 100, mode: "box" } } },
          { name: "battery_alert", selector: { number: { min: 1, max: 100, mode: "box" } } },
        ],
      },
    ];
  }

  _personSchema() {
    return [
      {
        type: "grid", name: "", schema: [
          { name: "name", selector: { text: {} } },
          { name: "tracker", required: true, selector: { entity: { domain: ["device_tracker", "person"] } } },
        ],
      },
      {
        type: "grid", name: "", schema: [
          { name: "battery", selector: { entity: { domain: "sensor" } } },
          { name: "battery_state", selector: { entity: { domain: "sensor" } } },
          { name: "wifi", selector: { entity: { domain: "sensor" } } },
          { name: "location", selector: { entity: { domain: "sensor" } } },
        ],
      },
      { name: "picture", selector: { text: {} } },
    ];
  }

  _form(schema, data, onChange) {
    const f = document.createElement("ha-form");
    f.hass = this._hass;
    f.schema = schema;
    f.data = data;
    f.computeLabel = (s) => LABELS[s.name] || s.name;
    f.addEventListener("value-changed", (ev) => {
      ev.stopPropagation();
      onChange(ev.detail.value);
    });
    return f;
  }

  _sync() {
    this._globalForm.data = this._config;
    this._personForms.forEach((f, i) => { f.data = this._config.people[i]; });
  }

  _build() {
    const people = this._config.people;
    this._count = people.length;
    this._personForms = [];
    this._titles = [];

    const root = this._el("div");
    const style = this._el("style");
    style.textContent = `
      .person { border:1px solid var(--divider-color); border-radius:12px; padding:12px; margin:12px 0; }
      .phead { display:flex; justify-content:space-between; align-items:center; margin-bottom:8px; font-weight:600; }
      .pbtns { display:flex; gap:6px; }
      .btn { cursor:pointer; border:1px solid var(--divider-color); background:transparent; color:var(--primary-text-color);
        border-radius:8px; padding:4px 10px; font:inherit; }
      .btn:disabled { opacity:.35; cursor:default; }
      .btn.del { color:var(--error-color, #db4437); }
      .add { cursor:pointer; border:0; border-radius:8px; padding:10px 16px; font:inherit; font-weight:600;
        background:var(--primary-color); color:var(--text-primary-color, #fff); }
      .h { margin:18px 0 4px; font-weight:600; }
    `;
    root.appendChild(style);

    this._globalForm = this._form(this._globalSchema(), this._config, (v) => {
      this._config = { ...this._config, ...v, people: this._config.people };
      this._emit();
    });
    root.appendChild(this._globalForm);
    root.appendChild(this._el("div", "h", "Personnes"));

    people.forEach((p, i) => {
      const block = this._el("div", "person");
      const head = this._el("div", "phead");
      const title = this._el("span", "", `${i + 1}. ${p.name || "Nouvelle personne"}`);
      this._titles.push(title);
      const btns = this._el("div", "pbtns");

      const up = this._el("button", "btn", "↑");
      up.type = "button"; up.disabled = i === 0;
      up.addEventListener("click", () => this._move(i, -1));
      const down = this._el("button", "btn", "↓");
      down.type = "button"; down.disabled = i === people.length - 1;
      down.addEventListener("click", () => this._move(i, 1));
      const del = this._el("button", "btn del", "Supprimer");
      del.type = "button";
      del.addEventListener("click", () => {
        this._config.people.splice(i, 1);
        this._emit();
        this._build();
      });
      btns.appendChild(up); btns.appendChild(down); btns.appendChild(del);
      head.appendChild(title); head.appendChild(btns);
      block.appendChild(head);

      const form = this._form(this._personSchema(), p, (v) => {
        const person = { ...v };
        Object.keys(person).forEach((k) => { if (person[k] === "" || person[k] === undefined) delete person[k]; });
        this._config.people[i] = person;
        this._titles[i].textContent = `${i + 1}. ${person.name || "Nouvelle personne"}`;
        this._emit();
      });
      this._personForms.push(form);
      block.appendChild(form);
      root.appendChild(block);
    });

    const add = this._el("button", "add", "+ Ajouter une personne");
    add.type = "button";
    add.addEventListener("click", () => {
      this._config.people.push({ name: "" });
      this._emit();
      this._build();
    });
    root.appendChild(add);

    this.replaceChildren(root);
  }

  _move(i, d) {
    const arr = this._config.people;
    const j = i + d;
    if (j < 0 || j >= arr.length) return;
    [arr[i], arr[j]] = [arr[j], arr[i]];
    this._emit();
    this._build();
  }
}

customElements.define("presence-family-card", PresenceFamilyCard);
customElements.define("presence-family-card-editor", PresenceFamilyCardEditor);

window.customCards = window.customCards || [];
window.customCards.push({
  type: "presence-family-card",
  name: "Presence Family Card (FR)",
  description: "Présence, position, batterie et Wi-Fi de toute la famille dans une seule carte.",
  preview: false,
});

console.info(
  `%c PRESENCE-FAMILY-CARD %c v${CARD_VERSION} `,
  "color:#fff;background:#1769c2;font-weight:700;border-radius:3px 0 0 3px;padding:2px 4px",
  "color:#1769c2;background:#fff;font-weight:700;border-radius:0 3px 3px 0;padding:2px 4px"
);
