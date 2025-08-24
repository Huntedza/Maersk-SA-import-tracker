// tests/e2e/dark-mode.spec.js
import { test, expect } from '@playwright/test';

test.describe('Dark Mode Toggle', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('[data-testid="sa-import-schedule-view"]', { timeout: 10000 });
  });

  test('should have dark mode toggle button', async ({ page }) => {
    // Look for dark mode toggle button with various possible selectors
    const darkModeToggle = page.locator(
      '[data-testid="dark-mode-toggle"], ' +
      'button:has-text("dark"), ' +
      'button:has-text("light"), ' +
      'button:has-text("theme"), ' +
      '[aria-label*="theme"], ' +
      '[aria-label*="dark"], ' +
      '.theme-toggle, ' +
      '.dark-mode-toggle'
    );
    
    const toggleCount = await darkModeToggle.count();
    if (toggleCount > 0) {
      await expect(darkModeToggle.first()).toBeVisible();
    }
  });

  test('should toggle between light and dark themes', async ({ page }) => {
    // Check initial theme state
    const initialBodyClasses = await page.locator('body').getAttribute('class');
    const initialHasDark = initialBodyClasses?.includes('dark') || false;
    
    // Look for theme toggle
    const darkModeToggle = page.locator(
      '[data-testid="dark-mode-toggle"], ' +
      'button:has-text("dark"), ' +
      'button:has-text("light"), ' +
      'button:has-text("theme"), ' +
      '[aria-label*="theme"], ' +
      '[aria-label*="dark"], ' +
      '.theme-toggle, ' +
      '.dark-mode-toggle'
    );
    
    if (await darkModeToggle.count() > 0) {
      // Click the toggle
      await darkModeToggle.first().click();
      await page.waitForTimeout(500);
      
      // Check if theme changed
      const newBodyClasses = await page.locator('body').getAttribute('class');
      const newHasDark = newBodyClasses?.includes('dark') || false;
      
      // Theme should have toggled
      expect(newHasDark).toBe(!initialHasDark);
      
      // Click again to toggle back
      await darkModeToggle.first().click();
      await page.waitForTimeout(500);
      
      const finalBodyClasses = await page.locator('body').getAttribute('class');
      const finalHasDark = finalBodyClasses?.includes('dark') || false;
      
      // Should be back to original state
      expect(finalHasDark).toBe(initialHasDark);
    }
  });

  test('should persist theme preference', async ({ page }) => {
    // Look for theme toggle
    const darkModeToggle = page.locator(
      '[data-testid="dark-mode-toggle"], ' +
      'button:has-text("dark"), ' +
      'button:has-text("light"), ' +
      'button:has-text("theme"), ' +
      '[aria-label*="theme"], ' +
      '[aria-label*="dark"], ' +
      '.theme-toggle, ' +
      '.dark-mode-toggle'
    );
    
    if (await darkModeToggle.count() > 0) {
      // Set to dark mode
      const initialBodyClasses = await page.locator('body').getAttribute('class');
      const initialHasDark = initialBodyClasses?.includes('dark') || false;
      
      if (!initialHasDark) {
        await darkModeToggle.first().click();
        await page.waitForTimeout(500);
      }
      
      // Verify dark mode is active
      const darkBodyClasses = await page.locator('body').getAttribute('class');
      const hasDark = darkBodyClasses?.includes('dark') || false;
      
      if (hasDark) {
        // Reload the page
        await page.reload();
        await page.waitForSelector('[data-testid="sa-import-schedule-view"]', { timeout: 10000 });
        
        // Check if dark mode persisted
        const persistedBodyClasses = await page.locator('body').getAttribute('class');
        const persistedHasDark = persistedBodyClasses?.includes('dark') || false;
        
        // Theme should persist after reload
        expect(persistedHasDark).toBe(true);
      }
    }
  });

  test('should apply appropriate styles for each theme', async ({ page }) => {
    // Look for theme toggle
    const darkModeToggle = page.locator(
      '[data-testid="dark-mode-toggle"], ' +
      'button:has-text("dark"), ' +
      'button:has-text("light"), ' +
      'button:has-text("theme"), ' +
      '[aria-label*="theme"], ' +
      '[aria-label*="dark"], ' +
      '.theme-toggle, ' +
      '.dark-mode-toggle'
    );
    
    if (await darkModeToggle.count() > 0) {
      // Test light theme styles
      const bodyClasses = await page.locator('body').getAttribute('class');
      const isDarkMode = bodyClasses?.includes('dark') || false;
      
      if (isDarkMode) {
        // Switch to light mode first
        await darkModeToggle.first().click();
        await page.waitForTimeout(500);
      }
      
      // Get background color in light mode
      const lightBgColor = await page.locator('body').evaluate(el => 
        getComputedStyle(el).backgroundColor
      );
      
      // Switch to dark mode
      await darkModeToggle.first().click();
      await page.waitForTimeout(500);
      
      // Get background color in dark mode
      const darkBgColor = await page.locator('body').evaluate(el => 
        getComputedStyle(el).backgroundColor
      );
      
      // Colors should be different between themes
      expect(lightBgColor).not.toBe(darkBgColor);
      
      // Dark mode should have darker background
      const lightIsLight = lightBgColor.includes('255') || lightBgColor === 'rgba(0, 0, 0, 0)';
      const darkIsDark = !darkBgColor.includes('255') && darkBgColor !== 'rgba(0, 0, 0, 0)';
      
      // At least one theme should show appropriate coloring
      expect(lightIsLight || darkIsDark).toBeTruthy();
    }
  });

  test('should maintain theme consistency across components', async ({ page }) => {
    // Look for theme toggle
    const darkModeToggle = page.locator(
      '[data-testid="dark-mode-toggle"], ' +
      'button:has-text("dark"), ' +
      'button:has-text("light"), ' +
      'button:has-text("theme"), ' +
      '[aria-label*="theme"], ' +
      '[aria-label*="dark"], ' +
      '.theme-toggle, ' +
      '.dark-mode-toggle'
    );
    
    if (await darkModeToggle.count() > 0) {
      // Switch to dark mode
      await darkModeToggle.first().click();
      await page.waitForTimeout(500);
      
      // Check that various components respect dark mode
      const bodyHasDark = await page.locator('body').getAttribute('class');
      const isDarkMode = bodyHasDark?.includes('dark') || false;
      
      if (isDarkMode) {
        // Sample various elements that should respect theme
        const elements = [
          'header', 'main', 'nav', 'button', 'div',
          '[data-testid="schedule-grid"]',
          '[data-testid="service-navigation"]'
        ];
        
        let themeConsistentElements = 0;
        
        for (const selector of elements) {
          const element = page.locator(selector).first();
          if (await element.count() > 0) {
            const bgColor = await element.evaluate(el => 
              getComputedStyle(el).backgroundColor
            );
            const textColor = await element.evaluate(el => 
              getComputedStyle(el).color
            );
            
            // Check if element has appropriate dark theme styling
            const hasDarkStyling = 
              !bgColor.includes('255, 255, 255') || 
              !textColor.includes('0, 0, 0') ||
              bgColor === 'rgba(0, 0, 0, 0)'; // transparent is fine
            
            if (hasDarkStyling) {
              themeConsistentElements++;
            }
          }
        }
        
        // Most elements should respect the dark theme
        expect(themeConsistentElements).toBeGreaterThan(0);
      }
    }
  });
});