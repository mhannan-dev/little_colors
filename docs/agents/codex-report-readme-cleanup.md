# README and cleanup report

Added the root README with desktop setup, browser preview, Formula Circuit WASM preparation, installer builds, checks, project layout, and links to the existing content and contributor guides.

Removed the unused `ComingSoon.svelte` component and the obsolete companion launcher directory. The directory contained an old ignore file and three generated native artifacts, reclaiming approximately 509.7 MiB. Application sources and configuration contain no references to either removed path.

## Verification

- All eight relative README links and the documented package scripts resolve.
- Workspace unit tests passed, including 637 core, 46 desktop, and four design-token tests.
- Workspace typechecking passed with zero Svelte errors or warnings.
- `git diff --check` passed.

## Requests

None.
