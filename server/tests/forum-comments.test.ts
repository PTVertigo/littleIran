import request from 'supertest';
import { browser, sessionToken } from './browser';
import { createApp } from '../src/app';
import { pool } from '../src/db';

const app = createApp();

async function addPost(overrides: Record<string, unknown> = {}) {
  const category = (await pool.query("SELECT id FROM categories WHERE type = 'forum' AND name = 'General Discussion'")).rows[0].id;
  const values = { title: 'A post', content: 'Some words.', ...overrides };
  const columns = Object.keys(values);
  const { rows } = await pool.query(
    `INSERT INTO forum_posts (category_id, ${columns.join(', ')}) VALUES ($1, ${columns.map((_, i) => `$${i + 2}`).join(', ')}) RETURNING id`,
    [category, ...Object.values(values)],
  );
  return rows[0].id as string;
}

beforeEach(async () => {
  await pool.query('TRUNCATE users RESTART IDENTITY CASCADE');
});

afterAll(async () => {
  await pool.end();
});

// Week 8: comments, replies and flags on a forum post
describe('Comments and flags on a post', () => {
  let token: string;
  let userId: string;
  let postId: string;

  const comment = (body: object, id = postId, session: string | null = token) =>
    browser(app, session ?? undefined).post(`/api/forum/posts/${id}/comments`).send(body);
  const flag = (body: object = {}, id = postId, session: string | null = token) =>
    browser(app, session ?? undefined).post(`/api/forum/posts/${id}/flag`).send(body);
  const list = (id = postId) => request(app).get(`/api/forum/posts/${id}/comments`);

  beforeEach(async () => {
    const registered = await browser(app).post('/api/users')
      .send({ email: 'talker@test.com', password: 'Test123@', firstName: 'Tara', lastName: 'Talker' });
    userId = registered.body.id;
    token = sessionToken(await browser(app).post('/api/auth/login').send({ email: 'talker@test.com', password: 'Test123@' }))!;
    postId = await addPost();
  });

  describe('comments', () => {
    it('adds a comment and lists it with its author, oldest first', async () => {
      const first = await comment({ content: '  First!  ' });
      await comment({ content: 'Second' });

      expect(first.status).toBe(201);
      expect(first.body.comment).toEqual({ id: expect.any(String), parentId: null, content: 'First!' });
      const res = await list();
      expect(res.status).toBe(200);
      expect(res.body.comments.map((c: { content: string }) => c.content)).toEqual(['First!', 'Second']);
      expect(res.body.comments[0]).toMatchObject({ authorId: userId, authorName: 'Tara Talker', parentId: null });
    });

    it('adds a reply under a comment of the same post', async () => {
      const parent = (await comment({ content: 'Parent' })).body.comment.id;

      const reply = await comment({ content: 'Reply', parentId: parent });

      expect(reply.status).toBe(201);
      expect((await list()).body.comments[1]).toMatchObject({ parentId: parent, content: 'Reply' });
    });

    it('refuses a reply to a reply, to a missing comment and to a comment of another post', async () => {
      const parent = (await comment({ content: 'Parent' })).body.comment.id;
      const reply = (await comment({ content: 'Reply', parentId: parent })).body.comment.id;
      const other = await addPost({ title: 'Other' });
      const elsewhere = (await comment({ content: 'Elsewhere' }, other)).body.comment.id;

      for (const parentId of [reply, '99999', elsewhere]) {
        const res = await comment({ content: 'No', parentId });
        expect(res.status).toBe(400);
        expect(res.body).toEqual({ errors: { parentId: 'Choose a comment to reply to.' } });
      }
    });

    it.each([
      [{ content: '' }, 'Write your comment.'],
      [{ content: '   ' }, 'Write your comment.'],
      [{}, 'Write your comment.'],
      [{ content: 'x'.repeat(1001) }, 'The comment can be at most 1000 characters.'],
      [{ content: 'a\0b' }, 'The comment contains characters that are not allowed.'],
    ])('refuses %j', async (body, message) => {
      const res = await comment(body);

      expect(res.status).toBe(400);
      expect(res.body).toEqual({ errors: { content: message } });
    });

    it('refuses a bad parentId', async () => {
      const res = await comment({ content: 'Hi', parentId: 'abc' });

      expect(res.body).toEqual({ errors: { parentId: 'Choose a comment to reply to.' } });
    });

    it('needs a login and the CSRF header', async () => {
      expect((await comment({ content: 'Hi' }, postId, null)).status).toBe(401);
      const noCsrf = await request(app).post(`/api/forum/posts/${postId}/comments`).send({ content: 'Hi' });
      expect(noCsrf.status).toBe(403);
    });

    it('keeps markup and SQL as plain text', async () => {
      const text = "<script>alert(1)</script>'; DROP TABLE forum_comments;--";
      await comment({ content: text });

      expect((await list()).body.comments[0].content).toBe(text);
    });

    it('ignores fields it was not asked for', async () => {
      await comment({ content: 'Hi', userId: '999', postId: '999', createdAt: '2000-01-01' });

      const { rows } = await pool.query('SELECT user_id, post_id, created_at FROM forum_comments');
      expect(rows[0].user_id).toBe(userId);
      expect(rows[0].post_id).toBe(postId);
      expect(rows[0].created_at.getFullYear()).toBeGreaterThan(2000);
    });

    it('answers 404 for a missing or hidden post, for reading and writing', async () => {
      const hidden = await addPost({ status: 'hidden' });

      for (const id of ['99999', 'abc', hidden]) {
        expect((await list(id)).status).toBe(404);
        expect((await comment({ content: 'Hi' }, id)).status).toBe(404);
      }
    });

    it('keeps a comment with no name when its author is deleted', async () => {
      await comment({ content: 'Still here' });
      await pool.query('DELETE FROM users WHERE id = $1', [userId]);

      expect((await list()).body.comments[0]).toMatchObject({ content: 'Still here', authorId: null, authorName: null });
    });

    it('goes away with its post', async () => {
      await comment({ content: 'Bye' });
      await pool.query('DELETE FROM forum_posts WHERE id = $1', [postId]);

      expect((await pool.query('SELECT 1 FROM forum_comments')).rowCount).toBe(0);
    });
  });

  describe('flags', () => {
    const statusOf = async (id = postId) => (await pool.query('SELECT status FROM forum_posts WHERE id = $1', [id])).rows[0].status;

    it('flags the post and records who and why', async () => {
      const res = await flag({ reason: '  Spam  ' });

      expect(res.status).toBe(201);
      expect(res.body).toEqual({ flagged: true });
      expect(await statusOf()).toBe('flagged');
      const { rows } = await pool.query('SELECT user_id, reason FROM forum_flags WHERE post_id = $1', [postId]);
      expect(rows).toEqual([{ user_id: userId, reason: 'Spam' }]);
    });

    it('does not need a reason', async () => {
      expect((await flag()).status).toBe(201);
      expect((await pool.query('SELECT reason FROM forum_flags')).rows[0].reason).toBeNull();
    });

    it('counts a member once however often they flag', async () => {
      await flag();
      const again = await flag({ reason: 'Again' });

      expect(again.status).toBe(201);
      expect((await pool.query('SELECT count(*)::int AS n FROM forum_flags')).rows[0].n).toBe(1);
    });

    it('keeps a flagged post visible', async () => {
      await flag();

      expect((await request(app).get(`/api/forum/posts/${postId}`)).status).toBe(200);
      expect((await request(app).get('/api/forum/posts')).body.total).toBe(1);
    });

    it('leaves a hidden post hidden, and answers 404 for it', async () => {
      const hidden = await addPost({ status: 'hidden' });

      expect((await flag({}, hidden)).status).toBe(404);
      expect(await statusOf(hidden)).toBe('hidden');
    });

    it('refuses a reason over 500 characters or with a null character', async () => {
      expect((await flag({ reason: 'x'.repeat(501) })).body).toEqual({ errors: { reason: 'The reason can be at most 500 characters.' } });
      expect((await flag({ reason: 'a\0' })).status).toBe(400);
      expect(await statusOf()).toBe('approved');
    });

    it('needs a login, and answers 404 for a missing post', async () => {
      expect((await flag({}, postId, null)).status).toBe(401);
      expect((await flag({}, '99999')).status).toBe(404);
      expect((await flag({}, 'abc')).status).toBe(404);
      expect(await statusOf()).toBe('approved');
    });
  });
});
