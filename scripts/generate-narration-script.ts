/**
 * Spec 08, AU-40: generate the recording script for the voice artist and reviewers.
 * Usage: pnpm narration:script   -> writes docs/narration-script.md
 */
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { audioPathFor } from '../packages/core/src/assets/manifest.ts';
import { VOICE_MANIFEST } from '../packages/core/src/audio/voiceManifest.ts';

const out = fileURLToPath(new URL('../docs/narration-script.md', import.meta.url));
const esc = (s = '') => s.replace(/\|/g, '\\|');
const code = (s: string) => '`' + s + '`';

const rows = VOICE_MANIFEST.map((e) =>
	[
		'',
		code(e.key),
		esc(e.bn),
		esc(e.en),
		e.islamic ? `${esc(e.neutralBn)} / ${esc(e.neutralEn)}` : '—',
		code(audioPathFor(e.key, 'bn-BD')),
		e.status,
		''
	].join(' | ').trim()
);

const islamicCount = VOICE_MANIFEST.filter((e) => e.islamic).length;

const md = [
	'# Narration Script',
	'',
	`> Generated from ${code('packages/core/src/audio/voiceManifest.ts')} by ${code('pnpm narration:script')}. Do not edit by hand.`,
	'',
	`**For the voice artist:** record each line in a warm, calm, child-friendly voice. Save as mono MP3 using the file name shown (the English file uses the same name under ${code('audio/en-US/')}). Lines with an Islamic expression also need the neutral variant, saved as ${code('<name>-neutral.mp3')}.`,
	'',
	`**For reviewers (spec 08, Content review):** record approval or requested changes in ${code('docs/content-review.md')}. AI agents must not mark lines as reviewed.`,
	'',
	`Lines: **${VOICE_MANIFEST.length}** (${islamicCount} with Islamic expressions)`,
	'',
	'| Key | Bengali | English | Neutral variant (bn / en) | File (bn-BD) | Status |',
	'|---|---|---|---|---|---|',
	...rows,
	''
].join('\n');

writeFileSync(out, md);
console.log(`Wrote ${VOICE_MANIFEST.length} lines to docs/narration-script.md`);
