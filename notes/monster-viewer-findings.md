# MHGU Monster Viewer — review findings

2 findings (2 open), exported 2026-09-26 from the Review Findings log.

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
