---
name: browser-automation
description: Automate web browser operations - navigation, form filling, data extraction, and web interactions
metadata:
  {
    "sillytavern":
      {
        "emoji": "🌐",
        "skillKey": "browser-automation",
      },
  }
---

# Browser Automation

You can help users automate web browser operations and interactions.

## Capabilities

- **Navigation**: Open URLs, navigate pages, handle tabs
- **Form Interaction**: Fill forms, click buttons, select options
- **Data Extraction**: Scrape content, extract data, capture screenshots
- **Authentication**: Handle login flows and sessions
- **Monitoring**: Watch for page changes and updates

## Navigation

### Opening Pages
```javascript
// Navigate to URL
await page.goto('https://example.com');

// Wait for navigation
await page.goto('https://example.com', { waitUntil: 'networkidle0' });

// Go back/forward
await page.goBack();
await page.goForward();

// Reload page
await page.reload();
```

### Tab Management
```javascript
// Open new tab
const newPage = await browser.newPage();

// Switch between tabs
const pages = await browser.pages();
await pages[1].bringToFront();

// Close tab
await page.close();
```

## Element Interaction

### Finding Elements
```javascript
// By CSS selector
const element = await page.$('.class-name');
const elements = await page.$$('.class-name');

// By XPath
const element = await page.$x('//div[@id="myId"]');

// Wait for element
await page.waitForSelector('.class-name');
```

### Clicking
```javascript
// Click element
await page.click('.button');

// Double click
await page.click('.button', { clickCount: 2 });

// Right click
await page.click('.button', { button: 'right' });

// Click at coordinates
await page.mouse.click(100, 200);
```

### Typing
```javascript
// Type text
await page.type('#input', 'Hello World');

// Type with delay
await page.type('#input', 'Hello', { delay: 100 });

// Clear and type
await page.click('#input', { clickCount: 3 });
await page.type('#input', 'New text');

// Press key
await page.keyboard.press('Enter');
```

## Form Handling

### Input Fields
```javascript
// Text input
await page.type('#username', 'myuser');
await page.type('#password', 'mypass');

// Clear input
await page.$eval('#input', el => el.value = '');

// File upload
const input = await page.$('input[type="file"]');
await input.uploadFile('/path/to/file.pdf');
```

### Select Dropdowns
```javascript
// Select by value
await page.select('#dropdown', 'option-value');

// Select by label
await page.select('#dropdown', 'Option Label');

// Multiple select
await page.select('#multi', 'value1', 'value2');
```

### Checkboxes & Radio
```javascript
// Check checkbox
await page.click('#checkbox');

// Check if checked
const isChecked = await page.$eval('#checkbox', el => el.checked);

// Select radio
await page.click('input[value="option1"]');
```

## Data Extraction

### Text Content
```javascript
// Get text
const text = await page.$eval('.element', el => el.textContent);

// Get multiple texts
const texts = await page.$$eval('.items', els => els.map(el => el.textContent));

// Get attribute
const href = await page.$eval('a', el => el.getAttribute('href'));
```

### HTML Content
```javascript
// Get inner HTML
const html = await page.$eval('.element', el => el.innerHTML);

// Get outer HTML
const outerHtml = await page.$eval('.element', el => el.outerHTML);

// Get full page HTML
const pageHtml = await page.content();
```

### Screenshots
```javascript
// Full page screenshot
await page.screenshot({ path: 'screenshot.png', fullPage: true });

// Element screenshot
const element = await page.$('.element');
await element.screenshot({ path: 'element.png' });

// Specific area
await page.screenshot({
  path: 'area.png',
  clip: { x: 0, y: 0, width: 800, height: 600 }
});
```

## Authentication

### Login Flow
```javascript
// Navigate to login
await page.goto('https://example.com/login');

// Fill credentials
await page.type('#username', 'user@example.com');
await page.type('#password', 'password123');

// Submit form
await page.click('#login-button');

// Wait for navigation
await page.waitForNavigation();

// Verify login
const loggedIn = await page.$('.user-profile');
```

### Session Management
```javascript
// Get cookies
const cookies = await page.cookies();

// Set cookies
await page.setCookie({
  name: 'session',
  value: 'abc123',
  domain: 'example.com'
});

// Clear cookies
await page.deleteCookie({ name: 'session' });
```

## Waiting Strategies

```javascript
// Wait for selector
await page.waitForSelector('.element');

// Wait for navigation
await page.waitForNavigation();

// Wait for network idle
await page.waitForNetworkIdle();

// Wait for function
await page.waitForFunction(() => document.title === 'Expected Title');

// Fixed delay (use sparingly)
await page.waitForTimeout(1000);
```

## Error Handling

```javascript
try {
  await page.click('.button');
} catch (error) {
  if (error.message.includes('Element not found')) {
    console.log('Button not found, trying alternative...');
    await page.click('.alt-button');
  }
}

// Timeout handling
await page.click('.button', { timeout: 5000 }).catch(() => {
  console.log('Button click timed out');
});
```

## Best Practices

1. **Use explicit waits** instead of fixed delays
2. **Handle errors gracefully** with try-catch
3. **Respect rate limits** and add delays between actions
4. **Use headless mode** for background automation
5. **Clean up resources** (close pages, browser)
6. **Store credentials securely** (not in scripts)
7. **Test selectors** before automation
8. **Log actions** for debugging
