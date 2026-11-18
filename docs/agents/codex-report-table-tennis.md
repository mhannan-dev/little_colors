# 3D Table Tennis

Added a same-window Three.js practice game at `/table-tennis`, reachable from Play under Fun games. The shared toy-style renderer provides lighting, shadows, resizing, and resource disposal. The table, see-through net, paddles, and ball use procedural meshes and work offline.

The child moves the near red paddle with a mouse, a touch drag, arrow keys, A/D, or the labeled slider. Serve and Space start a rally with a computer opponent. Fixed physics substeps handle gravity, table bounces, net contact, and paddle returns. Paddle contact position changes the shot direction. A miss offers another serve and gentle guidance. The game uses practice rallies, with no competitive scoreboard. Scores and sessions are not persisted.

The screen includes pause, restart, automatic background pause, bilingual instructions, language switching, a WebGL error message, and Back navigation. Narration uses the existing placeholder fallback. No camera shake or decorative movement is added.

## Verification

- Core tests and TypeScript checks passed.
- Desktop Svelte checking passed with zero errors or warnings.
- Edge verified the 3D scene, keyboard and slider input, serving, pause/resume, restart, language switching, and same-window Back navigation.
- Physics tests cover table bounce, both paddle returns, miss/re-serve, invalid elapsed time, and frame-time clamping.

## Requests

None.
