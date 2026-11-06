# WebP gallery images — 2026-11-06

The app screens use SVG artwork. The raster images available for migration were
the 29 documentation screenshots. Converted them to lossless WebP, compared
decoded RGBA pixels with every original, and updated all 24 gallery image links.
The gallery shrank from 1,414,662 bytes to 650,098 bytes.

Both gallery suites now save WebP through the Edge canvas encoder. The screenshot
buffer is passed in memory. Tauri packaging icons use their existing platform
files, and Playwright diagnostic artifacts follow their existing settings.

Verified a new 800 × 600 WebP capture decoded in Edge, both gallery suites
loaded in Playwright, all gallery links resolve, and `git diff --check` passed.
