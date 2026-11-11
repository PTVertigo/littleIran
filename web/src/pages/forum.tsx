import { useEffect, useState } from 'react';
import { Link } from 'react-router';

import { ErrorBanner } from '../components/error-banner';
import { Spinner } from '../components/spinner';
import { ApiError, apiRequest } from '../lib/api';

type ForumCategory = { id: string; name: string };

// REQ-3.5.1 the discussion forum lists every forum category, open to everyone. Each one opens its
// posts (REQ-3.5.2).
export function ForumPage() {
  const [categories, setCategories] = useState<ForumCategory[] | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    apiRequest<{ categories: ForumCategory[] }>('/api/categories?type=forum')
      .then((body) => setCategories(body.categories))
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.'));
  }, []);

  return (
    <section>
      <h1>Discussion forum</h1>
      <p className="muted">Ask questions, share recommendations and plan together with the community.</p>
      <p className="page-actions">
        <Link to="/forum/posts/new" className="button">
          New post
        </Link>
      </p>
      {error ? (
        <ErrorBanner message={error} />
      ) : !categories ? (
        <Spinner label="Loading forum categories" />
      ) : categories.length === 0 ? (
        <p>The forum has no categories yet.</p>
      ) : (
        <>
          <h2>Categories</h2>
          <ul className="card-grid">
            {categories.map((category) => (
              <li key={category.id}>
                <article className="card">
                  <h3>
                    <Link to={`/forum/categories/${category.id}`}>{category.name}</Link>
                  </h3>
                </article>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
