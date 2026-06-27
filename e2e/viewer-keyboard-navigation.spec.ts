import { expect, test } from '@playwright/test';
import { gotoMockedViewer } from './support/viewer';

test.describe('viewer keyboard navigation', () => {
    test('moves the camera with WASD and Arrow keys', async ({ page }) => {
        await gotoMockedViewer(page);

        await page.keyboard.down('w');
        await page.waitForTimeout(150);
        await page.keyboard.up('w');

        await expect
            .poll(() => Number(new URL(page.url()).searchParams.get('y')))
            .toBeGreaterThan(6060500);

        const xBeforeArrowMovement = Number(new URL(page.url()).searchParams.get('x'));
        await page.keyboard.down('ArrowRight');
        await page.waitForTimeout(150);
        await page.keyboard.up('ArrowRight');

        await expect
            .poll(() => Number(new URL(page.url()).searchParams.get('x')))
            .toBeGreaterThan(xBeforeArrowMovement);
    });

    test('does not capture movement keys while typing in a field', async ({ page }) => {
        await gotoMockedViewer(page);

        const searchInput = page.getByRole('textbox').first();
        await searchInput.focus();
        await page.keyboard.press('w');
        await page.waitForTimeout(750);

        expect(new URL(page.url()).searchParams.get('x')).toBeNull();
        expect(new URL(page.url()).searchParams.get('y')).toBeNull();
    });
});
