import { expect, test } from '@playwright/test';

// Use a fixed fixture catalogue so the test doesn't depend on research data.
test.use({ serviceWorkers: 'block' });

const fixture = {
  v: 1,
  built: '2026-11-14',
  brands: ['Electimuss'],
  items: [
    {
      b: 'Electimuss',
      n: 'Mercurial Cashmere',
      c: 'Pure Parfum',
      y: null,
      p: null,
      f: 'Woody Floral Musk',
      a: [],
      t: { top: ['bergamot'], heart: ['rose'], base: ['cashmere musk'], flat: [] },
      ns: 'official',
      col: null,
      s: [{ u: 'https://www.electimuss.com/products/mercurial-cashmere', n: 'Electimuss — Mercurial Cashmere', t: 'official', f: ['notes', 'family', 'concentration'] }],
      r: '2026-11-14',
    },
  ],
};

test('catalogue: offline suggestion fills a sourced profile, without AI', async ({ page }) => {
  await page.route('**/catalog/index.json', (r) => r.fulfill({ json: fixture }));
  await page.route('**/api/health', (r) => r.fulfill({ json: { ok: true, ai: { configured: false, provider: 'none', model: null, webResearch: false }, weather: { provider: 'x' }, version: '1' } }));
  await page.route('https://api.open-meteo.com/**', (r) => r.fulfill({ json: { current: { temperature_2m: 20, apparent_temperature: 20, relative_humidity_2m: 50, precipitation: 0, weather_code: 0, wind_speed_10m: 5, is_day: 1 } } }));
  await page.goto('/');
  await page.getByTestId('onb-start').click();
  for (let i = 0; i < 3; i++) await page.getByTestId('onb-next').click();
  await page.getByTestId('onb-finish').click();
  await page.goto('/wardrobe/new');
  await page.locator('#q').fill('mercur');
  await expect(page.getByTestId('catalog-match')).toHaveCount(1);
  await page.getByTestId('catalog-match').click();
  await expect(page.getByText('Catalogue · from researched sources, not AI').first()).toBeVisible();
  await page.getByTestId('save-perfume').click();
  await page.getByRole('button', { name: 'Full profile' }).click();
  await expect(page.getByRole('heading', { name: 'Mercurial Cashmere' })).toBeVisible();
  await expect(page.getByText('Verified').first()).toBeVisible();
  await expect(page.getByText('bergamot')).toBeVisible();
  await page.getByRole('button', { name: /Sources \(1\)/ }).click();
  await expect(page.getByRole('link', { name: 'Electimuss — Mercurial Cashmere' })).toHaveAttribute('href', /electimuss\.com/);
});
