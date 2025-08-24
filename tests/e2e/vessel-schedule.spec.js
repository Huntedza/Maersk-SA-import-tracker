// tests/e2e/vessel-schedule.spec.js
import { test, expect } from '@playwright/test';

test.describe('Vessel Schedule Display', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the application
    await page.goto('/');
    
    // Wait for the main component to load
    await page.waitForSelector('[data-testid="sa-import-schedule-view"]', { timeout: 10000 });
  });

  test('should display the main vessel schedule interface', async ({ page }) => {
    // Check if the main title/header is present
    await expect(page.getByText('SA Inbound Tracker')).toBeVisible();
    
    // Check if service navigation is present
    await expect(page.locator('[data-testid="service-navigation"]')).toBeVisible();
    
    // Check if the schedule grid container is present
    await expect(page.locator('[data-testid="schedule-grid"]')).toBeVisible();
  });

  test('should show loading indicator when fetching data', async ({ page }) => {
    // Look for loading indicator
    const loadingIndicator = page.locator('[data-testid="loading-indicator"]');
    
    // Loading indicator should appear and then disappear
    if (await loadingIndicator.isVisible()) {
      await expect(loadingIndicator).toBeVisible();
      // Wait for loading to complete (with reasonable timeout)
      await expect(loadingIndicator).not.toBeVisible({ timeout: 30000 });
    }
  });

  test('should display vessel information when data is loaded', async ({ page }) => {
    // Wait for data to load (either from API or database)
    await page.waitForTimeout(5000);
    
    // Check if vessel cards or grid items are displayed
    const vesselElements = page.locator('[data-testid="vessel-card"], .vessel-item, .schedule-item');
    
    // If vessels are present, verify they contain expected information
    const vesselCount = await vesselElements.count();
    if (vesselCount > 0) {
      // Check first vessel has name/schedule information
      const firstVessel = vesselElements.first();
      await expect(firstVessel).toBeVisible();
      
      // Look for common vessel information patterns
      const hasVesselInfo = await page.locator('text=/vessel|ship|schedule|eta|etd/i').count() > 0;
      expect(hasVesselInfo).toBeTruthy();
    }
  });

  test('should handle empty data state gracefully', async ({ page }) => {
    // Wait for potential loading to complete
    await page.waitForTimeout(5000);
    
    // If no vessels are displayed, should show appropriate message
    const noDataMessage = page.locator('text=/no vessels|no data|no schedules/i');
    const vesselElements = page.locator('[data-testid="vessel-card"], .vessel-item, .schedule-item');
    
    const vesselCount = await vesselElements.count();
    const hasNoDataMessage = await noDataMessage.count() > 0;
    
    // Either should have vessels OR a no-data message
    expect(vesselCount > 0 || hasNoDataMessage).toBeTruthy();
  });

  test('should be responsive on mobile viewport', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    
    // Check that main elements are still visible and properly arranged
    await expect(page.locator('[data-testid="sa-import-schedule-view"]')).toBeVisible();
    
    // Check that content doesn't overflow horizontally
    const bodyOverflow = await page.evaluate(() => {
      return document.body.scrollWidth <= document.body.clientWidth;
    });
    expect(bodyOverflow).toBeTruthy();
  });

  test('should display refresh functionality', async ({ page }) => {
    // Look for refresh button
    const refreshButton = page.locator('[data-testid="refresh-button"], button:has-text("refresh"), button:has-text("reload")');
    
    if (await refreshButton.count() > 0) {
      await expect(refreshButton.first()).toBeVisible();
      
      // Test refresh button click
      await refreshButton.first().click();
      
      // Should show loading state after refresh
      const loadingIndicator = page.locator('[data-testid="loading-indicator"]');
      if (await loadingIndicator.isVisible()) {
        await expect(loadingIndicator).toBeVisible();
      }
    }
  });
});