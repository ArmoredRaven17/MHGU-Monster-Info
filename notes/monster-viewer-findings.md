# MHGU Monster Viewer — review findings

10 findings (10 open), exported 2026-09-26 from the Review Findings log.

Live log: https://claude.ai/artifact/D2AMYQccRY1ESq5khzYXTB

Severity: **blocker** should not ship, **bug** is wrong but shippable, **nit** is cosmetic,
**note** is context rather than work.

Titles and detail describe what was seen on screen. The game names almost nothing — parts, effects
and clips are driven by ID — so a phrase like "the fire rock bomb" is a recall label, not an
identifier, and is not expected to appear anywhere in the source. Where a finding names a mechanism
in the code, that is the reading it was matched to, not the wording of the report.

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

  On the name: "Fire Rock Bomb" is an observer's description of what the attack looks like, not an
  identifier, and nothing in the tree carries that string nor should. Records are keyed by `pel` /
  `key` / `path`. Mechanically the description points at the rock shells, documented in
  `shells-em043.md` 9 and reaching the scheduler through `rockInput()` as
  `{ variant, target, floorY }` — the same path the delay-driven stages run down.

  `docs/render/rom/effect/schedule.js` ~295-355 (`hitLife`, `stepCount`, `stepShells`); `shells.js`
  `slotStep`; `docs/effects/em002_04.json` (28 shell records)

## Bloodbath Diablos (em007_04)

- **[bug] clip** — Steam explosion effects are incomplete, though some parts render

  Reported: the steam explosion effects are not complete. Some parts of them do render.

  Third partial-render report, after Gravios's fire beam and his gas clouds. Same shape as the fire
  beam in particular — one effect drawing some of its parts but not all — so worth treating the two
  together if either gets diagnosed.

## Gravios (em005_00)

- **[bug] clip** — Gas cloud effects render on some animations but not others

  Reported: the gas cloud effects do not render on some animations, but were confirmed rendering on
  others. So it is per-animation rather than the effect being absent outright.

  Nothing to check against here — `docs/effects/em005_00.json` is not in the pushed tree, so his effect
  records could not be looked at from this session.

  Possibly the same shape as the Khezu L2 M37 finding, which is also an effect missing on one animation
  while the monster's others are fine. Worth comparing the two if one gets diagnosed.

  `docs/effects/em005_00.json` (not in the pushed tree)

- **[bug] clip** — Fire beam partially renders

  Reported: the fire beam renders, but only partially.

  Separate from the gas cloud finding — that one is an effect missing entirely on some animations, this
  one is a single effect drawing incompletely.

## Grimclaw Tigrex (em032_04)

- **[bug] clip** — Steam vents from claw smashes are not displaying

  Reported: the steam vents that come off his claw smashes do not display at all.

  Absent rather than partial, unlike the Bloodbath and Gravios reports.

- **[bug] shells** — Rocks from throwing attacks are not showing

  Reported: the attacks that throw rocks do not show the rocks.

  Reported alongside the missing steam vents, but filed separately since they are different effects
  and may not share a cause.

  Filed under shells rather than clip: rocks reach the scheduler as shell effects through
  `rockInput()`, which came up in the Dreadking finding. That is only where rocks live generally, not
  a claim about this monster.

## Khezu (em003_00)

- **[bug] clip** — L2, M37 shows no shock effect

  Reported: playing list 2, Motion[37] shows no shock effect.

  What the pushed tree gives, as readings matched to that — not as the report itself.

  **List 2 looks like the ceiling posture.** The Khezu block in `motion-states.js` describes his ceiling
  sleep as "(3, 0x52) ceiling sleep L2 M8 -> hold L0 Motion[55] -> L2 M9 (posture 6, on the ceiling)".
  Those are the only L2 motions the file names, and both are ceiling. So L2 M37 is most likely a ceiling
  action, which fits a shock attack being expected there.

  **`MOTION_STATES.em003_00` has no list 2 entries at all.** Every key it defines is list 0 or list 3:
  `3|Motion[1]`, `3|Motion[2]`, `0|Motion[2]`, `0|Motion[15]`, `0|Motion[19]`, `0|Motion[31]`,
  `0|Motion[55]`, `3|Motion[13]`, `3|Motion[3..9]`, `3|Motion[12]`, `3|Motion[18]`. Nothing under `2|`
  exists for him anywhere in the file. Worth weighing carefully though: that table's own header says a
  motion listed there "changes what the viewer SHOWS while it plays" — state, part sets, timed fires —
  while an ordinary attack effect starts from the clip's own key events through `proof.js`. So the empty
  list 2 is suggestive, not proof, and it would only be the cause if this effect was meant to be a
  state-driven fire.

  **The likelier mechanism is an unexported record.** `schedule.js` drops an effect with the comment
  "no such record exported: the effect is not there" whenever a clip asks for a pel/key pair that is not
  in the monster's file. Khezu exports 24 clip records over two pels: `em003_00c` keys 0, 1, 4, 5, 6,
  30, 60, 90, 250, 3000, and `em003_00u` keys 200, 201, 210, 211, 260, 261, 262, 263, 270, 271, 272,
  273, 290, 320. If L2 M37 requests a key outside that set, nothing renders and nothing errors — which
  matches the report exactly.

  **The diagnostic that separates the two:** log the `(pel, key)` that L2 M37 requests and compare
  against those 24. In the set and still nothing drawn is a runtime problem; outside it is an export
  gap, and the fix is on the export side rather than the viewer's.

  **One thing to rule out before treating it as missing.** Khezu's shock trap effect is deliberately not
  on its own motion: the file records that "L3 Motion[2] is also the shock trap's first motion
  (10, 0x6e), which shows nothing of its own: the trap's effect runs on its hold, L3 Motion[13]", where
  it plays `c 1105` every 42 and is "shown as paralysis, as Rathian's same motion is". So one reading is
  that the shock being looked for lives on L3 M13 by design and L2 M37 was never going to show it. That
  does not fit if what was expected was a ceiling attack's own discharge rather than the trap.

  `docs/render/motion-states.js` (em003_00 block, no `2|` keys); `docs/render/rom/effect/schedule.js`
  ("no such record exported"); `docs/effects/em003_00.json` (24 clip records, pels `em003_00c` /
  `em003_00u`)

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
