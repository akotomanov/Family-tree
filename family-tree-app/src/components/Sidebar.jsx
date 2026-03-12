import './Sidebar.css';

function formatDate(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}.${month}.${year}`;
}

function PersonLinks({ names, onPersonClick }) {
  if (!names || names.length === 0) return null;
  return names.map((name, i) => (
    <span key={name}>
      {i > 0 && ', '}
      <a
        className="sidebar__link"
        href="#"
        onClick={(e) => { e.preventDefault(); onPersonClick(name); }}
      >
        {name}
      </a>
    </span>
  ));
}

export default function Sidebar({ person, isOpen, onClose, onPersonClick }) {
  if (!person) return null;

  const dateStr = formatDate(person.dateOfBirth);
  const rawPhoto = person.photos && person.photos.length > 0 ? person.photos[0] : null;
  const photoSrc = rawPhoto ? (rawPhoto.startsWith('/') || rawPhoto.startsWith('http') ? rawPhoto : `/photos/${rawPhoto}`) : null;

  const rows = [
    { label: 'Place of birth', value: person.placeOfBirth },
    { label: 'Sex', value: person.sex === 'M' ? 'Male' : person.sex === 'F' ? 'Female' : null },
    { label: 'Parents', links: person.parents },
    { label: 'Siblings', links: person.siblings },
    { label: 'Partner', links: person.partner ? [person.partner] : null },
    { label: 'Ex-partner', links: person.exPartners?.length > 0 ? person.exPartners : null },
    { label: 'Children', links: person.children },
  ];

  // Strip markdown headers from bio
  const bioText = person.bio
    ? person.bio.replace(/^##?\s+\w+\n/gm, '').trim()
    : null;

  return (
    <div className={`sidebar ${isOpen ? '' : 'sidebar--hidden'}`}>
      <button className="sidebar__close" onClick={onClose} aria-label="Close sidebar">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <line x1="6" y1="6" x2="18" y2="18" />
          <line x1="18" y1="6" x2="6" y2="18" />
        </svg>
      </button>

      <div className="sidebar__content">
        <div className="sidebar__photo">
          {photoSrc && <img src={photoSrc} alt={person.name} />}
        </div>

        <div className="sidebar__header">
          <div className="sidebar__name">{person.name}</div>
          {dateStr && <div className="sidebar__date">{dateStr}</div>}
        </div>

        <div className="sidebar__details">
          {rows.map(({ label, value, links }) => {
            if (!value && (!links || links.length === 0)) return null;
            return [
              <span className="sidebar__label" key={`${label}-label`}>{label}</span>,
              <span className="sidebar__value" key={`${label}-value`}>
                {links ? (
                  <PersonLinks names={links} onPersonClick={onPersonClick} />
                ) : (
                  value
                )}
              </span>,
            ];
          })}
        </div>

        {bioText && (
          <div className="sidebar__bio">
            <div className="sidebar__bio-title">Bio</div>
            <div className="sidebar__bio-text">{bioText}</div>
          </div>
        )}
      </div>
    </div>
  );
}
