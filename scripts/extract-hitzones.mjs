// MHGU hitzone extraction v4 — fixes the v3 parser's table-region bugs.
//
// v3 defects found by auditing every monster against Kiranico (2026-08-11):
//  1. Terminator `exhaust !== 100` — real rows carry exhaust 0/120/130/150/200/255
//     (Duramboros enraged hump 120, Zamtrios 200, Khezu electrified 255,
//     Nerscylla 120/130/150, Volvidon rolling 0, Daimyo hidden part 0).
//     Truncated 9 monsters, losing rows and whole parallel tables.
//  2. Start anchor required exhaust==100 on the first row — skipped Nerscylla's
//     entire first table (head exhaust 150) and anchored on its second.
//  3. Midpoint split required stun>=100 heads — missed Rajang (head stun 50,
//     tables split by byte-identical head repeat instead) and false-split
//     Ahtal-Ka (whose row 3 legitimately carries stun 100).
//  4. All-100 rows treated as table separators — they are placeholder SLOTS,
//     like the all-zero rows: std tables are fixed-stride 8-slot blocks.
//
// v4 model (validated against the raw bytes of all affected monsters):
//  - table region = rows from start anchor until the float-region count row
//    (r[0] in 1..30, everything else ~0 — no plausible hit-zone looks like it).
//  - row kinds: real hz row | pad (all-zero or all-100) — pads are unused slots.
//  - std region of M rows: if M is a multiple of 8 and every 8-row boundary
//    looks like a block start (head-like row: stun>=100 or byte-equal to row 0,
//    OR the row before the boundary is a pad), it is M/8 parallel 8-slot
//    tables; otherwise one M-slot table (Glavenus: 13 real parts + 3 pads,
//    including its enraged head/throat variant slots — Kiranico regroups
//    those into a display-only second table).
//  - emitted parts skip pads but keep slot numbers, so labels align across
//    parallel tables.
// Values come exclusively from the RomFS; Kiranico was used only to verify.
//
// Run: node scripts/extract-hitzones.mjs [path-to-romfs-enemy-arc-dir]
// The RomFS dump is NOT part of this repo (game files are never committed);
// point the argument or MHGU_ARCDIR at nativeNX/arc/enemy from your own dump.
// Output: data-src/hitzones_v4.json (then run build-data.mjs).
import { readFileSync, writeFileSync, readdirSync } from 'fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import zlib from 'zlib';
const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const ARCDIR = process.argv[2] || process.env.MHGU_ARCDIR || 'C:/Users/humph/AppData/Local/Temp/mhgu_romfs/nativeNX/arc/enemy';
const DB = path.join(root, 'data-src', 'db');
const OUT = path.join(root, 'data-src', 'hitzones_v4.json');
const idNames = JSON.parse(readFileSync(path.join(DB, 'db_id_names.json'), 'utf8'));
const idHp = JSON.parse(readFileSync(path.join(DB, 'db_id_hp.json'), 'utf8'));
const dmg = JSON.parse(readFileSync(path.join(DB, 'db_damage.json'), 'utf8'));
const KEYS = ['cut', 'impact', 'shot', 'fire', 'water', 'ice', 'thunder', 'dragon', 'stun', 'exhaust'];
const isBreak = nm => /\(?\bbreak(en)?\)?|broke/i.test(nm);

function getDt(p) { const arc = readFileSync(p), n = arc.readUInt16LE(6);
  for (let i = 0; i < n; i++) { const o = 12 + i * 80, nm = arc.slice(o, o + 64).toString('latin1').replace(/\x00+$/, '');
    if (/dt_tune.*dttune/i.test(nm)) { const c = arc.readUInt32LE(o + 68) >>> 0, d = (arc.readUInt32LE(o + 72) >>> 0) & 0x1FFFFFFF, f = arc.readUInt32LE(o + 76) >>> 0, cd = arc.slice(f, f + c);
      try { return zlib.inflateSync(cd); } catch { try { return zlib.inflateRawSync(cd); } catch { return c === d ? cd : null; } } } } return null; }

const row10 = (b, o) => Array.from({ length: 10 }, (_, j) => b[o + j]);
const all100 = r => r.every(v => v === 100);
const allZero = r => r.every(v => v === 0);
// Placeholder slots: all-zero, zero-with-exhaust-100, or 100-pads. The 100-pad
// test tolerates dirty stun/exhaust bytes (Mosswine's count row straddles its
// final pad; Nerscylla's slot-7 pad has dragon 0) but requires physicals all
// 100 AND every element 0-or-100 — real 100/100/100 rows (Bullfango, Larinoth
// heads) carry mid-range elements and stay parts.
const isPad = r => allZero(r) || (r.slice(0, 9).every(v => v === 0) && r[9] === 100)
  || (r[0] === 100 && r[1] === 100 && r[2] === 100 && r.slice(3, 8).every(v => v === 0 || v === 100));

