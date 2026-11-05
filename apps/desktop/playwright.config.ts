import { defineConfig } from '@playwright/test';

// E2E runs the desktop UI in Edge (same Chromium engine as WebView2 inside Tauri).
export default defineConfig({
	testDir: 'tests',
	timeout: 60_000,
	// Cold dev-server loads (e.g. the flag page imports 249 SVGs) can exceed the 5 s default.
	expect: { timeout: 15_000 },
	use: {
		baseURL: 'http://localhost:5173',
		channel: 'msedge',
		viewport: { width: 1280, height: 800 }
	},
	webServer: {
		command: 'pnpm dev',
		url: 'http://localhost:5173',
		reuseExistingServer: true,
		timeout: 120_000
	}
});
