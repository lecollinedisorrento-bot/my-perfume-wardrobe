import { expect, test, type Page } from '@playwright/test';
import { segmentAtRotation } from '../../src/domain/roulette';

// 1×1 PNG
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');

async function mockWeather(page: Page, temp = 29) {
  await page.route('https://api.open-meteo.com/**', (r) =>
    r.fulfill({ json: { current: { temperature_2m: temp, apparent_temperature: temp + 2, relative_humidity_2m: 60, precipitation: 0, weather_code: 0, wind_speed_10m: 8, is_day: 1 } } }),
  );
  await page.route('https://geocoding-api.open-meteo.com/**', (r) =>
    r.fulfill({ json: { results: [{ name: 'Sorrento', country: 'Italy', admin1: 'Campania', latitude: 40.63, longitude: 14.37 }] } }),
  );
}

async function onboard(page: Page, { sample = true } = {}) {
  await page.goto('/');
  await page.getByTestId('onb-start').click();
  await page.getByTestId('onb-next').click(); // language
  await page.getByTestId('onb-next').click(); // prefs (skip)
  await page.getByTestId('onb-next').click(); // weather (skip)
  if (sample) {
    await page.getByTestId('onb-sample').click();
    await expect(page.getByTestId('wardrobe-grid')).toBeVisible();
  } else {
    await page.getByTestId('onb-finish').click();
  }
}

async function acceptConsent(page: Page) {
  const btn = page.getByRole('button', { name: 'Got it, continue' });
  if (await btn.isVisible().catch(() => false)) await btn.click();
}

test.beforeEach(async ({ page }) => {
  await mockWeather(page);
});

test('first-time onboarding: language, preferences, city weather, sample import', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /your scent/i })).toBeVisible();
  await page.getByTestId('onb-start').click();
  await page.getByTestId('lang-it').click();
  await expect(page.getByRole('heading', { name: 'Scegli la lingua' })).toBeVisible();
  await page.getByTestId('lang-en').click();
  await page.getByLabel('Your first name (optional)').fill('Ada');
  await page.getByTestId('onb-next').click();
  await page.getByRole('button', { name: 'Citrus', exact: true }).click();
  await page.getByTestId('onb-next').click();
  await page.getByRole('button', { name: 'Pick a city' }).click();
  await page.locator('#city-q').fill('Sorr');
  await page.getByRole('option', { name: /Sorrento/ }).click();
  await expect(page.getByTestId('weather-current')).toContainText('29°');
  await page.keyboard.press('Escape');
  await page.getByTestId('onb-next').click();
  await page.getByTestId('onb-sample').click();
  await expect(page.locator('.pcard')).toHaveCount(16);
  await page.getByRole('link', { name: 'Home' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Ada');
  await expect(page.getByTestId('weather-pill')).toContainText('Sorrento');
});

test('location permission denial falls back gracefully', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'geolocation', {
      value: { getCurrentPosition: (_ok: unknown, err: (e: unknown) => void) => err({ code: 1, PERMISSION_DENIED: 1, message: 'denied' }) },
    });
  });
  await page.goto('/');
  await page.getByTestId('onb-start').click();
  await page.getByTestId('onb-next').click();
  await page.getByTestId('onb-next').click();
  await page.getByRole('button', { name: 'Use my location' }).click();
  await expect(page.getByText(/Location permission was denied/)).toBeVisible();
  // manual city still works
  await page.getByRole('button', { name: 'Pick a city' }).click();
  await page.locator('#city-q').fill('Sorr');
  await page.getByRole('option', { name: /Sorrento/ }).click();
  await expect(page.getByTestId('weather-current')).toBeVisible();
});

