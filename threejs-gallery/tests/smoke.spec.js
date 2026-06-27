import { test, expect } from '@playwright/test';

/**
 * Smoke tests: the app must boot with no console errors, render a non-empty
 * WebGL canvas, expose the debug overlay, and actually move the camera when the
 * page is scrolled.
 */

test('boots without console errors and renders the canvas', async ({ page }) => {
  const errors = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  page.on('pageerror', (err) => errors.push(err.message));

  await page.goto('/');

  const canvas = page.locator('#scene');
  await expect(canvas).toBeVisible();

  // Canvas should fill the viewport.
  const box = await canvas.boundingBox();
  expect(box.width).toBeGreaterThan(0);
  expect(box.height).toBeGreaterThan(0);

  // Give the render loop a moment, then assert the WebGL context is alive.
  await page.waitForTimeout(500);
  const hasGL = await page.evaluate(() => {
    const c = document.getElementById('scene');
    return !!(c.getContext('webgl2') || c.getContext('webgl'));
  });
  expect(hasGL).toBe(true);

  expect(errors, `console errors:\n${errors.join('\n')}`).toEqual([]);
});

test('debug overlay reports scroll progress and camera moves on scroll', async ({ page }) => {
  await page.goto('/');
  const debug = page.locator('#debug');
  await expect(debug).toContainText('scroll');
  await expect(debug).toContainText('cam.z');

  // Read camera Z at top of page.
  await page.waitForTimeout(400);
  const topText = await debug.textContent();
  const topZ = parseFloat(topText.match(/cam\.z\s+([-\d.]+)/)[1]);

  // Scroll to the bottom and let the smoothed camera catch up.
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(1500);

  const bottomText = await debug.textContent();
  const bottomZ = parseFloat(bottomText.match(/cam\.z\s+([-\d.]+)/)[1]);

  // Camera travels along -Z, so bottom Z must be meaningfully smaller.
  expect(bottomZ).toBeLessThan(topZ - 5);
});
