import { defineConfig } from '@playwright/test';

const baseURL = 'http://127.0.0.1:5179';

// E2E runs the desktop UI in Edge (same Chromium engine as WebView2 inside Tauri).
export default defineConfig({
	testDir: 'tests',
	timeout: 60_000,
	// Cold dev-server loads (e.g. the flag page imports 249 SVGs) can exceed the 5 s default.
	expect: { timeout: 15_000 },
	use: {
		baseURL,
		// Existing gameplay and gallery tests exercise Bengali labels.
		storageState: { cookies: [], origins: [{ origin: baseURL, localStorage: [{ name: 'rumi-language', value: 'bn-BD' }] }] },
		channel: 'msedge',
		viewport: { width: 1280, height: 800 }
	},
	// Own port + always a fresh server: never test against a dev server another tool/agent
	// started on 5173 (stale code, broken HMR socket → false console errors).
	webServer: {
		command: 'node node_modules/vite/bin/vite.js dev --host 127.0.0.1 --port 5179 --strictPort',
		url: baseURL,
		reuseExistingServer: false,
		env: { VITE_CACHE_DIR: 'node_modules/.vite-e2e' },
		// A cold test cache re-bundles dependencies; give it time on a busy machine.
		timeout: 240_000
	}
});
