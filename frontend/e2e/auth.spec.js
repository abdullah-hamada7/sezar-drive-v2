/* global process */
import { test, expect } from '@playwright/test';

test.describe('Fleet Management E2E', () => {
  const adminEmail = process.env.E2E_ADMIN_EMAIL;
  const adminPassword = process.env.E2E_ADMIN_PASSWORD;
  const driverEmail = `e2e.driver.${Date.now()}@fleet.com`;
  const driverPassword = 'Password123!';
  const newDriverPassword = 'NewPass123!@';

  test.skip(!adminEmail || !adminPassword, 'Set E2E_ADMIN_EMAIL and E2E_ADMIN_PASSWORD to run this test');

  test('Complete Admin & Driver Flow', async ({ page }) => {
    // 1. Admin Login
    await page.goto('http://localhost:5173');
    await page.fill('input[name="email"]', adminEmail);
    await page.fill('input[name="password"]', adminPassword);
    await page.click('button[type="submit"]');

    // Verify Admin Dashboard
    await expect(page.getByText('Fleet operations overview')).toBeVisible({ timeout: 10000 });

    // 2. Create Driver
    await page.click('a[href="/admin/drivers"]');
    await page.click('button:has-text("Add Driver")');
    await page.fill('input[name="name"]', 'E2E Driver');
    await page.fill('input[name="email"]', driverEmail);
    await page.fill('input[name="phone"]', `+201${Date.now().toString().slice(-8)}`);
    await page.fill('input[name="licenseNumber"]', `DL-${Date.now()}`);
    await page.fill('input[name="password"]', driverPassword);
    await page.click('button:has-text("Create Driver")');
    // Wait for modal to close and name to appear in table
    // Wait for modal to close and name to appear in table
    await expect(page.locator('.modal')).toBeHidden();
    await expect(page.getByText('E2E Driver').first()).toBeVisible();

    // 3. Create Vehicle
    await page.click('a[href="/admin/vehicles"]');
    await page.click('button:has-text("Add Vehicle")');
    const plateNumber = `E2E-${Date.now().toString().slice(-4)}`;
    await page.fill('input[name="plateNumber"]', plateNumber);
    await page.fill('input[name="model"]', 'Test Camry');
    await page.fill('input[name="year"]', '2024');
    await page.fill('input[name="capacity"]', '4');
    await page.fill('input[name="qrCode"]', `VH-${Date.now()}`);
    await page.click('button:has-text("Create Vehicle")');

    // Wait for modal to close and plate to appear
    await expect(page.locator('.modal')).toBeHidden();
    await expect(page.getByText(plateNumber)).toBeVisible();

    // 4. Logout Admin
    // 4. Logout Admin
    await page.getByRole('button', { name: 'Logout' }).click();
    await expect(page.getByRole('heading', { name: 'Sezar Drive', exact: true })).toBeVisible();

    // 5. Driver Login (Force Password Change)
    await page.fill('input[name="email"]', driverEmail);
    await page.fill('input[name="password"]', driverPassword);
    await page.click('button:has-text("Sign In")');

    // Verify Password Change Page
    await expect(page.getByRole('heading', { name: 'Change Password' })).toBeVisible();
    await page.fill('input[name="currentPassword"]', driverPassword);
    await page.fill('input[name="newPassword"]', newDriverPassword);
    await page.fill('input[name="confirmPassword"]', newDriverPassword);
    await page.click('button:has-text("Change Password")');

    // 6. Login with New Password
    // Wait for redirect to driver dashboard
    await expect(page).toHaveURL(/\/driver/, { timeout: 10000 });

    // 7. Verify Driver Dashboard & Upload Identity
    // Check for Identity Verification Alert
    await expect(page.getByText('Identity verification required')).toBeVisible();

    // Upload Photo
    // Handle the upload success alert
    const uploadDialogPromise = page.waitForEvent('dialog');
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles('e2e/fixtures/photo.jpg');

    // Wait for upload success alert
    const uploadDialog = await uploadDialogPromise;
    console.log(`UPLOAD DIALOG: ${uploadDialog.message()}`);
    await uploadDialog.accept();

    // Wait for reload
    await page.waitForURL(/\/driver/);
    await expect(page.getByText('Identity verification pending')).toBeVisible({ timeout: 10000 });

    // 8. Admin Approves Identity
    await page.getByRole('button', { name: 'Logout' }).click(); // Driver Logout

    // Admin Login
    await page.fill('input[name="email"]', adminEmail);
    await page.fill('input[name="password"]', adminPassword);
    await page.click('button:has-text("Sign In")');

    // Verify pending badge
    await page.click('a[href="/admin/drivers"]');
    const driverRow = page.getByRole('row').filter({ hasText: driverEmail });
    await expect(driverRow.getByRole('button', { name: 'Verify Identity' })).toBeVisible();

    // Verify badge changes to Verified
    page.on('console', msg => console.log(`BROWSER CONSOLE: ${msg.text()}`));
    page.on('request', request => console.log(`>> ${request.method()} ${request.url()}`));
    page.on('response', response => console.log(`<< ${response.status()} ${response.url()}`));

    // Click Verify
    page.on('dialog', dialog => {
      console.log(`DIALOG: ${dialog.message()}`);
      dialog.accept();
    });
    await driverRow.getByRole('button', { name: 'Verify Identity' }).click();

    // Verify badge changes to Verified
    await expect(driverRow.getByRole('button', { name: 'Verify Identity' })).not.toBeVisible({ timeout: 15000 });
    await expect(driverRow.getByText('Verified', { exact: false })).toBeVisible({ timeout: 10000 });

    // 9. Driver Checks Verification
    await page.getByRole('button', { name: 'Logout' }).click(); // Admin Logout

    // Driver Login
    await page.fill('input[name="email"]', driverEmail);
    await page.fill('input[name="password"]', newDriverPassword);
    await page.click('button:has-text("Sign In")');

    // Verification Alert should be GONE
    await expect(page.getByText('Identity verification required')).not.toBeVisible();

    // 10. Start Shift
    // Only possible if verified. 
    // Dashboard should have "Start your shift" card.
    await page.click('text=Start your shift');

    // Should navigate to /driver/shift
    await expect(page).toHaveURL(/\/driver\/shift/);

    // Create Shift
    await page.click('button:has-text("Start Shift")');

    // Scan QR (Mocked? Or manual entry?)
    // Shift page likely asks for vehicle text if QR camera not avail.
    // We need to check Shift.jsx

  });
});
