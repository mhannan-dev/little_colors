# Bundled country and territory flags

- 249 entries marked ISO in `flag-icons` **7.6.0**, including countries and
  territories. Extra regional/organizational flags are excluded. This is not a
  claim that all 249 entries are sovereign states.
- SVG artwork: [lipis/flag-icons](https://github.com/lipis/flag-icons), MIT license.
- Bengali/English display names: [Unicode CLDR JSON](https://github.com/unicode-org/cldr-json),
  `cldr-localenames-full` **49.0.0**, Unicode License V3 (data files).
- Flags retain the upstream 4:3 artwork and use `object-fit: contain`; nonrectangular
  flags are not stretched. Sources are versioned snapshots and may need updates.
- Full original notices are in `licenses/` and are included in the app's expandable
  credits. `sources.json` records archive URLs and npm SHA-512 integrity values.
- Run `python vendor_flags.py` from this directory (or pass the script's full path)
  to reproduce the data. The script reads pinned archives without installing or
  executing packages, verifies integrity, rejects active/external SVG content and
  refuses to replace generated files whose content differs.
- Gameplay needs no network. All 249 SVGs and both name sets are bundled.
- Similar/identical flag families are excluded from one another's answer choices.
  Every entry remains selectable in the learning gallery and playable in a quiz.
