import { describe, expect, it } from 'vitest';
import { parseSeed } from '../../src/ui/menu';

describe('parseSeed', () => {
  it('accepts non-negative integers', () => {
    expect(parseSeed('123')).toBe(123);
    expect(parseSeed(' 7 ')).toBe(7);
  });
  it('normalises negative and fractional input', () => {
    expect(parseSeed('-42')).toBe(42);
    expect(parseSeed('2.9')).toBe(2);
  });
  it('rejects empty or non-numeric input', () => {
    expect(parseSeed('')).toBeUndefined();
    expect(parseSeed(null)).toBeUndefined();
    expect(parseSeed('abc')).toBeUndefined();
  });
  it('keeps seeds in the 32-bit range used by the RNG', () => {
    expect(parseSeed('99999999999')).toBeLessThan(2 ** 32);
  });
});
