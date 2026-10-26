// Local stand-in for the three Supabase functions in schema.sql, for trying the shared list
// without a Supabase project:  node supabase/mock-server.mjs
// Then run the app with VITE_SUPABASE_URL=http://localhost:54321 VITE_SUPABASE_ANON_KEY=local
import { createServer } from 'node:http';

const households = new Map(); // household -> Map(item_key -> { product, added_at })
const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

createServer((req, res) => {
  if (req.method === 'OPTIONS') return res.writeHead(204, cors).end();
  let body = '';
  req.on('data', (c) => (body += c));
  req.on('end', () => {
    const fn = req.url?.match(/\/rpc\/(\w+)/)?.[1];
    const a = body ? JSON.parse(body) : {};
    const rows = households.get(a.h) ?? new Map();
    if (fn === 'get_list') {
      const out = [...rows].map(([item_key, v]) => ({ item_key, product: v.product, added_at: v.added_at })).sort((x, y) => y.added_at - x.added_at);
      return res.writeHead(200, { ...cors, 'Content-Type': 'application/json' }).end(JSON.stringify(out));
    }
    if (fn === 'put_item') {
      rows.set(a.k, { product: a.p, added_at: rows.get(a.k)?.added_at ?? Date.now() });
      households.set(a.h, rows);
      return res.writeHead(204, cors).end();
    }
    if (fn === 'del_item') {
      rows.delete(a.k);
      return res.writeHead(204, cors).end();
    }
    res.writeHead(404, cors).end();
  });
}).listen(54321, () => console.log('mock supabase on http://localhost:54321'));
