import { expect, test, type Page } from '@playwright/test';

const saved = (page: Page) => page.evaluate(()=>JSON.parse(localStorage.getItem('lc.blocks3d.v1') || '[]') as {x:number;y:number;z:number;color:string}[]);

test('build, undo, erase, save, and reopen a colorful 3D design',async({page})=>{
	const errors:string[]=[]; page.on('pageerror',error=>errors.push(error.message));
	await page.goto('/play');
	await page.getByRole('button',{name:'থ্রিডি ব্লক বিল্ডিং',exact:true}).click();
	await page.getByRole('button',{name:'English',exact:true}).click();
	await expect(page.getByRole('heading',{name:'3D Block Building'})).toBeVisible();
	await page.getByRole('button',{name:'Sound on',exact:true}).click();
	const board=page.getByRole('application',{name:'3D building area'});
	await board.focus();
	for (let i=0;i<10;i++) await page.keyboard.press('Enter');
	expect(await saved(page)).toHaveLength(10);
	await page.keyboard.press('Enter');
	await expect(page.locator('.feedback')).toContainText('up to 10 blocks high');
	expect(await saved(page)).toHaveLength(10);
	await page.getByRole('button',{name:'Undo',exact:true}).click();
	expect(await saved(page)).toHaveLength(9);
	await page.getByRole('button',{name:'Redo',exact:true}).click();
	expect(await saved(page)).toHaveLength(10);
	await page.getByRole('button',{name:'Blue',exact:true}).click();
	await board.focus(); await page.keyboard.press('ArrowRight'); await page.keyboard.press('Enter');
	expect((await saved(page)).filter(b=>b.color==='#80b9ce')).toHaveLength(1);
	await page.keyboard.press('Backspace');
	expect(await saved(page)).toHaveLength(10);
	await page.reload();
	await expect(page.getByRole('heading',{name:'3D Block Building'})).toBeVisible();
	expect(await saved(page)).toHaveLength(10);
	await page.getByRole('button',{name:/Little house/}).click();
	const house=await saved(page); expect(house.length).toBeGreaterThan(100);
	await page.getByRole('button',{name:/Clear/}).click();
	expect(await saved(page)).toHaveLength(0);
	await page.getByRole('button',{name:'Undo',exact:true}).click();
	expect(await saved(page)).toEqual(house);
	await page.getByRole('button',{name:'Rotate right',exact:true}).click();
	await page.getByRole('button',{name:'Zoom out',exact:true}).click();
	await page.getByRole('button',{name:'Rotate left',exact:true}).click();
	await expect(page.getByRole('button',{name:/Show me how/})).toBeInViewport();
	await page.screenshot({path:'test-results/blocks3d-house.png'});
	await page.getByRole('button',{name:/Clear/}).click();
	const rect=await board.boundingBox(); expect(rect).not.toBeNull();
	await page.mouse.click(rect!.x+rect!.width*0.5,rect!.y+rect!.height*0.75);
	expect(await saved(page)).toHaveLength(1);
	await page.getByRole('button',{name:'Remove block',exact:true}).click();
	await board.focus(); await page.keyboard.press('Enter');
	expect(await saved(page)).toHaveLength(0);
	await page.getByRole('button',{name:/Color tower/}).click();
	expect((await saved(page)).length).toBeGreaterThan(50);
	await page.getByRole('button',{name:/Colorful steps|Rainbow steps/}).click();
	expect((await saved(page)).length).toBeGreaterThan(50);
	await page.getByRole('button',{name:'বাংলা',exact:true}).click();
	await expect(page.getByRole('heading',{name:'থ্রিডি ব্লক বিল্ডিং'})).toBeVisible();
	expect(errors).toEqual([]);
});

