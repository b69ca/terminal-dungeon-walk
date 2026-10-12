const moves = { up: [0, -1], right: [1, 0], down: [0, 1], left: [-1, 0] };
function reveal(game) {
  game.visible.fill(0); const px = game.player % game.width, py = Math.floor(game.player / game.width);
  for (let dy = -game.vision; dy <= game.vision; dy++) for (let dx = -game.vision; dx <= game.vision; dx++) {
    if (dx * dx + dy * dy > game.vision * game.vision) continue;
    const tx = px + dx, ty = py + dy; if (tx < 0 || ty < 0 || tx >= game.width || ty >= game.height) continue;
    let x = px, y = py, ax = Math.abs(dx), ay = Math.abs(dy), error = ax - ay;
    while (true) {
      const id = y * game.width + x; game.visible[id] = 1; game.seen[id] = 1;
      if (!game.cells[id] || (x === tx && y === ty)) break;
      const twice = error * 2; if (twice > -ay) { error -= ay; x += Math.sign(dx); } if (twice < ax) { error += ax; y += Math.sign(dy); }
    }
  }
}
export function createDungeon({ width = 61, height = 27, seed = 42, vision = 5 } = {}) {
  if (!Number.isInteger(width) || width < 25 || width > 101 || !Number.isInteger(height) || height < 15 || height > 61) throw new Error('width must be 25–101 and height 15–61, both integers');
  if (!Number.isInteger(seed) || seed < 0 || seed > 0xffffffff || !Number.isInteger(vision) || vision < 1 || vision > 12) throw new Error('seed must be unsigned 32-bit and vision an integer from 1 to 12');
  let state = seed; const random = max => { state = (Math.imul(state, 1664525) + 1013904223) >>> 0; return Math.floor(state / 4294967296 * max); };
  const cells = new Uint8Array(width * height), rooms = [];
  const carve = (x, y) => { cells[y * width + x] = 1; };
  for (let attempt = 0; attempt < 60 && rooms.length < 12; attempt++) {
    const w = 3 + random(Math.min(8, width - 5)), h = 3 + random(Math.min(5, height - 5)), x = 1 + random(width - w - 1), y = 1 + random(height - h - 1);
    if (rooms.some(r => x <= r.x + r.w && x + w >= r.x && y <= r.y + r.h && y + h >= r.y)) continue;
    for (let row = y; row < y + h; row++) for (let col = x; col < x + w; col++) carve(col, row);
    const room = { x, y, w, h, cx: x + Math.floor(w / 2), cy: y + Math.floor(h / 2) };
    if (rooms.length) {
      const prev = rooms.at(-1); let cx = prev.cx, cy = prev.cy;
      const horizontal = () => { while (cx !== room.cx) { carve(cx, cy); cx += Math.sign(room.cx - cx); } carve(cx, cy); };
      const vertical = () => { while (cy !== room.cy) { carve(cx, cy); cy += Math.sign(room.cy - cy); } carve(cx, cy); };
      if (random(2)) { horizontal(); vertical(); } else { vertical(); horizontal(); }
    }
    rooms.push(room);
  }
  const start = rooms[0].cy * width + rooms[0].cx, queue = [start], visited = new Set(queue);
  for (let i = 0; i < queue.length; i++) for (const [dx, dy] of Object.values(moves)) {
    const id = queue[i], x = id % width + dx, y = Math.floor(id / width) + dy, next = y * width + x;
    if (x >= 0 && y >= 0 && x < width && y < height && cells[next] && !visited.has(next)) { visited.add(next); queue.push(next); }
  }
  const exit = queue.at(-1), floors = queue.filter(id => id !== start && id !== exit);
  for (let i = floors.length - 1; i > 0; i--) { const j = random(i + 1); [floors[i], floors[j]] = [floors[j], floors[i]]; }
  const treasures = new Set(floors.slice(0, Math.min(10, floors.length)));
  const game = { width, height, seed, vision, cells, rooms, player: start, start, exit, treasures, totalTreasure: treasures.size, collected: 0, moves: 0, won: false, seen: new Uint8Array(cells.length), visible: new Uint8Array(cells.length) };
  reveal(game); return game;
}
export function move(game, direction) {
  if (!Object.hasOwn(moves, direction)) throw new Error('direction must be up, right, down, or left');
  if (game.won) return false;
  const [dx, dy] = moves[direction], x = game.player % game.width + dx, y = Math.floor(game.player / game.width) + dy;
  if (x < 0 || y < 0 || x >= game.width || y >= game.height || !game.cells[y * game.width + x]) return false;
  game.player = y * game.width + x; game.moves++;
  if (game.treasures.delete(game.player)) game.collected++;
  game.won = game.player === game.exit; reveal(game); return true;
}
export function analyze(game) {
  return { seed: game.seed, width: game.width, height: game.height, rooms: game.rooms.length, moves: game.moves, collected: game.collected, totalTreasure: game.totalTreasure, won: game.won, exploredCells: game.seen.reduce((n, value) => n + value, 0), floorCells: game.cells.reduce((n, value) => n + value, 0), player: { x: game.player % game.width, y: Math.floor(game.player / game.width) }, exit: { x: game.exit % game.width, y: Math.floor(game.exit / game.width) } };
}
function glyph(game, id, all) {
  if (!all && !game.seen[id]) return ' ';
  if (id === game.player) return '@';
  if (id === game.exit) return '>';
  if (game.treasures.has(id)) return '$';
  return game.cells[id] ? '.' : '#';
}
export function render(game, { color = false, all = false } = {}) {
  const inks = { '@': 36, '>': 35, '$': 33, '#': 90, '.': 34 };
  return Array.from({ length: game.height }, (_, y) => Array.from({ length: game.width }, (_, x) => { const id = y * game.width + x, c = glyph(game, id, all); return color && c !== ' ' ? `\x1b[${!all && !game.visible[id] ? 90 : inks[c]}m${c}\x1b[0m` : c; }).join('')).join('\n');
}
export function renderSVG(game, { all = false } = {}) {
  const size = 10, w = Math.max(640, game.width * size + 64), h = game.height * size + 130, inks = { '@': '#5de4c7', '>': '#f48fb1', '$': '#ffd166', '#': '#293c56', '.': '#162a43' };
  const cells = [...game.cells].map((_, id) => { const c = glyph(game, id, all), x = 32 + id % game.width * size, y = 86 + Math.floor(id / game.width) * size; if (c === ' ') return ''; const tile = `<rect x="${x}" y="${y}" width="9" height="9" fill="${inks[c]}" opacity="${all || game.visible[id] ? 1 : 0.4}"/>`; return tile; }).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="${Math.round(h * 800 / w)}" viewBox="0 0 ${w} ${h}"><rect width="${w}" height="${h}" rx="18" fill="#0d1525"/><g font-family="monospace"><text x="32" y="36" font-size="22" fill="#e8edf8">TERMINAL DUNGEON WALK</text><text x="32" y="62" font-size="12" fill="#93a4bc">seed ${game.seed} / ${game.rooms.length} rooms / ${all ? 'revealed map' : 'fog of war'}</text>${cells}<text x="32" y="${h - 16}" font-size="12" fill="#93a4bc">Mint player / gold treasure / pink exit / WASD or HJKL move / n next / r reset / q quit</text></g></svg>\n`;
}
