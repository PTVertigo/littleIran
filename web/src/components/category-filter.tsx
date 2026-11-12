import { useEffect, useId, useState } from 'react';

import { apiRequest } from '../lib/api';

type Category = { id: string; name: string };

// REQ-3.7.4 / 3.7.5 one button per category of the given kind, plus "All". The pressed one is the one in use.
export function CategoryFilter({
  type,
  selected,
  onSelect,
}: {
  type: 'business' | 'event' | 'forum';
  selected: string;
  onSelect: (name: string) => void;
}) {
  const [categories, setCategories] = useState<Category[]>([]);
  const labelId = useId();

  useEffect(() => {
    apiRequest<{ categories: Category[] }>(`/api/categories?type=${type}`)
      .then((body) => setCategories(body.categories))
      // The page works without the filter, so a failed request just leaves it out
      .catch((err) => console.error(err));
  }, [type]);

  if (categories.length === 0) return null;

  return (
    <div role="group" aria-labelledby={labelId} className="filter">
      <p id={labelId} className="filter__label">
        Filter by category
      </p>
      <ul className="filter__list">
        <li>
          <button type="button" className="chip" aria-pressed={!selected} onClick={() => onSelect('')}>
            All
          </button>
        </li>
        {categories.map((category) => (
          <li key={category.id}>
            <button
              type="button"
              className="chip"
              aria-pressed={selected.toLowerCase() === category.name.toLowerCase()}
              onClick={() => onSelect(category.name)}>
              {category.name}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
