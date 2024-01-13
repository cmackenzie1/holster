import { Context, Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import ShortUniqueId from 'short-unique-id';

type Bindings = {
  DB: D1Database;
};

interface Paste {
  id: number;
  public_id: string;
  content_type: string;
  content: string;
  created_at: string;
  expires_at: string;
}

const app = new Hono<{ Bindings: Bindings }>();
const uid = new ShortUniqueId();

app.get('/pastes/:public_id{[0-9A-Za-z]+}', async (c: Context<{ Bindings: Bindings }>) => {
  const { public_id } = c.req.param();
  const now = new Date().toISOString();

  console.log(c.req.url, c.req.headers);
  let result = null;
  try {
    result = await c.env.DB.prepare('SELECT * FROM pastes WHERE public_id = ? AND expires_at > ?')
      .bind(public_id, now)
      .first();
  } catch (e) {
    console.error(e);
    throw new HTTPException(500, { message: JSON.stringify(e) });
  }

  if (!result) {
    throw new HTTPException(404, { message: 'Paste not found' });
  }

  return c.text(result.content, { headers: { 'Content-Type': result.content_type } });
});

app.get('/pastes', async (c: Context<{ Bindings: Bindings }>) => {
  const result = await c.env.DB.prepare('SELECT * FROM pastes ORDER BY created_at DESC').all();
  if (result.error) {
    console.error(result.error);
    throw new HTTPException(500, { message: JSON.stringify(result.error) });
  }

  const pastes: Paste[] = result.results.map((row) => ({
    id: row.id as number,
    public_id: row.public_id as string,
    content_type: row.content_type as string,
    content: row.content as string,
    created_at: row.created_at as string,
    expires_at: row.expires_at as string,
  }));

  return c.json(pastes);
});

app.post('/pastes', async (c: Context<{ Bindings: Bindings }>) => {
  const content_type = c.req.header('Content-Type') || 'text/plain';
  const created_at = new Date().toISOString();
  const expires_at = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7).toISOString();

  if (content_type !== 'text/plain') {
    throw new HTTPException(400, { message: 'Invalid content type, only text/plain is supported!' });
  }

  let content = '';
  try {
    content = await c.req.text();
  } catch (e) {
    console.error(e);
    throw new HTTPException(500, { message: JSON.stringify(e) });
  }

  const public_id = uid.rnd();
  let result = null;
  try {
    result = await c.env.DB.prepare(
      'INSERT INTO pastes (public_id, content_type, content, created_at, expires_at) VALUES (?, ?, ?, ?, ?) RETURNING public_id',
    )
      .bind(public_id, content_type, content, created_at, expires_at)
      .first();
  } catch (e) {
    console.error(e);
    throw new HTTPException(500, { message: JSON.stringify(e) });
  }

  if (!result) {
    throw new HTTPException(500, { message: 'Failed to create paste' });
  }

  const host = c.req.header('Host').split(':')[0] || 'paste.mirio.dev';

  return c.json(
    { url: `https://${host}/pastes/${result.public_id}` },
    { status: 201, headers: { Location: `/pastes/${result.public_id}` } },
  );
});

export default {
  async scheduled(event, env: Bindings, ctx) {
    const result = await env.DB.prepare('DELETE FROM pastes WHERE expires_at < ?').bind(new Date().toISOString()).run();
    if (result.error) {
      console.error(result.error);
      throw new Error(result.error);
    }

    console.log(`Deleted  ${result.meta.changes} pastes in ${result.meta.duration}ms`);
  },
  ...app,
};
