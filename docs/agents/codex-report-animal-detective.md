# Animal Detective

- Added a Play menu entry for two activities that use ten local WebP photos of seven animals.
- Recognition has seven rounds with three photo choices each. Counting has six rounds with quantities from one to six, mixed animal photos, and tappable checkmarks.
- Every solved round awards one star and shows a short animation. Completing either activity awards a detective badge. Rewards reset when a new activity starts. Reduced-motion preferences disable reward animation.
- Added Bengali and English prompts and encouragement to the existing narration catalog.
- Workspace typecheck, all 566 core tests, and the Edge end-to-end test passed. The browser test covers photo loading, retries, stars, reduced motion, counting, and the completion badge.

## Notebook and badge update

- Styled the activity as a notebook and added Rumi to the welcome and badge screens.
- The selected answer releases an animated star into that round's progress marker. The markers show completed clues without a numeric score or rating. Counting cards stay in place, and the success chime uses the existing volume and sound controls.
- The completion screen loads Three.js on demand for a short medal reveal. An SVG medal covers reduced motion, unavailable WebGL, and lost contexts. The renderer stops drawing when the reveal ends.
- Typecheck and all five Animal Detective and language tests passed. An additional Edge run with software WebGL confirmed the 3D medal is rendered.

## Requests

None.
