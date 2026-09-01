import { expect, test } from '@playwright/test';

test.describe('about the project modal', () => {
    test('shows the Lithuanian project credits and external links', async ({ page }) => {
        await page.addInitScript(() => localStorage.setItem('i18nextLng', 'lt'));
        await page.goto('/');

        await page.getByRole('button', { name: 'Apie projektą' }).click();

        const dialog = page.getByRole('dialog', { name: 'Apie projektą' });
        await expect(dialog).toBeVisible();
        await expect(dialog).toContainText('Vilniaus universitetas nuo 2026 m. rugsėjo 1 d.');
        await expect(dialog.getByRole('link', { name: 'LinkedIn' })).toHaveAttribute(
            'href',
            'https://www.linkedin.com/in/gmacev/'
        );
        await expect(dialog.getByRole('link', { name: 'GitHub' })).toHaveAttribute(
            'href',
            'https://github.com/gmacev/lidar-lt'
        );
        await expect(dialog.getByRole('button', { name: 'Uždaryti langą' })).toBeVisible();

        await page.keyboard.press('Escape');
        await expect(dialog).toBeHidden();
    });

    test('uses the institutions’ official English names', async ({ page }) => {
        await page.addInitScript(() => localStorage.setItem('i18nextLng', 'en'));
        await page.goto('/');

        await page.getByRole('button', { name: 'About the project' }).click();

        const dialog = page.getByRole('dialog', { name: 'About the project' });
        await expect(dialog).toContainText(
            'Airborne laser scanning of Lithuania is coordinated by the National Land Service.'
        );
        await expect(dialog).toContainText(
            'The data is distributed by the Construction Sector Development Agency.'
        );
        await expect(dialog).toContainText(
            'Department of Cartography and Geoinformatics at the Institute of Geosciences'
        );
    });
});