// A real std hit-zone row: physicals <=125, elements <=100, stun <=200,
// exhaust 0 or >=100, and substance beyond a lone byte (kills the float-count row).
function realStd(r) {
  if (!(r.slice(0, 3).every(v => v <= 125) && r.slice(3, 8).every(v => v <= 100) && r[8] <= 200)) return false;
  if (!(r[9] === 0 || r[9] >= 100)) return false;
  const phys = (r[0] > 0) + (r[1] > 0) + (r[2] > 0);
  return phys >= 2 || r.slice(3, 8).some(v => v > 0);
}
const stdRowOk = r => isPad(r) || realStd(r);
// float-region count row: small u32 LE (N,0,0,0); the remaining 6 bytes of the
// 10-byte window are float data and can be anything (Malfestio's has a 64).
// No real part row starts [1..30,0,0,0] — parts with cut carry impact or shot.
const isCountRow = r => r[0] >= 1 && r[0] <= 30 && r[1] === 0 && r[2] === 0 && r[3] === 0;

// v3's strict anchor (verified correct for every monster it parsed): a plausible
// row with exhaust exactly 100 followed by another. Then walk BACKWARD while the
// preceding row still looks like table content — recovers Nerscylla, whose first
// table's head has exhaust 150 and was skipped entirely by v3.
function findStartStd(b) {
  const plausibleHZ = r => r[0] > 0 && r[2] > 0 && r.slice(0, 3).every(v => v <= 120) && r.slice(3, 8).every(v => v <= 100);
  const anchorRow = r => plausibleHZ(r) && r[1] > 0;
  let o0 = -1;
  for (let o = 0x40; o < 0x140 && o + 20 <= b.length; o++) {
    const r0 = row10(b, o); if (r0[9] !== 100 || all100(r0) || !anchorRow(r0)) continue;
    const r1 = row10(b, o + 10);
    if ((r1[9] === 100 && plausibleHZ(r1)) || all100(r1)) { o0 = o; break; }
  }
  if (o0 < 0) return -1;
  while (o0 - 10 >= 0x40) { const r = row10(b, o0 - 10); if (!stdRowOk(r) || isCountRow(r)) break; o0 -= 10; }
  return o0;
}

function parseStd(b, start) {
  const rows = []; let o = start;
  while (o + 10 <= b.length) { const r = row10(b, o); if (isCountRow(r) || !stdRowOk(r)) break; rows.push(r); o += 10; }
  // Regions measure 8 or 16 rows, sometimes plus one stray all-zero row before
  // the float section, so floor to whole 8-slot blocks. Do NOT infer block
  // boundaries from row content: Fatalis carries no stun on any part (no
  // "head" marker) and Stonefist Hermitaur's second block opens on two pad
  // slots, so both would read as one long table under a content heuristic.
  const blocks = Math.floor(rows.length / 8);
  if (!blocks) return [];
  const tables = [];
  for (let t = 0; t < blocks; t++) {
    const parts = [];
    for (let s = 0; s < 8; s++) { const r = rows[t * 8 + s]; if (!isPad(r)) parts.push({ slot: s, row: r }); }
    if (parts.length) tables.push(parts);
  }
  return tables;
}

// ---- SIEGE: unchanged from v3 (verified byte-perfect vs Kiranico) ----
function findStartSiege(b) {
  const plausibleHZ = r => r[0] > 0 && r[2] > 0 && r.slice(0, 3).every(v => v <= 120) && r.slice(3, 8).every(v => v <= 100);
  const anchorRow = r => plausibleHZ(r) && r[1] > 0;
  for (let o = 0x40; o < 0x140 && o + 20 <= b.length; o++) {
    const r0 = row10(b, o); if (r0[8] !== 0 || r0[9] !== 0 || !anchorRow(r0)) continue;
    const r1 = row10(b, o + 10);
    if ((r1[8] === 0 && r1[9] === 0 && plausibleHZ(r1)) || allZero(r1)) return o;
  } return -1;
}
function siegeRowKind(r) {
  if (allZero(r)) return 'zero';
  if (r[8] === 0 && r[9] === 0 && r.slice(0, 8).every(v => v <= 120) && r[0] <= 120) return 'hz';
  return 'float';
}
function parseSiege(b, start) {
  let N = 0; while (siegeRowKind(row10(b, start + N * 10)) === 'hz') N++;
  if (N === 0) return [];
  const tables = [];
  for (let blk = 0; ; blk++) {
    const base = start + blk * N * 10; if (base + N * 10 > b.length) break;
    const parts = []; let anyHZ = false, hitFloat = false;
    for (let s = 0; s < N; s++) { const k = siegeRowKind(row10(b, base + s * 10));
      if (k === 'float') { hitFloat = true; break; }
      if (k === 'hz') { parts.push({ slot: s, row: row10(b, base + s * 10) }); anyHZ = true; } }
    if (hitFloat || !anyHZ) break;
    tables.push(parts);
  }
  return tables;
}

function partObj(slot, r, name) { const o = { slot }; if (name) o.name = name; KEYS.forEach((k, j) => o[k] = r[j]); return o; }

