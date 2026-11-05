import {defineConfig} from '@playwright/test';
export default defineConfig({
	testDir:'tests/e2e',testMatch:['fruits.spec.ts'],outputDir:'../../test-results/fruit-codex',workers:1,timeout:90_000,
	use:{baseURL:'http://127.0.0.1:5177',channel:'msedge',viewport:{width:1280,height:800}},
	webServer:{command:'node node_modules/vite/bin/vite.js dev --host 127.0.0.1 --port 5177 --strictPort',url:'http://127.0.0.1:5177',reuseExistingServer:true,timeout:120_000}
});
