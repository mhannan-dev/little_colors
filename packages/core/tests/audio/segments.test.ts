import { describe, expect, it } from 'vitest';
import { CLIPS, composeLine, getClip, NARRATION_CATALOG, recordingPlan } from '../../src/index.ts';

/** Compare spoken content, ignoring spaces and punctuation. */
const norm = (s: string) => s.replace(/[\s!?।,.]/g, '');

describe('clip compositions (human voice recording)', () => {
	const composed = NARRATION_CATALOG.filter((e) => composeLine(e.key));

	it('covers the large templated families', () => {
		expect(composed.length).toBeGreaterThan(200);
	});

	it('every composition reproduces the exact Bengali line from known clips', () => {
		for (const e of composed) {
			const clips = composeLine(e.key)!;
			for (const c of clips) expect(getClip(c), `${e.key} → ${c}`).toBeDefined();
			expect(norm(clips.map((c) => getClip(c)!.bn).join(' ')), e.key).toBe(norm(e.bn));
		}
	});

	it('clip keys are unique', () => {
		const keys = CLIPS.map((c) => c.key);
		expect(new Set(keys).size).toBe(keys.length);
	});
});

describe('recording plan', () => {
	const plan = recordingPlan();
	const planned = new Set(plan.map((i) => `${i.key}|${i.neutral}`));

	it('makes every Bengali line playable: whole recording or all of its clips', () => {
		for (const e of NARRATION_CATALOG) {
			const clips = composeLine(e.key);
			if (clips) for (const c of clips) expect(planned.has(`${c}|false`), `${e.key} needs ${c}`).toBe(true);
			else expect(planned.has(`${e.key}|false`) || !!getClip(e.key), e.key).toBe(true);
			if (e.islamic && !clips) expect(planned.has(`${e.key}|true`), `${e.key} neutral`).toBe(true);
		}
	});

	it('has no duplicates and is ordered basics → core → lessons', () => {
		expect(planned.size).toBe(plan.length);
		const order = plan.map((i) => ['basics', 'core', 'lessons'].indexOf(i.group));
		expect([...order].sort((a, b) => a - b)).toEqual(order);
	});

	it('core games need only a small set of recordings', () => {
		const core = plan.filter((i) => i.group !== 'lessons');
		expect(core.length).toBeLessThan(150);
	});
});
