#!/usr/bin/env node
/* Builds docs/data/hitzones.js from data-src/hitzones_v3.json (RomFS dt_tune decode).
 *
 * - Skips the extraction's error entries (em087_00 non-standard-format,
 *   ems100-106 table-not-found).
 * - Part names exist only on table index 0 in the source, so each later
 *   table's parts resolve their name from table 0 by slot at build time.
 *   Parts whose slot has no table-0 name stay null; the app shows a
 *   slot-derived "Part N" label instead.
 * - Source part order is preserved; `slot` is carried as data because it is
 *   not dense (Duramboros jumps to slot 9) and must never be used as an index.
 *
 * Run: node scripts/build-data.mjs
 */
import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const src = JSON.parse(readFileSync(path.join(root, "data-src", "hitzones_v3.json"), "utf8"));

// The game stores parallel hit-zone tables back-to-back, and the second one
// starts with a byte-identical repeat of the head row. The upstream decoder
// splits on that, but missed em023_00 Rajang, whose entry ships as one
// contiguous 16-row table. Apply the same rule here: an even-length table
// whose midpoint row repeats row 0's values splits in two, with the second
// half's slots renumbered so parts line up across tables. Cross-checked
// against Kiranico's two Rajang tables (exact match, hardened 10/10/10 arms
// in the second). Fires on exactly one table in the v3 file.
const VALUE_FIELDS = ["cut", "impact", "shot", "fire", "water", "ice", "thunder", "dragon", "stun", "exhaust"];
const sameValues = (a, b) => VALUE_FIELDS.every(f => a[f] === b[f]);
function splitMergedTables(id, tables) {
  const out = [];
  for (const t of tables) {
    const n = t.parts.length / 2;
    if (Number.isInteger(n) && n > 0 && sameValues(t.parts[0], t.parts[n])) {
      console.log(`split merged table: ${id} (${t.parts.length} rows -> 2x${n})`);
      out.push({ parts: t.parts.slice(0, n) });
      out.push({ parts: t.parts.slice(n).map(p => ({ ...p, slot: p.slot - n })) });
    } else {
      out.push(t);
    }
  }
  return out;
}

const monsters = [];
let skipped = 0, tablesTotal = 0;
for (const [id, m] of Object.entries(src.monsters)) {
  if (m.error || !m.tables) { skipped++; continue; }
  const srcTables = splitMergedTables(id, m.tables);
  const nameBySlot = new Map();
  for (const p of srcTables[0].parts) if (p.name) nameBySlot.set(p.slot, p.name);
  const tables = srcTables.map(t => t.parts.map(p => [
    p.slot, p.name ?? nameBySlot.get(p.slot) ?? null,
    p.cut, p.impact, p.shot, p.fire, p.water, p.ice, p.thunder, p.dragon, p.stun, p.exhaust,
  ]));
  tablesTotal += tables.length;
  monsters.push({ id, name: m.name, large: !id.startsWith("ems"), hp: m.hp, tables });
}

const emNum = id => parseInt(id.match(/\d+/)[0], 10);
monsters.sort((a, b) => a.large === b.large ? emNum(a.id) - emNum(b.id) : a.large ? -1 : 1);

// Icon audit: warn about monsters whose icon is missing from the copied set,
// so a rename or a new monster never fails silently to the question mark.
const ICON_ALIASES = { "Nakarkos": "Nakarkos Body" };
const have = new Set(readdirSync(path.join(root, "docs", "assets", "MonsterIcons")));
const missing = monsters
  .filter(m => !have.has("MHGU-" + (ICON_ALIASES[m.name] || m.name).replace(/ /g, "_") + "_Icon.webp"))
  .map(m => m.name);

writeFileSync(
  path.join(root, "docs", "data", "hitzones.js"),
  "window.MONSTER_DATA = " + JSON.stringify({ version: 1, monsters }) + ";\n",
);

const large = monsters.filter(m => m.large).length;
console.log(`monsters: ${monsters.length} (${large} large / ${monsters.length - large} small)`);
console.log(`tables: ${tablesTotal}, error entries skipped: ${skipped}`);
if (missing.length) console.warn(`missing icons (question-mark fallback): ${missing.join(", ")}`);
