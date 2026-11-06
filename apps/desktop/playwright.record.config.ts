import { defineConfig } from '@playwright/test';

/**
 * /record studio tests: own port (5177) so they never reuse a dev server started
 * elsewhere, plus Chromium's fake microphone (a steady beep) with permission granted.
 */
export default defineConfig({
	testDir: 'tests/record',
	timeout: 60_000,
	expect: { timeout: 15_000 },
	workers: 1,
	use: {
		baseURL: 'http://127.0.0.1:5177',
		channel: 'msedge',
		viewport: { width: 1280, height: 800 },
		permissions: ['microphone'],
		launchOptions: { args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'] }
	},
	webServer: {
		command: 'node node_modules/vite/bin/vite.js dev --host 127.0.0.1 --port 5177 --strictPort',
		url: 'http://127.0.0.1:5177',
		reuseExistingServer: false,
		timeout: 120_000
	}
});
