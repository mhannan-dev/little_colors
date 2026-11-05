import { defineConfig } from '@playwright/test';
export default defineConfig({
	testDir:'tests/e2e',testMatch:['flag.spec.ts','flagWorld.spec.ts'],outputDir:'../../test-results/flag-codex',workers:1,timeout:60_000,
	use:{baseURL:'http://127.0.0.1:5176',channel:'msedge',viewport:{width:1280,height:800}},
	webServer:{command:'node node_modules/vite/bin/vite.js dev --host 127.0.0.1 --port 5176 --strictPort',url:'http://127.0.0.1:5176',reuseExistingServer:true,timeout:120_000}
});
