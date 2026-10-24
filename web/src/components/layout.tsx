import { useState } from 'react';
import { Link, NavLink, Outlet, useNavigate } from 'react-router';

import { ApiError } from '../lib/api';
import { useSession } from '../lib/session';
import { ErrorBanner } from './error-banner';
import { Spinner } from './spinner';

const YEAR = new Date().getFullYear();

// REQ-4.3.3 / ACC-004 every page shares the same landmarks: banner, navigation, main, contentinfo
export function Layout() {
  const { state, signOut } = useSession();
  const navigate = useNavigate();
  const [logoutError, setLogoutError] = useState('');

  async function logOut() {
    setLogoutError('');
    // Leave first: on a protected page, clearing the session would make RequireAuth redirect to login
    navigate('/');
    try {
      await signOut();
    } catch (err) {
      setLogoutError(err instanceof ApiError ? err.message : 'Could not log out. Please try again.');
    }
  }

  return (
    <>
      <a className="skip-link" href="#main">
        Skip to main content
      </a>
      <header className="site-header">
        <div className="container site-header__inner">
          <Link to="/" className="brand">
            <img src="/icon.png" alt="" width={32} height={32} />
            LittleIran
          </Link>
          <nav aria-label="Main">
            <ul className="nav-list">
              <li>
                <NavLink to="/" end>
                  Home
                </NavLink>
              </li>
              {state.status === 'signedIn' && (
                <>
                  <li>
                    <NavLink to="/dashboard">Dashboard</NavLink>
                  </li>
                  <li>
                    <button type="button" className="link-button" onClick={logOut}>
                      Log out
                    </button>
                  </li>
                </>
              )}
              {state.status === 'signedOut' && (
                <li>
                  <NavLink to="/login">Log in</NavLink>
                </li>
              )}
            </ul>
          </nav>
        </div>
      </header>
      <main id="main" className="container" tabIndex={-1}>
        {logoutError && <ErrorBanner message={logoutError} />}
        {state.status === 'loading' ? <Spinner /> : <Outlet />}
      </main>
      <footer className="site-footer">
        <div className="container">© {YEAR} LittleIran</div>
      </footer>
    </>
  );
}
