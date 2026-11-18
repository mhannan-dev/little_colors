import { COLOR_NAMES, SHAPES } from '@little-colors/core';
import { learning } from '@little-colors/design-tokens';

export type TrailMode = 'colors' | 'shapes' | 'numbers' | 'mixed';
export type Token = { id: string; kind: 'color' | 'shape' | 'number'; hex: string; shape: 'circle' | 'square' | 'triangle'; value?: number; bn: string; en: string; voice: string };
export type Lesson = { target: Token; options: Token[] };
export const MODES = [
	{ id: 'colors', bn: 'রঙের পথ', en: 'Color trail', icon: '◒', voice: 'match.instruction.color' },
	{ id: 'shapes', bn: 'আকারের পথ', en: 'Shape trail', icon: '△', voice: 'match.instruction.shape' },
	{ id: 'numbers', bn: 'গুনে চলি', en: 'Counting trail', icon: '123', voice: 'play3d.set.123' },
	{ id: 'mixed', bn: 'সব মিলে অভিযান', en: 'Little adventure', icon: '✿', voice: 'feedback.celebrate' }
] as const;

const colors: Token[] = (['red', 'yellow', 'blue', 'green', 'orange'] as const).map((id, index) => ({
	id, kind: 'color', hex: learning[id], shape: (['circle', 'square', 'triangle'] as const)[index % 3],
	bn: COLOR_NAMES[id].bn, en: COLOR_NAMES[id].en, voice: `color.${id}`
}));
const shapes: Token[] = (['circle', 'square', 'triangle'] as const).map(id => {
	const name = SHAPES.find(shape => shape.key === id)!;
	return { id, kind: 'shape', shape: id, hex: learning.blue, bn: name.bn, en: name.en, voice: `match.name.blue.${id}` };
});
const numbers: Token[] = Array.from({ length: 5 }, (_, index) => ({
	id: String(index + 1), kind: 'number', value: index + 1, hex: learning.purple, shape: 'circle',
	bn: ['এক', 'দুই', 'তিন', 'চার', 'পাঁচ'][index], en: ['one', 'two', 'three', 'four', 'five'][index], voice: `abc3d.find.123.${index + 1}`
}));

export function createTrail(mode: TrailMode, beginner: boolean): Lesson[] {
	const targets = mode === 'mixed' ? [colors[0], shapes[0], numbers[0], colors[2], numbers[2]]
		: mode === 'shapes' ? [shapes[0], shapes[1], shapes[2], shapes[0], shapes[1]]
		: mode === 'numbers' ? numbers : colors;
	return targets.map((target, index) => {
		const pool = target.kind === 'number' ? numbers : target.kind === 'shape' ? shapes : colors;
		const others = pool.filter(token => token.id !== target.id).slice(index % 2, index % 2 + (beginner ? 1 : 2));
		const options = [target, ...others];
		const offset = index % options.length;
		return { target, options: [...options.slice(offset), ...options.slice(0, offset)] };
	});
}

/** Shared drawing for the learning gates. Countable dots accompany every numeral. */
export function drawToken(context: CanvasRenderingContext2D, token: Token, numeral: string) {
	context.fillStyle = '#fff9ed';
	context.fillRect(0, 0, 256, 256);
	context.fillStyle = token.hex;
	context.strokeStyle = '#354b53';
	context.lineWidth = 6;
	if (token.kind === 'number') {
		context.textAlign = 'center'; context.textBaseline = 'middle'; context.font = '700 110px "Hind Siliguri", system-ui';
		context.fillText(numeral, 128, 100);
		for (let i = 0; i < token.value!; i++) {
			context.beginPath(); context.arc(128 + (i - (token.value! - 1) / 2) * 34, 200, 11, 0, Math.PI * 2); context.fill();
		}
		return;
	}
	context.beginPath();
	if (token.shape === 'circle') context.arc(128, 128, 69, 0, Math.PI * 2);
	else if (token.shape === 'square') context.roundRect(60, 60, 136, 136, 15);
	else { context.moveTo(128, 48); context.lineTo(207, 195); context.lineTo(49, 195); context.closePath(); }
	context.fill(); context.stroke();
}
