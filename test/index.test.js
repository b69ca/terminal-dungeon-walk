import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createDungeon, move, analyze, render, renderSVG } from '../src/index.js';
const cli = args => spawnSync(process.execPath, ['src/cli.js', ...args], { encoding: 'utf8' });
const adjacent = (g, id) => [['up', -g.width], ['right', 1], ['down', g.width], ['left', -1]].filter(([, d]) => g.cells[id + d]);
function routes(g) { const queue = [g.start], parents = new Map([[g.start, null]]), distances = new Map([[g.start, 0]]); for (let i = 0; i < queue.length; i++) for (const [direction, delta] of adjacent(g, queue[i])) { const id = queue[i] + delta; if (!parents.has(id)) { parents.set(id, [queue[i], direction]); distances.set(id, distances.get(queue[i]) + 1); queue.push(id); } } return { parents, distances }; }
test('seeded maps reproduce, preserve borders, and have connected rooms with a farthest exit', () => {
  for (const seed of [0, 1, 42, 137, 4294967295]) {
    const g = createDungeon({ width: 35, height: 19, seed }); assert.deepEqual(g, createDungeon({ width: 35, height: 19, seed }));
    const { parents, distances } = routes(g); assert.equal(parents.size, analyze(g).floorCells); assert.equal(distances.get(g.exit), Math.max(...distances.values()));
    assert.ok(g.rooms.length >= 1); assert.ok([...g.treasures].every(id => g.cells[id] && id !== g.start && id !== g.exit));
    for (let y = 0; y < g.height; y++) for (let x = 0; x < g.width; x++) if (!x || !y || x === g.width - 1 || y === g.height - 1) assert.equal(g.cells[y * g.width + x], 0);
  }
});
test('exit route is traversable and winning freezes movement', () => {
  const g = createDungeon(), { parents } = routes(g), path = []; let id = g.exit;
  while (id !== g.start) { const [prev, dir] = parents.get(id); path.push(dir); id = prev; }
  path.reverse().forEach(dir => assert.equal(move(g, dir), true)); assert.equal(g.won, true); assert.equal(g.moves, path.length);
  const at = g.player; assert.equal(move(g, 'left'), false); assert.equal(g.player, at);
});
test('walls reject movement, treasure is collected once, and fog remembers visited cells', () => {
  const g = createDungeon(); const [dir, delta] = adjacent(g, g.player)[0]; g.treasures.add(g.player + delta); g.totalTreasure = g.treasures.size;
  const before = [...g.seen]; assert.equal(move(g, dir), true); assert.equal(g.collected, 1); assert.equal(g.treasures.has(g.player), false);
  before.forEach((value, i) => { if (value) assert.equal(g.seen[i], 1); }); assert.ok(g.visible[g.player]);
  const blocked = createDungeon(); blocked.cells.fill(0); blocked.cells[blocked.player] = 1;
  for (const direction of ['up', 'right', 'down', 'left']) assert.equal(move(blocked, direction), false); assert.equal(blocked.moves, 0);
});
test('line of sight reveals blocking walls but not cells behind a solid wall', () => {
  const g = createDungeon({ width: 25, height: 15, vision: 5 }); g.cells.fill(1); g.player = 7 * 25 + 10; g.won = false; g.seen.fill(0);
  for (let y = 0; y < 15; y++) g.cells[y * 25 + 13] = 0;
  move(g, 'left'); assert.equal(g.visible[7 * 25 + 13], 1); assert.equal(g.visible[7 * 25 + 14], 0);
});
test('validates parameters and emits exact dimensions, fog, and SVG', () => {
  for (const options of [{ width: 24 }, { height: 14 }, { seed: -1 }, { vision: 0 }]) assert.throws(() => createDungeon(options));
  const g = createDungeon(); assert.throws(() => move(g, 'toString'));
  assert.equal(render(g).split('\n').length, g.height); assert.ok(render(g).split('\n').every(row => row.length === g.width));
  assert.equal(render(g).includes('\x1b'), false); assert.notEqual(render(g), render(g, { all: true })); assert.match(renderSVG(g), /^<svg/);
});
test('CLI supports replay, JSON, revealed maps, errors, and SVG exports', () => {
  const r = cli(['--moves', 'wasd', '--json']); assert.equal(r.status, 0); assert.equal(JSON.parse(r.stdout).seed, 42); assert.equal(cli([]).stdout.includes('\x1b'), false);
  for (const args of [['--seed'], ['--seed', '-1'], ['--moves', 'oops'], ['--vision', '0'], ['--wat']]) assert.equal(cli(args).status, 2);
  const dir = mkdtempSync(join(tmpdir(), 'dungeon-')); try { const file = join(dir, 'x.svg'); assert.equal(cli(['--reveal', '--svg', file]).status, 0); assert.match(readFileSync(file, 'utf8'), /revealed map/); assert.equal(cli(['--svg', join(dir, 'missing', 'x.svg')]).status, 2); } finally { rmSync(dir, { recursive: true, force: true }); }
});
