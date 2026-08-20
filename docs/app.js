/* MHGU Monster Info — all app logic (IIFE, no modules). */
(function () {
  "use strict";
  const $ = id => document.getElementById(id);
  const DATA = window.MONSTER_DATA;
  if (!DATA) { document.body.textContent = "Failed to load monster data."; return; }

  const THEME_KEY = "mhgu-monster-info-theme";

  // Same palette + monster icons as the other MHGU apps.
  // [displayName, hex] or [displayName, hex, iconName].
  const THEME_COLORS = [
    ["Teostra","#570B0B"], ["Rathalos","#b51717"],
    ["Tetsucabra","#783E0F"], ["Agnaktor","#C7620E"],
    ["Tigrex","#74631D"], ["Rajang","#9C8328"],
    ["Deviljho","#0B570F"], ["Rathian","#39993E"],
    ["Astalos","#14503d"], ["Zinogre","#279773"],
    ["Zamtrios","#005984"], ["Plesioth","#0080c1"],
    ["Brachydios","#0B2757"], ["Lagiacrus","#0b3f97"],
    ["G. Magala","#1F0B57","Gore Magala"], ["Nerscylla","#4e2fa2"],
    ["Y. Garuga","#62008f","Yian Garuga"], ["Chameleos","#8e50ab"],
    ["Mizutsune","#D4358C"], ["Congalala","#C8679D"],
    ["Duramboros","#5a411f"], ["Diablos","#997c54"],
    ["Barroth","#835A32"], ["Bulldrome","#B17A47"],
    ["K. Daora","#505358","Kushala Daora"], ["Valstrax","#7C879B"],
    ["Forbidden","#1E2025","Question Mark"],
  ];
  // THE PALETTE'S ONE INVARIANT: every theme takes white text and a white checkbox tick.
  //
  // Two requirements, one number. A native checkbox takes accent-color from the theme and the
  // browser picks the tick glyph itself — white below relative luminance .1791, black above it.
  // White body text needs its ground at .1833 or below to clear 4.5:1. The checkbox line is the
  // stricter of the two, so hold a surface under .1791 and white text on it clears AA for free.
  //
  // The binding surface is the lightest one a theme paints — a 60/40 composite of darken(hex,.80)
  // and darken(hex,.95), lighter than the tick's own darken(hex,.70), so testing the composite
  // covers both. Every theme is under it; worst white-on-ground in the palette is 4.73:1.
  //
  // This is load-bearing rather than cosmetic. Most of these apps paint white text unconditionally
  // with no light-theme fallback left, so a swatch over the line is not a slightly-too-bright
  // swatch, it is unreadable. The Hunting Log and the Randomizer do still carry an isLight branch,
  // but it trips only at near-white and nothing in the palette comes close. The Randomizer's
  // Gypceros is the deliberate exception — tripping that branch is its entire joke.
  //
  // A NEW OR RE-CUT COLOUR HAS TO CLEAR THIS. A swatch that fails is not a slightly-too-bright
  // swatch, it is a theme that inverts against every other one.
  //
  // Eight came down to get there — Rajang, Rathian, Zinogre, Mizutsune, Congalala, Barroth,
  // Bulldrome and Valstrax — by lightness alone, so each keeps its own hue and saturation. Where
  // capping the light member on its own would have squashed a pair onto one lightness, the dark
  // partner came down by the same factor instead of the pair collapsing: that is why Barroth
  // moved with Bulldrome, and Mizutsune with Congalala.
  //
  // Two pairs are re-cuts of other pairs, keeping their own slot on the wheel and taking the
  // source pair's saturation and lightness, member for member:
  //
  //   Tigrex / Rajang        <- Astalos / Zinogre,      at the yellow slot (47°)
  //   Tetsucabra / Agnaktor  <- Brachydios / Lagiacrus, at the orange slot (27°)
  //
  // Both pairs then come back up as far as the line allows, less a working margin, because a
  // source pair brings its own lightness along and the teal and blue pairs are the dark ones.
  //
  // RAJANG IS THE ONE SITTING ON THE CEILING. Its ground measures .170 against the .1791 line,
  // so it has no lift left: brightening it buys dark text and a black tick, which is the exact
  // thing this invariant exists to prevent. If it ever has to read punchier, trade saturation
  // for lightness along the boundary (#A58100 at S 1.00 is the vivid end) rather than pushing
  // lightness up — but that drops it to L .32 and squeezes the pair against Tigrex, so check
  // the separation before taking it.
  //
  // The earth tones (Duramboros, Diablos, Barroth, Bulldrome) share the 27–47° stretch with both
  // of those pairs by design. Swatches sitting close together in there is expected and is not a
  // collision to design out.
  //
  // A saved theme is a bare hex, so anyone sitting on a retired one keeps a colour that is no
  // longer in the list: it never picks up the change, and anything keyed off the hex (the selected
  // swatch, the theme's icon) stops matching. Remap on read, not on write — the stale value is
  // already in localStorage on every device that chose it. Only hexes that actually shipped are
  // listed; cuts that never left the working tree are not, because no device can hold them.
  //
  // "Shipped" is per app, not per palette. #574916 went out on Talisman Bingo alone, and
  // #68360D / #B5590D / #68581A on MHGU Bingo alone, because an unrelated commit in each of
  // those repos swept the working tree mid-edit and pushed a cut that was still being tuned.
  // They are listed in all nine anyway: the map is kept identical regardless of which app
  // released what, because this palette is hand-copied with no shared source and a per-app map
  // is one more thing to drift.
  const LEGACY_HEX = {
    "#C8A319": "#74631D", "#57470B": "#74631D", "#5E4D0C": "#74631D",           // Tigrex
    "#574916": "#74631D",
    "#F1D364": "#9C8328", "#B59417": "#9C8328", "#C39F19": "#9C8328",           // Rajang
    "#BEA031": "#9C8328",
    "#C65900": "#783E0F", "#FC933E": "#C7620E",                                 // Tetsucabra, Agnaktor
    "#68360D": "#783E0F", "#B5590D": "#C7620E",                                 // ...and the cuts that
    "#68581A": "#74631D",                                                       // reached MHGU Bingo only
    "#3A9B3F": "#39993E", "#2DAE85": "#279773",                                 // Rathian, Zinogre
    "#D84696": "#D4358C", "#CE79A8": "#C8679D",                                 // Mizutsune, Congalala
    "#B57C45": "#835A32", "#CFAA87": "#B17A47",                                 // Barroth, Bulldrome
    "#AEB5C1": "#7C879B",                                                       // Valstrax
  };
  const migrateHex = (h) => (h && LEGACY_HEX[h.toUpperCase()]) || h;
  const COLORS_HEX = Object.fromEntries(THEME_COLORS.map(([name, hex]) => [hex.toUpperCase(), name]));
  const COLORS_ICON = Object.fromEntries(THEME_COLORS.filter(c => c[2]).map(([name, , icon]) => [name, icon]));
  const FALLBACK_ICON = "assets/MonsterIcons/MHGU-Question_Mark_Icon.webp";
  // The icon set names Nakarkos's icon after its body part.
  const ICON_ALIASES = { "Nakarkos": "Nakarkos Body" };
  const monsterIcon = name => name
    ? "assets/MonsterIcons/MHGU-" + (ICON_ALIASES[name] || name).replace(/ /g, "_") + "_Icon.webp"
    : FALLBACK_ICON;
  function iconImg(name, cls) {
    const img = document.createElement("img");
    img.className = cls || "";
    img.alt = "";
    img.src = monsterIcon(name);
    img.onerror = () => { img.onerror = null; img.src = FALLBACK_ICON; };
    return img;
  }

  // Heat buckets from the MHFU Look Up app's HitzoneBrushConverter.
  // Applied to every value column — KO/Exhaust land mostly gray/green, which
  // is fine; one consistent scale beats special-casing two columns.
  const heatBg = v => v >= 66 ? "#2e5e2e" : v >= 46 ? "#6b3d00" : v >= 21 ? "#5a5200" : "#383838";

  // Part rows are [slot, name, cut, impact, shot, fire, water, ice, thunder, dragon, stun, exhaust].
  // MHGU game order: ice before thunder.
  const COLS = [
    ["Cut", 2], ["Impact", 3], ["Shot", 4], ["Fire", 5], ["Water", 6],
    ["Ice", 7], ["Thunder", 8], ["Dragon", 9], ["KO", 10], ["Exhaust", 11],
  ];

  const byId = new Map(DATA.monsters.map(m => [m.id, m]));

  // ── State ──────────────────────────────────────────────────────────────
  let selectedId = null;
  let tableIndex = 0;
  let searchText = "";

  // ── Monster list ───────────────────────────────────────────────────────
  const GROUPS = [
    ["Large Monsters", DATA.monsters.filter(m => m.large)],
    ["Small Monsters", DATA.monsters.filter(m => !m.large)],
  ];

  function renderList() {
    const nav = $("monsterList");
    nav.textContent = "";
    const q = searchText.trim().toLowerCase();
    let any = false;
    for (const [label, monsters] of GROUPS) {
      const hits = q ? monsters.filter(m => m.name.toLowerCase().includes(q)) : monsters;
      if (!hits.length) continue;
      any = true;
      const group = document.createElement("div");
      group.className = "mon-group";
      const head = document.createElement("div");
      head.className = "mon-group-head";
      const title = document.createElement("span");
      title.textContent = label;
      const count = document.createElement("span");
      count.className = "mon-group-count";
      count.textContent = String(hits.length);
      head.append(title, count);
      const body = document.createElement("div");
      body.className = "mon-group-body";
      for (const m of hits) {
        const row = document.createElement("button");
        row.type = "button";
        row.className = "mon-row" + (m.id === selectedId ? " sel" : "");
        row.dataset.id = m.id;
        const name = document.createElement("span");
        name.textContent = m.name;
        row.append(iconImg(m.name), name);
        row.addEventListener("click", () => selectMonster(m.id));
        body.appendChild(row);
      }
      group.append(head, body);
      nav.appendChild(group);
    }
    if (!any) {
      const empty = document.createElement("div");
      empty.className = "list-empty";
      empty.textContent = "No monsters found.";
      nav.appendChild(empty);
    }
  }

  function selectMonster(id, fromHash) {
    if (id === selectedId) return;
    selectedId = id;
    tableIndex = 0;
    document.querySelectorAll(".mon-row").forEach(r => r.classList.toggle("sel", r.dataset.id === id));
    if (!fromHash) location.hash = id;
    renderDetail();
  }

  // ── Detail pane ────────────────────────────────────────────────────────
  function renderDetail() {
    const pane = $("detail");
    pane.textContent = "";
    const m = byId.get(selectedId);
    if (!m) {
      const empty = document.createElement("div");
      empty.className = "detail-empty";
      empty.textContent = "Select a monster from the list.";
      pane.appendChild(empty);
      return;
    }

    const head = document.createElement("div");
    head.className = "detail-head";
    const info = document.createElement("div");
    const title = document.createElement("div");
    title.className = "detail-title";
    title.textContent = m.name;
    const sub = document.createElement("div");
    sub.className = "detail-sub";
    sub.textContent = "Base HP " + m.hp;
    info.append(title, sub);
    head.append(iconImg(m.name, "detail-icon"), info);
    pane.appendChild(head);

    // Sections are independent blocks — future info (staggers, loot…) appends here.
    pane.appendChild(hitzoneSection(m));
  }

  function hitzoneSection(m) {
    const section = document.createElement("div");
    section.className = "section";
    const title = document.createElement("div");
    title.className = "section-title";
    title.textContent = "Hitzones";
    section.appendChild(title);

    const scroll = document.createElement("div");
    scroll.className = "table-scroll";

    if (m.tables.length > 1) {
      const toggle = document.createElement("div");
      toggle.className = "table-toggle";
      m.tables.forEach((_, i) => {
        const b = document.createElement("button");
        b.type = "button";
        b.textContent = "Table " + (i + 1);
        b.classList.toggle("active", i === tableIndex);
        b.addEventListener("click", () => {
          if (i === tableIndex) return;
          tableIndex = i;
          toggle.querySelectorAll("button").forEach((x, j) => x.classList.toggle("active", j === i));
          scroll.textContent = "";
          scroll.appendChild(buildTable(m, i));
        });
        toggle.appendChild(b);
      });
      section.appendChild(toggle);
    }

    scroll.appendChild(buildTable(m, tableIndex));
    section.appendChild(scroll);
    return section;
  }

  function buildTable(m, ti) {
    const table = document.createElement("table");
    table.className = "hz";
    const thead = document.createElement("thead");
    const hr = document.createElement("tr");
    for (const label of ["Part", ...COLS.map(c => c[0])]) {
      const th = document.createElement("th");
      th.textContent = label;
      hr.appendChild(th);
    }
    thead.appendChild(hr);
    table.appendChild(thead);

    const tbody = document.createElement("tbody");
    for (const part of m.tables[ti]) {
      const tr = document.createElement("tr");
      const td = document.createElement("td");
      td.className = "part" + (part[1] ? "" : " unnamed");
      td.textContent = part[1] || "Part " + (part[0] + 1);
      tr.appendChild(td);
      for (const [, idx] of COLS) {
        const cell = document.createElement("td");
        cell.textContent = String(part[idx]);
        cell.style.background = heatBg(part[idx]);
        tr.appendChild(cell);
      }
      tbody.appendChild(tr);
    }
    table.appendChild(tbody);
    return table;
  }

  // ── Search ─────────────────────────────────────────────────────────────
  $("searchInput").addEventListener("input", e => {
    searchText = e.target.value;
    renderList();
  });

  // ── Deep link ──────────────────────────────────────────────────────────
  function applyHash() {
    const id = location.hash.slice(1);
    if (byId.has(id)) selectMonster(id, true);
  }
  window.addEventListener("hashchange", applyHash);

  // ── Theme ──────────────────────────────────────────────────────────────
  const hexRgb = h => { h = h.replace("#", ""); return [0, 2, 4].map(i => parseInt(h.substr(i, 2), 16)); };
  const clamp = n => Math.max(0, Math.min(255, Math.round(n)));
  const clamp01 = n => Math.max(0, Math.min(1, n));
  const rgbToHsl = ([r, g, b]) => {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min, l = (max + min) / 2;
    if (d === 0) return [0, 0, l];
    const s = d / (1 - Math.abs(2 * l - 1));
    const h = max === r ? ((g - b) / d + (g < b ? 6 : 0)) / 6 : max === g ? ((b - r) / d + 2) / 6 : ((r - g) / d + 4) / 6;
    return [h, s, l];
  };
  const hslToRgb = ([h, s, l]) => {
    const c = (1 - Math.abs(2 * l - 1)) * s, x = c * (1 - Math.abs((h * 6) % 2 - 1)), m = l - c / 2;
    const hi = Math.floor(h * 6) % 6;
    const [r, g, b] = hi === 0 ? [c, x, 0] : hi === 1 ? [x, c, 0] : hi === 2 ? [0, c, x] : hi === 3 ? [0, x, c] : hi === 4 ? [x, 0, c] : [c, 0, x];
    return [r + m, g + m, b + m].map(v => clamp(v * 255));
  };
  const darken = (rgb, f) => { const [h, s, l] = rgbToHsl(rgb); return hslToRgb([h, s, clamp01(l * f)]); };
  const lighten = (rgb, b) => { const [h, s, l] = rgbToHsl(rgb); return hslToRgb([h, s, clamp01(l + (1 - l) * b)]); };
  const cssRgb = rgb => `rgb(${rgb[0]},${rgb[1]},${rgb[2]})`;
  function applyTheme(hex) {
    const c = hexRgb(hex), r = document.documentElement.style;
    r.setProperty("--bg", cssRgb(darken(c, .70)));
    r.setProperty("--bg1", cssRgb(darken(c, .80)));
    r.setProperty("--grid-bg", cssRgb(darken(c, .35)));
    r.setProperty("--content-bg", cssRgb(darken(c, .55)));
    r.setProperty("--panel-bg", cssRgb(darken(c, .40)));
    r.setProperty("--bg2", cssRgb(darken(c, .95)));
    r.setProperty("--hover", cssRgb(darken(c, .30)));
    r.setProperty("--accent", cssRgb(darken(c, .7)));
    r.setProperty("--accent-hover", cssRgb(lighten(c, .4)));
    r.setProperty("--text", "#ffffff");
    r.setProperty("--text-dim", "#fffffff5");
    r.setProperty("--line", "rgba(255,255,255,0.12)");
    r.setProperty("--card", "rgba(255,255,255,0.05)");
    try { localStorage.setItem(THEME_KEY, hex); } catch (e) {}
    document.querySelectorAll(".swatch").forEach(s => s.classList.toggle("sel", s.dataset.hex === hex));
    const titleIcon = document.querySelector(".title-icon");
    if (titleIcon) {
      const name = COLORS_HEX[hex.toUpperCase()];
      titleIcon.src = name ? monsterIcon(COLORS_ICON[name] || name) : FALLBACK_ICON;
    }
  }
  function buildSwatches() {
    const wrap = $("swatches"); wrap.textContent = "";
    for (const [name, hex, iconOverride] of THEME_COLORS) {
      const d = document.createElement("div");
      d.className = "swatch"; d.dataset.hex = hex; d.style.background = hex; d.title = name;
      const img = iconImg(iconOverride || name, "swatch-icon");
      const span = document.createElement("span");
      span.textContent = name;
      d.append(img, span);
      d.addEventListener("click", () => applyTheme(hex));
      wrap.appendChild(d);
    }
  }

  // ── Modals ─────────────────────────────────────────────────────────────
  function bindModal(btnId, modalId, closeId) {
    $(btnId).addEventListener("click", () => $(modalId).classList.remove("hidden"));
    $(closeId).addEventListener("click", () => $(modalId).classList.add("hidden"));
    $(modalId).addEventListener("click", e => { if (e.target.id === modalId) $(modalId).classList.add("hidden"); });
  }
  bindModal("aboutBtn", "aboutModal", "aboutClose");
  bindModal("linksBtn", "linksModal", "linksClose");
  bindModal("themeBtn", "themeModal", "themeClose");

  // ── Init ───────────────────────────────────────────────────────────────
  buildSwatches();
  let themeHex = null;
  try { themeHex = migrateHex(localStorage.getItem(THEME_KEY)); } catch (e) {}
  applyTheme(themeHex || "#1E2025");
  renderList();
  renderDetail();
  applyHash();
})();
