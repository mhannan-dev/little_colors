/**
 * Generate placeholder narration MP3s with Azure AI Speech (neural TTS), spec 08 / AS-30.
 *
 * Usage:
 *   pnpm tts:generate --dry-run          # count lines/characters, no key needed
 *   pnpm tts:generate                    # generate missing or changed files
 *   pnpm tts:generate --force            # regenerate everything
 *   pnpm tts:generate --locale=bn-BD     # one language only
 *   pnpm tts:generate --only=football.   # keys starting with a prefix
 *
 * Needs AZURE_SPEECH_KEY and AZURE_SPEECH_REGION in .env (never committed). Optional
 * TTS_VOICE_BN / TTS_VOICE_EN to pin a voice. Free tier (F0): 0.5M neural characters
 * per month, throttled (not billed) when exceeded.
 *
 * Output: apps/desktop/src/lib/assets/audio/<locale>/<name>.mp3 (bundled automatically).
 * Recordings stay status "placeholder"; a human voice artist replaces them before release.
 */
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { audioPathFor } from '../packages/core/src/assets/manifest.ts';
import { NARRATION_CATALOG } from '../packages/core/src/audio/catalog.ts';
import type { Locale } from '../packages/core/src/types/colors.ts';

const ROOT = fileURLToPath(new URL('../apps/desktop/src/lib/assets/', import.meta.url));
const CACHE_FILE = join(ROOT, 'audio', 'tts-manifest.json');

const args = new Map(
	process.argv.slice(2).map((a) => {
		const [k, v] = a.replace(/^--/, '').split('=');
		return [k!, v ?? 'true'] as const;
	})
);
const DRY = args.has('dry-run');
const FORCE = args.has('force');
const ONLY = args.get('only');
const ALL_LOCALES: Locale[] = ['bn-BD', 'en-US'];
const LOCALES: Locale[] = args.has('locale') ? [args.get('locale') as Locale] : ALL_LOCALES;
if (!LOCALES.every((l) => ALL_LOCALES.includes(l))) {
	console.error(`Unknown --locale=${args.get('locale')}. Use one of: ${ALL_LOCALES.join(', ')}`);
	process.exit(1);
}

interface Job {
	path: string;
	locale: Locale;
	text: string;
	key: string;
}

const jobs: Job[] = [];
for (const e of NARRATION_CATALOG) {
	if (ONLY && !e.key.startsWith(ONLY)) continue;
	for (const locale of LOCALES) {
		const bn = locale === 'bn-BD';
		jobs.push({ key: e.key, locale, text: bn ? e.bn : e.en, path: audioPathFor(e.key, locale) });
		if (e.islamic) {
			const neutral = bn ? e.neutralBn : e.neutralEn;
			if (neutral) jobs.push({ key: e.key, locale, text: neutral, path: audioPathFor(e.key, locale, true) });
		}
	}
}

const chars = jobs.reduce((s, j) => s + j.text.length, 0);
console.log(`Lines: ${jobs.length} (${LOCALES.join(', ')}), characters: ${chars.toLocaleString()}`);
console.log(`Free tier F0 allows 500,000 neural characters per month (${((chars / 500_000) * 100).toFixed(1)}% of it).`);
if (DRY) process.exit(0);

const KEY = process.env.AZURE_SPEECH_KEY;
const REGION = process.env.AZURE_SPEECH_REGION;
if (!KEY || !REGION) {
	console.error('Missing AZURE_SPEECH_KEY / AZURE_SPEECH_REGION. Copy .env.example to .env and fill them in.');
	process.exit(1);
}
const BASE = `https://${REGION}.tts.speech.microsoft.com`;

interface AzureVoice {
	ShortName: string;
	Locale: string;
	Gender: string;
}

