import { allPositions, applyAction, cell, isLegal, type Action, type BridgeDir, type GameEvent, type GameState } from '../game';
import { Animator } from './animator';

function bridgesOf(s: GameState): { x: number; y: number; dir: BridgeDir }[] {
  return allPositions(s).flatMap((p) => {
    const b = cell(s, p).bridge;
    return b ? [{ ...p, dir: b }] : [];
  });
}

/** Game state plus its animation queue; the single gate through which actions enter the game. */
export class Session {
  readonly animator = new Animator();
  onEvents: ((events: GameEvent[]) => void) | null = null;

  constructor(public state: GameState) {}

  /** Apply `a` if the game accepts input right now. Returns whether it was applied. */
  dispatch(a: Action): boolean {
    if (this.animator.busy() || this.state.over || !isLegal(this.state, a)) return false;
    const prev = this.state;
    const { state, events } = applyAction(prev, a);
    this.animator.noteBridges(bridgesOf(prev));
    this.animator.push(events, state.players);
    this.state = state;
    this.onEvents?.(events);
    return true;
  }
}
