# 08 — Audio, Narration & Islamic Content

**Depends on:** 01, 04, [14-assets-placeholders.md](14-assets-placeholders.md)
**Used by:** every game mode and screen
**Phase:** 5 (the narration interface and captions are needed from Phase 2)

## Audio categories

- Instruction narration
- Color names
- Shape names
- Number words
- Positive feedback
- Mascot expressions
- Sound effects
- Background music (**off by default**)

## Audio manager

The `AudioManager` lives in `packages/core/src/audio/` and uses the injected `AudioPlayer` and `SpeechFallback` interfaces.

| ID | Requirement |
|---|---|
| AU-01 | Narration MUST NOT overlap; a new narration cancels or queues after the current one, per call option. |
| AU-02 | Supports a narration queue (e.g. counting "এক… দুই… তিন"). |
| AU-03 | Supports cancellation of the current item and the whole queue. |
| AU-04 | Mute/unmute applies immediately, including to audio already playing. |
| AU-05 | Respects browser autoplay rules: no sound before the first user gesture; the Play button unlocks audio. |
| AU-06 | Pausing gameplay pauses or stops audio; resuming does not replay old lines automatically. |
| AU-07 | `replayInstruction()` replays the current activity's instruction. |
| AU-08 | Audio failure MUST NEVER block gameplay; `play()` resolves `"failed"` and the caption stays visible. |
| AU-09 | SFX and narration have separate enable flags and share one volume setting. |

```typescript
interface AudioManager {
  narrate(key: NarrationKey, opts?: { mode?: "interrupt" | "queue"; params?: Record<string, string | number> }): Promise<void>;
  playSfx(key: SfxKey): void;
  replayInstruction(): void;
  stopAll(): void;
  setMuted(muted: boolean): void;
  setLocale(locale: Locale): void;
}
```

### Playback resolution order

1. Packaged audio file for the key and locale, if present.
2. Otherwise `SpeechFallback` (development placeholder), if a voice exists for the locale.
3. Otherwise silent; the caption remains on screen.

## Captions

| ID | Requirement |
|---|---|
| AU-10 | Every essential spoken instruction MUST have an on-screen caption in the current language. |
| AU-11 | Captions stay visible while narration plays and for at least 2 s afterwards, or until the next instruction. |

## Voice manifest

All narration text lives in `packages/core/src/audio/voiceManifest.ts`.

```typescript
interface NarrationEntry {
  key: string;
  bn: string;
  en: string;
  neutralBn?: string;   // required if bn contains an Islamic expression
  neutralEn?: string;
  islamic: boolean;
  file: { bn: string; en: string };   // e.g. "audio/bn-BD/feedback/correct.mp3"
  status: "placeholder" | "final";
}
```

| ID | Requirement |
|---|---|
| AU-20 | Every key MUST have `bn` and `en` text. |
| AU-21 | Every entry with `islamic: true` MUST have neutral variants. |
| AU-22 | A missing translation or neutral variant MUST fail the build (manifest validation test). |
| AU-23 | Narration text MUST NOT be hardcoded in UI files (AR-04). |
| AU-24 | Number narration uses the vocabulary in [07-numbers-counting.md](07-numbers-counting.md). |

## Islamic expressions

Islamic expressions appear naturally as optional, positive encouragement. The game stays focused on its core learning goals.

| Event | Bengali | English | Neutral (expressions off) |
|---|---|---|---|
| Correct match | "মাশাআল্লাহ! খুব ভালো!" | "MashaAllah! Very good!" | "খুব ভালো!" / "Very good!" |
| Completed activity | "আলহামদুলিল্লাহ! আমরা শিখেছি!" | "Alhamdulillah! We learned it!" | "আমরা শিখেছি!" / "We learned it!" |
| New discovery | "সুবহানাল্লাহ! কী সুন্দর রং!" | "SubhanAllah! What a beautiful color!" | "কী সুন্দর রং!" / "What a beautiful color!" |
| Encouragement | "আবার চেষ্টা করি!" | "Let's try again!" | (same) |
| Rest time | "চলো একটু বিশ্রাম নিই!" | "Let's take a little rest!" | (same) |

