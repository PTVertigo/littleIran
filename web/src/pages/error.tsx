import { isRouteErrorResponse, Link, useRouteError } from 'react-router';

// Screen 5 (error display). REQ-4.2.1 plain wording, never the error's internals
export function ErrorPage() {
  const error = useRouteError();
  // No error means this rendered as the catch-all route for an unknown address
  const notFound = !error || (isRouteErrorResponse(error) && error.status === 404);
  if (error && !notFound) console.error(error);

  return (
    <section className="error-page">
      <h1>{notFound ? 'Page not found' : 'Something went wrong'}</h1>
      <p>
        {notFound
          ? 'The page you are looking for does not exist or has moved.'
          : 'Please try again in a moment.'}
      </p>
      <Link to="/" className="button">
        Go to the home page
      </Link>
    </section>
  );
}
