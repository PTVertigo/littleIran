import { Link } from 'react-router';

export function HomePage() {
  return (
    <section className="hero">
      <h1>LittleIran</h1>
      <p className="lead">
        Discover Iranian businesses, events and community across Southern Ontario.
      </p>
      <p>
        <Link to="/businesses" className="button">
          Browse businesses
        </Link>{' '}
        <Link to="/events" className="button">
          Browse events
        </Link>{' '}
        <Link to="/forum" className="button">
          Join the forum
        </Link>
      </p>
    </section>
  );
}
