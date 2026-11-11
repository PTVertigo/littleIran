import { FORUM_LIMITS, validateForumPostForm } from './forum-validation';

const valid = () => ({ title: 'Best tea shops', categoryId: '14', content: 'Where do you go for saffron tea?' });
const errorsFor = (changes: object) => validateForumPostForm({ ...valid(), ...changes });

// UT-007 forum post validation (REQ-3.5, REQ-4.1.7), browser side
describe('validateForumPostForm', () => {
  it('accepts a complete post', () => {
    expect(validateForumPostForm(valid())).toEqual({});
  });

  it('asks for every field when the form is empty', () => {
    expect(validateForumPostForm({ title: '', categoryId: '', content: '' })).toEqual({
      title: 'Enter a title for your post.',
      categoryId: 'Choose a category.',
      content: 'Write your post.',
    });
  });

  it('treats spaces alone as nothing', () => {
    expect(errorsFor({ title: '   ', content: '  \n ' })).toEqual({
      title: 'Enter a title for your post.',
      content: 'Write your post.',
    });
  });

  it('allows a title of exactly the limit and refuses one character more', () => {
    expect(errorsFor({ title: 'a'.repeat(FORUM_LIMITS.title) }).title).toBeUndefined();
    expect(errorsFor({ title: 'a'.repeat(FORUM_LIMITS.title + 1) }).title).toBe(`The title can be at most ${FORUM_LIMITS.title} characters.`);
  });

  it('allows a post of exactly the limit and refuses one character more', () => {
    expect(errorsFor({ content: 'a'.repeat(FORUM_LIMITS.content) }).content).toBeUndefined();
    expect(errorsFor({ content: 'a'.repeat(FORUM_LIMITS.content + 1) }).content).toBe(`The post can be at most ${FORUM_LIMITS.content} characters.`);
  });

  it('uses the same limits as the server', () => {
    expect(FORUM_LIMITS).toEqual({ title: 150, content: 5000 });
  });

  it('accepts markup, which is shown as plain text', () => {
    expect(errorsFor({ title: '<b>Hi</b>', content: "<script>alert('xss')</script>" })).toEqual({});
  });
});
