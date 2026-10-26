import type { PlayerId } from '../game';

export type Tool = 'move' | 'tree' | 'bridge' | 'erase' | 'skip';

export const PLAYER_NAME: Record<PlayerId, string> = { 0: 'Modra podgana', 1: 'Rdeča podgana' };
export const PLAYER_SHORT: Record<PlayerId, string> = { 0: 'Modra', 1: 'Rdeča' };

export const TOOL_LABEL: Record<Tool, string> = {
  move: 'Premik',
  tree: 'Drevo',
  bridge: 'Most',
  erase: 'Radirka',
  skip: 'Preskoči',
};

export const TOOL_HINT: Record<Tool, string> = {
  move: 'Klikni sosednje polje, da se premakneš. Čez most skočiš na drugo stran.',
  tree: 'Klikni prazno polje in nanj nariši drevo. Drevo je ovira in enkrat zaščiti polje pred erozijo.',
  bridge: 'Klikni vrzel z obarvanim mostom, da ga narišeš. R ali ⟲ obrne smer.',
  erase: 'Klikni drevo ali most, da ga zradiraš.',
  skip: 'Klikni še enkrat, da potrdiš preskok poteze.',
};

export const T = {
  round: (n: number) => `Krog ${n}`,
  turn: (p: PlayerId) => `Na potezi: ${PLAYER_NAME[p]}`,
  roundBanner: (n: number, p: PlayerId) => `Krog ${n} · začne ${PLAYER_SHORT[p].toLowerCase()}`,
  turnBanner: (p: PlayerId) => `${PLAYER_NAME[p]} na potezi`,
  marked: (n: number) =>
    n === 0
      ? 'Ta krog ne izgine nobeno polje'
      : `${n} ${n === 1 ? 'polje bo izginilo' : n === 2 ? 'polji bosta izginili' : n <= 4 ? 'polja bodo izginila' : 'polj bo izginilo'} ob koncu kroga`,
  actsLeft: (left: number) => (left === 2 ? 'Oba igralca še na potezi' : 'Še zadnja poteza pred erozijo'),
  denied: 'Tja ne gre.',
  danger: 'Pozor: stojiš na polju, ki bo izginilo!',
  rotateBridge: 'Obrni most (R)',
  camLeft: 'Zavrti levo (Q)',
  camRight: 'Zavrti desno (E)',
  noWebGPU:
    'Tvoj brskalnik ne podpira WebGPU. Odpri igro v novejšem Chromu ali Edgu (računalnik ali Android), v Firefoxu na Windows ali v Safariju 26+. Na Linuxu v Chromu vklopi chrome://flags/#enable-unsafe-webgpu.',
  loading: 'Šiljim svinčnike …',
  gpuLost: 'Grafična kartica se je ponastavila. Osveži stran.',
};
