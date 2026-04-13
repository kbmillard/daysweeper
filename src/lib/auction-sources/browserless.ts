/**
 * Browserless.io integration for JS-rendered pages
 *
 * Browserless provides headless Chrome as a service.
 * Free tier: 1000 units/month (1 unit = ~1 page render)
 *
 * Sign up at: https://www.browserless.io/
 * Set BROWSERLESS_API_KEY in environment
 */

const BROWSERLESS_API_KEY = process.env.BROWSERLESS_API_KEY;
const BROWSERLESS_URL = 'https://chrome.browserless.io';

export function isBrowserlessConfigured(): boolean {
  return !!BROWSERLESS_API_KEY;
}

/**
 * Fetch a URL using Browserless (renders JavaScript)
 */
export async function fetchWithBrowserless(url: string): Promise<string | null> {
  if (!BROWSERLESS_API_KEY) {
    console.warn('BROWSERLESS_API_KEY not set - JS rendering disabled');
    return null;
  }

  try {
    const response = await fetch(`${BROWSERLESS_URL}/content?token=${BROWSERLESS_API_KEY}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        url,
        waitFor: 3000, // Wait for JS to render
        gotoOptions: {
          waitUntil: 'networkidle2'
        }
      }),
      signal: AbortSignal.timeout(30000)
    });

    if (!response.ok) {
      console.error(`Browserless error: ${response.status} ${response.statusText}`);
      return null;
    }

    return await response.text();
  } catch (error) {
    console.error('Browserless fetch error:', error);
    return null;
  }
}

/**
 * Fetch a URL with regular fetch, falling back to Browserless if content seems incomplete
 */
export async function fetchWithFallback(
  url: string,
  options: {
    checkSelector?: string;
    requiresJs?: boolean;
  } = {}
): Promise<string | null> {
  // If we know it requires JS, go straight to Browserless
  if (options.requiresJs && isBrowserlessConfigured()) {
    return fetchWithBrowserless(url);
  }

  // Try regular fetch first
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9'
      },
      signal: AbortSignal.timeout(15000)
    });

    if (!response.ok) {
      return null;
    }

    const html = await response.text();

    // If we have a check selector and Browserless is configured, verify content exists
    if (options.checkSelector && isBrowserlessConfigured()) {
      // Simple check for expected content
      if (!html.includes(options.checkSelector)) {
        // Fallback to Browserless
        return fetchWithBrowserless(url);
      }
    }

    return html;
  } catch (error) {
    console.error('Fetch error:', error);

    // Fallback to Browserless
    if (isBrowserlessConfigured()) {
      return fetchWithBrowserless(url);
    }

    return null;
  }
}
