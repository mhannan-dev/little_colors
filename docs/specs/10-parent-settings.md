# 10 — Parent Gate & Parent Settings

**Depends on:** 01, 02, 04, [11-curriculum-progress.md](11-curriculum-progress.md) (persistence)
**Phase:** 6 (the gate may be stubbed earlier)

## Parent gate

The gate is a speed bump for young children, not a security mechanism.

| ID | Requirement |
|---|---|
| PS-01 | The parent button is small, placed in a corner of the Welcome screen, and MUST be **held for 3 seconds** (a progress ring fills). A tap does nothing. |
| PS-02 | After the hold, a **text-only** question appears with **no audio**, written in words, e.g. "বারো যোগ সাত কত?" / "What is twelve plus seven?" |
| PS-03 | Four numeric answer buttons; questions are random with results between 11 and 30; all four options are unique. |
| PS-04 | A correct answer opens Parent Settings. A wrong answer quietly closes the gate and returns to Welcome: no error sound, no lockout. |
| PS-05 | The gate is keyboard and screen-reader accessible for adults. Hold can be replaced by pressing and holding Enter or Space. |
| PS-06 | The same gate guards every external link (privacy policy, store pages). |

```typescript
// packages/core/src/settings/parentGate.ts
interface GateQuestion {
  textBn: string;   // numbers written as words
  textEn: string;
  options: number[]; // length 4, unique, includes answer
  answer: number;
}
function createGateQuestion(seed: number): GateQuestion;
```

## Parent Settings screen (Screen 7)

| Setting | Type | Default | Notes |
|---|---|---|---|
| Language | `bn-BD` / `en-US` | `bn-BD` | Changes UI text, captions, and narration |
| Numeral style | Bengali / English / both | Bengali | Used by Numbers mode and any displayed number |
| Volume | 0–100 % | 80 % | Shared by narration and SFX |
| Narration | on/off | on | |
| Sound effects | on/off | on | |
| Background music | on/off | **off** | |
| Islamic expressions | on/off | on | Off → neutral variants |
| Difficulty | Beginner / Explorer / Advanced | Beginner | Applies to all modes |
| Reduced motion | on/off | follows OS setting | |
| Dark mode | on/off | off | |
| Rest reminder | 10–60 min, step 5 | 20 min | Also an "off" option |
| Reset local progress | button with confirmation | — | Clears progress only, not settings |

| ID | Requirement |
|---|---|
| PS-10 | All settings persist locally and apply immediately. |
| PS-11 | No personal information is requested (PR-05). |
| PS-12 | Shows the difficulty recommendation when one exists ([11-curriculum-progress.md](11-curriculum-progress.md), CP-20). |
| PS-13 | "Reset local progress" asks for confirmation in plain adult language. |
| PS-14 | Contains a short privacy statement ("This app stores progress only on this device and collects no personal data") and a gated link to the full privacy policy. |
| PS-15 | A clear Back / Done button returns to Welcome. |

## Settings service

```typescript
// packages/core/src/settings/settingsService.ts
interface SettingsService {
  load(): Promise<ParentSettings>;               // returns defaults when missing or corrupted
  update(patch: Partial<ParentSettings>): Promise<ParentSettings>;
  subscribe(listener: (s: ParentSettings) => void): () => void;
}
```

| ID | Requirement |
|---|---|
| PS-20 | Defaults are defined once in `settings/defaults.ts`. |
| PS-21 | Stored data has `schemaVersion`; migrations upgrade older versions. |
| PS-22 | Corrupted or unknown data falls back to defaults without crashing; invalid fields are replaced individually. |
| PS-23 | If storage is unavailable, settings work in memory for the session. |

## Files

```text
packages/core/src/settings/{schema,defaults,migrations,settingsService,parentGate}.ts
packages/core/tests/settings/*.test.ts
apps/desktop/src/routes/parent/+page.svelte
apps/desktop/src/lib/components/ui/ParentGate.svelte
apps/desktop/src/lib/stores/settings.ts
```

## Tests

- Unit: defaults, migrations, corrupted data, partial update, gate question generation (unique options, range 11–30).
- Integration: a tap on the parent button does nothing; a 3 s hold opens the gate; a wrong answer closes it.
- E2E: change language → UI and captions switch; change numeral style → Numbers mode updates; reload → settings persist.

## Acceptance checklist

- [ ] Gate requires a 3 s hold and a correct text-only answer.
- [ ] Every setting in the table works and persists.
- [ ] Corrupted storage does not crash the app.
- [ ] Reset progress works and keeps settings.
