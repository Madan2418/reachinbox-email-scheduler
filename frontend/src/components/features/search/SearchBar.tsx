import { useState } from 'react';
import { useEmailSearch } from '../../../api/hooks';
import { StatusBadge } from '../../ui/Badge';
import { formatDateTime } from '../../../lib/format';

export function SearchBar() {
  const [query, setQuery] = useState('');
  const [debouncedQ, setDebouncedQ] = useState('');
  const { data } = useEmailSearch(debouncedQ);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setQuery(val);
    clearTimeout((window as Window & { _searchTimer?: number })._searchTimer);
    (window as Window & { _searchTimer?: number })._searchTimer = window.setTimeout(() => {
      setDebouncedQ(val);
    }, 400);
  };

  return (
    <div className="search-wrap">
      <div className="search-input-wrap">
        <svg className="search-icon" width="16" height="16" viewBox="0 0 16 16" fill="none">
          <circle cx="6.5" cy="6.5" r="4" stroke="var(--ink-muted)" strokeWidth="1.5"/>
          <path d="M9.5 9.5L13 13" stroke="var(--ink-muted)" strokeWidth="1.5" strokeLinecap="round"/>
        </svg>
        <input
          id="email-search"
          className="search-input"
          placeholder="Search emails..."
          value={query}
          onChange={handleChange}
          aria-label="Search emails"
        />
        {query && (
          <button
            className="search-clear"
            onClick={() => { setQuery(''); setDebouncedQ(''); }}
            aria-label="Clear search"
          >
            ×
          </button>
        )}
      </div>

      {debouncedQ && data && (
        <div className="search-results">
          {data.results.length === 0 ? (
            <div className="search-empty">No results for "{debouncedQ}"</div>
          ) : (
            <>
              <div className="search-results-header">
                {data.total} result{data.total !== 1 ? 's' : ''} for "{debouncedQ}"
              </div>
              {data.results.map((r) => (
                <div key={r.id} className="search-result-item">
                  <div className="search-result-main">
                    <span className="search-result-to truncate">{r.to}</span>
                    <StatusBadge status={r.status} />
                  </div>
                  <div className="search-result-subject truncate">{r.subject}</div>
                  <div className="search-result-time tabular-nums">
                    {formatDateTime(r.scheduledAt)}
                  </div>
                </div>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}