test('add a fragrance with AI identification + research, image upload, edit, rate, persist, delete', async ({ page }) => {
  await onboard(page, { sample: false });
  await page.goto('/wardrobe/new');
  await page.locator('#q').fill('Nabeel Irth');
  await page.getByRole('button', { name: /Find it/ }).click();
  await acceptConsent(page);
  // ambiguous → clarification + candidates
  await expect(page.getByText('Test fixture: original or Boom?')).toBeVisible();
  await expect(page.getByText('TEST FIXTURE · not real AI')).toBeVisible();
  await page.getByTestId('candidate').nth(1).click();
  await expect(page.getByTestId('save-perfume')).toBeVisible();
  // review shows honest provenance
  await expect(page.getByText('Unverified').first()).toBeVisible();
  await expect(page.getByText('AI interpretation').first()).toBeVisible();
  await expect(page.locator('input[name=name]')).toHaveValue('Irth Boom');
  // upload a bottle photo
  await page.getByTestId('image-file').setInputFiles({ name: 'bottle.png', mimeType: 'image/png', buffer: PNG });
  await expect(page.getByText('Your photo').first()).toBeVisible();
  await page.getByTestId('save-perfume').click();
  await expect(page.getByTestId('added-reveal')).toBeVisible();
  await page.getByRole('button', { name: 'Full profile' }).click();

  // detail page: dropped unsupported facts, notes, estimate labels
  await expect(page.getByRole('heading', { name: 'Irth Boom' })).toBeVisible();
  await expect(page.getByTestId('provenance')).toContainText('releaseYear');
  await expect(page.getByText('Estimate', { exact: true })).toBeVisible();
  await expect(page.locator('.bottle img')).toBeVisible();

  // rate + favourite + personal note
  await page.getByRole('radio', { name: '4/5' }).click();
  await page.locator('.detail-fav .fav-btn').click();
  await page.getByPlaceholder(/Compliments/).fill('Bought in Dubai');
  await page.getByPlaceholder(/Compliments/).blur();

  // edit
  await page.getByRole('link', { name: 'Edit' }).click();
  await page.locator('input[name=brand]').fill('Nabeel Perfumes');
  await page.getByTestId('save-perfume').click();
  await expect(page.getByText('Nabeel Perfumes')).toBeVisible();

  // persists after reload
  await page.reload();
  await expect(page.getByText('Nabeel Perfumes')).toBeVisible();
  await expect(page.getByRole('radio', { name: '4/5' })).toHaveAttribute('aria-checked', 'true');
  await expect(page.locator('.detail-fav .fav-btn')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByPlaceholder(/Compliments/)).toHaveValue('Bought in Dubai');

  // delete
  await page.getByRole('button', { name: 'Delete' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Delete' }).click();
  await expect(page).toHaveURL(/\/wardrobe$/);
  await expect(page.getByText('An empty shelf is a blank canvas')).toBeVisible();
});

test('manual add without AI when the server has no AI configured', async ({ page }) => {
  await page.route('**/api/health', (r) => r.fulfill({ json: { ok: true, ai: { configured: false, provider: 'none', model: null, webResearch: false }, weather: { provider: 'x' }, version: '1' } }));
  await onboard(page, { sample: false });
  await page.goto('/wardrobe/new');
  await expect(page.getByText(/AI is not connected on this server/)).toBeVisible();
  await page.locator('#q').fill('Initio Oud for Greatness');
  await page.getByRole('button', { name: 'Next' }).click();
  await expect(page.locator('input[name=brand]')).toHaveValue('Initio');
  await page.getByLabel('Top notes').fill('saffron, nutmeg');
  await page.getByTestId('save-perfume').click();
  await page.getByRole('button', { name: 'Full profile' }).click();
  await expect(page.getByText('Your entry').first()).toBeVisible();
  await expect(page.getByText('saffron · nutmeg')).toBeVisible();
});

test('wheel: stops on the real, recorded result and adds it to today’s rotation', async ({ page }) => {
  test.setTimeout(120_000);
  await onboard(page);
  await page.getByRole('link', { name: 'Spin' }).click();
  await expect(page.getByTestId('eligible-count')).toHaveText('16 in the draw');
  for (let i = 0; i < 3; i++) {
    await page.getByTestId('spin-button').click();
    await expect(page.getByTestId('spin-result')).toBeVisible({ timeout: 12_000 });
    const rotation = Number(await page.getByTestId('wheel').getAttribute('data-rotation'));
    const label = (await page.getByTestId('wheel').getAttribute('aria-label'))!;
    const names = label.replace(/^Wheel: /, '').split(', ');
    const resultName = (await page.getByTestId('result-name').textContent())!;
    expect(names[segmentAtRotation(rotation, names.length)].toLowerCase()).toBe(resultName.toLowerCase());
  }
  const name = (await page.getByTestId('result-name').textContent())!;
  await page.getByTestId('add-rotation').click();
  await expect(page.getByTestId('add-rotation')).toContainText('Added');
  await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Home' }).click();
  await expect(page.getByRole('heading', { name: 'Today’s rotation', exact: true })).toBeVisible();
  await expect(page.locator('.chip.on', { hasText: new RegExp(name, 'i') }).first()).toBeVisible();
});

test('slot machine: three reels, real outcome, history', async ({ page }) => {
  await onboard(page);
  await page.goto('/spin');
  await page.getByRole('button', { name: 'Slots' }).click();
  await page.getByTestId('spin-button').first().click();
  await expect(page.getByTestId('spin-result')).toBeVisible({ timeout: 12_000 });
  const reels = await Promise.all([0, 1, 2].map((i) => page.getByTestId(`reel-${i}`).getAttribute('data-result')));
  expect(reels.every(Boolean)).toBe(true);
  const winners = await page.locator('.reel.win').count();
  expect(winners).toBeGreaterThanOrEqual(1);
  await expect(page.locator('.diary-row').first()).toContainText('Slots');
});

test('spin filters: favourites only', async ({ page }) => {
  await onboard(page);
  await page.locator('.pcard .fav-btn').first().click();
  await expect(page.locator('.pcard .fav-btn').first()).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('link', { name: 'Spin' }).click();
  await page.getByRole('button', { name: /Filters/ }).click();
  await page.getByRole('dialog').getByText('Favourites', { exact: true }).click();
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('eligible-count')).toHaveText('1 in the draw');
});

test('layer lab: suggestions, save, rate, mark success', async ({ page }) => {
  await onboard(page);
  await page.goto('/lab');
  await page.locator('.pick-bottle').first().click();
  await page.getByTestId('find-partners').click();
  await acceptConsent(page);
  await expect(page.getByTestId('layer-suggestion').first()).toBeVisible();
  await page.getByTestId('layer-suggestion').first().click();
  await expect(page.getByText('Application order')).toBeVisible();
  await page.getByTestId('save-combo').click();
  await expect(page.getByTestId('notebook-entry')).toHaveCount(1);
  await page.getByTestId('notebook-entry').click();
  await page.getByRole('dialog').getByRole('radio', { name: '5/5' }).click();
  await page.getByRole('dialog').getByRole('button', { name: /Worked for me/ }).click();
  await expect(page.getByRole('dialog').getByRole('button', { name: /Worked for me/ })).toHaveAttribute('aria-pressed', 'true');
  await page.goto('/badges');
  await expect(page.getByTestId('badge-first_layer')).toHaveAttribute('data-unlocked', 'true');
  await expect(page.getByTestId('badge-favorite_combo')).toHaveAttribute('data-unlocked', 'true');
});

test('discover: AI picks stay inside the collection; local fallback when AI fails', async ({ page }) => {
  await onboard(page);
  await page.goto('/discover');
  await page.getByTestId('mood-date_night').click();
  await page.getByTestId('discover-go').click();
  await acceptConsent(page);
  await expect(page.getByTestId('discover-results')).toBeVisible();
  await expect(page.locator('.match')).toHaveCount(2); // the out-of-collection pick was filtered by the server
  await expect(page.getByText('TEST FIXTURE · not real AI')).toBeVisible();

  await page.route('**/api/ai/recommend', (r) => r.fulfill({ status: 500, json: { error: 'internal_error' } }));
  await page.getByTestId('discover-go').click();
  await expect(page.getByText(/The AI hit a snag/)).toBeVisible();
  await expect(page.getByText('Local match · not AI')).toBeVisible();
  await expect(page.locator('.match').first()).toBeVisible();
});

test('export, full reset and import restore the collection', async ({ page }) => {
  await onboard(page);
  await page.goto('/settings');
  const dl = page.waitForEvent('download');
  await page.getByTestId('export').click();
  const file = await (await dl).path();
  await page.getByRole('button', { name: 'Erase everything' }).click();
  await page.getByTestId('erase-input').fill('ERASE');
  await page.getByRole('dialog').getByRole('button', { name: 'Erase everything' }).click();
  await expect(page.getByTestId('onb-start')).toBeVisible();
  await page.getByTestId('onb-start').click();
  for (let i = 0; i < 3; i++) await page.getByTestId('onb-next').click();
  await page.getByTestId('onb-finish').click();
  await page.goto('/settings');
  await page.getByTestId('import-file').setInputFiles(file!);
  await page.getByTestId('restore-replace').click();
  await expect(page.getByText('Restored 16 perfumes.')).toBeVisible();
  await page.goto('/wardrobe');
  await expect(page.locator('.pcard')).toHaveCount(16);
});

test('bottom navigation reaches all five destinations', async ({ page }) => {
  await onboard(page);
  const nav = page.getByRole('navigation', { name: 'Main' });
  await nav.getByRole('link', { name: 'Home' }).click();
  await expect(page.getByTestId('today-card')).toBeVisible();
  await nav.getByRole('link', { name: 'Wardrobe' }).click();
  await expect(page.getByRole('heading', { name: 'My Wardrobe' })).toBeVisible();
  await nav.getByRole('link', { name: 'Spin' }).click();
  await expect(page.getByRole('heading', { name: 'Spin', exact: true })).toBeVisible();
  await nav.getByRole('link', { name: 'Layer Lab' }).click();
  await expect(page.getByRole('heading', { name: 'Layer Lab' })).toBeVisible();
  await nav.getByRole('link', { name: 'Discover' }).click();
  await expect(page.getByRole('heading', { name: 'Discover' })).toBeVisible();
  // no horizontal page scroll at phone width on any main screen
  for (const path of ['/', '/wardrobe', '/spin', '/lab', '/discover', '/settings', '/wardrobe/stats', '/badges']) {
    await page.goto(path);
    await page.waitForTimeout(300);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow, path).toBeLessThanOrEqual(0);
  }
});

test('PWA: manifest, service worker and offline collection', async ({ page, context }) => {
  const manifest = await (await page.request.get('/manifest.webmanifest')).json();
  expect(manifest).toMatchObject({ display: 'standalone', start_url: '/' });
  expect(manifest.icons.some((i: { sizes: string }) => i.sizes === '512x512')).toBe(true);

  await onboard(page);
  await page.waitForFunction(async () => !!(await navigator.serviceWorker.getRegistration())?.active, null, { timeout: 20_000 });
  await page.reload(); // let the SW control the page
  await context.setOffline(true);
  await page.goto('/wardrobe');
  await expect(page.locator('.pcard')).toHaveCount(16);
  await expect(page.getByText(/You are offline/)).toBeVisible();
  await page.goto('/spin');
  await page.getByTestId('spin-button').click();
  await expect(page.getByTestId('spin-result')).toBeVisible({ timeout: 12_000 });
  await context.setOffline(false);
});
