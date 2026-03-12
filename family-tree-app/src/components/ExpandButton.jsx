import { memo } from 'react';
import { Handle, Position } from 'reactflow';
import './ExpandButton.css';

const ExpandButton = memo(({ data }) => {
  if (!data) return null;

  return (
    <div className="expand-button" onClick={data.onClick}>
      <Handle type="source" position={Position.Bottom} />
      <div className="expand-button__icon">
        <svg viewBox="0 0 20 18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <line x1="10" y1="1" x2="10" y2="7" />
          <line x1="10" y1="7" x2="4" y2="7" />
          <line x1="10" y1="7" x2="16" y2="7" />
          <line x1="4" y1="7" x2="4" y2="13" />
          <line x1="16" y1="7" x2="16" y2="13" />
          <rect x="1" y="13" width="6" height="4" rx="1" />
          <rect x="13" y="13" width="6" height="4" rx="1" />
        </svg>
      </div>
    </div>
  );
});

ExpandButton.displayName = 'ExpandButton';

export default ExpandButton;
