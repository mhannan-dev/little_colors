const files = import.meta.glob('./flags/*.svg', { eager: true, query: '?url', import: 'default' }) as Record<string, string>;
export function flagUrl(id: string): string {
	const url = files[`./flags/${id}.svg`];
	if (!url) throw new Error(`Missing bundled flag: ${id}`);
	return url;
}
