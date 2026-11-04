export type NumeralStyle = 'bengali' | 'english' | 'both';
const BENGALI_DIGITS = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
export function toBengaliNumeral(n: number): string {
	return String(n).replace(/\d/g, (digit) => BENGALI_DIGITS[Number(digit)]!);
}
export function formatNumeral(n: number, style: NumeralStyle): string {
	if (style === 'english') return String(n);
	if (style === 'bengali') return toBengaliNumeral(n);
	return `${toBengaliNumeral(n)} / ${n}`;
}
