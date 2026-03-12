import { useState, useRef, useEffect } from 'react';
import './SearchBar.css';

export default function SearchBar({ people, onSelect }) {
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const wrapperRef = useRef(null);

  const results = query.length >= 1
    ? Object.keys(people)
        .filter(name => name.toLowerCase().includes(query.toLowerCase()))
        .slice(0, 20)
    : [];

  useEffect(() => {
    function handleClickOutside(e) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  function handleSelect(name) {
    onSelect(name);
    setQuery('');
    setIsOpen(false);
  }

  return (
    <div className="search-bar" ref={wrapperRef}>
      <div className="search-bar__input-wrapper">
        <div className="search-bar__icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="7" />
            <line x1="16.5" y1="16.5" x2="21" y2="21" />
          </svg>
        </div>
        <input
          className="search-bar__input"
          type="text"
          placeholder="Find a person"
          value={query}
          onChange={e => { setQuery(e.target.value); setIsOpen(true); }}
          onFocus={() => setIsOpen(true)}
        />
      </div>

      {isOpen && query.length >= 1 && (
        <div className="search-bar__dropdown">
          {results.length > 0 ? (
            results.map(name => (
              <div
                key={name}
                className="search-bar__result"
                onClick={() => handleSelect(name)}
              >
                {name}
              </div>
            ))
          ) : (
            <div className="search-bar__no-results">No results</div>
          )}
        </div>
      )}
    </div>
  );
}
