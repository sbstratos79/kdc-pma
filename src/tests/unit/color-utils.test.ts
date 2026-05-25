// src/tests/unit/color-utils.test.ts

import { describe, it, expect } from 'vitest';
import {
	getStatusColor,
	getPriorityColor,
	getStatusBarColor,
	getPriorityGradient
} from '$lib/utils/colorUtils';

describe('getStatusColor', () => {
	it('returns green classes for Completed', () => {
		const result = getStatusColor('Completed');
		expect(result).toContain('green');
	});

	it('returns blue classes for In Progress', () => {
		const result = getStatusColor('In Progress');
		expect(result).toContain('blue');
	});

	it('returns yellow classes for Planning', () => {
		const result = getStatusColor('Planning');
		expect(result).toContain('yellow');
	});

	it('returns slate classes for On Hold', () => {
		const result = getStatusColor('On Hold');
		expect(result).toContain('slate');
	});

	it('returns red classes for Cancelled', () => {
		const result = getStatusColor('Cancelled');
		expect(result).toContain('red');
	});

	it('returns gray default for null', () => {
		const result = getStatusColor(null);
		expect(result).toContain('gray');
	});

	it('returns gray default for unknown status', () => {
		const result = getStatusColor('Unknown');
		expect(result).toContain('gray');
	});
});

describe('getPriorityColor', () => {
	it('returns red for High', () => {
		expect(getPriorityColor('High')).toContain('red');
	});

	it('returns yellow for Medium', () => {
		expect(getPriorityColor('Medium')).toContain('yellow');
	});

	it('returns green for Low', () => {
		expect(getPriorityColor('Low')).toContain('green');
	});

	it('returns gray for unknown', () => {
		expect(getPriorityColor('Unknown')).toContain('gray');
	});
});

describe('getStatusBarColor', () => {
	it('returns green gradient for completed (case-insensitive)', () => {
		expect(getStatusBarColor('Completed')).toContain('green');
		expect(getStatusBarColor('COMPLETED')).toContain('green');
	});

	it('returns blue gradient for in progress', () => {
		expect(getStatusBarColor('In Progress')).toContain('blue');
	});

	it('returns amber gradient for planning', () => {
		expect(getStatusBarColor('Planning')).toContain('amber');
	});

	it('returns slate gradient for on hold', () => {
		expect(getStatusBarColor('On Hold')).toContain('slate');
	});

	it('returns red gradient for cancelled', () => {
		expect(getStatusBarColor('Cancelled')).toContain('red');
	});

	it('returns gray default for null', () => {
		expect(getStatusBarColor(null)).toContain('gray');
	});
});

describe('getPriorityGradient', () => {
	it('returns red gradient for high', () => {
		expect(getPriorityGradient('High')).toContain('red');
	});

	it('returns yellow gradient for medium', () => {
		expect(getPriorityGradient('Medium')).toContain('yellow');
	});

	it('returns green gradient for low', () => {
		expect(getPriorityGradient('Low')).toContain('green');
	});

	it('returns gray gradient for unknown', () => {
		expect(getPriorityGradient('Unknown')).toContain('gray');
	});

	it('handles case-insensitive priority', () => {
		expect(getPriorityGradient('high')).toContain('red');
	});
});
