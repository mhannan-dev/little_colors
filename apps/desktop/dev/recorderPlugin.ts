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
// Narration keys may contain capitals (e.g. "letters.nextLetter"); no dots/slashes, so no traversal.
const SAFE_PATH = /^audio\/(bn-BD|en-US)\/[A-Za-z0-9-]+\.wav$/;
const MAX_BYTES = 5 * 1024 * 1024;
/** The /record page sends this; a custom header forces a CORS preflight for other sites. */
export const RECORD_HEADER = 'x-little-colors-record';
const LOCAL_ORIGIN = /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/;

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

				// Writes only from the dev app itself: a page on another site must not be able to
				// replace the child-facing recordings while the dev server runs.
				const origin = req.headers.origin;
				if ((origin && !LOCAL_ORIGIN.test(origin)) || req.headers[RECORD_HEADER] !== '1') {
					return send(403, { error: 'forbidden' });
				}

				const rel = url.searchParams.get('path') ?? '';
				if (!SAFE_PATH.test(rel)) return send(400, { error: 'invalid path' });
				const file = join(ASSETS, rel);

				if (req.method === 'DELETE' && url.pathname === '/delete') {
					try {
						if (existsSync(file)) unlinkSync(file);
						return send(200, { ok: true });
					} catch (e) {
						return send(500, { error: (e as Error).message });
					}
				}

				if (req.method === 'POST' && url.pathname === '/save') {
					const chunks: Buffer[] = [];
					let size = 0;
					let done = false;
					const finish = (status: number, body: unknown) => {
						if (done) return;
						done = true;
						send(status, body);
					};
					req.on('data', (c: Buffer) => {
						size += c.length;
						if (size > MAX_BYTES) {
							finish(413, { error: 'too large' });
							req.destroy(); // stop reading an oversized body
							return;
						}
						chunks.push(c);
					});
					req.on('error', (e) => finish(400, { error: e.message }));
					req.on('end', () => {
						if (done) return;
						const body = Buffer.concat(chunks);
						if (body.subarray(0, 4).toString('ascii') !== 'RIFF') return finish(400, { error: 'not a WAV file' });
						// Errors here (e.g. file locked on Windows) must not crash the dev server.
						try {
							mkdirSync(dirname(file), { recursive: true });
							writeFileSync(file, body);
							finish(200, { ok: true, path: rel, bytes: body.length });
						} catch (e) {
							finish(500, { error: (e as Error).message });
						}
					});
					return;
				}

				send(404, { error: 'not found' });
			});
		}
	};
}
