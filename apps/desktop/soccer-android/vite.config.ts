import { fileURLToPath } from 'node:url';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { defineConfig } from 'vite';

export default defineConfig({
	root: fileURLToPath(new URL('.', import.meta.url)),
	base: './',
	plugins: [svelte({ configFile: false })],
	build: {
		// Windows aapt2 can store backslashes in nested asset paths. Keep WebView files flat.
		assetsDir: '',
		outDir: fileURLToPath(new URL('../../../test-results/world-soccer-android/web/', import.meta.url)),
		emptyOutDir: true
	}
});
