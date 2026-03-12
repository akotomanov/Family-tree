import { memo } from 'react';
import { Handle, Position } from 'reactflow';
import './PersonNode.css';

function formatDate(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}.${month}.${year}`;
}

const PersonNode = memo(({ data }) => {
  if (!data || !data.person) {
    return null;
  }

  const { person, isSelected } = data;
  const dateStr = formatDate(person.dateOfBirth);
  const rawPhoto = person.photos && person.photos.length > 0 ? person.photos[0] : null;
  const photoSrc = rawPhoto ? (rawPhoto.startsWith('/') || rawPhoto.startsWith('http') ? rawPhoto : `/photos/${rawPhoto}`) : null;

  const className = [
    'person-node',
    isSelected && 'person-node--selected',
  ].filter(Boolean).join(' ');

  return (
    <div className={className}>
      <Handle type="target" position={Position.Top} />

      <div className="person-node__photo">
        {photoSrc && <img src={photoSrc} alt={person.name} />}
      </div>

      <div className="person-node__labels">
        <div className="person-node__name" title={person.name}>
          {person.name}
        </div>
        {dateStr && (
          <div className="person-node__date">{dateStr}</div>
        )}
      </div>

      <Handle type="source" position={Position.Bottom} />
    </div>
  );
});

PersonNode.displayName = 'PersonNode';

export default PersonNode;
