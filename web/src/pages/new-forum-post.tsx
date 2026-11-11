import { useEffect, useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router';

import { ErrorBanner } from '../components/error-banner';
import { SelectField } from '../components/select-field';
import { Spinner } from '../components/spinner';
import { TextAreaField } from '../components/text-area-field';
import { TextField } from '../components/text-field';
import { ApiError, apiRequest } from '../lib/api';
import { FORUM_LIMITS, validateForumPostForm, type ForumPostForm, type ForumPostFormErrors } from '../lib/forum-validation';

type Category = { id: string; name: string };

const CHECK_MESSAGE = 'Check the fields marked below and try again.';

// REQ-3.5 a member writes a forum post. It is published at once in the category they choose. A category can
// be chosen in advance with ?category=<id>, which is how the "New post" buttons on the forum pages link here.
export function NewForumPostPage() {
  const [params] = useSearchParams();
  const wanted = params.get('category') ?? '';
  const [categories, setCategories] = useState<Category[] | null>(null);
  const [loadError, setLoadError] = useState('');
  const [values, setValues] = useState<ForumPostForm>({ title: '', categoryId: '', content: '' });
  const [fieldErrors, setFieldErrors] = useState<ForumPostFormErrors>({});
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [posted, setPosted] = useState<{ title: string; categoryId: string; categoryName: string } | null>(null);

  useEffect(() => {
    apiRequest<{ categories: Category[] }>('/api/categories?type=forum')
      .then((body) => {
        setCategories(body.categories);
        // Only a category that exists can be chosen in advance
        if (body.categories.some((c) => c.id === wanted)) setValues((v) => ({ ...v, categoryId: wanted }));
      })
      .catch((err) => setLoadError(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.'));
  }, [wanted]);

  function bind(field: keyof ForumPostForm) {
    return {
      value: values[field],
      error: fieldErrors[field],
      onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
        setValues({ ...values, [field]: e.target.value }),
    };
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (loading) return;

    const errors = validateForumPostForm(values);
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) {
      setError(CHECK_MESSAGE);
      return;
    }
    setError('');

    setLoading(true);
    try {
      const { post } = await apiRequest<{ post: { id: string; title: string; categoryId: string } }>('/api/forum/posts', {
        method: 'POST',
        body: { title: values.title.trim(), categoryId: values.categoryId, content: values.content.trim() },
      });
      const categoryName = categories?.find((c) => c.id === post.categoryId)?.name ?? 'the forum';
      setPosted({ title: post.title, categoryId: post.categoryId, categoryName });
    } catch (err) {
      if (err instanceof ApiError && Object.keys(err.fieldErrors).length > 0) {
        setFieldErrors(err.fieldErrors as ForumPostFormErrors);
        setError(CHECK_MESSAGE);
      } else {
        setError(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.');
      }
    }
    setLoading(false);
  }

  if (posted) {
    return (
      <section className="form-page">
        <h1>Post published</h1>
        <p role="status" className="success-banner">
          Thank you. Your post “{posted.title}” is now in {posted.categoryName}.
        </p>
        <p className="form-footer">
          <Link to={`/forum/categories/${posted.categoryId}`}>See the posts in {posted.categoryName}</Link>
        </p>
        <p className="form-footer">
          <button
            type="button"
            className="link-button"
            onClick={() => {
              setValues({ title: '', categoryId: values.categoryId, content: '' });
              setFieldErrors({});
              setPosted(null);
            }}>
            Write another post
          </button>
        </p>
      </section>
    );
  }

  return (
    <section className="form-page">
      <h1>New forum post</h1>
      <p className="muted">Share a question, a recommendation or an idea with the community. Please be kind and respectful.</p>

      {loadError && <ErrorBanner message={loadError} />}
      {!loadError && !categories && <Spinner label="Loading the form" />}

      {categories && (
        <form onSubmit={submit} noValidate className="form">
          {error && <ErrorBanner message={error} />}
          <TextField label="Title" maxLength={FORUM_LIMITS.title} {...bind('title')} />
          <SelectField
            label="Category"
            placeholder="Choose a category"
            options={categories.map((c) => ({ value: c.id, label: c.name }))}
            {...bind('categoryId')}
          />
          <TextAreaField label="Post" rows={8} hint={`Up to ${FORUM_LIMITS.content} characters.`} {...bind('content')} />
          <button type="submit" className="button" disabled={loading}>
            {loading ? 'Publishing…' : 'Publish post'}
          </button>
        </form>
      )}

      <p className="form-footer">
        <Link to="/forum">Back to the forum</Link>
      </p>
    </section>
  );
}