// Every enemy arc, base and variant. The _NN suffix selects the variant:
// _00 base, _01/_02 subspecies & rare species, _04 deviants, _05 the
// "Furious/Savage/Raging/Chaotic" variants. The DB keys those as
// suffix * 256 + em number (small monsters occupy the suffix-16 block).
const files = readdirSync(ARCDIR).filter(f => /^ems?\d+_\d+\.arc$/.test(f)).sort();
const out = {}; const problems = [];
for (const f of files) {
  const id = f.replace('.arc', ''); const small = /^ems/.test(id);
  const [num, variant] = id.match(/\d+/g).map(Number);
  const dbId = (small ? 16 : variant) * 256 + num;
  const name = idNames[dbId] || null;
  let b; try { b = getDt(`${ARCDIR}/${f}`); } catch { b = null; }
  if (!b) { out[id] = { name, error: 'no-dttune' }; problems.push(`${id}:no-dttune`); continue; }
  const hp = b.readUInt32LE(0x38);
  // em087 uses a 2-byte-prefixed record layout the std/siege parsers misread
  // into garbage rows; keep it flagged until it gets its own decoder. It is
  // the only large monster on Kiranico we don't ship — their Ahtal-Neset
  // (the wall phase of the Ahtal-Ka fight), which the community DB has no
  // entry for, so `name` stays null rather than inventing one.
  if (id === 'em087_00') { out[id] = { name, hp, error: 'non-standard-format' }; problems.push(`${id}=${name}:non-standard`); continue; }
  let mode = 'std', start = findStartStd(b), tablesRaw;
  if (start >= 0) tablesRaw = parseStd(b, start);
  if (start < 0 || !tablesRaw || !tablesRaw.length || !tablesRaw[0].length) {
    const ss = findStartSiege(b); if (ss >= 0) { mode = 'siege'; start = ss; tablesRaw = parseSiege(b, ss); } }
  if (start < 0 || !tablesRaw || !tablesRaw.length || !tablesRaw[0]?.length) { out[id] = { name, hp, error: 'table-not-found' }; problems.push(`${id}=${name}:not-found`); continue; }
  if (!small && tablesRaw[0].length < 2) { out[id] = { name, hp, format: mode, error: 'non-standard-format' }; problems.push(`${id}=${name}:non-standard`); continue; }

  // Part names: only from the DB, only when the base table byte-matches in order.
  const core = name && dmg[name] ? dmg[name].parts.filter(p => !isBreak(p.part)) : null;
  const base = tablesRaw[0];
  let dbNames = null;
  if (core && core.length === base.length) {
    let ok = true;
    for (let i = 0; i < base.length; i++) { const p = core[i], r = base[i].row;
      if (r[0]!==p.cut||r[1]!==p.impact||r[2]!==p.shot||r[3]!==p.fire||r[4]!==p.water||r[5]!==p.ice||r[6]!==p.thunder||r[7]!==p.dragon) { ok = false; break; } }
    if (ok) dbNames = core.map(p => p.part);
  }
  out[id] = {
    name, em_id: id, db_id: dbId, hp, hp_matches_db: idHp[dbId] > 0 && hp === idHp[dbId],
    format: mode, table_count: tablesRaw.length,
    part_names: dbNames ? 'db (byte-validated)' : 'none (slot index only)',
    tables: tablesRaw.map((t, ti) => ({ index: ti, parts: t.map((p, pi) => partObj(p.slot, p.row, mode === 'siege' ? null : (dbNames && ti === 0 ? dbNames[pi] : null))) })),
  };
}
const wrapped = {
  _meta: {
    description: 'MHGU monster hit zones — all parallel tables (normal / enraged / broken), decoded from base-game RomFS. v4: fixed table-region parsing (see build_v4.mjs header).',
    source: 'nativeNX/arc/enemy/em###_00.arc -> dt_tune/..._dttune (MT Framework, magic DTT\\0)',
    fields: 'per part: slot (index within its 8-slot block), cut, impact, shot, fire, water, ice, thunder, dragon, stun, exhaust. game order = ice before thunder. physicals reach 125, stun 200, exhaust 0/100-255.',
    tables: 'std tables are parallel 8-slot blocks (normal / enraged / broken); placeholder slots (all-zero or all-100 rows) are omitted but slot numbers are kept. semantic labels are NOT assigned. siege break tables are sparse.',
    part_names: 'assigned ONLY when the base table byte-matches the collection-tracker DB in order; otherwise slot index only (no invented names).',
    hp_offset: 'u32 at file offset 0x38',
    monster_count: Object.values(out).filter(m => !m.error).length,
  },
  monsters: out,
};
writeFileSync(OUT, JSON.stringify(wrapped, null, 1));
const ok = Object.values(out).filter(m => !m.error);
console.log(`extracted ${ok.length}/${files.length} | problems ${problems.length}: ${problems.join(', ') || 'none'}`);
console.log('table_count dist:', JSON.stringify(ok.reduce((a, m) => { a[m.table_count] = (a[m.table_count] || 0) + 1; return a; }, {})));
console.log('db-named monsters:', ok.filter(m => m.part_names.startsWith('db')).length);
