import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router';

const SITE = 'LittleIran';

// The title that goes with a page heading: "Events – LittleIran", and just "LittleIran" for the home page
export function titleFor(heading: string): string {
  const text = heading.trim();
  return !text || text === SITE ? SITE : `${text} – ${SITE}`;
}

// REQ-4.3.3 / WCAG 2.4.2 every page has its own title, taken from its main heading, so a screen reader user
// (and anyone with several tabs open) can tell the pages apart. The headings of pages that load their content
// first (an event's name, "Business submitted") are picked up when they appear.
// REQ-4.3.2 / WCAG 2.4.3 when the page changes without a reload, keyboard focus moves to the start of the new
// page; otherwise it would stay on the link that was used, which has just disappeared.
export function useRouteChrome() {
  const { pathname } = useLocation();
  const first = useRef(true);

  useEffect(() => {
    const main = document.getElementById('main');
    if (!main) return;

    const update = () => {
      document.title = titleFor(main.querySelector('h1')?.textContent ?? '');
    };
    update();

    // The first page is the one the browser just loaded; there is nothing to move focus away from
    if (first.current) first.current = false;
    else main.focus();

    const observer = new MutationObserver(update);
    observer.observe(main, { childList: true, subtree: true, characterData: true });
    return () => observer.disconnect();
  }, [pathname]);
}
