import { useEffect, useRef, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router';

import { ErrorBanner } from '../components/error-banner';
import { Pagination } from '../components/pagination';
import { Spinner } from '../components/spinner';
import { ApiError, apiRequest } from '../lib/api';
import { formatDateTime } from '../lib/format';

type ForumPost = {
  id: string;
  title: string;
  excerpt: string;
  createdAt: string;
  views: number;
  authorId: string | null;
  authorName: string | null;
};

type Result = {
  category: { id: string; name: string };
  posts: ForumPost[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

// REQ-3.5.2 the posts of one forum category, newest first, open to everyone. REQ-3.7.9 fifteen posts a page,
// with page navigation; the page lives in the address (?page=...), so it can be shared and the back button works.
// Keyed by the category, so moving to another one starts from a clean state.
export function ForumCategoryPage() {
  const { id = '' } = useParams();
  return <ForumCategoryView key={id} id={id} />;
}

function ForumCategoryView({ id }: { id: string }) {
  const [params, setParams] = useSearchParams();
  const rawPage = params.get('page') ?? '';
  const page = /^[1-9]\d{0,5}$/.test(rawPage) ? Number(rawPage) : 1;
  const [result, setResult] = useState<Result | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState('');
  const statusRef = useRef<HTMLParagraphElement>(null);
  const movedPage = useRef(false);

  useEffect(() => {
    let current = true;
    apiRequest<Result>(`/api/forum/categories/${encodeURIComponent(id)}/posts${page > 1 ? `?page=${page}` : ''}`)
      .then((body) => current && setResult(body))
      .catch((err) => {
        if (!current) return;
        if (err instanceof ApiError && err.status === 404) setNotFound(true);
        else setError(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.');
      });
    return () => {
      current = false;
    };
  }, [id, page]);

  // After the buttons are used the new page has arrived above them, so keyboard focus goes to the line that
  // says which page it is; the next Tab is the first post
  useEffect(() => {
    if (result && movedPage.current) {
      movedPage.current = false;
      statusRef.current?.focus();
    }
  }, [result]);

  const back = (
    <p>
      <Link to="/forum">All forum categories</Link>
    </p>
  );

  if (notFound) {
    return (
      <section>
        {back}
        <h1>Category not found</h1>
        <p>There is no forum category here. Choose one from the list of categories.</p>
      </section>
    );
  }
  if (error) {
    return (
      <section>
        {back}
        <ErrorBanner message={error} />
      </section>
    );
  }
  if (!result) return <Spinner label="Loading posts" />;

  const { category, posts, total, totalPages } = result;
  const changePage = (n: number) => {
    movedPage.current = true;
    const next = new URLSearchParams(params);
    if (n > 1) next.set('page', String(n));
    else next.delete('page');
    setParams(next);
  };

  const noun = total === 1 ? 'post' : 'posts';
  const first = (result.page - 1) * result.pageSize + 1;
  const summary =
    posts.length === 0 && total > 0
      ? `There is no page ${result.page}. This category has ${totalPages} ${totalPages === 1 ? 'page' : 'pages'}.`
      : totalPages === 1
        ? `${total} ${noun}`
        : `Showing ${first}–${first + posts.length - 1} of ${total} ${noun}. Page ${result.page} of ${totalPages}.`;

  return (
    <section>
      {back}
      <h1>{category.name}</h1>
      <p className="page-actions">
        <Link to={`/forum/posts/new?category=${category.id}`} className="button">
          New post
        </Link>
      </p>
      {total === 0 ? (
        <p>There are no posts in this category yet.</p>
      ) : (
        <>
          {/* A status message, so a screen reader announces how many posts there are */}
          <p role="status" tabIndex={-1} ref={statusRef}>
            {summary}
          </p>
          {posts.length === 0 ? (
            <p>
              <button type="button" className="link-button" onClick={() => changePage(1)}>
                Go to the first page
              </button>
            </p>
          ) : (
            <ul className="card-grid" aria-busy={result.page !== page}>
              {posts.map((post) => (
                <li key={post.id}>
                  <article className="card">
                    <h2>
                      <Link to={`/forum/posts/${post.id}`}>{post.title}</Link>
                    </h2>
                    <p className="card__meta">
                      {post.authorName ?? 'Former member'} · <time dateTime={post.createdAt}>{formatDateTime(post.createdAt)}</time> ·{' '}
                      {post.views} {post.views === 1 ? 'view' : 'views'}
                    </p>
                    <p>{post.excerpt}</p>
                  </article>
                </li>
              ))}
            </ul>
          )}
          <Pagination page={page} totalPages={totalPages} label="Forum post pages" onChange={changePage} />
        </>
      )}
    </section>
  );
}