async function pickVoices(): Promise<Record<Locale, string>> {
	const res = await fetch(`${BASE}/cognitiveservices/voices/list`, {
		headers: { 'Ocp-Apim-Subscription-Key': KEY! }
	});
	if (!res.ok) throw new Error(`Voice list failed: HTTP ${res.status} (check key and region)`);
	const voices = (await res.json()) as AzureVoice[];
	const pick = (locale: Locale, preferred: string[], override?: string) => {
		if (override) return override;
		const inLocale = voices.filter((v) => v.Locale === locale);
		for (const name of preferred) if (inLocale.some((v) => v.ShortName === name)) return name;
		const female = inLocale.find((v) => v.Gender === 'Female') ?? inLocale[0];
		if (!female) throw new Error(`No ${locale} voice available in region ${REGION}`);
		return female.ShortName;
	};
	return {
		'bn-BD': pick('bn-BD', ['bn-BD-NabanitaNeural'], process.env.TTS_VOICE_BN),
		// AnaNeural is a child voice when the region offers it; otherwise a warm female voice.
		'en-US': pick('en-US', ['en-US-AnaNeural', 'en-US-JennyNeural'], process.env.TTS_VOICE_EN)
	};
}

const xml = (s: string) =>
	s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');

// Slightly slower and warmer for young children.
const ssml = (voice: string, locale: Locale, text: string) =>
	`<speak version="1.0" xml:lang="${locale}" xmlns="http://www.w3.org/2001/10/synthesis">` +
	`<voice name="${voice}"><prosody rate="-12%" pitch="+4%">${xml(text)}</prosody></voice></speak>`;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function synthesize(body: string): Promise<Buffer> {
	for (let attempt = 1; ; attempt++) {
		let res: Response;
		try {
			res = await fetch(`${BASE}/cognitiveservices/v1`, {
				method: 'POST',
				headers: {
					'Ocp-Apim-Subscription-Key': KEY!,
					'Content-Type': 'application/ssml+xml',
					'X-Microsoft-OutputFormat': 'audio-24khz-48kbitrate-mono-mp3',
					'User-Agent': 'little-colors-tts'
				},
				body
			});
		} catch (e) {
			// Network drop / DNS / reset: retry like a 5xx instead of aborting the whole run.
			if (attempt >= 6) throw e;
			const wait = 1000 * 2 ** attempt;
			console.log(`  network error (${(e as Error).message}), retrying in ${wait / 1000} s…`);
			await sleep(wait);
			continue;
		}
		if (res.ok) return Buffer.from(await res.arrayBuffer());
		if ((res.status === 429 || res.status >= 500) && attempt < 6) {
			const wait = Number(res.headers.get('retry-after')) * 1000 || 1000 * 2 ** attempt;
			console.log(`  HTTP ${res.status}, retrying in ${Math.round(wait / 1000)} s…`);
			await sleep(wait);
			continue;
		}
		throw new Error(`Synthesis failed: HTTP ${res.status} ${await res.text()}`);
	}
}

const cache: Record<string, string> = existsSync(CACHE_FILE)
	? JSON.parse(readFileSync(CACHE_FILE, 'utf8'))
	: {};

const voices = await pickVoices();
console.log(`Voices: bn-BD → ${voices['bn-BD']}, en-US → ${voices['en-US']}`);

let made = 0;
let skipped = 0;
for (const job of jobs) {
	const body = ssml(voices[job.locale], job.locale, job.text);
	const hash = createHash('sha256').update(body).digest('hex').slice(0, 16);
	const out = join(ROOT, job.path);
	if (!FORCE && cache[job.path] === hash && existsSync(out)) {
		skipped++;
		continue;
	}
	const audio = await synthesize(body);
	mkdirSync(dirname(out), { recursive: true });
	writeFileSync(out, audio);
	cache[job.path] = hash;
	made++;
	// Save after every file: an aborted run must not pay for the same lines again.
	writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2) + '\n');
	if (made % 20 === 0) console.log(`  ${made} generated…`);
	await sleep(120); // stay well inside F0 request limits
}
writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2) + '\n');
console.log(`Done: ${made} generated, ${skipped} unchanged.`);
