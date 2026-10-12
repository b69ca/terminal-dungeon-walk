#!/usr/bin/env node
import { writeFile } from 'node:fs/promises';
import { createDungeon, move, analyze, render, renderSVG } from './index.js';
import { parse, integer, terminal } from './terminal.js';
const args = process.argv.slice(2);
if (args.includes('--help')) { console.log('Usage: terminal-dungeon-walk [--seed N] [--width N] [--height N] [--vision N] [--moves wasd...] [--reveal] [--json] [--svg FILE] [--no-color]\nControls: lowercase WASD or HJKL move, n next seed, r reset, q quit'); process.exit(0); }
try {
  const options = parse(args, ['--seed', '--width', '--height', '--vision', '--moves', '--svg'], ['--reveal']);
  const live = !!(process.stdout.isTTY && process.stdin.isTTY && !options['--json'] && !options['--svg']);
  const width = integer(options, '--width', live ? Math.max(25, Math.min(81, (process.stdout.columns || 80) - 1)) : 61, 101);
  const height = integer(options, '--height', live ? Math.max(15, Math.min(35, (process.stdout.rows || 32) - 4)) : 27, 61);
  let seed = integer(options, '--seed', 42, 0xffffffff);
  const vision = integer(options, '--vision', 5, 12), make = () => createDungeon({ width, height, seed, vision }); let game = make();
  const directions = { w: 'up', k: 'up', d: 'right', l: 'right', s: 'down', j: 'down', a: 'left', h: 'left' };
  if (options['--moves'] !== undefined) { if (!/^[wasdhjkl]+$/.test(options['--moves'])) throw new Error('--moves accepts only lowercase wasdhjkl'); for (const key of options['--moves']) move(game, directions[key]); }
  if (options['--json'] || options['--svg']) {
    if (options['--svg']) await writeFile(options['--svg'], renderSVG(game, { all: !!options['--reveal'] }));
    if (options['--json']) console.log(JSON.stringify(analyze(game), null, 2));
  } else await terminal({ live, onTick: () => false,
    onKey: key => { if (Object.hasOwn(directions, key)) move(game, directions[key]); else if (key === 'n') { seed = (seed + 1) >>> 0; game = make(); } else if (key === 'r') game = make(); },
    draw: () => { const r = analyze(game); return `DUNGEON WALK | seed ${seed} | ${r.moves} moves | treasure ${r.collected}/${r.totalTreasure}${game.won ? ' | EXIT FOUND!' : ''}\n${render(game, { all: !!options['--reveal'], color: live && !options['--no-color'] && !process.env.NO_COLOR })}\n@ player $ treasure > exit | wasd/hjkl move n next r reset q quit`; }
  });
} catch (error) { console.error(`terminal-dungeon-walk: ${error.message}`); process.exitCode = 2; }
