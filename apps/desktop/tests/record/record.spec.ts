import { expect, test } from '@playwright/test';

const created: string[] = [];
const HEADERS = { 'x-little-colors-record': '1' };

test.afterEach(async ({ request }) => {
	// Never leave test recordings in the app's assets.
	for (const path of created.splice(0)) {
		await request.delete(`/__record/delete?path=${encodeURIComponent(path)}`, { headers: HEADERS });
	}
});

test('record → process → save writes a WAV into the app assets', async ({ page, request }) => {
	const before: string[] = await (await request.get('/__record/list')).json();
	await page.goto('/record');
	const card = page.getByTestId('record-item');
	await expect(card).toBeVisible();
	const key = (await card.getAttribute('data-key'))!;
	const path = `audio/bn-BD/${key.replace(/\./g, '-')}.wav`;
	test.skip(before.includes(path), 'first item already recorded by a person; not touching it');
	created.push(path);

	await page.getByTestId('record-start').click();
	await page.waitForTimeout(1500);
	await page.getByTestId('record-stop').click();
	await expect(page.getByTestId('record-save')).toBeEnabled();
	await page.getByTestId('record-save').click();
	await expect(page.getByTestId('record-message')).toHaveText(/সেভ হয়েছে/);

	const after: string[] = await (await request.get('/__record/list')).json();
	expect(after).toContain(path);
	const wav = await request.get(`/src/lib/assets/${path}`);
	expect(wav.ok()).toBe(true);
	const bytes = await wav.body();
	expect(bytes.subarray(0, 4).toString('ascii')).toBe('RIFF');
	// 22.05 kHz mono 16-bit, trimmed: well under 2 s of fake-mic beep → < 100 kB
	expect(bytes.readUInt32LE(24)).toBe(22050);
	expect(bytes.length).toBeLessThan(100_000);
});

test('the save endpoint refuses paths outside the audio folder', async ({ request }) => {
	for (const bad of ['../../../evil.wav', 'audio/bn-BD/../x.wav', 'audio/xx/x.wav', 'audio/bn-BD/X.mp3']) {
		const res = await request.post(`/__record/save?path=${encodeURIComponent(bad)}`, { headers: HEADERS, data: Buffer.from('RIFFxxxx') });
		expect(res.status(), bad).toBe(400);
	}
});

test('writes are refused without the studio header or from another site', async ({ request }) => {
	const path = encodeURIComponent('audio/bn-BD/clip-color-red.wav');
	const noHeader = await request.post(`/__record/save?path=${path}`, { data: Buffer.from('RIFFxxxx') });
	expect(noHeader.status()).toBe(403);
	const evil = await request.post(`/__record/save?path=${path}`, {
		headers: { ...HEADERS, origin: 'https://evil.example' },
		data: Buffer.from('RIFFxxxx')
	});
	expect(evil.status()).toBe(403);
	const del = await request.delete(`/__record/delete?path=${path}`);
	expect(del.status()).toBe(403);
});

test('camelCase narration keys can be saved (letters.nextLetter)', async ({ request }) => {
	const path = 'audio/bn-BD/letters-nextLetter.wav';
	const before: string[] = await (await request.get('/__record/list')).json();
	test.skip(before.includes(path), 'already recorded by a person');
	created.push(path);
	// minimal valid WAV header + 2 samples
	const wav = Buffer.alloc(48);
	wav.write('RIFF', 0); wav.writeUInt32LE(40, 4); wav.write('WAVEfmt ', 8); wav.writeUInt32LE(16, 16);
	wav.writeUInt16LE(1, 20); wav.writeUInt16LE(1, 22); wav.writeUInt32LE(22050, 24); wav.writeUInt32LE(44100, 28);
	wav.writeUInt16LE(2, 32); wav.writeUInt16LE(16, 34); wav.write('data', 36); wav.writeUInt32LE(4, 40);
	const res = await request.post(`/__record/save?path=${encodeURIComponent(path)}`, { headers: HEADERS, data: wav });
	expect(res.status()).toBe(200);
});

test('groups show progress and the studio is keyboard-driven', async ({ page }) => {
	await page.goto('/record');
	await expect(page.locator('[data-group="basics"] small')).toHaveText(/[০-৯]+\/[০-৯]+/);
	await page.locator('[data-group="core"]').click();
	await expect(page.getByTestId('record-item')).toBeVisible();
	const id = async () => {
		const c = page.getByTestId('record-item');
		// Neutral variants share the key of their line, so compare key + variant.
		return `${await c.getAttribute('data-key')}|${await c.getAttribute('data-neutral')}`;
	};
	const first = await id();
	await page.keyboard.press('ArrowRight');
	expect(await id()).not.toBe(first);
	await page.keyboard.press('ArrowLeft');
	expect(await id()).toBe(first);
});
