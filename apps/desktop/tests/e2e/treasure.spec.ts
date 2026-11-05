import { expect, test, type Page } from '@playwright/test';

async function open(page:Page, older=false) {
	await page.goto('/thinking'); const sound=page.locator('header button[aria-pressed]').first();
	if(await sound.getAttribute('aria-pressed')==='true') await sound.click();
	if(older) await page.getByTestId('age-8-10').click();
	await page.getByTestId('start-treasure').click();
}
async function start(page:Page, stage:string) { await expect(page.getByTestId('treasure-intro')).toHaveAttribute('data-stage',stage); await page.getByTestId('treasure-begin').click(); }
async function clues(page:Page,count:number) { for(let i=0;i<count;i++) { const id=await page.getByTestId('treasure-target').getAttribute('data-token'); await page.locator(`[data-treasure-option="${id}"]`).click(); } }
for(const older of [false,true]) test(`treasure ${older?'8-10':'5-7'} full hunt with sound off, four keys, surprise and replay`,async({page},info)=>{
	const errors:string[]=[]; page.on('pageerror',e=>errors.push(e.message)); await open(page,older);
	await start(page,'clues'); await clues(page,older?3:2); await page.getByTestId('treasure-next').click();
	await start(page,'memory'); const spots=await page.locator('[data-spot][data-token]').evaluateAll(es=>es.map(e=>({cell:e.getAttribute('data-spot'),id:e.getAttribute('data-token')})));
	expect(spots).toHaveLength(older?3:2); await page.getByTestId('treasure-hide').click();
	await expect(page.locator('[data-spot][data-token]')).toHaveCount(0);
	for(let i=0;i<spots.length;i++) { const id=await page.getByTestId('treasure-target').getAttribute('data-token'); await page.locator(`[data-spot="${spots.find(s=>s.id===id)!.cell}"]`).click(); }
	await page.getByTestId('treasure-next').click(); await start(page,'sort');
	const shape=await page.getByTestId('treasure-sort-shape').getAttribute('data-shape');
	for(const option of await page.locator(`[data-treasure-option][data-shape="${shape}"]`).all()) await option.click();
	await page.getByTestId('treasure-next').click(); await start(page,'pattern');
	const sequence=await page.locator('[data-testid="treasure-sequence"] [data-token]').evaluateAll(es=>es.map(e=>e.getAttribute('data-token')));
	const unit=older?3:2; const answer=sequence[sequence.length%unit];
	await page.locator(`[data-treasure-option="${answer}"]`).click(); await page.getByTestId('treasure-next').click();
	await expect(page.getByTestId('treasure-chest')).toHaveAttribute('data-open','false'); await page.getByTestId('treasure-open').click();
	await expect(page.getByTestId('treasure-banana')).toBeVisible(); await page.screenshot({path:info.outputPath('treasure-surprise.png')});
	await page.getByTestId('treasure-giggle').click(); await expect(page.getByTestId('treasure-banana')).toBeVisible();
	await page.getByTestId('treasure-replay').click(); await expect(page.getByTestId('treasure-intro')).toHaveAttribute('data-stage','clues');
	await page.getByTestId('treasure-back').click(); await expect(page.getByTestId('start-picnic')).toBeVisible(); expect(errors).toEqual([]);
});
test('treasure wrong choices, help, keyboard, memory peek and reset preserve keys',async({page})=>{
	await open(page); await start(page,'clues'); const id=await page.getByTestId('treasure-target').getAttribute('data-token');
	await page.locator(`[data-treasure-option]:not([data-treasure-option="${id}"])`).first().click(); await expect(page.getByTestId('treasure-target')).toHaveAttribute('data-token',id!);
	await page.getByTestId('treasure-help').click(); await expect(page.getByTestId('treasure-hint')).toBeVisible();
	await page.locator(`[data-treasure-option="${id}"]`).focus(); await page.keyboard.press('Enter'); await clues(page,1);
	await page.getByTestId('treasure-next').click(); await start(page,'memory'); await page.getByTestId('treasure-hide').click();
	await page.getByTestId('treasure-peek').click(); await expect(page.locator('[data-spot][data-token]')).toHaveCount(2);
	await page.getByTestId('treasure-reset').click(); await expect(page.locator('[data-spot][data-token]')).toHaveCount(2);
	await expect(page.getByTestId('treasure-begin')).toHaveCount(0); await expect(page.getByTestId('treasure-hide')).toBeVisible();
});
test('treasure stays reachable at desktop and narrow sizes with reduced motion',async({page},info)=>{
	await page.emulateMedia({reducedMotion:'reduce'});
	for(const [width,height] of [[1280,800],[800,600],[360,640]]) {
		await page.setViewportSize({width:width!,height:height!}); await open(page); await start(page,'clues');
		const area=page.getByTestId('treasure-adventure'); expect(await area.evaluate(e=>e.scrollWidth>e.clientWidth)).toBe(false);
		await page.getByTestId('treasure-help').scrollIntoViewIfNeeded(); await expect(page.getByTestId('treasure-help')).toBeInViewport();
		if(width===360) await page.screenshot({path:info.outputPath('treasure-narrow.png')});
	}
});
