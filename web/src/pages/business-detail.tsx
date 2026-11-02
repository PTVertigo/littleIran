import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router';

import { ErrorBanner } from '../components/error-banner';
import { Spinner } from '../components/spinner';
import { ApiError, apiRequest } from '../lib/api';
import { DAY_NAMES, formatTime, safeWebUrl } from '../lib/format';

type Hours = { day: number; opens: string; closes: string };
type BusinessDetail = {
  id: string;
  name: string;
  category: string;
  description: string;
  street: string;
  city: string;
  postalCode: string;
  phone: string;
  email: string;
  website: string | null;
  hours: Hours[];
};

// Screen 6 detail. REQ-3.3.2 name, address, phone, email, website, hours, description and category.
// Keyed by the id, so moving from one business to another starts from a clean state.
export function BusinessDetailPage() {
  const { id = '' } = useParams();
  return <BusinessDetailView key={id} id={id} />;
}

function BusinessDetailView({ id }: { id: string }) {
  const [business, setBusiness] = useState<BusinessDetail | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let current = true;
    apiRequest<{ business: BusinessDetail }>(`/api/businesses/${encodeURIComponent(id)}`)
      .then((body) => current && setBusiness(body.business))
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
      <Link to="/businesses">Back to the business directory</Link>
    </p>
  );

  if (notFound) {
    return (
      <section>
        {back}
        <h1>Business not found</h1>
        <p>This business does not exist, or it has not been published.</p>
      </section>
    );
  }

  if (!business) {
    return (
      <section>
        {back}
        <h1>Business</h1>
        {error ? <ErrorBanner message={error} /> : <Spinner label="Loading the business" />}
      </section>
    );
  }

  const website = safeWebUrl(business.website);
  const phoneDigits = business.phone.replace(/[^\d+]/g, '');
  const hoursByDay = new Map(business.hours.map((h) => [h.day, h]));

  return (
    <section>
      {back}
      <h1>{business.name}</h1>
      <p className="card__meta">
        {business.category} · {business.city}
      </p>
      <p>{business.description}</p>

      <h2>Contact</h2>
      <dl className="details">
        <dt>Address</dt>
        <dd>{`${business.street}, ${business.city} ${business.postalCode}`}</dd>
        <dt>Phone</dt>
        <dd>{phoneDigits ? <a href={`tel:${phoneDigits}`}>{business.phone}</a> : business.phone}</dd>
        <dt>Email</dt>
        <dd>
          <a href={`mailto:${business.email}`}>{business.email}</a>
        </dd>
        {business.website && (
          <>
            <dt>Website</dt>
            <dd>
              {website ? (
                <a href={website} rel="noopener noreferrer">
                  {business.website}
                </a>
              ) : (
                business.website
              )}
            </dd>
          </>
        )}
      </dl>

      <h2>Hours</h2>
      {business.hours.length === 0 ? (
        <p>Opening hours have not been provided.</p>
      ) : (
        <table className="hours">
          <caption className="visually-hidden">Opening hours</caption>
          <tbody>
            {DAY_NAMES.map((name, index) => {
              const open = hoursByDay.get(index + 1);
              return (
                <tr key={name}>
                  <th scope="row">{name}</th>
                  <td>{open ? `${formatTime(open.opens)} – ${formatTime(open.closes)}` : 'Closed'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </section>
  );
}
