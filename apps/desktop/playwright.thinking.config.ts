import { defineConfig } from '@playwright/test';

/** Isolated port so these lessons can be verified while Claude tests other screens. */
export default defineConfig({
	testDir: 'tests/e2e',
	testMatch: ['thinking.spec.ts', 'picnic.spec.ts', 'playground.spec.ts', 'treasure.spec.ts', 'shop.spec.ts', 'train.spec.ts', 'letters.spec.ts', 'rally.spec.ts'],
	outputDir: 'test-results/thinking',
	workers: 1,
	timeout: 60_000,
	use: { baseURL: 'http://127.0.0.1:5175', channel: 'msedge', viewport: { width: 1280, height: 800 } },
	webServer: {
		command: 'node node_modules/vite/bin/vite.js dev --host 127.0.0.1 --port 5175 --strictPort',
		url: 'http://127.0.0.1:5175',
		reuseExistingServer: true,
		timeout: 60_000
	}
});
