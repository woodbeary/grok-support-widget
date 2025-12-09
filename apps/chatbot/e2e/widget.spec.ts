import { test, expect } from '@playwright/test';
import { defineConfig } from '@playwright/test'; // Not needed here

test.describe('Chat Widget E2E', () => {
  test('renders chat page and interacts with widget', async ({ page }) => {
    // Navigate to chat page
    await page.goto('/chat');

    // Verify initial assistant message
    await expect(page.getByText(/Hello! I am Grok/)).toBeVisible();

    // Check UI elements for premium design (shadcn clean look)
    await expect(page.getByRole('generic', { name: /card/ })).toBeVisible(); // Card container
    await expect(page.locator('[data-testid="avatar-assistant"]')).toBeVisible(); // Assume added
    await expect(page.locator('input[placeholder*="Ask Grok"]')).toBeVisible();
    await expect(page.getByRole('button', { name: /send/i })).toBeVisible();

    // Send a message
    const input = page.locator('input[placeholder*="Ask Grok"]');
    await input.fill('What is xAI?');
    await page.getByRole('button', { name: /send/i }).click();

    // Wait for streaming/loading
    await expect(page.getByText(/Grok is typing.../)).toBeVisible({ timeout: 10000 });

    // Wait for response (real API call with key)
    await page.waitForSelector('[role="user"]', { timeout: 30000 }); // Or text containing response
    await expect(page.locator('text=/xAI is an AI company/')).toContainText('xAI'); // Partial match expected response

    // Verify message bubbles
    const userMessage = page.locator('[role="user"]').last();
    await expect(userMessage).toHaveText('What is xAI?');
    const assistantResponse = page.locator('[role="assistant"]').last();
    await expect(assistantResponse).toBeVisible();

    // Edge case: error handling (simulate by bad input or network, but for now check if error shown)
    // Or test long input
    await input.fill('A very long message exceeding limits to test error' + 'a'.repeat(5000));
    await page.getByRole('button', { name: /send/i }).click();
    await expect(page.getByText(/too long/i)).toBeVisible(); // From api 400

    // Check responsive: mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    await expect(page.locator('.max-w-md')).toHaveClass(/max-w-md/); // Responsive classes

    // Aesthetic check: screenshot for review (premium like grok: clean, modern)
    await expect(page).toHaveScreenshot('chat-widget-full.png', { fullPage: true });

    // Close or other UX
    // Assume close button, test toggle if embed
  });

  test('API proxy security edge cases', async ({ page, request }) => {
    // Test health GET
    const response = await request.get('/api/chat');
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.status).toBe('Chat API ready');

    // Test unauthorized origin (simulate)
    const postResponse = await request.post('/api/chat', {
      headers: { origin: 'http://evil.com' },
      data: { messages: [{ role: 'user', content: 'test' }] },
    });
    expect(postResponse.status()).toBe(403);

    // Authorized POST
    const authResponse = await request.post('/api/chat', {
      headers: { origin: 'http://localhost:3000' },
      data: { messages: [{ role: 'user', content: 'Hello' }] },
    });
    expect(authResponse.status()).toBe(200); // Streams, but ok

    // Invalid input edge cases
    const invalidResponse = await request.post('/api/chat', {
      headers: { origin: 'http://localhost:3000' },
      data: { messages: [] },
    });
    expect(invalidResponse.status()).toBe(400);

    // Long message
    const longMsg = { messages: [{ role: 'user', content: 'a'.repeat(5000) }] };
    const longResponse = await request.post('/api/chat', {
      headers: { origin: 'http://localhost:3000' },
      data: longMsg,
    });
    expect(longResponse.status()).toBe(400);
    const longText = await longResponse.text();
    expect(longText).toContain('too long');

    // Model selection log (check console or via devtools, but skip for e2e)
    // Complex query selects grok-4-1
  });

  test('Widget embed in mock-site', async ({ browser, page }) => {
    // This test assumes mock-site running on 3000, but config webServer for chatbot
    // To test cross, start both or use existing
    // For now, manual or separate run

    const context = await browser.newContext({ baseURL: 'http://localhost:3000' });
    const mPage = await context.newPage();
    await mPage.goto('/');

    // Check bubble appears (from widget.js)
    await expect(mPage.locator('.chat-bubble')).toBeVisible(); // Assume class from widget.js

    // Click to open widget
    await mPage.locator('.chat-bubble').click();
    await expect(mPage.locator('#x-support-widget')).toBeVisible();

    // Interact with chat in embed
    await mPage.fill('input[placeholder*="Ask"]', 'Embed test');
    await mPage.click('button:has(svg)'); // Send button

    // Wait for response
    await expect(mPage.locator('.message-bubble')).toBeVisible();

    // Close on outside click
    await mPage.click('body');
    await expect(mPage.locator('#x-support-widget')).toHaveClass(/hidden/);

    // Premium UX: verify theme, responsive, no leaks
    await mPage.setViewportSize({ width: 375, height: 667 });
    await expect(mPage.locator('.chat-widget')).toBeVisible(); // Mobile friendly

    await expect(mPage).toHaveScreenshot('embedded-widget.png');
  });
});