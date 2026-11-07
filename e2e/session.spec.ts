import { expect, test, type Page } from '@playwright/test';

// Real Chromium, phone-sized, against the production build: taps, swipes, keyboard, and
// progress that survives a reload (real IndexedDB).
test.use({ viewport: { width: 390, height: 844 } });

const card = (page: Page) => page.getByTestId('flashcard');

const swipe = async (page: Page, direction: 'right' | 'left') => {
  const box = (await card(page).boundingBox())!;
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + (direction === 'right' ? 160 : -160), y, {
    steps: 12,
  });
  await page.mouse.up();
};

/** Setup: Complete deck, Time + dates only (7 cards). */
const startTimeAndDates = async (page: Page) => {
  await page.goto('/swahili/');
  await page.getByRole('radio', { name: 'Complete deck' }).check();
  await page.getByLabel(/^Numbers/).uncheck();
  await expect(page.getByRole('button', { name: /^Start/ })).toHaveText(
    'Start · 7 cards'
  );
  await page.getByRole('button', { name: /^Start/ }).click();
};

test('the setup screen fits a phone: no sideways scrolling', async ({
  page,
}) => {
  await page.goto('/swahili/');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth
  );
  expect(overflow).toBeLessThanOrEqual(0);
});

test('a whole Complete deck run with taps and swipes, then progress survives a reload', async ({
  page,
}) => {
  await startTimeAndDates(page);

  for (let i = 0; i < 7; i++) {
    await expect(page.getByText(`${i}/7`)).toBeVisible();
    // A swipe must never flip the card that replaces it.
    await expect(
      page.getByRole('button', { name: 'Show answer' })
    ).toBeVisible();
    await card(page).click(); // tap the card to see the answer
    await expect(page.getByRole('button', { name: 'Got it' })).toBeVisible();
    await swipe(page, 'right');
  }

  await expect(page.getByRole('heading', { name: /Hongera!/ })).toBeVisible();
  await page.getByRole('button', { name: 'Done' }).click();
  await expect(
    page.getByRole('heading', { name: /Kadi za Kiswahili/ })
  ).toBeVisible();

  // Reload: the choices were remembered and every card is now learned, so Practice has nothing due.
  await page.reload();
  await page.getByRole('radio', { name: 'Practice' }).check();
  await expect(page.getByText(/Nothing due right now/)).toBeVisible();
  await expect(page.getByRole('button', { name: /^Start/ })).toBeDisabled();
});

test('swiping left is "Missed it", and the card comes back', async ({
  page,
}) => {
  await startTimeAndDates(page);
  await card(page).click();
  const missed = await card(page).locator('.flashcard-prompt').textContent();
  await swipe(page, 'left');
  await expect(page.getByText('0/7')).toBeVisible();

  // With 7 cards and an offset of 3–5, it reappears within the next 6.
  const seen: string[] = [];
  for (let i = 0; i < 6 && !seen.includes(missed!); i++) {
    seen.push((await card(page).locator('.flashcard-prompt').textContent())!);
    if (seen.at(-1) === missed) break;
    await page.keyboard.press(' ');
    await page.keyboard.press('ArrowRight');
  }
  expect(seen).toContain(missed);
});

test('a short drag springs back without marking', async ({ page }) => {
  await startTimeAndDates(page);
  await card(page).click();
  const box = (await card(page).boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 40, box.y + box.height / 2, {
    steps: 5,
  });
  await page.mouse.up();
  await expect(page.getByText('0/7')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Got it' })).toBeVisible();
});

test('leaving mid-run with the Back button returns to setup and offers to resume', async ({
  page,
}) => {
  await startTimeAndDates(page);
  await page.keyboard.press(' ');
  await page.keyboard.press('ArrowRight');
  await expect(page.getByText('1/7')).toBeVisible();

  await page.goBack();
  await expect(
    page.getByRole('heading', { name: /Kadi za Kiswahili/ })
  ).toBeVisible();
  await page.getByRole('button', { name: 'Resume (1/7)' }).click();
  await expect(page.getByText('1/7')).toBeVisible();
});
