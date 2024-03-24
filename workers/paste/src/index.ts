import { Context, Hono } from 'hono';
import { cors } from 'hono/cors';
import { HTTPException } from 'hono/http-exception';
import ShortUniqueId from 'short-unique-id';

type Bindings = {
  HOST: string;
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

app.all('*', cors());

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
  const result = await c.env.DB.prepare('SELECT * FROM pastes').all();
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
  const content_type = c.req.header('content-type');
  console.log(c.req.url, c.req.headers);
  const created_at = new Date().toISOString();
  const expires_at = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7).toISOString();

  if (!content_type) {
    throw new HTTPException(400, { message: 'Missing Content-Type header' });
  }

  // only accept form data cont
  if (
    !content_type.startsWith('multipart/form-data') &&
    !content_type.startsWith('application/x-www-form-urlencoded')
  ) {
    console.log('invalid content type', content_type);
    throw new HTTPException(400, { message: 'Invalid Content-Type header' });
  }

  const form = await c.req.formData();
  const content = form.get('content');
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

  const host = c.env.HOST || 'paste.mirio.dev';

  return c.redirect(`/pastes/${result.public_id}`);
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