test('tapping the same column again stacks on top, up to ten, and a full build stays in view', async ({ page }) => {
	await page.goto('/blocks-3d');
	await page.getByRole('button', { name: 'English', exact: true }).click();
	await page.evaluate(() => localStorage.removeItem('lc.blocks3d.v1'));
	await page.reload();
	const board = page.getByRole('application', { name: '3D building area' });
	const rect = (await board.boundingBox())!;
	// Same spot every time: first the floor tile, then the block's own face.
	for (let i = 0; i < 11; i++) await page.mouse.click(rect.x + rect.width * 0.5, rect.y + rect.height * 0.62);
	const column = await saved(page);
	expect(column).toHaveLength(10);
	expect(new Set(column.map((b) => `${b.x},${b.z}`)).size).toBe(1);
	expect(column.map((b) => b.y).sort((a, b) => a - b)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
	await expect(page.locator('.feedback')).toContainText('up to 10 blocks high');
	await page.screenshot({ path: 'test-results/blocks3d-tall.png' });

	for (const [width, height] of [[1280, 800], [1024, 600]] as const) {
		await page.setViewportSize({ width, height });
		await page.getByRole('button', { name: /Little house/ }).click();
		await page.waitForTimeout(200);
		await page.screenshot({ path: `test-results/blocks3d-fit-${width}.png` });
		// Undo/Redo/Clear stay on screen; nothing is pushed below the window.
		const clear = (await page.getByRole('button', { name: /Clear/ }).boundingBox())!;
		expect(clear.y + clear.height).toBeLessThanOrEqual(height);
	}
});

test('black and white blocks can be chosen and are saved', async ({ page }) => {
	await page.goto('/blocks-3d');
	await page.getByRole('button', { name: 'English', exact: true }).click();
	await page.evaluate(() => localStorage.removeItem('lc.blocks3d.v1'));
	await page.reload();
	const board = page.getByRole('application', { name: '3D building area' });
	for (const [name, hex] of [['Black', '#2f3437'], ['White', '#ffffff']] as const) {
		await page.getByRole('button', { name, exact: true }).click();
		await expect(page.getByRole('button', { name, exact: true })).toHaveAttribute('aria-pressed', 'true');
		await board.focus();
		await page.keyboard.press(name === 'Black' ? 'Enter' : 'ArrowRight');
		if (name === 'White') await page.keyboard.press('Enter');
		expect((await saved(page)).filter((b) => b.color === hex)).toHaveLength(1);
	}
	await page.screenshot({ path: 'test-results/blocks3d-black-white.png' });
	await page.reload();
	expect((await saved(page)).map((b) => b.color).sort()).toEqual(['#2f3437', '#ffffff']);
});

test('the Kaaba template stays whole: nothing taken away or piled on, the courtyard is free (PR-13)', async ({ page }) => {
	await page.goto('/blocks-3d');
	await page.getByRole('button', { name: 'English', exact: true }).click();
	await page.getByRole('button', { name: /The Kaaba/ }).click();
	const start = await saved(page);
	expect(start.filter((b) => b.color === '#c9a227').length).toBeGreaterThan(10);
	await page.waitForTimeout(200);
	await page.screenshot({ path: 'test-results/blocks3d-kaaba.png' });
	const board = page.getByRole('application', { name: '3D building area' });
	await board.focus();
	for (let i = 0; i < 3; i++) await page.keyboard.press('ArrowRight');
	await page.keyboard.press('Enter'); // build on the Kaaba
	await expect(page.locator('.feedback')).toContainText('The Kaaba stays just as it is');
	await page.getByRole('button', { name: 'Remove block', exact: true }).click();
	await board.focus();
	await page.keyboard.press('Backspace'); // take a piece away
	await page.keyboard.press('Enter');
	expect(await saved(page)).toEqual(start);
	// Tapping the Kaaba with the mouse is gentle too.
	const rect = (await board.boundingBox())!;
	await page.mouse.click(rect.x + rect.width * 0.5, rect.y + rect.height * 0.45);
	expect(await saved(page)).toEqual(start);
	// The courtyard can be decorated.
	await page.getByRole('button', { name: 'Add block', exact: true }).click();
	await page.getByRole('button', { name: 'Green', exact: true }).click();
	await board.focus();
	for (let i = 0; i < 8; i++) await page.keyboard.press('ArrowLeft');
	await page.keyboard.press('Enter');
	expect(await saved(page)).toHaveLength(start.length + 1);
});

test('save a build, find it in My builds, open it again, and delete it with a second tap', async ({ page }) => {
	await page.goto('/blocks-3d');
	await page.getByRole('button', { name: 'English', exact: true }).click();
	await page.evaluate(() => { localStorage.removeItem('lc.blocks3d.v1'); localStorage.removeItem('lc.blocks3d.saved.v1'); });
	await page.reload();
	const save = page.getByTestId('save-build');
	await expect(save).toBeDisabled(); // nothing to save on an empty mat
	await page.getByRole('button', { name: /Colorful steps|Rainbow steps/ }).click();
	const rainbow = await saved(page);
	await save.click();
	await expect(page.locator('.feedback')).toContainText('Saved! It is in My builds.');
	await save.click();
	await expect(page.locator('.feedback')).toContainText('already saved');
	await expect(page.getByTestId('my-builds')).toContainText('1');

	await page.getByRole('button', { name: /Clear/ }).click();
	expect(await saved(page)).toHaveLength(0);
	await page.reload(); // My builds survive closing the game
	await page.getByTestId('my-builds').click();
	const dialog = page.getByRole('dialog', { name: 'My builds' });
	await expect(dialog.locator('img')).toHaveCount(1);
	await page.screenshot({ path: 'test-results/blocks3d-my-builds.png' });
	await dialog.getByRole('button', { name: 'Open build 1' }).click();
	await expect(dialog).toBeHidden();
	expect(await saved(page)).toEqual(rainbow);
	await expect(page.locator('.feedback')).toContainText("Here it is again!");

	await page.getByTestId('my-builds').click();
	await dialog.getByRole('button', { name: 'Delete', exact: true }).click();
	await expect(dialog.locator('img')).toHaveCount(1); // first tap only asks
	await dialog.getByRole('button', { name: 'Yes, delete' }).click();
	await expect(dialog.locator('img')).toHaveCount(0);
	await expect(dialog).toContainText('Nothing saved yet');
	await page.keyboard.press('Escape');
	await expect(dialog).toBeHidden();
});

async function tapGuide(page: Page) {
	const box = (await page.locator('[data-guide-target]').boundingBox())!;
	await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
}

test('💡 idea: a shadow appears, the child fills it block by block, and it is celebrated (no score)', async ({ page }) => {
	await page.goto('/blocks-3d');
	await page.getByRole('button', { name: 'English', exact: true }).click();
	await page.evaluate(() => localStorage.removeItem('lc.blocks3d.v1'));
	await page.reload();
	const idea = page.getByTestId('idea');
	await idea.click();
	await expect(idea).toHaveAttribute('aria-pressed', 'true');
	await expect(page.locator('.feedback')).toContainText('Put blocks on the light shadow!');
	await page.waitForTimeout(200);
	await page.screenshot({ path: 'test-results/blocks3d-idea.png' });
	// The first idea is a 4-block rainbow tower; the color follows the shadow.
	for (let i = 0; i < 4; i++) await tapGuide(page);
	await expect(page.locator('.feedback')).toContainText('We built the whole thing!');
	await expect(idea).toHaveAttribute('aria-pressed', 'false');
	const tower = await saved(page);
	expect(tower).toHaveLength(4);
	expect(new Set(tower.map((b) => `${b.x},${b.z}`)).size).toBe(1);
	expect(new Set(tower.map((b) => b.color)).size).toBe(4);
	// Pressing again shows the next idea; pressing once more hides it.
	await idea.click();
	await expect(idea).toHaveAttribute('aria-pressed', 'true');
	await idea.click();
	await expect(idea).toHaveAttribute('aria-pressed', 'false');
});

test('💡 idea follows the active mission, and a stuck tap on the Kaaba points to free ground', async ({ page }) => {
	await page.goto('/blocks-3d');
	await page.getByRole('button', { name: 'English', exact: true }).click();
	await page.evaluate(() => localStorage.removeItem('lc.blocks3d.v1'));
	await page.reload();
	await page.getByRole('tab', { name: /Missions/ }).click();
	await page.getByRole('button', { name: /Build a Tall Tower/ }).click();
	await page.getByTestId('idea').click();
	for (let i = 0; i < 4; i++) await tapGuide(page);
	await expect(page.locator('.celebration-dialog')).toBeVisible();
	await page.getByRole('button', { name: 'Keep Building' }).click();

	await page.getByRole('tab', { name: /Build/ }).click();
	await page.getByRole('button', { name: /The Kaaba/ }).click();
	const board = page.getByRole('application', { name: '3D building area' });
	const rect = (await board.boundingBox())!;
	await page.mouse.click(rect.x + rect.width * 0.5, rect.y + rect.height * 0.45);
	await expect(page.locator('.feedback')).toContainText('The Kaaba stays just as it is');
	// The hand's target is on free courtyard: tapping it adds a block there.
	const before = (await saved(page)).length;
	await tapGuide(page);
	expect(await saved(page)).toHaveLength(before + 1);
});
