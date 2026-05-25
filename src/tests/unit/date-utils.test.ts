// src/tests/unit/date-utils.test.ts

import { describe, it, expect } from 'vitest';
import { formatDate, parseDate, dateToIso } from '$lib/utils/dateUtils';

describe('formatDate', () => {
	it('returns "Not set" for null input', () => {
		expect(formatDate(null)).toBe('Not set');
	});

	it('returns a formatted string for a valid date', () => {
		const result = formatDate('2025-06-15');
		expect(result).not.toBe('Not set');
		expect(result).not.toBe('Invalid date');
	});
});

describe('parseDate', () => {
	it('returns null for null input', () => {
		expect(parseDate(null)).toBeNull();
	});

	it('returns the same Date instance when given a Date', () => {
		const d = new Date('2025-06-15');
		expect(parseDate(d)).toBe(d);
	});

	it('parses a valid ISO string', () => {
		const result = parseDate('2025-06-15');
		expect(result).toBeInstanceOf(Date);
		expect(result!.toISOString().startsWith('2025-06-15')).toBe(true);
	});

	it('returns null for an invalid string', () => {
		expect(parseDate('not-a-date')).toBeNull();
	});
});

describe('dateToIso', () => {
	it('returns null for null input', () => {
		expect(dateToIso(null)).toBeNull();
	});

	it('converts a Date to ISO string', () => {
		const d = new Date('2025-06-15T10:00:00.000Z');
		expect(dateToIso(d)).toBe('2025-06-15T10:00:00.000Z');
	});

	it('converts a valid date string to ISO', () => {
		const result = dateToIso('2025-06-15');
		expect(result).toBeTypeOf('string');
		expect(result).toContain('2025-06-15');
	});

	it('returns null for an invalid string', () => {
		expect(dateToIso('not-a-date')).toBeNull();
	});
});
