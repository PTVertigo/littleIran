import { isRecordId } from './validation';

// REQ-4.1.7 the rules for a new forum post. web/src/lib/forum-validation.ts applies the same ones in the
// browser; this is the copy that counts, because requests can skip the page.
export const FORUM_LIMITS = { title: 150, content: 5000 } as const;

export type ValidForumPost = { title: string; categoryId: string; content: string };

const text = (value: unknown) => (typeof value === 'string' ? value.trim() : '');

// UT-007 / REQ-3.5: a post with missing or bad fields gets one message per field, and nothing else.
// REQ-4.1.3 the text is kept exactly as typed; it is escaped where it is shown, never stripped here.
export function validateForumPost(body: unknown): { errors: Record<string, string>; value?: ValidForumPost } {
  const input = (body && typeof body === 'object' ? body : {}) as Record<string, unknown>;
  const errors: Record<string, string> = {};

  const title = text(input.title);
  if (!title) errors.title = 'Enter a title for your post.';
  else if (title.length > FORUM_LIMITS.title) errors.title = `The title can be at most ${FORUM_LIMITS.title} characters.`;
  else if (title.includes('\0')) errors.title = 'The title contains characters that are not allowed.';

  const categoryId = typeof input.categoryId === 'string' ? input.categoryId.trim() : '';
  if (!isRecordId(categoryId)) errors.categoryId = 'Choose a category.';

  const content = text(input.content);
  if (!content) errors.content = 'Write your post.';
  else if (content.length > FORUM_LIMITS.content) errors.content = `The post can be at most ${FORUM_LIMITS.content} characters.`;
  else if (content.includes('\0')) errors.content = 'The post contains characters that are not allowed.';

  if (Object.keys(errors).length > 0) return { errors };
  return { errors, value: { title, categoryId, content } };
}

export const COMMENT_MAX = 1000;
export const FLAG_REASON_MAX = 500;

// A comment, or a reply when parentId is given. Kept as typed, escaped where it is shown (REQ-4.1.3).
export function validateComment(body: unknown): { errors: Record<string, string>; value?: { content: string; parentId: string | null } } {
  const input = (body && typeof body === 'object' ? body : {}) as Record<string, unknown>;
  const errors: Record<string, string> = {};

  const content = text(input.content);
  if (!content) errors.content = 'Write your comment.';
  else if (content.length > COMMENT_MAX) errors.content = `The comment can be at most ${COMMENT_MAX} characters.`;
  else if (content.includes('\0')) errors.content = 'The comment contains characters that are not allowed.';

  let parentId: string | null = null;
  if (input.parentId !== undefined && input.parentId !== null) {
    if (typeof input.parentId === 'string' && isRecordId(input.parentId)) parentId = input.parentId;
    else errors.parentId = 'Choose a comment to reply to.';
  }

  if (Object.keys(errors).length > 0) return { errors };
  return { errors, value: { content, parentId } };
}

// The reason is optional.
export function validateFlag(body: unknown): { errors: Record<string, string>; value?: { reason: string | null } } {
  const input = (body && typeof body === 'object' ? body : {}) as Record<string, unknown>;
  const reason = text(input.reason);
  if (reason.length > FLAG_REASON_MAX) return { errors: { reason: `The reason can be at most ${FLAG_REASON_MAX} characters.` } };
  if (reason.includes('\0')) return { errors: { reason: 'The reason contains characters that are not allowed.' } };
  return { errors: {}, value: { reason: reason || null } };
}
