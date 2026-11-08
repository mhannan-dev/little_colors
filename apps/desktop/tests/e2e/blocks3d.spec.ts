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
	for (let i=0;i<5;i++) await page.keyboard.press('Enter');
	expect(await saved(page)).toHaveLength(5);
	await page.keyboard.press('Enter');
	await expect(page.locator('.feedback')).toContainText('up to 5 blocks high');
	expect(await saved(page)).toHaveLength(5);
	await page.getByRole('button',{name:'Undo',exact:true}).click();
	expect(await saved(page)).toHaveLength(4);
	await page.getByRole('button',{name:'Redo',exact:true}).click();
	expect(await saved(page)).toHaveLength(5);
	await page.getByRole('button',{name:'Blue',exact:true}).click();
	await board.focus(); await page.keyboard.press('ArrowRight'); await page.keyboard.press('Enter');
	expect((await saved(page)).filter(b=>b.color==='#80b9ce')).toHaveLength(1);
	await page.keyboard.press('Backspace');
	expect(await saved(page)).toHaveLength(5);
	await page.reload();
	await expect(page.getByRole('heading',{name:'3D Block Building'})).toBeVisible();
	expect(await saved(page)).toHaveLength(5);
	await page.getByRole('button',{name:/Little house/}).click();
	const house=await saved(page); expect(house.length).toBeGreaterThan(100);
	await page.getByRole('button',{name:/Clear/}).click();
	expect(await saved(page)).toHaveLength(0);
	await page.getByRole('button',{name:'Undo',exact:true}).click();
	expect(await saved(page)).toEqual(house);
	await page.getByRole('button',{name:'Rotate right',exact:true}).click();
	await page.getByRole('button',{name:'Zoom out',exact:true}).click();
	await page.getByRole('button',{name:'Rotate left',exact:true}).click();
	const sidebar=await page.locator('aside').boundingBox();
	const help=await page.getByRole('button',{name:/Show me how/}).boundingBox();
	expect(help!.y+help!.height).toBeLessThanOrEqual(sidebar!.y+sidebar!.height);
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
	await page.getByRole('button',{name:/Rainbow steps/}).click();
	expect((await saved(page)).length).toBeGreaterThan(50);
	await page.getByRole('button',{name:'বাংলা',exact:true}).click();
	await expect(page.getByRole('heading',{name:'থ্রিডি ব্লক বিল্ডিং'})).toBeVisible();
	expect(errors).toEqual([]);
});

test('tapping the same column again stacks on top, up to five, and a full build stays in view', async ({ page }) => {
	await page.goto('/blocks-3d');
	await page.getByRole('button', { name: 'English', exact: true }).click();
	await page.evaluate(() => localStorage.removeItem('lc.blocks3d.v1'));
	await page.reload();
	const board = page.getByRole('application', { name: '3D building area' });
	const rect = (await board.boundingBox())!;
	// Same spot every time: first the floor tile, then the block's own face.
	for (let i = 0; i < 6; i++) await page.mouse.click(rect.x + rect.width * 0.5, rect.y + rect.height * 0.62);
	const column = await saved(page);
	expect(column).toHaveLength(5);
	expect(new Set(column.map((b) => `${b.x},${b.z}`)).size).toBe(1);
	expect(column.map((b) => b.y).sort()).toEqual([0, 1, 2, 3, 4]);
	await expect(page.locator('.feedback')).toContainText('up to 5 blocks high');

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
