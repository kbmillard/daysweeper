/**
 * Normalization utilities for auction lot data
 */

import {
  IN_SCOPE_KEYWORDS,
  OUT_OF_SCOPE_KEYWORDS
} from '@/config/auction-collapsible-search-terms';

/**
 * Clean text: trim whitespace, collapse multiple spaces, remove newlines
 */
export function cleanText(text: string | null | undefined): string {
  if (!text) return '';
  return text.replace(/\s+/g, ' ').trim();
}

/**
 * Parse quantity from text
 * Looks for patterns like:
 * - (10)
 * - Lot of 25
 * - Qty: 40
 * - 25 each
 * - 50 units
 * - approx 100
 */
export function parseQuantity(text: string | null | undefined): number | undefined {
  if (!text) return undefined;

  const lowerText = text.toLowerCase();

  // Patterns to match
  const patterns = [
    /\((\d+)\)/,                                    // (10)
    /lot\s+of\s+(\d+)/i,                            // Lot of 25
    /qty[:\s]+(\d+)/i,                              // Qty: 40
    /quantity[:\s]+(\d+)/i,                         // Quantity: 50
    /(\d+)\s*(each|ea\.?|units?|pcs?|pieces?)/i,    // 25 each, 10 units
    /approx(?:imately)?\s*(\d+)/i,                  // approx 100
    /\bx\s*(\d+)\b/i,                               // x 50
    /(\d+)\s*x\b/i,                                 // 50 x
    /^(\d+)\s+/,                                    // Leading number
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      const num = parseInt(match[1], 10);
      if (num > 0 && num < 10000) {
        return num;
      }
    }
  }

  // Check for number near container-related words
  const containerWords = ['container', 'gaylord', 'tote', 'bin', 'bulk'];
  for (const word of containerWords) {
    if (lowerText.includes(word)) {
      // Look for number within 20 chars of the word
      const idx = lowerText.indexOf(word);
      const nearby = text.slice(Math.max(0, idx - 20), idx + word.length + 20);
      const numMatch = nearby.match(/(\d+)/);
      if (numMatch) {
        const num = parseInt(numMatch[1], 10);
        if (num > 0 && num < 10000 && num !== 48 && num !== 45 && num !== 40) {
          // Exclude common dimension numbers
          return num;
        }
      }
    }
  }

  return undefined;
}

/**
 * Parse location from text
 * Returns city, state, and original location line
 */
export function parseLocation(text: string | null | undefined): {
  city?: string;
  state?: string;
  locationLine?: string;
} {
  if (!text) return {};

  const cleaned = cleanText(text);
  if (!cleaned) return {};

  // US state abbreviations
  const stateAbbrevs =
    /\b(AL|AK|AZ|AR|CA|CO|CT|DE|FL|GA|HI|ID|IL|IN|IA|KS|KY|LA|ME|MD|MA|MI|MN|MS|MO|MT|NE|NV|NH|NJ|NM|NY|NC|ND|OH|OK|OR|PA|RI|SC|SD|TN|TX|UT|VT|VA|WA|WV|WI|WY)\b/i;

  // Try "City, ST" pattern
  const cityStateMatch = cleaned.match(/([A-Za-z\s]+),\s*([A-Z]{2})\b/);
  if (cityStateMatch) {
    return {
      city: cityStateMatch[1].trim(),
      state: cityStateMatch[2].toUpperCase(),
      locationLine: cleaned
    };
  }

  // Just state abbreviation
  const stateMatch = cleaned.match(stateAbbrevs);
  if (stateMatch) {
    return {
      state: stateMatch[1].toUpperCase(),
      locationLine: cleaned
    };
  }

  // Return just the location line
  return { locationLine: cleaned };
}

/**
 * Check if a lot is in-scope (likely a collapsible container)
 */
export function isInScope(title: string, description?: string): boolean {
  const text = `${title} ${description || ''}`.toLowerCase();

  // Check for out-of-scope keywords first
  for (const keyword of OUT_OF_SCOPE_KEYWORDS) {
    if (text.includes(keyword.toLowerCase())) {
      return false;
    }
  }

  // Check for in-scope keywords
  for (const keyword of IN_SCOPE_KEYWORDS) {
    if (text.includes(keyword.toLowerCase())) {
      return true;
    }
  }

  return false;
}

/**
 * Parse phone number from text
 */
export function parsePhone(text: string | null | undefined): string | undefined {
  if (!text) return undefined;

  // Look for phone patterns
  const phonePatterns = [
    /\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/,  // (555) 555-5555
    /\d{3}[-.\s]\d{3}[-.\s]\d{4}/,          // 555-555-5555
    /\+?1?[-.\s]?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/ // +1 (555) 555-5555
  ];

  for (const pattern of phonePatterns) {
    const match = text.match(pattern);
    if (match) {
      return match[0];
    }
  }

  return undefined;
}

/**
 * Parse email from text
 */
export function parseEmail(text: string | null | undefined): string | undefined {
  if (!text) return undefined;

  const emailPattern = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;
  const match = text.match(emailPattern);
  return match ? match[0] : undefined;
}

/**
 * Extract contact name from text
 * Only returns if there's an explicit "contact:" or "call:" mention
 */
export function parseContactName(text: string | null | undefined): string | undefined {
  if (!text) return undefined;

  const patterns = [
    /contact[:\s]+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/i,
    /call[:\s]+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/i,
    /speak\s+(?:to|with)[:\s]+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/i
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match && match[1] && match[1].length > 2) {
      return match[1].trim();
    }
  }

  return undefined;
}
