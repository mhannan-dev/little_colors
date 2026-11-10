# Project brief for AI agents: Rumi Learning Adventures ("Little Colors")

Read this first. It explains what the app is, the rules it must follow, how the code is organised, how to run and test it, and how to work next to the other AI agents (Claude Code, Codex) in this repository.

> **The owner** writes in Bengali or Banglish. Reply in Bengali, keep it short, and explain technical terms simply.

---

## 1. What the app is

| | |
|---|---|
| Name | **Rumi Learning Adventures** (Bengali: রুমির শেখার অভিযান). Repo and package name: `little-colors`. |
| Audience | Children aged **3–6**. Parents are the administrators. Most of the children **cannot read**. |
| Languages | **Bengali (`bn-BD`) first**, English (`en-US`) second. The first-launch language is English (the owner's choice). Digits follow the language: বাংলা ১২৩ / English 123. |
| Platform | **Windows desktop app**: Tauri 2 shell with a SvelteKit UI, NSIS installer. A React Native mobile app is planned later. There is no public web version. |
| Network | **Offline.** All content is bundled. The only network use is the optional in-app update check (see section 7). |
| Mascot | **Rumi**, a friendly tiger cub with a green scarf. Its colours are design tokens (`mascot.*`). |

## 2. Non-negotiable product rules

The full list is in [docs/specs/01-product-principles.md](docs/specs/01-product-principles.md). The ones that matter most when you build a game:

- **The child never loses.** No game over, no failing, no "you lost". Even racing games are no-lose: friends stay close, everyone finishes together, and a crash is impossible.
- **PR-07:** no scores, coins, tallies, streaks, star ratings, countdown timers or leaderboards. Progress is shown as pictures (a journey bar), never as numbers.
- **PR-08 / PR-21:** a wrong answer gets a gentle retry ("আবার চেষ্টা করি!"). No buzzers, red crosses or sad mascot.
- **PR-22:** after 2 wrong tries a hint appears (glow plus a ghost hand). The answer is never forced.
- **PR-23:** the child moves on with a big Next button. Don't advance automatically mid-lesson.
- **PR-24:** meaning never relies on colour alone. Add a shape, a label or a voice line.
- **PR-25 / PR-26: playable without reading.** Every instruction is spoken. Every button has a pictogram and says its name on focus or hover. If the child is idle, the prompt is repeated at most twice. First visits show a ghost-hand demo.
- **PR-13:** sacred objects (Kaaba, mosque) are never targets for kicking, throwing, counting or "taking away". The Kaaba in block building is **locked**: it can't be removed or built on. Don't mark religious content as reviewed. A human must review it.
- **AU-30:** Islamic expressions ("মাশাআল্লাহ") appear only when `settings.islamicExpressionsEnabled` is on.
- **PR-12:** never copy another game's name, characters, art or look. The genre is fine; clones are not.
- No ads, purchases, sign-up, analytics, chat, or external links in the child UI. Don't collect child data.
- Gentle motion: no flashing. Respect `prefers-reduced-motion`. The `paused` store must stop timers, narration and motion.

## 2b. What the UI looks like, and how professional it is

**Visual style: warm, calm, toy-like. Deliberately *not* photo-realistic.** The goal is a polished picture-book feel for small children, not realism.

| Area | What it is today |
|---|---|
| Design system | One source of colour: [packages/design-tokens/src/index.ts](packages/design-tokens/src/index.ts). Cream background `#FFF9F0`, white cards, soft borders `#DCE5E1`, dark text `#263238`. Six learning colours: red `#E5484D`, yellow `#F2C94C`, blue `#3478D4`, orange `#F28C28`, green `#35A66A`, purple `#8A5AC2`. Dark-theme tokens exist. Rounded shapes (radius 24–32 px). |
| Type | **Hind Siliguri** (bundled) for Bengali and Latin. Big, bold labels (24–40 px on child screens). |
| Touch targets | At least 56 px; game buttons **88 px**. Large pictogram buttons (GameButton), coloured by meaning: green = go, dark = replay, light = other. |
| Layout | Fits 800×600 up to large screens. The whole UI scales up to 1.6× (`zoom` on `<main>`) and uses container query units. No page scrolling inside games. |
| 2D art | Hand-built **SVG**: game cards, the Rumi mascot (animated states: idle, wave, celebrate, encourage, thinking), mini-game art. Simple flat shapes with dark outlines, consistent across screens. |
| 3D art (three.js) | **Code-built low-poly toys** (no downloaded models): rounded-box toy blocks with printed letters, chunky toy cars with animal drivers, cone trees, buildings, trucks and buses. Soft shadows, gradient skies with fog, neutral tone mapping (bright toy colours), squash-and-stretch hops, confetti. It looks like a well-made toy set, not a realistic simulator. |
| Photos | Real photos only where they teach: Animal Detective (licensed free, see docs/asset-licenses.md). Real flag SVGs. |
| Motion | Gentle (no flashing). Reduced motion respected. A ghost hand demonstrates. Confetti on success. |
| Sound | Narration lines (Bengali and English) for every instruction and button. Today they are **placeholder voices** (TTS or speech synthesis) until a human records them. Small synthesised chimes and horn sounds. No music. |

Reference screenshots: [docs/ui/](docs/ui/) (welcome, game picker, colour mixing, matching, numbers, mini-games, ghost hand, record studio).

**Honest quality level:** a **polished, consistent prototype close to early-release quality**, but not yet store-ready. Where it falls short:
- No professional illustrator or sound designer yet. Some art is still placeholder (spec 14, AS-20), and the voices are placeholders.
- Some screens use **emoji** for food, animals and landmarks (Kitchen, Highway journey). They depend on the Windows emoji font, so they look less unified than the SVG art.
- **Consistency across agents varies.** The games added by other agents (Formula Circuit, City Bus Driver, Counter Rush) use adult-style UI: English-only, text-heavy, a debug HUD in Formula. They don't yet meet the bar below.
- The game picker has ~20 cards and scrolls. Small children don't scroll, so it needs grouping or a smaller grid.

**The bar for any new screen:**
- Use tokens (no new random colours) and Hind Siliguri.
- Pictogram + spoken name on every button. No reading required.
- Bengali first.
- Check screenshots at 1280×800 **and** 800×600 before calling it done.
- Toy-like, friendly and calm, matching the existing SVG and 3D style.
- Don't use realistic violence, crashes or adult HUDs (speed tables, debug overlays, score panels).

## 3. Repository layout (pnpm monorepo)

```
packages/core/            Pure TypeScript game rules (no UI). Tests: packages/core/tests/**
  src/fsm/createMachine.ts      Tiny state-machine helper ({target, guard, reduce, effects})
  src/minigames/choiceMachine.ts  Shared "choose one" machine: READY→ANIMATING→CORRECT/TRY_AGAIN→CELEBRATING→COMPLETE
  src/audio/                    voiceManifest.ts (lines), catalog.ts (NARRATION_CATALOG = every spoken key), audioManager.ts
  src/play3d/  kitchen/  highway/  color-mixing/  shape-matching/  numbers/  flags/ …  one folder per game
  src/index.ts                  Public API (every module is exported here)
packages/design-tokens/   Colours, sizes, mascot colours (CSS variables --learn-*, --mascot-*)
apps/desktop/             SvelteKit 3 + Svelte 5 runes SPA (adapter-static, ssr=false) inside Tauri 2
  src/routes/<game>/+page.svelte   One route per game; /play is the game picker
  src/lib/features/<game>/         Each game's screen components
  src/lib/audio/narrator.ts        instruct / instructAll / say / speakLabel / setIdlePrompt / leaveScreen
  src/lib/components/ui/           TopBar, GameButton (action="play|next|replay|choose-game|hint|reset"), Icon
  src/lib/game/                    scheduler.ts (pausable timers), hand.ts (ghost hand)
  src/lib/three3d/toyKit.ts        Shared three.js kit: stage, toy car, trees, blocks, confetti (lazy-loaded)
  src/lib/platform/updates.ts      In-app update check
  src/lib/stores/                  settings (language, numeralStyle, sound, difficulty), pause
  src-tauri/                       Rust shell, tauri.conf.json, capabilities, icons
  tests/e2e/*.spec.ts              Playwright tests (Edge)
docs/specs/               Product and technical specs 00–17 (source of truth)
docs/agents/              Multi-agent ownership map (README.md), task files, reports
docs/decisions/           Decision records (e.g. 0001-in-app-updates.md)
examples/                 Stand-alone starter projects (formula-circuit = Rust/Bevy, restaurant-sim); not part of the app
run.ps1                   Windows launcher (menu/dev/web/record/test/e2e/build/tts…)
```

## 4. How a game is built (follow this pattern)

1. **Rules in `packages/core/src/<game>/`:** pure functions (round generator with a seeded RNG, checks) plus a `<GAME>_NARRATION: NarrationEntry[]` list with Bengali and English text. Register it in `src/audio/catalog.ts` and export it from `src/index.ts`. Add tests in `packages/core/tests/<game>/`. A catalog test fails on duplicate narration keys.
2. **Screen in `apps/desktop/src/lib/features/<game>/`:**
   - Use `instruct(key)` (or `instructAll([...])`) for the spoken instruction and idle repeats, `say(key)` for feedback, and `speakLabel(key)` for button names.
   - Use `createScheduler()` for timers, and pause it when the `paused` store is set.
   - Show numbers with `formatNumeral(n, $settings.numeralStyle)`.
   - Use `GameButton` for standard actions.
   - Call `leaveScreen()` in `onDestroy`.
3. **Route** `apps/desktop/src/routes/<game>/+page.svelte`, plus a **card** in `src/routes/play/+page.svelte`. Each card needs an SVG picture and a `mode.<game>` narration key.
4. **e2e test** `apps/desktop/tests/e2e/<game>.spec.ts`.

**3D games:**
- Import `#lib/three3d/toyKit.ts` with a dynamic `import()`.
- Pause the render loop when the canvas is hidden.
- Dispose geometries and materials.
- Put real `<button>`s over 3D objects so keyboard users, screen readers and tests can reach them.
- Provide a fallback if WebGL fails.
- A released WebGL context can't be reused: use a fresh `<canvas>` (`{#key}`).

## 5. Games in the app

| Route | Game | Notes |
|---|---|---|
| `/mixing` | Colour mixing | |
| `/matching` | Shape matching | |
| `/numbers` | Number counting | |
| `/football` `/car` `/bird` | Football, Garage, Birds | Shared choice machine |
| `/flag` | Country flags | |
| `/holy-puzzle` | Mosque and Kaaba picture puzzle | Religious imagery, not yet reviewed |
| `/fruit` `/flower` `/animals` | Fruits, flowers, Animal Detective | |
| `/thinking` | Thinking lessons (ages 5–10) | Includes rally, picnic, shop, train, treasure, letters |
| `/garden-3d` | 3D flower garden | |
| `/blocks-3d` | 3D block building | Missions, 💡 ideas, "My builds" gallery, locked Kaaba template |
| `/color-blocks` | Colour blocks puzzle | |
| `/abc-123` | 3D ABC & ১২৩ blocks | |
| `/toy-car` | Rumi's toy car | |
| `/race` | Race with friends | Plus "just drive" free mode; no-lose |
| `/kitchen` | রুমির রান্নাঘর (Rumi's Kitchen) | No-lose cooking: one friend at a time, nothing burns, no coins |
| `/highway` | রুমির হাইওয়ে (Rumi's Highway) | Pedals, lanes, horn, pause menu; a crash is impossible |
| `/record` | Voice recording studio | Dev server only |

**Being added by another agent (uncommitted, check `git status`):**
- `/city-bus-driver`: currently has timers, scores and locked routes. That conflicts with PR-07.
- `/formula-circuit`: Bevy compiled to WASM, about 87 MB. Needs `pnpm --filter desktop build:formula`.
- `/world-soccer`, `/tic-tac-toe`.
- `/counter-rush`: **the owner asked for it to be removed**, because customers leave and it uses coins. Rumi's Kitchen replaces it.

## 6. Commands

From the repo root (Windows, PowerShell or Git Bash):

| Do | Command |
|---|---|
| Install | `pnpm install` |
| Run the desktop app | `pnpm dev` (= `tauri dev`; UI on port 5173) or `.\run.ps1 dev` |
| UI in the browser | `.\run.ps1 web` |
| Unit tests | `pnpm --filter @little-colors/core exec vitest run` and `pnpm --filter desktop test` |
| Typecheck | `pnpm --filter desktop typecheck` (svelte-check) and `pnpm --filter @little-colors/core exec tsc --noEmit` |
| e2e | `cd apps/desktop; npx playwright test tests/e2e` |
| Installer | `.\run.ps1 build` → `apps/desktop/src-tauri/target/release/bundle/nsis/*.exe` |

**e2e details:**
- Tests run in Microsoft Edge (`channel: 'msedge'`) against a fresh dev server on **port 5179**.
- That server uses its own dependency cache `node_modules/.vite-e2e`, so running tests never breaks an open dev server.
- Tests default to Bengali (`rumi-language=bn-BD`).
- On a busy machine, the first page load can take 30–60 s. Use a generous first-visible timeout.

## 7. Desktop, updates, release

- **Rust:** Tauri 2. The local toolchain is **Windows GNU**, and `crate-type = ["rlib"]` is required for MinGW linking. Keep both.
- **Security:** CSP is self-only (OF-02). Capabilities are minimal (OF-04). Any new plugin needs a record in `docs/decisions/`.
- **In-app updates** (`tauri-plugin-updater`, decision 0001):
  - Checks quietly at most once a day, and never offline.
  - A grown-up must press and hold to install.
  - Updates must be signed. The public key in `tauri.conf.json` is still `REPLACE_WITH_UPDATER_PUBLIC_KEY` until the owner sets it up.
  - Releases: push a `v*` tag, and `.github/workflows/release-desktop.yml` publishes to the public repo `mhannan-dev/rumi-learning-releases`. Steps are in [docs/releasing.md](docs/releasing.md).
- **Data:** user data lives in WebView2 localStorage under `%LOCALAPPDATA%\com.littlecolors.app`. It survives upgrades. **Never change the identifier `com.littlecolors.app`.**
- **Git:** the source repo is `github.com/mhannan-dev/little_colors` (private). Push as the `mhannan-dev` account.

## 8. Working with the other agents (important)

Several AI agents edit this repo, sometimes at the same time. Follow [docs/agents/README.md](docs/agents/README.md):

1. **Before editing, run `git status`.** If a file has uncommitted changes you didn't make, someone else is working on it. Don't edit it. Tell the owner.
2. **Never edit a file you don't own** (see the ownership map). In short:
   - Claude owns `apps/desktop/**`, the core wiring (`index.ts`, `audio/**`), tooling and specs. One exception: block building (`blocks3d`) moved to Claude.
   - Codex owns its core modules (`shape-matching`, `numbers`, `session`, `settings`, `progress`, `storage`) and its own features.
   - **Gemini:** ask the owner which area is yours before you start.
3. **Commit only your own files**, in separate commits with a clear prefix (`Gemini: …`). Never `git add -A` when other people's changes are in the tree. Commit only when the owner asks.
4. **No destructive git:** no `reset`, `checkout --`, `stash`, `clean`, rebase or force push, unless the owner explicitly asks.
5. **Don't overwrite** a file without reading its current content first.
6. If a file you own was changed by someone else: **stop and tell the owner.** Don't revert it.
7. Don't start a second dev server on a port someone is using. Use your own port.

## 9. Gotchas

- **Bengali text in search-and-replace:** exact matching on Bengali strings often fails, because of Unicode normalisation (nukta forms). Anchor edits on ASCII text near the Bengali, or use regexes with `\u09xx` escapes.
- **`run.ps1` must stay ASCII.** Windows PowerShell 5.1 misreads non-ASCII characters.
- **Svelte 5 runes everywhere** (`$state`, `$derived`, `$effect`, `$props`). Imports use `#lib/...` aliases and `.ts` extensions.
- **Narration** plays in this order: human `.wav` recordings → TTS `.mp3` → speech synthesis → caption only. Every key must be in `NARRATION_CATALOG`. New lines are `status: 'placeholder'` until recorded.
- **Picker layout:** with many cards, the picker page scrolls. Small children don't scroll, so keep important cards near the top.

## 10. Open decisions / next steps

- Remove Counter Rush (owner's request), and fix City Bus Driver so a child can't lose.
- Parent settings screen (C-06): parent gate, difficulty, sound, Islamic expressions, settings that persist.
- The owner's one-time updater setup: signing key, public releases repo, GitHub secrets.
- Human review of religious imagery (Kaaba template, mosque puzzle).
- Voice recordings for the many placeholder narration lines (`/record` studio or Azure TTS via `scripts/generate-tts.ts`). Never put API keys in chat. Keys live only in the git-ignored `.env`.
