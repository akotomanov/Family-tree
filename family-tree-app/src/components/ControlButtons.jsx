import './ControlButtons.css';

export default function ControlButtons({ onZoomIn, onZoomOut, onFullscreen, onHome }) {
  return (
    <div className="control-buttons">
      <button
        className="control-btn control-btn--standalone"
        onClick={onFullscreen}
        aria-label="Fullscreen"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="15 3 21 3 21 9" />
          <polyline points="9 21 3 21 3 15" />
          <polyline points="21 3 14 10" />
          <polyline points="3 21 10 14" />
        </svg>
      </button>

      <button
        className="control-btn control-btn--standalone"
        onClick={onHome}
        aria-label="Go to home person"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 10.5L12 3l9 7.5" />
          <path d="M5 9.5V19a1 1 0 001 1h4v-5h4v5h4a1 1 0 001-1V9.5" />
        </svg>
      </button>

      <div className="control-btn-group">
        <button
          className="control-btn"
          onClick={onZoomIn}
          aria-label="Zoom in"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
        </button>
        <button
          className="control-btn"
          onClick={onZoomOut}
          aria-label="Zoom out"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
        </button>
      </div>
    </div>
  );
}
