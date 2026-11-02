import { useEffect, useState } from 'react';
import { Link } from 'react-router';

import { ErrorBanner } from '../components/error-banner';
import { Spinner } from '../components/spinner';
import { ApiError, apiRequest } from '../lib/api';

type Business = { id: string; name: string; category: string; city: string; description: string };

// Screen 6 (business directory). REQ-3.3.1 every approved business, open to everyone
export function BusinessesPage() {
  const [businesses, setBusinesses] = useState<Business[] | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    apiRequest<{ businesses: Business[] }>('/api/businesses')
      .then((body) => setBusinesses(body.businesses))
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.'));
  }, []);

  return (
    <section>
      <h1>Business directory</h1>
      <p className="muted">Iranian-owned businesses across Southern Ontario.</p>

      {error && <ErrorBanner message={error} />}
      {!error && !businesses && <Spinner label="Loading businesses" />}
      {businesses?.length === 0 && <p>No businesses have been listed yet.</p>}
      {businesses && businesses.length > 0 && (
        <>
          <p>{`${businesses.length} ${businesses.length === 1 ? 'business' : 'businesses'}`}</p>
          <ul className="card-grid">
            {businesses.map((business) => (
              <li key={business.id}>
                <article className="card">
                  <h2>
                    {/* REQ-3.3.2 */}
                    <Link to={`/businesses/${business.id}`}>{business.name}</Link>
                  </h2>
                  <p className="card__meta">
                    {business.category} · {business.city}
                  </p>
                  <p>{business.description}</p>
                </article>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
