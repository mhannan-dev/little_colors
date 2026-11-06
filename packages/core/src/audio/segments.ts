import { NUMBER_VOCABULARY } from '../numbers/numberVocabulary.ts';
import { SHAPES } from '../shape-matching/shapes.ts';
import { COLORS } from '../types/colors.ts';
import { NARRATION_CATALOG } from './catalog.ts';
import { COLOR_NAMES } from './voiceManifest.ts';

/**
 * Recording with a human voice (spec 08 / AS-33) without recording 600+ lines:
 * templated Bengali lines ("এটা লাল তারা!", "দুই আর তিন মিলে পাঁচ!") are played as a
 * sequence of short recorded clips. A whole-line recording, when present, always wins.
 *
 * Clip keys start with "clip." (or reuse "number.N", which is already a one-word line).
 */
export interface Clip {
	key: string;
	bn: string;
}

const countTa = (n: number) => `${NUMBER_VOCABULARY[n]!.bn}টা`; // একটা, দুইটা …
const countTi = (n: number) => `${NUMBER_VOCABULARY[n]!.bn}টি`; // একটি, দুইটি …
const ONE_TO_TEN = Array.from({ length: 10 }, (_, i) => i + 1);

const WORDS: Clip[] = [
	{ key: 'clip.w.eta', bn: 'এটা' },
	{ key: 'clip.w.rong', bn: 'রং!' },
	{ key: 'clip.w.ar', bn: 'আর' },
	{ key: 'clip.w.mile', bn: 'মিলে' },
	{ key: 'clip.w.mot', bn: 'মোট' },
	{ key: 'clip.w.pakhi', bn: 'পাখি!' },
	{ key: 'clip.w.goal', bn: 'গোল!' },
	{ key: 'clip.w.goal-e-ball', bn: 'গোলে বল পাঠাই!' },
	{ key: 'clip.w.number-goal-e-ball', bn: 'নম্বর গোলে বল পাঠাই!' },
	{ key: 'clip.w.number-goal', bn: 'নম্বর গোল!' },
	{ key: 'clip.w.garita-kon', bn: 'গাড়িটা কোন গ্যারেজে যাবে?' },
	{ key: 'clip.w.gari', bn: 'গাড়ি' },
	{ key: 'clip.w.garage-e', bn: 'গ্যারেজে!' },
	{ key: 'clip.w.jon-jatri', bn: 'জন যাত্রী,' },
	{ key: 'clip.w.number-garage', bn: 'নম্বর গ্যারেজ!' }
];

/** Every clip that compositions can use, in recording order. */
export const CLIPS: readonly Clip[] = [
	...COLORS.map((c) => ({ key: `clip.color.${c}`, bn: COLOR_NAMES[c].bn })),
	...SHAPES.map((s) => ({ key: `clip.shape.${s.key}`, bn: s.bn })),
	...ONE_TO_TEN.map((n) => ({ key: `number.${n}`, bn: NUMBER_VOCABULARY[n]!.bn })),
	...ONE_TO_TEN.map((n) => ({ key: `clip.count-ta.${n}`, bn: countTa(n) })),
	...ONE_TO_TEN.map((n) => ({ key: `clip.count-ti.${n}`, bn: countTi(n) })),
	...WORDS
];

const CLIP_BY_KEY = new Map(CLIPS.map((c) => [c.key, c]));
export const getClip = (key: string) => CLIP_BY_KEY.get(key);

const num = (n: string | number) => `number.${n}`;
const col = (c: string) => `clip.color.${c}`;

