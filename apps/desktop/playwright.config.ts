import { defineConfig } from '@playwright/test';

// E2E runs the desktop UI in Edge (same Chromium engine as WebView2 inside Tauri).
export default defineConfig({
	testDir: 'tests',
	timeout: 60_000,
	// Cold dev-server loads (e.g. the flag page imports 249 SVGs) can exceed the 5 s default.
	expect: { timeout: 15_000 },
	use: {
		baseURL: 'http://127.0.0.1:5179',
		channel: 'msedge',
		viewport: { width: 1280, height: 800 }
	},
	// Own port + always a fresh server: never test against a dev server another tool/agent
	// started on 5173 (stale code, broken HMR socket → false console errors).
	webServer: {
		command: 'node node_modules/vite/bin/vite.js dev --host 127.0.0.1 --port 5179 --strictPort',
		url: 'http://127.0.0.1:5179',
		reuseExistingServer: false,
		timeout: 120_000
	}
});
