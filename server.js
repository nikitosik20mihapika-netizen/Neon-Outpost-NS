/**
 * Neon Outpost ALFA+ — Online v2
 * Протокол:
 *  hello, join, leave, state, chat, ping
 *  shot  { x,y,dx,dy,dmg,speed,color } — выстрел (relay)
 *  hit   { to, dmg } — урон жертве (relay + cap)
 *  death { } — смерть (relay)
 */
const http = require('http');
const { WebSocketServer } = require('ws');

const PORT = process.env.PORT || 3000;
const MAX_ROOMS = 40;
const MAX_PER_ROOM = 6;
const MAX_HIT_DMG = 80;

const server = http.createServer((req, res) => {
  if (req.url === '/' || req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({
      ok: true,
      service: 'neon-outpost-online',
      version: 'v2',
      rooms: rooms.size,
      players: clients.size,
      ts: Date.now()
    }));
    return;
  }
  res.writeHead(404);
  res.end('Not found');
});

const wss = new WebSocketServer({ server });
const clients = new Map();
const rooms = new Map();

function uid() {
  return 'p' + Math.random().toString(36).slice(2, 10);
}
function send(ws, obj) {
  if (ws.readyState === 1) ws.send(JSON.stringify(obj));
}
function roomList() {
  const list = [];
  for (const [name, set] of rooms) {
    list.push({ name, players: set.size, max: MAX_PER_ROOM });
  }
  list.sort((a, b) => b.players - a.players);
  return list;
}
function broadcastRoom(room, obj, except) {
  const set = rooms.get(room);
  if (!set) return;
  const raw = JSON.stringify(obj);
  for (const ws of set) {
    if (ws !== except && ws.readyState === 1) ws.send(raw);
  }
}
function leaveRoom(ws) {
  const c = clients.get(ws);
  if (!c || !c.room) return;
  const set = rooms.get(c.room);
  if (set) {
    set.delete(ws);
    broadcastRoom(c.room, { t: 'peer_left', id: c.id, name: c.name }, ws);
    if (set.size === 0) rooms.delete(c.room);
  }
  c.room = null;
}
function broadcastRoomsAll() {
  const list = roomList();
  for (const [other] of clients) {
    if (other.readyState === 1) send(other, { t: 'rooms', rooms: list });
  }
}

wss.on('connection', (ws) => {
  const id = uid();
  clients.set(ws, {
    id, name: 'Гость', room: null,
    x: 0, y: 0, hp: 100, angle: 0, last: Date.now()
  });
  send(ws, { t: 'welcome', id, rooms: roomList(), version: 'v2' });

  ws.on('message', (buf) => {
    let msg;
    try { msg = JSON.parse(String(buf)); } catch { return; }
    const c = clients.get(ws);
    if (!c) return;
    c.last = Date.now();

    switch (msg.t) {
      case 'hello': {
        c.name = String(msg.name || 'Гость').slice(0, 20) || 'Гость';
        send(ws, { t: 'hello_ok', id: c.id, name: c.name, rooms: roomList(), version: 'v2' });
        break;
      }
      case 'rooms':
        send(ws, { t: 'rooms', rooms: roomList() });
        break;
      case 'join': {
        let room = String(msg.room || 'lobby').slice(0, 24).replace(/[^\w\-а-яА-ЯёЁ]/g, '') || 'lobby';
        if (rooms.size >= MAX_ROOMS && !rooms.has(room)) {
          send(ws, { t: 'error', error: 'Слишком много комнат' });
          break;
        }
        const set = rooms.get(room) || new Set();
        if (set.size >= MAX_PER_ROOM) {
          send(ws, { t: 'error', error: 'Комната полная' });
          break;
        }
        leaveRoom(ws);
        set.add(ws);
        rooms.set(room, set);
        c.room = room;
        c.hp = 100;
        const peers = [];
        for (const other of set) {
          if (other === ws) continue;
          const o = clients.get(other);
          if (o) peers.push({ id: o.id, name: o.name, x: o.x, y: o.y, hp: o.hp, angle: o.angle });
        }
        send(ws, { t: 'joined', room, peers, id: c.id });
        broadcastRoom(room, { t: 'peer_join', id: c.id, name: c.name, x: c.x, y: c.y, hp: c.hp }, ws);
        broadcastRoomsAll();
        break;
      }
      case 'leave':
        leaveRoom(ws);
        send(ws, { t: 'left', rooms: roomList() });
        break;
      case 'state': {
        if (!c.room) break;
        if (typeof msg.x === 'number') c.x = msg.x;
        if (typeof msg.y === 'number') c.y = msg.y;
        if (typeof msg.hp === 'number') c.hp = Math.max(0, Math.min(200, msg.hp));
        if (typeof msg.angle === 'number') c.angle = msg.angle;
        broadcastRoom(c.room, {
          t: 'state', id: c.id, name: c.name,
          x: c.x, y: c.y, hp: c.hp, angle: c.angle
        }, ws);
        break;
      }
      case 'shot': {
        if (!c.room) break;
        if (typeof msg.x !== 'number' || typeof msg.y !== 'number') break;
        const dx = typeof msg.dx === 'number' ? msg.dx : 0;
        const dy = typeof msg.dy === 'number' ? msg.dy : 0;
        const dmg = Math.min(MAX_HIT_DMG, Math.max(1, Number(msg.dmg) || 10));
        const speed = Math.min(900, Math.max(200, Number(msg.speed) || 500));
        broadcastRoom(c.room, {
          t: 'shot',
          from: c.id,
          name: c.name,
          x: msg.x, y: msg.y,
          dx, dy, dmg, speed,
          color: String(msg.color || '#ffcc44').slice(0, 20)
        }, ws);
        break;
      }
      case 'hit': {
        if (!c.room) break;
        const to = String(msg.to || '');
        const dmg = Math.min(MAX_HIT_DMG, Math.max(0, Number(msg.dmg) || 0));
        if (!to || dmg <= 0) break;
        broadcastRoom(c.room, {
          t: 'hit', from: c.id, name: c.name, to, dmg
        }, null);
        break;
      }
      case 'death': {
        if (!c.room) break;
        c.hp = 0;
        broadcastRoom(c.room, {
          t: 'death', id: c.id, name: c.name || msg.name
        }, ws);
        break;
      }
      case 'chat': {
        if (!c.room) break;
        const text = String(msg.text || '').slice(0, 120);
        if (!text.trim()) break;
        broadcastRoom(c.room, { t: 'chat', id: c.id, name: c.name, text }, null);
        break;
      }
      case 'ping':
        send(ws, { t: 'pong', ts: Date.now() });
        break;
      default:
        break;
    }
  });

  ws.on('close', () => {
    leaveRoom(ws);
    clients.delete(ws);
  });
});

setInterval(() => {
  const now = Date.now();
  for (const [ws, c] of clients) {
    if (now - c.last > 120000) {
      try { ws.close(); } catch (_) {}
      leaveRoom(ws);
      clients.delete(ws);
    }
  }
}, 60000);

server.listen(PORT, () => {
  console.log('Neon Outpost online v2 on :' + PORT);
});
