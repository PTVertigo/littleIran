import { Link, NavLink, Outlet } from 'react-router';

import { useSession } from '../lib/session';
import { Spinner } from './spinner';

const YEAR = new Date().getFullYear();

// REQ-4.3.3 / ACC-004 every page shares the same landmarks: banner, navigation, main, contentinfo
export function Layout() {
  const { state } = useSession();

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
            </ul>
          </nav>
        </div>
      </header>
      <main id="main" className="container" tabIndex={-1}>
        {state.status === 'loading' ? <Spinner /> : <Outlet />}
      </main>
      <footer className="site-footer">
        <div className="container">© {YEAR} LittleIran</div>
      </footer>
    </>
  );
}
