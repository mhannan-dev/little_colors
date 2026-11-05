# 01 — Product Principles

**Depends on:** none (base context for every task)
**Applies to:** web and mobile

## Goal

Build a playful, calm, responsive, offline-capable educational game that helps children aged 3–6 learn:

- Primary and secondary colors, and basic color mixing
- Shape recognition and color matching
- Early numeracy: counting, numerals, comparison, simple addition, patterns
- Simple Bengali vocabulary
- Positive Islamic expressions in an age-appropriate, optional context

Children's comfort, accessibility, learning, privacy, and enjoyment take priority over engagement metrics.

## Product facts

| Item | Value |
|---|---|
| Product name | Little Colors |
| Primary language | Bengali (Bangladesh, `bn-BD`) |
| Secondary language | English (`en-US`) |
| Audience | Children ~3–6 years old, with parents as administrators |
| Platforms | **1st:** Desktop (Tauri + SvelteKit UI). **2nd:** Android & iOS (React Native). No public web/PWA version planned. |
| Backend | None for MVP |

## Non-negotiable rules

| ID | Rule |
|---|---|
| PR-01 | MUST NOT show advertisements. |
| PR-02 | MUST NOT include in-app purchases. |
| PR-03 | MUST NOT include public chat or social features. |
| PR-04 | MUST NOT expose external links in the child interface; any external link sits behind the parent gate. |
| PR-05 | MUST NOT collect unnecessary data; never collect the child's name, photo, voice, or precise location. |
| PR-06 | MUST NOT use flashing or rapidly blinking animations. |
| PR-07 | MUST NOT use artificial pressure: no streaks, scores, star ratings, countdown timers, or leaderboards. |
| PR-08 | MUST NOT punish incorrect answers: no buzzers, red crosses, lost points, or sad mascot reactions. |
| PR-09 | MUST NOT require internet connectivity during gameplay. |
| PR-10 | MUST NOT require sign-up or authentication to play. |
| PR-11 | MUST NOT include third-party analytics, tracking, or advertising SDKs. |
| PR-12 | MUST NOT copy existing games' characters, voices, branding, or assets (e.g. Talking Tom). |
| PR-13 | MUST NOT treat sacred or religious objects as targets for kicking, throwing, splashing, counting, or "taking away". |
| PR-14 | MUST NOT claim medical benefits (e.g. that a palette prevents eye strain, or that 20 minutes is a medical threshold). |

## Feedback tone

| ID | Rule |
|---|---|
| PR-20 | Correct answers MUST get short, warm feedback: visual highlight + mascot reaction + voice. |
| PR-21 | Incorrect answers MUST get a gentle retry: the object returns, and a voice line such as "আবার চেষ্টা করি!" plays. |
| PR-22 | After 2 incorrect attempts on the same activity, a hint MUST become available, but the answer is never forced. |
| PR-23 | Progression MUST be child-initiated: a large Next button, never automatic advancement. |
| PR-24 | Meaning MUST NOT rely on color alone; combine shape, outline, voice, or motion. |

## Playable without reading

Most 3–6-year-olds cannot read. Text on child screens is a helper for adults, never the only way to understand.

| ID | Rule |
|---|---|
| PR-25 | A child MUST be able to finish every activity without reading: every instruction is spoken (recorded or TTS audio, not device speech alone), repeated after 8 s of inactivity (max twice), and shown as a picture where words alone would be ambiguous (e.g. color vs shape matching). First visits show a ghost-hand demonstration; help points with the hand. |
| PR-26 | Every child-facing button MUST show a pictogram (play, next, replay, another game, help, start over) and speak its name on focus or mouse rest. "Go" actions (play, next) are always the green arrow. |
| PR-27 | No answer choice may require reading, except in Advanced reading-practice activities. Text-label answers (e.g. country names) need a picture-based mode for Beginner/Explorer. |

## Difficulty levels

Difficulty is set by a parent. The system MAY recommend a level but MUST NOT change it automatically (PR-30).

| Level | Intended child | General rules |
|---|---|---|
| **Beginner** | Just starting to recognize colors and shapes | One objective per screen; 2 options; large targets; spoken instructions; no timers |
| **Explorer** | Comfortable with basic colors | 2–3 options; basic mixing; simple shape matching; secondary colors introduced gradually |
| **Advanced** | Ready for more complex play | 3 options; multi-step mixing; combined shape + color matching; guided challenges with no time pressure |

Each game mode file defines exactly what each level means for that mode.

## Out of scope for MVP

- Accounts, cloud sync, multiplayer
- Subtraction and abstract arithmetic without objects
- Over-the-air code updates on mobile
- Any monetization
