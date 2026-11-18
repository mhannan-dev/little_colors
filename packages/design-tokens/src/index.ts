/** Spec 02 — the only place hex values are defined (DS-01, DS-02). */
export const neutral = {
	'bg-primary': '#FFF9F0',
	'bg-secondary': '#F4F8F5',
	surface: '#FFFFFF',
	'text-primary': '#263238',
	'text-secondary': '#52616B',
	'border-soft': '#DCE5E1',
	focus: '#1F5FAD'
} as const;

export const neutralDark = {
	'bg-primary': '#1E2428',
	'bg-secondary': '#242C31',
	surface: '#2C363C',
	'text-primary': '#F1F4F3',
	'text-secondary': '#B8C4C2',
	'border-soft': '#3B474D',
	focus: '#8CB8F0'
} as const;

export const learning = {
	red: '#E5484D',
	yellow: '#F2C94C',
	blue: '#3478D4',
	orange: '#F28C28',
	green: '#35A66A',
	purple: '#8A5AC2'
} as const;

/** Rumi's colors: muted, clearly distinct from learning orange (MA-04). */
export const mascot = {
	fur: '#E3B48A',
	'fur-light': '#F6E3CF',
	stripe: '#8A6A52',
	scarf: '#5E8C6A',
	eye: '#263238'
} as const;

export const size = {
	'radius-lg': '24px',
	'radius-xl': '32px',
	'target-min': '56px',
	'target-game': '88px'
} as const;

export type LearningColorName = keyof typeof learning;

const effects = {
	'panel-shadow': '0 12px 32px rgba(38, 63, 58, .08), 0 2px 5px rgba(38, 63, 58, .04)',
	'control-shadow': '0 4px 0 rgba(38, 63, 58, .12), 0 8px 16px rgba(38, 63, 58, .06)',
	'spring-out': 'cubic-bezier(.22, 1.25, .4, 1)',
	'spring-settle': 'cubic-bezier(.3, .85, .35, 1.08)',
	'contact-shadow': '0 5px 8px rgba(43, 49, 42, .15), 0 13px 20px rgba(43, 49, 42, .07)'
} as const;

/** CSS custom properties for :root (light) — consumed by the desktop UI. */
export function toCssVariables(theme: 'light' | 'dark' = 'light'): string {
	const n = theme === 'dark' ? neutralDark : neutral;
	const entries: [string, string][] = [
		...Object.entries(n),
		...Object.entries(learning).map(([k, v]) => [`learn-${k}`, v] as [string, string]),
		...Object.entries(mascot).map(([k, v]) => [`mascot-${k}`, v] as [string, string]),
		...Object.entries(size),
		...Object.entries(effects)
	];
	return entries.map(([k, v]) => `--${k}: ${v};`).join('\n');
}
