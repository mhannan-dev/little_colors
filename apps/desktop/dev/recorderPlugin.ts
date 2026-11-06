/**
 * Dev-server-only endpoints for the /record page (human voice recording, spec 08 / AS-33).
 * `apply: 'serve'` keeps this out of production builds and the Tauri app entirely.
 *
 *   GET    /__record/list            → ["audio/bn-BD/clip-color-red.wav", …]
 *   POST   /__record/save?path=…     → body: WAV bytes; writes the file
 *   DELETE /__record/delete?path=…   → removes a recording
 *
 * Paths are strictly validated so nothing outside src/lib/assets/audio can be written.
 */
import { existsSync, mkdirSync, readdirSync, unlinkSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Plugin } from 'vite';

const ASSETS = fileURLToPath(new URL('../src/lib/assets/', import.meta.url));
const SAFE_PATH = /^audio\/(bn-BD|en-US)\/[a-z0-9-]+\.wav$/;
const MAX_BYTES = 5 * 1024 * 1024;

function listRecordings(): string[] {
	const out: string[] = [];
	for (const locale of ['bn-BD', 'en-US']) {
		const dir = join(ASSETS, 'audio', locale);
		if (!existsSync(dir)) continue;
		for (const f of readdirSync(dir)) if (f.endsWith('.wav')) out.push(`audio/${locale}/${f}`);
	}
	return out.sort();
}

export function recorderPlugin(): Plugin {
	return {
		name: 'little-colors-recorder',
		apply: 'serve',
		configureServer(server) {
			server.middlewares.use('/__record', (req, res) => {
				const url = new URL(req.url ?? '/', 'http://localhost');
				const send = (status: number, body: unknown) => {
					res.statusCode = status;
					res.setHeader('Content-Type', 'application/json');
					res.end(JSON.stringify(body));
				};

				if (req.method === 'GET' && url.pathname === '/list') return send(200, listRecordings());

				const rel = url.searchParams.get('path') ?? '';
				if (!SAFE_PATH.test(rel)) return send(400, { error: 'invalid path' });
				const file = join(ASSETS, rel);

				if (req.method === 'DELETE' && url.pathname === '/delete') {
					if (existsSync(file)) unlinkSync(file);
					return send(200, { ok: true });
				}

				if (req.method === 'POST' && url.pathname === '/save') {
					const chunks: Buffer[] = [];
					let size = 0;
					req.on('data', (c: Buffer) => {
						size += c.length;
						if (size <= MAX_BYTES) chunks.push(c);
					});
					req.on('end', () => {
						const body = Buffer.concat(chunks);
						if (size > MAX_BYTES) return send(413, { error: 'too large' });
						if (body.subarray(0, 4).toString('ascii') !== 'RIFF') return send(400, { error: 'not a WAV file' });
						mkdirSync(dirname(file), { recursive: true });
						writeFileSync(file, body);
						send(200, { ok: true, path: rel, bytes: body.length });
					});
					return;
				}

				send(404, { error: 'not found' });
			});
		}
	};
}
