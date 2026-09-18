import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
        localStorage.setItem('i18nextLng', 'en');
    });
    await page.goto('/');
});

test('renders sectors as genuine links with canonical viewer URLs', async ({ page }) => {
    const sectorLink = page.locator('[data-sector-id="76_32"]');

    await expect(sectorLink).toHaveCount(1);
    await expect(sectorLink).toHaveAttribute('href', /\/viewer\/76_32\?sectorName=/);
    await expect(sectorLink).toHaveAttribute('aria-label', /Open sector .+, 76\/32/);
    await expect(sectorLink.locator('path')).toHaveAttribute('d', /^M/);

    const elementIdentity = await sectorLink.evaluate((element) => ({
        tagName: element.tagName,
        namespace: element.namespaceURI,
    }));
    expect(elementIdentity).toEqual({
        tagName: 'a',
        namespace: 'http://www.w3.org/2000/svg',
    });

    const contextMenuEvent = await sectorLink.evaluate((element) => {
        const event = new MouseEvent('contextmenu', {
            bubbles: true,
            cancelable: true,
            button: 2,
        });
        return {
            dispatched: element.dispatchEvent(event),
            defaultPrevented: event.defaultPrevented,
        };
    });
    expect(contextMenuEvent).toEqual({ dispatched: true, defaultPrevented: false });
});

test('leaves new-tab behavior to the browser without calling window.open', async ({
    page,
    context,
}) => {
    await page.addInitScript(() => {
        window.open = () => {
            throw new Error('Sector links must not emulate native new-tab behavior');
        };
    });
    await page.reload();

    const sectorLink = page.locator('[data-sector-id="76_32"]');
    const newPagePromise = context.waitForEvent('page');
    await sectorLink.click({ button: 'middle' });
    const newPage = await newPagePromise;

    await newPage.waitForLoadState('domcontentloaded');
    expect(new URL(newPage.url()).pathname).toBe('/viewer/76_32');
    await newPage.close();

    const modifiedPagePromise = context.waitForEvent('page');
    await sectorLink.click({ modifiers: ['Control'] });
    const modifiedPage = await modifiedPagePromise;

    await modifiedPage.waitForLoadState('domcontentloaded');
    expect(new URL(modifiedPage.url()).pathname).toBe('/viewer/76_32');
    await modifiedPage.close();
});

test('keeps ordinary clicks as client-side navigation', async ({ page }) => {
    const documentLoads = await page.evaluate(
        () => performance.getEntriesByType('navigation').length
    );
    await page.locator('[data-sector-id="76_32"]').click();

    await expect(page).toHaveURL(/\/viewer\/76_32\?sectorName=/);
    expect(await page.evaluate(() => performance.getEntriesByType('navigation').length)).toBe(
        documentLoads
    );
});

test('preserves map drag and wheel interactions through the link layer', async ({ page }) => {
    const sectorPath = page.locator('[data-sector-id="76_32"] path');
    const initialPath = await sectorPath.getAttribute('d');
    const box = await sectorPath.boundingBox();
    if (!box) throw new Error('Expected the test sector to be visible');

    const startX = box.x + box.width / 2;
    const startY = box.y + box.height / 2;
    await page.mouse.move(startX, startY);
    await page.mouse.down();
    await page.mouse.move(startX + 60, startY + 30, { steps: 5 });
    await page.mouse.up();

    await expect(page).toHaveURL('/');
    await expect.poll(() => sectorPath.getAttribute('d')).not.toBe(initialPath);

    const draggedPath = await sectorPath.getAttribute('d');
    await sectorPath.hover();
    await page.mouse.wheel(0, -300);
    await expect.poll(() => sectorPath.getAttribute('d')).not.toBe(draggedPath);
    await expect(page).toHaveURL('/');
});
