import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router';

import { ErrorBanner } from '../components/error-banner';
import { Spinner } from '../components/spinner';
import { ApiError, apiRequest } from '../lib/api';
import { formatDateTime } from '../lib/format';

type Post = {
  id: string;
  title: string;
  content: string;
  views: number;
  createdAt: string;
  editedAt: string | null;
  categoryId: string;
  category: string;
  authorId: string | null;
  authorName: string | null;
};

// One forum post in full, open to everyone. The text is shown as typed (line breaks kept, markup shown as
// plain text). Keyed by the id, so moving from one post to another starts from a clean state.
export function ForumPostPage() {
  const { id = '' } = useParams();
  return <ForumPostView key={id} id={id} />;
}

function ForumPostView({ id }: { id: string }) {
  const [post, setPost] = useState<Post | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let current = true;
    apiRequest<{ post: Post }>(`/api/forum/posts/${encodeURIComponent(id)}`)
      .then((body) => current && setPost(body.post))
      .catch((err) => {
        if (!current) return;
        if (err instanceof ApiError && err.status === 404) setNotFound(true);
        else setError(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.');
      });
    return () => {
      current = false;
    };
  }, [id]);

  const back = (
    <p>
      <Link to="/forum">All forum categories</Link>
    </p>
  );

  if (notFound) {
    return (
      <section>
        {back}
        <h1>Post not found</h1>
        <p>This post does not exist, or it has been removed.</p>
      </section>
    );
  }

  if (!post) {
    return (
      <section>
        {back}
        <h1>Forum post</h1>
        {error ? <ErrorBanner message={error} /> : <Spinner label="Loading the post" />}
      </section>
    );
  }

  return (
    <section>
      <p>
        <Link to={`/forum/categories/${post.categoryId}`}>Back to {post.category}</Link>
      </p>
      <article>
        <h1>{post.title}</h1>
        <p className="card__meta">
          {post.category} · {post.authorName ?? 'Former member'} · <time dateTime={post.createdAt}>{formatDateTime(post.createdAt)}</time>
          {post.editedAt && (
            <>
              {' '}
              · Edited <time dateTime={post.editedAt}>{formatDateTime(post.editedAt)}</time>
            </>
          )}{' '}
          · {post.views} {post.views === 1 ? 'view' : 'views'}
        </p>
        <p className="post-body">{post.content}</p>
      </article>
    </section>
  );
}
