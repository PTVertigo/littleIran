// REQ-4.1.7 the same rules as server/src/forum-validation.ts, checked before anything is sent.
// The server still checks everything again, and it is the copy that counts.
export const FORUM_LIMITS = { title: 150, content: 5000 } as const;

export type ForumPostForm = { title: string; categoryId: string; content: string };
export type ForumPostFormErrors = Partial<Record<keyof ForumPostForm, string>>;

// UT-007 (REQ-3.5): one message per field that is missing or too long
export function validateForumPostForm(form: ForumPostForm): ForumPostFormErrors {
  const errors: ForumPostFormErrors = {};
  const title = form.title.trim();
  const content = form.content.trim();

  if (!title) errors.title = 'Enter a title for your post.';
  else if (title.length > FORUM_LIMITS.title) errors.title = `The title can be at most ${FORUM_LIMITS.title} characters.`;

  if (!form.categoryId) errors.categoryId = 'Choose a category.';

  if (!content) errors.content = 'Write your post.';
  else if (content.length > FORUM_LIMITS.content) errors.content = `The post can be at most ${FORUM_LIMITS.content} characters.`;

  return errors;
}
