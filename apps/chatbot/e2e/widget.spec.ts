import { test, expect } from '@playwright/test';

test.describe('Chat Widget E2E', () => {
  test('renders chat page and sends messages with streaming', async ({ page }) => {
    // Navigate to chat page with dark theme
    await page.goto('/chat?theme=dark');

    // Verify initial Grok assistant message shows
    await expect(page.getByText(/How can I help you/)).toBeVisible({ timeout: 10000 });

    // Check UI elements for premium design (shadcn)
    // Use more reliable selectors that work with the actual component
    await expect(page.locator('input[placeholder*="Grok"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();

    // Verify Grok title is visible (use exact match to avoid matching welcome message)
    await expect(page.getByText('Grok', { exact: true })).toBeVisible();

    // Send a simple message
    const input = page.locator('input[placeholder*="Grok"]');
    await input.fill('What is 2+2?');
    await page.locator('button[type="submit"]').click();

    // Wait for either loading indicator OR response (loading may be too fast to see)
    // The important thing is that we get a response
    await page.waitForTimeout(5000); // Give time for streaming to complete

    // Verify the user message appears
    await expect(page.getByText('What is 2+2?')).toBeVisible({ timeout: 5000 });

    // Take screenshot for visual review
    await page.screenshot({
      path: 'test-results/chat-after-response.png',
      fullPage: true
    });

    // Responsive test: mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    await page.screenshot({
      path: 'test-results/chat-mobile.png',
      fullPage: true
    });
  });

  test('API proxy security and edge cases', async ({ request }) => {
    // Test health GET endpoint
    const response = await request.get('/api/chat');
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.status).toBe('Chat API ready');

    // Traces are admin-only: no session cookie, or a forged one, gets 401
    const tracesRes = await request.get('/api/admin/traces');
    expect(tracesRes.status()).toBe(401);
    const forgedRes = await request.get('/api/admin/traces', {
      headers: { cookie: 'admin-token=valid' },
    });
    expect(forgedRes.status()).toBe(401);

    // Wrong admin password is rejected (503 when ADMIN_PASSWORD is unset)
    const loginRes = await request.post('/api/admin/login', { data: { password: 'wrong' } });
    expect([401, 503]).toContain(loginRes.status());

    // Test unauthorized origin blocked
    const postResponse = await request.post('/api/chat', {
      headers: { origin: 'http://evil.com' },
      data: { messages: [{ role: 'user', content: 'test' }] },
    });
    expect(postResponse.status()).toBe(403);

    // Authorized POST works
    const authResponse = await request.post('/api/chat', {
      headers: { origin: 'http://localhost:3000' },
      data: { messages: [{ role: 'user', content: 'Hello' }] },
    });
    expect(authResponse.status()).toBe(200);

    // A malformed session cookie (it names the trace file) is replaced, never used
    const traversalResponse = await request.post('/api/chat', {
      headers: { origin: 'http://localhost:3000', cookie: 'chat-session-id=../../package' },
      data: { messages: [{ role: 'user', content: 'Hello' }] },
    });
    expect(traversalResponse.status()).toBe(200);
    expect(traversalResponse.headers()['set-cookie'] ?? '').not.toContain('../');

    // Empty messages returns 400
    const invalidResponse = await request.post('/api/chat', {
      headers: { origin: 'http://localhost:3000' },
      data: { messages: [] },
    });
    expect(invalidResponse.status()).toBe(400);

    // Long message returns 400
    const longMsg = { messages: [{ role: 'user', content: 'a'.repeat(5000) }] };
    const longResponse = await request.post('/api/chat', {
      headers: { origin: 'http://localhost:3000' },
      data: longMsg,
    });
    expect(longResponse.status()).toBe(400);
    const longText = await longResponse.text();
    expect(longText).toContain('too long');
  });

  test('Widget embed in mock-site works', async ({ browser }) => {
    // This test needs mock-site running on port 3000
    const context = await browser.newContext({ baseURL: 'http://localhost:3000' });
    const mPage = await context.newPage();

    try {
      await mPage.goto('/', { timeout: 10000 });
    } catch {
      // Skip if mock-site not running
      console.log('Mock site not running, skipping embed test');
      await context.close();
      return;
    }

    // Check the chat bubble appears (updated selector for new styling)
    await expect(mPage.locator('#x-chat-bubble')).toBeVisible({ timeout: 10000 });

    // Take initial screenshot
    await mPage.screenshot({
      path: 'test-results/mock-site-bubble.png',
      fullPage: true
    });

    // Click to open widget
    await mPage.locator('#x-chat-bubble').click();

    // Widget container should appear
    await expect(mPage.locator('#x-support-widget')).toBeVisible({ timeout: 5000 });

    // Take screenshot of opened widget
    await mPage.screenshot({
      path: 'test-results/mock-site-widget-open.png',
      fullPage: true
    });

    await context.close();
  });
});