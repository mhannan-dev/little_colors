import { writeFile } from 'node:fs/promises';
import type { Page } from '@playwright/test';

export async function saveWebpScreenshot(page: Page, path: string): Promise<void> {
	const png = await page.screenshot({ type: 'png' });
	const webp = await page.evaluate(async (base64) => {
		const bytes = Uint8Array.from(atob(base64), (character) => character.charCodeAt(0));
		const bitmap = await createImageBitmap(new Blob([bytes], { type: 'image/png' }));
		try {
			const canvas = document.createElement('canvas');
			canvas.width = bitmap.width;
			canvas.height = bitmap.height;
			const context = canvas.getContext('2d');
			if (!context) throw new Error('Cannot create a screenshot canvas');
			context.drawImage(bitmap, 0, 0);
			return canvas.toDataURL('image/webp', 1);
		} finally {
			bitmap.close();
		}
	}, png.toString('base64'));
	const prefix = 'data:image/webp;base64,';
	if (!webp.startsWith(prefix)) throw new Error('The browser did not encode a WebP screenshot');
	await writeFile(path, Buffer.from(webp.slice(prefix.length), 'base64'));
}
