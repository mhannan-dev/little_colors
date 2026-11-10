import adapter from '@sveltejs/adapter-static';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import { recorderPlugin } from './dev/recorderPlugin.ts';

// Tauri expects a fixed dev port and a static SPA build.
export default defineConfig({
	clearScreen: false,
	// Test servers (Playwright) use their own dependency cache, so running tests never invalidates
	// the pre-bundle of a dev server that is already open ("new version of the pre-bundle").
	cacheDir: process.env.VITE_CACHE_DIR || 'node_modules/.vite',
	server: {
		port: 5173,
		strictPort: true
	},
	plugins: [
		recorderPlugin(), // dev server only: lets /record save voice recordings
		sveltekit({
			compilerOptions: {
				runes: ({ filename }) =>
					filename.split(/[/\\]/).includes('node_modules') ? undefined : true
			},
			adapter: adapter({ fallback: 'index.html' })
		})
	]
});