/** Clip sequence for a templated Bengali line, or null if it must be recorded whole. */
export function composeLine(key: string): string[] | null {
	const p = key.split('.');
	let m: RegExpMatchArray | null;
	if ((m = key.match(/^color\.([a-z]+)$/))) return ['clip.w.eta', col(m[1]!), 'clip.w.rong'];
	if ((m = key.match(/^match\.(name|correct)\.([a-z]+)\.([a-z]+)$/))) {
		return ['clip.w.eta', col(m[2]!), `clip.shape.${m[3]}`];
	}
	if ((m = key.match(/^numbers\.add\.(\d+)\.(\d+)$/))) {
		const sum = Number(m[1]) + Number(m[2]);
		return [num(m[1]!), 'clip.w.ar', num(m[2]!), 'clip.w.mile', num(sum)];
	}
	if ((m = key.match(/^numbers\.total\.(\d+)$/))) return ['clip.w.mot', `clip.count-ti.${m[1]}`];
	if ((m = key.match(/^birds\.total\.(\d+)$/))) return ['clip.w.mot', `clip.count-ta.${m[1]}`, 'clip.w.pakhi'];
	if ((m = key.match(/^football\.to\.number\.(\d+)$/))) return [num(m[1]!), 'clip.w.number-goal-e-ball'];
	if ((m = key.match(/^football\.to\.([a-z]+)$/))) return [col(m[1]!), 'clip.w.goal-e-ball'];
	if ((m = key.match(/^football\.goal\.number\.(\d+)$/))) return ['clip.w.goal', num(m[1]!), 'clip.w.number-goal'];
	if ((m = key.match(/^football\.goal\.([a-z]+)$/))) return ['clip.w.goal', col(m[1]!), 'clip.w.goal'];
	if ((m = key.match(/^car\.parked\.count\.(\d+)$/))) {
		return [num(m[1]!), 'clip.w.jon-jatri', num(m[1]!), 'clip.w.number-garage'];
	}
	if ((m = key.match(/^car\.parked\.([a-z]+)$/))) return [col(m[1]!), 'clip.w.gari', col(m[1]!), 'clip.w.garage-e'];
	if (p[0] === 'car' && p[1] === 'park' && p.length === 3 && p[2] !== 'count') {
		return [col(p[2]!), 'clip.w.garita-kon'];
	}
	return null;
}

// ── Recording plan ──────────────────────────────────────────────────────────
export type RecordingGroup = 'basics' | 'core' | 'lessons';

export interface RecordingItem {
	/** Narration key or clip key; the file name is audioPathFor(key[, neutral]). */
	key: string;
	neutral: boolean;
	bn: string;
	group: RecordingGroup;
	/** Lines that become playable once this item is recorded (for previews). */
	usedBy: number;
}

/** Families built by Claude's core games (mixing, matching, numbers, mini-games, UI). */
const CORE_PREFIXES = [
	'welcome.', 'mode.', 'ui.', 'feedback.', 'color.', 'mix.', 'match.', 'numbers.instruction.',
	'numbers.compare.', 'numbers.correct', 'numbers.retry', 'numbers.pattern.', 'numbers.celebrate',
	'football.', 'car.', 'birds.'
];

/**
 * What a human voice needs to record for Bengali: clips for templated lines, plus every
 * other line (and neutral variant) whole. Ordered by priority group.
 */
export function recordingPlan(): RecordingItem[] {
	const usage = new Map<string, number>();
	const whole: RecordingItem[] = [];
	for (const e of NARRATION_CATALOG) {
		const clips = composeLine(e.key);
		if (clips) {
			for (const c of clips) usage.set(c, (usage.get(c) ?? 0) + 1);
			continue;
		}
		if (CLIP_BY_KEY.has(e.key)) continue; // e.g. number.N is recorded once as a clip
		const group: RecordingGroup = CORE_PREFIXES.some((p) => e.key.startsWith(p)) ? 'core' : 'lessons';
		whole.push({ key: e.key, neutral: false, bn: e.bn, group, usedBy: 1 });
		if (e.islamic && e.neutralBn) whole.push({ key: e.key, neutral: true, bn: e.neutralBn, group, usedBy: 1 });
	}
	const clips: RecordingItem[] = CLIPS.map((c) => ({
		key: c.key,
		neutral: false,
		bn: c.bn,
		group: 'basics',
		usedBy: (usage.get(c.key) ?? 0) + (NARRATION_CATALOG.some((e) => e.key === c.key) ? 1 : 0)
	}));
	const order: Record<RecordingGroup, number> = { basics: 0, core: 1, lessons: 2 };
	return [...clips, ...whole].sort((a, b) => order[a.group] - order[b.group]);
}
