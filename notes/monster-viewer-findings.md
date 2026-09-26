# MHGU Monster Viewer — review findings

4 findings (4 open), exported 2026-09-26 from the Review Findings log.

Live log: https://claude.ai/artifact/D2AMYQccRY1ESq5khzYXTB

Severity: **blocker** should not ship, **bug** is wrong but shippable, **nit** is cosmetic,
**note** is context rather than work.

> These findings are about `ArmoredRaven17/mhgu-monster-viewer`, not this repository. This file is
> the durable copy of the log, checked in here because the cloud session that maintains it runs in a
> container that gets reclaimed. Code changes belong to the local agent working in the viewer repo;
> the cloud session only reads that repo and records what it finds.
>
> Pushed viewer HEAD when this was written: `b959955` (2026-09-24). A good deal of effects work
> existed only locally at that point, so anything here that cites counts is citing the push, not
> the working tree.

## Dreadking Rathalos (em002_04)

- **[bug] shells** — Fire Rock Bomb behaves oddly under the new pause-effects-with-animation behaviour

  Reported: the effect renders, but behaves oddly now that effects pause with the animation. Suspicion
  is that effects carrying time delays may need omitting.

  What the pushed tree shows about why. Shell-driven effects do not advance on the clip's frame alone.
  `schedule.js` hands `stepShells` two time sources that are independent of it:

  - `hitLife: true` — "the hit-slot life of a timer-0 shell01 (its hit data's delay + duration;
    shells.js slotStep)". The comment states plainly that without it "the fire and explosions would end
    at their first move". So a delay+duration window is exactly what keeps the fire and explosions alive.
  - `stepCount: this.frame` — "the free-running timer Rathian's hover dust pulses on (vtable +0x1dc
    0xcee250: every 100 moves since her setup)", counted from the mount as a stand-in for its phase.
    Free-running by description, not clip-locked.

  That gives two failure shapes, and which one it is decides the fix. Either the pause halts stepping,
  so a delayed stage never elapses and the sequence hangs at whatever stage it had reached (the rock
  lands but the explosion never comes); or the pause halts only the clip while those counters keep
  advancing, so stages fire on a frozen monster and drift out of sync. Worth confirming which is
  happening before changing anything — the pause code is not in the pushed tree, so this could not be
  read here.

  On omitting delayed effects: it would work, but note what it costs. `hitLife` exists specifically to
  stop the fire and explosions ending at their first move, so omitting the delayed records trades wrong
  timing for the effect being absent. Where it is the explosion itself that is delayed, omission and the
  hang look the same on screen. A gate that freezes the delay counters alongside the clip, rather than
  dropping the records, would keep both.

  Blast radius if a rule is written against `when == "shell"`: 112 records across 10 monsters in the
  pushed tree, and Dreadking is the heaviest by some margin — 28 shell records of his 78, against 17 for
  Dreadqueen and 12–13 for the rest of the Rathian and Rathalos line, plus Khezu 11, Savage Deviljho 5,
  Nargacuga 4 and Deviljho 4. So he is the worst case, not an outlier, and a fix aimed at him covers the
  line.

  One mapping gap: "Fire Rock Bomb" does not appear anywhere in the pushed tree. Effect records are
  keyed by `pel` / `key` / `path` rather than by name, so that label lives in local work and the record
  it refers to could not be pinned down from here. Rock behaviour itself is documented in
  `shells-em043.md` 9 and reaches the scheduler through `rockInput()` as `{ variant, target, floorY }`.

  `docs/render/rom/effect/schedule.js` ~295-355 (`hitLife`, `stepCount`, `stepShells`); `shells.js`
  `slotStep`; `docs/effects/em002_04.json` (28 shell records)

## Rathian line

- **[nit] clip** — Rathian line's DA should be L4, M8

  Set the opening view (DA) to `L4, M8` for all three em001 entries — Rathian (`em001_00`), Gold
  Rathian (`em001_02`) and Dreadqueen Rathian (`em001_04`). All three currently read
  `view: {"list": "0", "clip": "Motion[14]_loop"}`.

  One thing to settle before writing it: the Barioth precedent in this file renders a bare
  `DA: L2, M12.` as `clip: "Motion[12]"`, with no suffix, while the Rathian line's present clip carries
  `_loop`. Writing `"Motion[8]"` literally would therefore also drop the loop, which is a behaviour
  change on top of the clip change. If the opening view should keep looping, the value wants to be
  `"Motion[8]_loop"` instead. Reported as "L4, M8" with no suffix given either way.

  Came in as a directed change rather than a defect, so it is filed as a nit; it is work to do, not
  context to remember.

  `docs/part-review.json` → `em001_00`, `em001_02`, `em001_04` → `view`

## em087_00

- **[note] data** — em087_00 has no name anywhere in the repo, so name fields render as "null"

  `docs/monster-classes.json` classes `em087_00` as `Unclassified` and carries no name for it; no name
  exists elsewhere in the repo either. `dev/weld-report.json` shows it beside `em087_00_rubble_02` and
  `_03`, which suggests a destructible rather than a monster proper, but that is a guess and no name
  was invented.

  Any consumer that prints a monster name needs a null guard. The Effects Coverage Board printed the
  literal string `null` in that row and answered a search for "null"; that page now renders
  `(unnamed)`, but the guard lives only in the published page and will be lost the next time the board
  is regenerated. Worth putting the same guard in whatever generates the board, and anywhere else a
  name reaches the DOM.

  `docs/monster-classes.json`, `dev/weld-report.json`

## Not tied to one monster

- **[note] data** — Regenerating the coverage board from a fresh clone would blank 29 wired monsters

  As of pushed HEAD `b959955` (2026-09-24), `docs/effects/` holds 22 monster files. The Effects
  Coverage Board shows 51 monsters wired, and all 22 pushed ones match its totals exactly
  (`tot == len(effects)`), with nothing in the push that the board is missing. The other 29 come from
  work that exists locally but is not pushed.

  So the board is ahead of origin, not behind. Anything that regenerates it from a fresh clone before
  that work is pushed will drop those 29 rows to zero: Gravios, Gypceros, Kirin, the four dromes,
  Cephadrome, Daimyo, Blangonga, Furious Rajang, Bulldrome, Giadrome, Lavasioth, Barroth, Royal
  Ludroth, Alatreon, Nibelsnarf, Brachydios, Zamtrios, Seltas Queen, Seregios, both Malfestios, both
  Glavenuses, both Astaloses, both Gammoths.

  `docs/effects/` at `b959955`
