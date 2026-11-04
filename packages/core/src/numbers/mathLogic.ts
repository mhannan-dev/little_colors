export type MathActivityKind = 'count' | 'numeral-to-quantity' | 'compare' | 'add' | 'pattern';
export type CompareAnswer = 'left' | 'right' | 'same';
export function compareQuantities(left: number, right: number): CompareAnswer {
	if (left === right) return 'same';
	return left > right ? 'left' : 'right';
}
export function addQuantities(a: number, b: number, max: number): number | null {
	const sum = a + b;
	return Number.isSafeInteger(a) && Number.isSafeInteger(b) && Number.isSafeInteger(max) && a >= 0 && b >= 0 && sum <= max ? sum : null;
}
export function nextInPattern<T>(sequence: readonly T[], unit: readonly T[]): T {
	if (!unit.length) throw new RangeError('Pattern unit must not be empty.');
	return unit[sequence.length % unit.length]!;
}
