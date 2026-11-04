import { describe, expect, it } from 'vitest';
import {
	COLORS,
	createMatchingRound,
	createMatchingMachine,
	getNarration,
	NARRATION_CATALOG,
	narrationText,
	SHAPES,
	type Difficulty,
	type MatchingEffect
} from '../../src/index.ts';

describe('narration catalog (spec 08, C-04 integration)', () => {
	it('has unique keys across all modes', () => {
		const seen = new Map<string, number>();
		for (const e of NARRATION_CATALOG) seen.set(e.key, (seen.get(e.key) ?? 0) + 1);
		const dupes = [...seen].filter(([, n]) => n > 1).map(([k]) => k);
		expect(dupes).toEqual([]);
	});

	it('every line has Bengali and English text, and Islamic lines have neutral variants', () => {
		for (const e of NARRATION_CATALOG) {
			expect(e.bn.trim(), e.key).not.toBe('');
			expect(e.en.trim(), e.key).not.toBe('');
			if (e.islamic) {
				expect(e.neutralBn, e.key).toBeTruthy();
				expect(e.neutralEn, e.key).toBeTruthy();
			}
		}
	});

	it('resolves every color/shape name the matching machine can narrate', () => {
		for (const c of COLORS) {
			for (const s of SHAPES) {
				expect(getNarration(`match.name.${c}.${s.key}`), `${c}.${s.key}`).toBeDefined();
				expect(getNarration(`match.correct.${c}.${s.key}`), `${c}.${s.key}`).toBeDefined();
			}
		}
		expect(narrationText('match.name.green.circle', 'bn-BD', true)).toBe('এটা সবুজ গোল!');
	});

	it.each(['beginner', 'explorer', 'advanced'] as Difficulty[])(
		'%s: every instruction and narrate effect in 200 matching rounds has a line',
		(difficulty) => {
			for (let seed = 0; seed < 200; seed++) {
				for (const activity of createMatchingRound(difficulty, seed).activities) {
					expect(getNarration(activity.instructionKey), activity.instructionKey).toBeDefined();
					const m = createMatchingMachine(activity);
					const keys: string[] = [];
					m.onEffect((e: MatchingEffect) => {
						if (e.type === 'narrate') keys.push(e.key);
					});
					// Wrong tap, then correct taps for every source.
					const first = activity.sources[0]!;
					const wrong = activity.targets.find(
						(t) => !(t.shape === first.shape && t.color === first.color)
					);
					if (wrong) {
						m.send({ type: 'TAP_SOURCE', itemId: first.id });
						m.send({ type: 'TAP_TARGET', targetId: wrong.id });
						m.send({ type: 'VALIDATE' });
						m.send({ type: 'RETURN_DONE' });
					}
					for (const s of activity.sources) {
						const t = activity.targets.find((x) => x.shape === s.shape && x.color === s.color)!;
						m.send({ type: 'TAP_SOURCE', itemId: s.id });
						m.send({ type: 'TAP_TARGET', targetId: t.id });
						m.send({ type: 'VALIDATE' });
						m.send({ type: 'SNAP_DONE' });
					}
					expect(m.state).toBe('CELEBRATING');
					for (const k of keys) expect(getNarration(k), k).toBeDefined();
				}
			}
		}
	);
});
