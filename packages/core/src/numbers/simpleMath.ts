export type MathMode = 'add' | 'subtract' | 'mixed';
export type MathLimit = 10 | 20;

/** Generate four distinct choices with exactly one answer inside the selected range. */
export function createMathQuestion(mode: MathMode, limit: MathLimit, random = Math.random) {
	const integer = (max: number) => Math.floor(random() * (max + 1));
	const operation = mode === 'mixed' ? (random() < 0.5 ? 'add' : 'subtract') : mode;
	const total = 1 + integer(limit - 1);
	const part = integer(total);
	const left = operation === 'add' ? part : total;
	const right = operation === 'add' ? total - part : part;
	const answer = operation === 'add' ? total : total - part;
	const alternatives = Array.from({ length: limit + 1 }, (_, value) => value).filter(value => value !== answer);
	const choices = [answer];
	for (let index = 0; index < 3; index++) {
		choices.push(alternatives.splice(integer(alternatives.length - 1), 1)[0]!);
	}
	for (let index = choices.length - 1; index > 0; index--) {
		const other = integer(index);
		[choices[index], choices[other]] = [choices[other]!, choices[index]!];
	}
	return { left, right, operation, answer, choices };
}