| ID | Requirement |
|---|---|
| AU-30 | Parents can enable or disable Islamic expressions (default: enabled). |
| AU-31 | Religious phrases MUST NOT be used as a reward for "winning" or as negative feedback. |
| AU-32 | Religious phrases MUST NOT appear in incorrect-answer feedback. |

## Core narration lines

| Key | Bengali | English |
|---|---|---|
| `mix.intro.red-yellow` | লাল আর হলুদ রং মেশাই! | Let's mix red and yellow! |
| `color.red` | এটা লাল রং! | This is red! |
| `mix.result.red-yellow` | লাল আর হলুদ মিলে কমলা রং হলো! | Red and yellow make orange! |
| `mix.retry` | চলো আবার চেষ্টা করি! | Let's try again! |
| `match.correct.green-circle` | এটা সবুজ গোল! | This is a green circle! |
| `count.intro.balls` | চলো গুনি! কয়টা বল? | Let's count! How many balls? |
| `count.total.balls` | মোট {n}টা বল! | {n} balls in total! |
| `rest.reminder` | অনেক সুন্দর রং শিখেছি! এবার একটু বিশ্রাম নিই! | We learned so many colors! Let's rest a little! |

The full list is generated into `docs/narration-script.md`.

## Asset layout

```text
assets/audio/
  bn-BD/
    colors/  shapes/  numbers/  feedback/  instructions/  mascot/
  en-US/
    colors/  shapes/  numbers/  feedback/  instructions/  mascot/
  sfx/
```

Filenames match narration keys (`mix.result.red-yellow` becomes `instructions/mix-result-red-yellow.mp3`). Use compressed audio (AAC/MP3 or Opus) and a consistent, child-friendly voice.

## Content review

| Content | Reviewer | Checks |
|---|---|---|
| Islamic expressions and imagery | A knowledgeable adult chosen by the product owner (e.g. a local teacher or imam) | Correct wording and pronunciation, respectful context, no sacred object in play actions |
| Bengali script | A native Bengali (Bangladesh) speaker | Natural child-friendly wording, consistent dialect, correct number words |
| English script | A fluent English speaker | Simple vocabulary for ages 3–6 |

| ID | Requirement |
|---|---|
| AU-40 | The agent generates `docs/narration-script.md` from the manifest: key, bn, en, neutral variants. |
| AU-41 | Reviewers record outcomes in `docs/content-review.md` (role, date, keys, result). |
| AU-42 | The agent MUST NEVER mark content as reviewed. Unreviewed content may be used in development but blocks release. |

## Files

```text
packages/core/src/audio/types.ts
packages/core/src/audio/voiceManifest.ts
packages/core/src/audio/audioManager.ts
packages/core/src/audio/narrationQueue.ts
packages/core/tests/audio/*.test.ts
apps/desktop/src/lib/platform/webAudioPlayer.ts
apps/desktop/src/lib/platform/speechSynthesisFallback.ts
apps/desktop/src/lib/components/ui/AudioButton.svelte
scripts/generate-narration-script.ts
```

## Tests

- Manifest validation (AU-20 to AU-22).
- Queue ordering, interrupt vs queue, cancellation, mute mid-playback (AU-01 to AU-04), using a fake `AudioPlayer`.
- Fallback order: file → speech → silent with caption (AU-08).
- Islamic toggle off → neutral variants used.
- Integration: muting during narration does not block progression.

## Acceptance checklist

- [ ] Every screen's instructions narrate (placeholder allowed) and show captions.
- [ ] Mute, replay, and volume work.
- [ ] Islamic expressions toggle works and uses neutral variants.
- [ ] `docs/narration-script.md` is generated and complete.
