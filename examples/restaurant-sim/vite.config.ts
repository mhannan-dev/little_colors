import { svelte } from '@sveltejs/vite-plugin-svelte';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [svelte()],
	resolve: { dedupe: ['svelte', '@tauri-apps/api'] },
	server: {
		host: '127.0.0.1', port: 1420, strictPort: true,
		fs: { allow: ['.', '../../apps/desktop/src/lib/features/counter-rush'] }
	},
	clearScreen: false
});
