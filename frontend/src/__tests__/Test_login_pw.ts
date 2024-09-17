// const { chromium } = require('playwright');

// (async () => {
//     // Launch the browser in headless mode
//     const browser = await chromium.launch({ headless: true });
//     const page = await browser.newPage();

//     try {
//         // Log navigation start
//         console.log('Navigating to the login page...');

//         // Navigate to the login page with increased timeout and network idle wait
//         await page.goto('https://tracker.canada.ca/sign-in', { 
//             timeout: 120000, // 2 minutes timeout
//             waitUntil: 'networkidle' // Wait until there are no more network connections for at least 500 ms
//         });
//         console.log('Page loaded successfully.');

//         // Take a screenshot for debugging purposes
//         console.log('Taking a screenshot...');
//         await page.screenshot({ path: 'screenshot.png', fullPage: true, timeout: 60000 }); // 1 minute timeout for screenshot
//         console.log('Screenshot taken successfully.');

//         // Check if the login form is visible
//         const loginFormVisible = await page.isVisible('form#login-form');
//         if (!loginFormVisible) throw new Error('Login form not found!');
//         console.log('Login form is visible.');

//         // Fill in the login form
//         console.log('Filling in login credentials...');
//         await page.fill('input[name="username"]', 'zakaria.hiri@tbs-sct.gc.ca');
//         await page.fill('input[name="password"]', 'MCIGTBATITF.7');
        
//         // Submit the login form
//         console.log('Submitting the login form...');
//         await Promise.all([
//             page.click('button[type="submit"]'),
//             page.waitForNavigation({ timeout: 120000 }) // Wait for navigation after login
//         ]);

//         // Check if login was successful by verifying URL or page content
//         const currentUrl = page.url();
//         if (currentUrl !== 'https://tracker.canada.ca/sign-in') {
//             console.log('Login successful, redirected to:', currentUrl);
//         } else {
//             throw new Error('Login failed or unexpected redirection!');
//         }

//     } catch (error) {
//         console.error(`Test failed: ${error.message}`);
//         // Capture a screenshot if there is an error
//         await page.screenshot({ path: 'error-screenshot.png', fullPage: true });
//     } finally {
//         // Close the browser
//         await browser.close();
//     }
// })();

// const { chromium } = require('playwright');

// (async () => {
//     const browser = await chromium.launch({ headless: true });
//     const page = await browser.newPage();

//     try {
//         console.log('Navigating to example.com...');
//         await page.goto('https://tracker.canada.ca/sign-in', { 
//             timeout: 10000, // 1 minute timeout
//             waitUntil: 'domcontentloaded' // Wait for the DOM content to be loaded
//         });
//         console.log('Page loaded successfully.');

//         await page.screenshot({ path: 'screenshot.png', fullPage: true });
//         console.log('Screenshot taken successfully.');

//     } catch (error) {
//         console.error(`Test failed: ${error.message}`);
//         await page.screenshot({ path: 'error-screenshot.png', fullPage: true });
//     } finally {
//         await browser.close();
//     }
// })();


// import { test, expect } from '@playwright/test';

// test('has title', async ({ page }) => {
//   await page.goto('https://playwright.dev/');

//   // Expect a title "to contain" a substring.
//   await expect(page).toHaveTitle(/Playwright/);
// });

// test('get started link', async ({ page }) => {
//   await page.goto('https://playwright.dev/');

//   // Click the get started link.
//   await page.getByRole('link', { name: 'Get started' }).click();

//   // Expects page to have a heading with the name of Installation.
//   await expect(page.getByRole('heading', { name: 'Installation' })).toBeVisible();
// });

const { chromium } = require('playwright');

(async () => {
    // Launch the browser in headless mode
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();

    try {
        // Log navigation start
        console.log('Navigating to the login page...');

        // Navigate to the login page with increased timeout and network idle wait
        await page.goto('https://tracker.canada.ca/sign-in', { 
            timeout: 120000, // 2 minutes timeout
            waitUntil: 'networkidle' // Wait until there are no more network connections for at least 500 ms
        });
        console.log('Page loaded successfully.');

        // Take a screenshot for debugging purposes
        console.log('Taking a screenshot...');
        await page.screenshot({ path: 'screenshot.png', fullPage: true, timeout: 60000 }); // 1 minute timeout for screenshot
        console.log('Screenshot taken successfully.');

        // Check if the login form is visible
        const loginFormVisible = await page.isVisible('form#login-form');
        if (!loginFormVisible) throw new Error('Login form not found!');
        console.log('Login form is visible.');

        // Fill in the login form
        console.log('Filling in login credentials...');
        await page.fill('input[name="username"]', 'zakaria.hiri@tbs-sct.gc.ca');
        await page.fill('input[name="password"]', 'MCIGTBATITF.7');
        
        // Submit the login form
        console.log('Submitting the login form...');
        await Promise.all([
            page.click('button[type="submit"]'),
            page.waitForNavigation({ timeout: 120000 }) // Wait for navigation after login
        ]);

        // Check if login was successful by verifying URL or page content
        const currentUrl = page.url();
        if (currentUrl !== 'https://tracker.canada.ca/sign-in') {
            console.log('Login successful, redirected to:', currentUrl);
        } else {
            throw new Error('Login failed or unexpected redirection!');
        }

    } catch (error) {
        if (error instanceof Error) {
            console.error(`Test failed: ${error.message}`);
        } else {
            console.error('Test failed with an unknown error.');
        }
        // Capture a screenshot if there is an error
        await page.screenshot({ path: 'error-screenshot.png', fullPage: true });
    } finally {
        // Close the browser
        await browser.close();
    }
})();
