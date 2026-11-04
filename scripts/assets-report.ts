/**
 * Spec 14, AS-40: list every placeholder asset still in use.
 * Usage: pnpm assets:report   (the release checklist requires 0 placeholders)
 */
import { ASSET_MANIFEST, placeholders, type AssetEntry } from '../packages/core/src/assets/manifest.ts';

const open = placeholders();
const byKind = new Map<string, AssetEntry[]>();
for (const a of open) byKind.set(a.kind, [...(byKind.get(a.kind) ?? []), a]);

console.log(`Assets: ${ASSET_MANIFEST.length} total, ${open.length} placeholder(s)\n`);
for (const [kind, list] of byKind) {
	console.log(`${kind} (${list.length})`);
	const shown = kind === 'audio' ? list.slice(0, 5) : list;
	for (const a of shown) console.log(`  - ${a.key}  ->  ${a.path}${a.note ? `   (${a.note})` : ''}`);
	if (shown.length < list.length) {
		console.log(`  ... and ${list.length - shown.length} more recordings (see docs/narration-script.md)`);
	}
	console.log('');
}
console.log(open.length === 0 ? 'Release-ready: no placeholders.' : 'Not release-ready: placeholders remain.');
