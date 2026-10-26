import { describe, expect, it } from 'vitest';
import { Animator } from '../../src/view/animator';
import { Session } from '../../src/view/session';
import { applyAction, createGame, defaultRules } from '../../src/game';
import { buildSceneView } from '../../src/view/scene';
import { makeState, P } from '../game/helpers';

describe('Animator', () => {
  it('is busy after an erosion event until enough time has passed', () => {
    const s = makeState(['1!...', '.....', '.....', '.....', '....2']);
    const a = applyAction(s, { type: 'skip' });
    const b = applyAction(a.state, { type: 'skip' });
    const anim = new Animator();
    anim.push(b.events);
    expect(anim.busy()).toBe(true);
    const total = anim.remaining();
    expect(total).toBeGreaterThan(0.5);
    anim.update(total - 0.05);
    expect(anim.busy()).toBe(true);
    anim.update(0.1);
    expect(anim.busy()).toBe(false);
  });

  it('shows eroded tiles until their fall finishes', () => {
    const s = makeState(['1!...', '.....', '.....', '.....', '....2']);
    const b = applyAction(applyAction(s, { type: 'skip' }).state, { type: 'skip' });
    const anim = new Animator();
    anim.push(b.events);
    const view = buildSceneView(b.state);
    anim.apply(view);
    expect(view.tiles.some((t) => t.x === 1 && t.y === 0)).toBe(true);
    anim.update(anim.remaining() + 1);
    const after = buildSceneView(b.state);
    anim.apply(after);
    expect(after.tiles.some((t) => t.x === 1 && t.y === 0)).toBe(false);
  });

  it('keeps a moving rat between its start and end tile mid-animation', () => {
    const s = makeState(['1....', '.....', '.....', '.....', '....2']);
    const r = applyAction(s, { type: 'move', to: P(1, 0) });
    const anim = new Animator();
    anim.push(r.events);
    anim.update(0.15);
    const view = buildSceneView(r.state);
    anim.apply(view);
    const rat = view.sprites.find((sp) => sp.key === 'rat0')!;
    // tile (0,0) is at x = -2, tile (1,0) at x = -1 on a 5x5 board
    expect(rat.pos[0]).toBeGreaterThan(-2);
    expect(rat.pos[0]).toBeLessThan(-1);
  });
});

describe('Session', () => {
  it('ignores actions while animating', () => {
    const session = new Session(createGame(defaultRules(), 3));
    expect(session.dispatch({ type: 'skip' })).toBe(true);
    expect(session.dispatch({ type: 'skip' })).toBe(false);
    session.animator.update(10);
    expect(session.dispatch({ type: 'skip' })).toBe(true);
  });

  it('ignores illegal actions and actions after game over', () => {
    const session = new Session(makeState(['A....', '.....', '.....', '.....', '....2']));
    expect(session.dispatch({ type: 'move', to: P(4, 4) })).toBe(false);
    session.dispatch({ type: 'skip' });
    session.animator.update(10);
    session.dispatch({ type: 'skip' });
    session.animator.update(10);
    expect(session.state.over).toBe(true);
    expect(session.dispatch({ type: 'skip' })).toBe(false);
  });
});
