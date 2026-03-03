const { chromium } = require('playwright');

/**
 * Performance Audit Script
 * Measures Core Web Vitals and Page Load metrics.
 */
async function runAudit() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  console.log('--- Performance Audit Started ---');

  // Start performance measurement
  await page.goto('http://localhost:5173/login');
  
  // Simple login flow to reach dashboard
  const adminEmail = process.env.PERF_ADMIN_EMAIL || process.env.ADMIN_EMAIL;
  const adminPassword = process.env.PERF_ADMIN_PASSWORD || process.env.ADMIN_PASSWORD;
  if (!adminEmail || !adminPassword) {
    throw new Error('Missing PERF_ADMIN_EMAIL/PERF_ADMIN_PASSWORD (or ADMIN_EMAIL/ADMIN_PASSWORD)');
  }
  await page.fill('input[type="email"]', adminEmail);
  await page.fill('input[type="password"]', adminPassword);
  await page.click('button[type="submit"]');
  
  await page.waitForURL('**/admin');
  console.log('Logged in, navigating to Dashboard...');

  // Measure Dashboard Load
  const startTime = Date.now();
  await page.goto('http://localhost:5173/admin');
  await page.waitForLoadState('networkidle');
  const loadTime = Date.now() - startTime;

  // Extract Web Vitals
  const metrics = await page.evaluate(() => {
    return new Promise((resolve) => {
      let lcp = 0;
      let cls = 0;
      
      new PerformanceObserver((entryList) => {
        const entries = entryList.getEntries();
        lcp = entries[entries.length - 1].startTime;
      }).observe({ type: 'largest-contentful-paint', buffered: true });

      new PerformanceObserver((entryList) => {
        for (const entry of entryList.getEntries()) {
          if (!entry.hadRecentInput) {
            cls += entry.value;
          }
        }
      }).observe({ type: 'layout-shift', buffered: true });

      // Wait a bit to capture metrics
      setTimeout(() => {
        resolve({
          lcp: lcp.toFixed(2),
          cls: cls.toFixed(4),
          tti: performance.now().toFixed(2)
        });
      }, 3000);
    });
  });

  console.log('\n--- Results ---');
  console.log(`Initial Load Time: ${loadTime}ms`);
  console.log(`Largest Contentful Paint (LCP): ${metrics.lcp}ms`);
  console.log(`Cumulative Layout Shift (CLS): ${metrics.cls}`);
  console.log(`Time to Interactive (TTI): ${metrics.tti}ms`);
  
  if (metrics.lcp < 2500) console.log('✅ LCP is within healthy range (< 2.5s)');
  else console.log('❌ LCP is slow (> 2.5s)');

  if (metrics.cls < 0.1) console.log('✅ CLS is within healthy range (< 0.1)');
  else console.log('❌ CLS is high (> 0.1)');

  await browser.close();
}

runAudit().catch(console.error);
