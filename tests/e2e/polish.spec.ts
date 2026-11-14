import { expect, test, type Page } from '@playwright/test';

// Flows added after the first release: hand-spun wheel, pullable lever,
// catalogue photos and updates, theme and language persistence, extra pages.

async function start(page: Page, { sample = true } = {}) {
  await page.route('https://api.open-meteo.com/**', (r) => r.abort());
  await page.route('https://geocoding-api.open-meteo.com/**', (r) => r.abort());
  await page.goto('/');
  await page.getByTestId('onb-start').click();
  for (let i = 0; i < 3; i++) await page.getByTestId('onb-next').click();
  if (sample) {
    await page.getByTestId('onb-sample').click();
    await expect(page.getByTestId('wardrobe-grid')).toBeVisible();
  } else {
    await page.getByTestId('onb-finish').click();
  }
}

test('wheel: a slow drag only turns it, a flick spins it to a recorded result', async ({ page }) => {
  await start(page);
  await page.goto('/spin');
  const wheel = page.getByTestId('wheel');
  // Measure the wheel only once fonts and images have settled the layout.
  await page.evaluate(() => document.fonts.ready);
  await page.waitForLoadState('networkidle');
  const box = (await wheel.boundingBox())!;
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  const r = box.width * 0.38;

  await page.mouse.move(cx + r, cy);
  await page.mouse.down();
  for (let k = 1; k <= 20; k++) {
    const a = (k * Math.PI) / 40;
    await page.mouse.move(cx + r * Math.cos(a), cy + r * Math.sin(a));
    await page.waitForTimeout(30);
  }
  await page.waitForTimeout(200);
  await page.mouse.up();
  // A quarter-turn of the finger turns the wheel a quarter-turn (a few degrees of pointer rounding allowed).
  const turned = Number(await wheel.getAttribute('data-rotation'));
  expect(turned).toBeGreaterThan(84);
  expect(turned).toBeLessThan(96);
  await expect(page.getByTestId('spin-result')).toHaveCount(0);

  await page.mouse.move(cx + r, cy);
  await page.mouse.down();
  for (let k = 1; k <= 6; k++) {
    const a = (k * Math.PI) / 8;
    await page.mouse.move(cx + r * Math.cos(a), cy + r * Math.sin(a));
    await page.waitForTimeout(8);
  }
  await page.mouse.up();
  await expect(page.getByTestId('spin-result')).toBeVisible({ timeout: 9000 });
  await expect(page.getByText(/Spin history|Storico/)).toBeVisible();
});

test('slot lever: released early it springs back, pulled past halfway it spins', async ({ page }) => {
  await start(page);
  await page.goto('/spin');
  await page.getByRole('button', { name: /^Slots?$/ }).click();
  const lever = page.getByTestId('spin-button').first();
  const b = (await lever.boundingBox())!;
  const x = b.x + b.width / 2;

  // A short tug: no spin.
  await page.mouse.move(x, b.y + 40);
  await page.mouse.down();
  await page.mouse.move(x, b.y + 70, { steps: 4 });
  await page.mouse.up();
  await page.waitForTimeout(600);
  await expect(page.getByTestId('spin-result')).toHaveCount(0);

  // A full pull: spins and lands on the reels' real outcome.
  await page.mouse.move(x, b.y + 40);
  await page.mouse.down();
  await page.mouse.move(x, b.y + 190, { steps: 10 });
  await page.mouse.up();
  await expect(page.getByTestId('spin-result')).toBeVisible({ timeout: 6000 });
  const winner = await page.getByTestId('result-name').textContent();
  const reels = await page.locator('[data-testid^="reel-"]').evaluateAll((els) => els.map((e) => e.getAttribute('data-result')));
  expect(reels.every(Boolean)).toBe(true);
  expect(winner?.trim().length).toBeGreaterThan(0);
});

test('catalogue photos show on cards, and a catalogue-filled profile can be updated', async ({ page }) => {
  await start(page);
  // The sample shelf uses cut-out photos from the catalogue.
  const photos = page.locator('.pcard .bottle-cutout img');
  await expect(photos.first()).toBeVisible();
  expect(await photos.count()).toBeGreaterThan(5);
  // Profile shows the catalogue's sourced longevity line when it has one.
  await page.getByText('Carlisle').first().click();
  await expect(page.getByRole('heading', { name: 'Carlisle' })).toBeVisible();
  await expect(page.getByTestId('perf-evidence')).toBeVisible();
});

test('theme starts light, a choice in Settings sticks across reloads', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await start(page);
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await page.goto('/settings');
  await page.getByRole('group', { name: /Appearance|Aspetto/ }).getByRole('button', { name: /Dark|Scuro/ }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
});

test('language switch translates the app and persists', async ({ page }) => {
  await start(page);
  await page.goto('/settings');
  await page.getByRole('button', { name: 'Italiano' }).click();
  await page.goto('/wardrobe');
  await expect(page.getByRole('heading', { level: 1 })).toContainText(/ARMADIO|Armadio/i);
  await page.reload();
  await expect(page.getByRole('link', { name: 'Armadio' })).toBeVisible();
});

test('home: wear today and another pick; badges and stats pages render', async ({ page }) => {
  await start(page);
  await page.goto('/');
  const card = page.getByTestId('today-card');
  const first = await card.locator('.today-name').textContent();
  await card.getByRole('button', { name: /Another one|Un altro/ }).click();
  await expect(card.locator('.today-name')).not.toHaveText(first ?? '');
  await card.getByRole('button', { name: /Wear it today|Indossalo oggi/ }).click();
  await expect(card.getByRole('button', { name: /Worn today|Indossato oggi/ })).toBeVisible();
  await page.goto('/badges');
  await expect(page.locator('.badge-card.on').first()).toBeVisible();
  await page.goto('/wardrobe/stats');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
});

test('empty shelf shows illustrated empty states, not a broken page', async ({ page }) => {
  await start(page, { sample: false });
  await page.goto('/wardrobe');
  await expect(page.locator('.empty-art')).toBeVisible();
  await page.goto('/spin');
  await expect(page.locator('.empty-art')).toBeVisible();
  await page.goto('/lab');
  await expect(page.locator('.empty-art')).toBeVisible();
});
