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

const monsters = [];
let skipped = 0, tablesTotal = 0;
for (const [id, m] of Object.entries(src.monsters)) {
  if (m.error || !m.tables) { skipped++; continue; }
  const nameBySlot = new Map();
  for (const p of m.tables[0].parts) if (p.name) nameBySlot.set(p.slot, p.name);
  const tables = m.tables.map(t => t.parts.map(p => [
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
