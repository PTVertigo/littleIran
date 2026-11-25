import { FORUM_LIMITS, validateForumPost } from '../src/forum-validation';

const valid = () => ({ title: 'Best tea shops', categoryId: '14', content: 'Where do you go for saffron tea?' });
const errorsFor = (changes: object) => validateForumPost({ ...valid(), ...changes }).errors;

// UT-007 forum post validation (REQ-3.5, REQ-4.1.7)
describe('validateForumPost', () => {
  it('accepts a complete post and returns it cleaned up', () => {
    const { errors, value } = validateForumPost({ title: '  Best tea shops ', categoryId: ' 14 ', content: '  Where do you go?  ' });

    expect(errors).toEqual({});
    expect(value).toEqual({ title: 'Best tea shops', categoryId: '14', content: 'Where do you go?' });
  });

  it('asks for every field when the post is empty', () => {
    expect(validateForumPost({}).errors).toEqual({
      title: 'Enter a title for your post.',
      categoryId: 'Choose a category.',
      content: 'Write your post.',
    });
  });

  it.each([undefined, null, 'text', 42, [], true])('treats %p instead of a body as an empty post', (body) => {
    expect(Object.keys(validateForumPost(body).errors).sort()).toEqual(['categoryId', 'content', 'title']);
  });

  it.each(['', '   ', undefined, null, 5, {}, []])('refuses the title %p', (title) => {
    expect(errorsFor({ title }).title).toBe('Enter a title for your post.');
  });

  it('allows a title of exactly the limit and refuses one character more', () => {
    expect(errorsFor({ title: 'a'.repeat(FORUM_LIMITS.title) }).title).toBeUndefined();
    expect(errorsFor({ title: 'a'.repeat(FORUM_LIMITS.title + 1) }).title).toBe(`The title can be at most ${FORUM_LIMITS.title} characters.`);
  });

  it('allows content of exactly the limit and refuses one character more', () => {
    expect(errorsFor({ content: 'a'.repeat(FORUM_LIMITS.content) }).content).toBeUndefined();
    expect(errorsFor({ content: 'a'.repeat(FORUM_LIMITS.content + 1) }).content).toBe(`The post can be at most ${FORUM_LIMITS.content} characters.`);
  });

  it.each(['', 'abc', '0', '-1', '1.5', '1;DROP', 7, null, undefined, ['1']])('refuses the category %p', (categoryId) => {
    expect(errorsFor({ categoryId }).categoryId).toBe('Choose a category.');
  });

  it('refuses a null character, which the database cannot store', () => {
    expect(errorsFor({ title: 'a\0b' }).title).toBe('The title contains characters that are not allowed.');
    expect(errorsFor({ content: 'a\0b' }).content).toBe('The post contains characters that are not allowed.');
  });

  // REQ-4.1.3 markup is kept as typed; it is escaped when shown
  it('keeps markup as plain text instead of changing it', () => {
    const { value } = validateForumPost({ ...valid(), title: '<b>Hi</b>', content: "<script>alert('xss')</script>" });

    expect(value).toMatchObject({ title: '<b>Hi</b>', content: "<script>alert('xss')</script>" });
  });
});
