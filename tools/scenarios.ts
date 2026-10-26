/* Prints scripted UI test scenarios as JSON (states built from ASCII like the unit tests). */
import { makeState } from '../tests/game/helpers';

const scenarios = {
  bridgeCross: makeState(['.....', '1-...', '.....', '.....', '....2']),
  saveTile: makeState(['1....', '.....', '..!..', '.....', '....2']),
  trapWin: makeState(['1....', '.....', '.T...', 'TB.T.', '.T...']),
  draw: makeState(['A.T..', 'T....', '.....', '....T', '..T.B']),
  bridgeRotateErase: makeState(['1.....', '......', '..#...', '......', '......', '.....2']),
  eraseCanopy: makeState(['1.....', '......', '..T...', '...T..', '......', '.....2']),
  ghostBridges: makeState(['1.....', '.#..#.', '......', '..#...', '....#.', '.....2']),
  // red rat diagonally in front of the gap (towards the default camera), covering it on screen
  bridgeBehindRat: makeState(['......', '......', '..#...', '...2..', '1.....', '......']),
};
for (const s of Object.values(scenarios)) s.seed = 5;
console.log(JSON.stringify(scenarios));
