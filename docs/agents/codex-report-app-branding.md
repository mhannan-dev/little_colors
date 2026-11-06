# Rumi Learning Adventures — 2026-11-06

The user delegated the naming and metadata choices. Rumi Learning Adventures
and রুমির শেখার অভিযান use the mascot that appears across the learning games.
The description covers offline play for ages 5–10 in Bengali and English.

The welcome screen and Think & Play header read the name from the existing UI
labels. The static app shell carries the title, application name, description,
and Open Graph fields so they are present before the client loads. The Tauri
product name, window title, bundle descriptions, and Cargo description use the
new branding. The Tauri identifier is `com.littlecolors.app`.

`pnpm typecheck` passed with zero errors and warnings. `pnpm build` passed.
The generated HTML contains one title and both description tags with the new
copy. The desktop configuration parsed and its product and window names matched.
The Windows installer will use the new branding on its next build.
