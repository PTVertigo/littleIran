import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router';

import { ErrorBanner } from '../components/error-banner';
import { Spinner } from '../components/spinner';
import { TextAreaField } from '../components/text-area-field';
import { ApiError, apiRequest } from '../lib/api';
import { formatDateTime } from '../lib/format';
import { useSession } from '../lib/session';

export const COMMENT_MAX = 1000;
export const FLAG_REASON_MAX = 500;

type Comment = {
  id: string;
  parentId: string | null;
  content: string;
  createdAt: string;
  authorId: string | null;
  authorName: string | null;
};

const failure = (err: unknown) => (err instanceof ApiError ? err.message : 'Something went wrong. Please try again.');

// Comments and replies on a post. Anyone can read them; members can write them. Replies go one level deep.
export function Comments({ postId }: { postId: string }) {
  const { state } = useSession();
  const signedIn = state.status === 'signedIn';
  const [comments, setComments] = useState<Comment[] | null>(null);
  const [error, setError] = useState('');
  const [replyTo, setReplyTo] = useState<string | null>(null);

  const load = () =>
    apiRequest<{ comments: Comment[] }>(`/api/forum/posts/${encodeURIComponent(postId)}/comments`)
      .then((body) => setComments(body.comments))
      .catch((err) => setError(failure(err)));

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [postId]);

  const top = (comments ?? []).filter((c) => !c.parentId);
  const repliesTo = (id: string) => (comments ?? []).filter((c) => c.parentId === id);

  return (
    <section aria-labelledby="comments-heading">
      <h2 id="comments-heading">Comments{comments ? ` (${comments.length})` : ''}</h2>
      {error ? (
        <ErrorBanner message={error} />
      ) : !comments ? (
        <Spinner label="Loading comments" />
      ) : top.length === 0 ? (
        <p>No comments yet. Be the first to reply.</p>
      ) : (
        <ul className="comment-list">
          {top.map((comment) => (
            <li key={comment.id}>
              <CommentView comment={comment} />
              {signedIn && replyTo !== comment.id && (
                <p>
                  <button type="button" className="link-button" onClick={() => setReplyTo(comment.id)}>
                    Reply<span className="visually-hidden"> to {comment.authorName ?? 'a former member'}</span>
                  </button>
                </p>
              )}
              {(repliesTo(comment.id).length > 0 || replyTo === comment.id) && (
                <ul className="comment-list comment-list--replies">
                  {repliesTo(comment.id).map((reply) => (
                    <li key={reply.id}>
                      <CommentView comment={reply} />
                    </li>
                  ))}
                  {replyTo === comment.id && (
                    <li>
                      <CommentForm
                        postId={postId}
                        parentId={comment.id}
                        label={`Reply to ${comment.authorName ?? 'a former member'}`}
                        submitLabel="Post reply"
                        onCancel={() => setReplyTo(null)}
                        onPosted={() => {
                          setReplyTo(null);
                          return load();
                        }}
                      />
                    </li>
                  )}
                </ul>
              )}
            </li>
          ))}
        </ul>
      )}

      {signedIn ? (
        <CommentForm postId={postId} parentId={null} label="Add a comment" submitLabel="Post comment" onPosted={load} />
      ) : (
        <p>
          <Link to="/login">Log in</Link> to comment.
        </p>
      )}
    </section>
  );
}

function CommentView({ comment }: { comment: Comment }) {
  return (
    <article>
      <p className="card__meta">
        {comment.authorName ?? 'Former member'} · <time dateTime={comment.createdAt}>{formatDateTime(comment.createdAt)}</time>
      </p>
      <p className="post-body">{comment.content}</p>
    </article>
  );
}

function CommentForm(props: {
  postId: string;
  parentId: string | null;
  label: string;
  submitLabel: string;
  onPosted: () => Promise<unknown> | unknown;
  onCancel?: () => void;
}) {
  const [content, setContent] = useState('');
  const [fieldError, setFieldError] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (loading) return;
    const text = content.trim();
    if (!text) {
      setFieldError('Write your comment.');
      return;
    }
    setFieldError('');
    setError('');
    setLoading(true);
    try {
      await apiRequest(`/api/forum/posts/${encodeURIComponent(props.postId)}/comments`, {
        method: 'POST',
        body: { content: text, ...(props.parentId && { parentId: props.parentId }) },
      });
      setContent('');
      await props.onPosted();
    } catch (err) {
      if (err instanceof ApiError && err.fieldErrors.content) setFieldError(err.fieldErrors.content);
      else setError(failure(err));
    }
    setLoading(false);
  }

  return (
    <form onSubmit={submit} noValidate>
      {error && <ErrorBanner message={error} />}
      <TextAreaField
        label={props.label}
        value={content}
        rows={3}
        maxLength={COMMENT_MAX}
        hint={`Up to ${COMMENT_MAX} characters.`}
        error={fieldError}
        onChange={(e) => setContent(e.target.value)}
      />
      <p>
        <button type="submit" className="button" disabled={loading}>
          {loading ? 'Posting…' : props.submitLabel}
        </button>{' '}
        {props.onCancel && (
          <button type="button" className="link-button" onClick={props.onCancel}>
            Cancel
          </button>
        )}
      </p>
    </form>
  );
}

// Report a post to the administrators. Members only; the reason is optional.
export function FlagPost({ postId }: { postId: string }) {
  const { state } = useSession();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  if (state.status !== 'signedIn') {
    return (
      <p>
        <Link to="/login">Log in</Link> to report this post.
      </p>
    );
  }
  if (sent) {
    return (
      <p role="status" className="success-banner">
        Thank you. The administrators will review this post.
      </p>
    );
  }
  if (!open) {
    return (
      <p>
        <button type="button" className="link-button" onClick={() => setOpen(true)}>
          Report this post
        </button>
      </p>
    );
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (loading) return;
    setLoading(true);
    setError('');
    try {
      await apiRequest(`/api/forum/posts/${encodeURIComponent(postId)}/flag`, { method: 'POST', body: { reason: reason.trim() } });
      setSent(true);
    } catch (err) {
      setError(err instanceof ApiError && err.fieldErrors.reason ? err.fieldErrors.reason : failure(err));
    }
    setLoading(false);
  }

  return (
    <form onSubmit={submit}>
      <h2>Report this post</h2>
      {error && <ErrorBanner message={error} />}
      <TextAreaField
        label="Why are you reporting it? (optional)"
        value={reason}
        rows={3}
        maxLength={FLAG_REASON_MAX}
        hint={`Up to ${FLAG_REASON_MAX} characters.`}
        onChange={(e) => setReason(e.target.value)}
      />
      <p>
        <button type="submit" className="button" disabled={loading}>
          {loading ? 'Sending…' : 'Send report'}
        </button>{' '}
        <button type="button" className="link-button" onClick={() => setOpen(false)}>
          Cancel
        </button>
      </p>
    </form>
  );
}
