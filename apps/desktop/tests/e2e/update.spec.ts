import { expect, test, type Page } from '@playwright/test';

/** In-app updates (docs/decisions/0001-in-app-updates.md). The browser is not the desktop app, so a fake update is injected. */
async function fakeUpdate(page: Page, fail = false) {
	await page.waitForFunction(() => '__lcFakeUpdate' in window);
	await page.evaluate((f) => (window as unknown as { __lcFakeUpdate: (f: boolean) => void }).__lcFakeUpdate(f), fail);
}

test('no update notice unless an update exists (and never an offline message)', async ({ page }) => {
	await page.goto('/');
	await page.waitForTimeout(3500); // past the quiet check delay
	await expect(page.getByTestId('update-notice')).toHaveCount(0);
	await expect(page.getByText(/offline|অফলাইন/i)).toHaveCount(0);
});

test('a quick tap does nothing; a grown-up press-and-hold starts the update', async ({ page }) => {
	await page.goto('/');
	await fakeUpdate(page);
	const notice = page.getByTestId('update-notice');
	await expect(notice).toContainText('9.9.9');
	await page.screenshot({ path: 'test-results/update-notice.png' });
	const hold = page.getByTestId('update-hold');
	await hold.click(); // a child's tap
	await expect(notice).not.toContainText('আপডেট নামছে');
	const box = (await hold.boundingBox())!;
	await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
	await page.mouse.down();
	await page.waitForTimeout(2300);
	await page.mouse.up();
	await expect(notice).toContainText('আপডেট নামছে');
});

test('a failed download is gentle and can be put off', async ({ page }) => {
	await page.goto('/');
	await fakeUpdate(page, true);
	const hold = page.getByTestId('update-hold');
	await hold.focus();
	await page.keyboard.down('Enter');
	await page.waitForTimeout(2300);
	await page.keyboard.up('Enter');
	const notice = page.getByTestId('update-notice');
	await expect(notice).toContainText('পরে আবার চেষ্টা করবো');
	await notice.getByRole('button', { name: 'পরে' }).click();
	await expect(notice).toHaveCount(0);
});
