import { describe, expect, it } from 'vitest';
import { T } from '../../src/ui/strings';

describe('Slovenian plural for vanishing tiles', () => {
  it('uses the right grammatical number', () => {
    expect(T.marked(0)).toBe('Ta krog ne izgine nobeno polje');
    expect(T.marked(1)).toBe('1 polje bo izginilo ob koncu kroga');
    expect(T.marked(2)).toBe('2 polji bosta izginili ob koncu kroga');
    expect(T.marked(3)).toBe('3 polja bodo izginila ob koncu kroga');
    expect(T.marked(4)).toBe('4 polja bodo izginila ob koncu kroga');
    expect(T.marked(5)).toBe('5 polj bo izginilo ob koncu kroga');
  });
});
