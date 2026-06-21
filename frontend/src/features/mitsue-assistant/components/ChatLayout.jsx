import { Monitor, Smartphone } from 'lucide-react';

export default function ChatLayout({ viewMode, onViewModeChange, desktop, mobile }) {
  return (
    <div className={`chat-layout chat-layout-${viewMode}`}>
      <div className="view-mode-toggle" aria-label="Alternar visualizacao">
        <button
          type="button"
          className={viewMode === 'desktop' ? 'is-active' : ''}
          onClick={() => onViewModeChange('desktop')}
        >
          <Monitor size={15} />
          Desktop
        </button>
        <button
          type="button"
          className={viewMode === 'mobile' ? 'is-active' : ''}
          onClick={() => onViewModeChange('mobile')}
        >
          <Smartphone size={15} />
          Mobile
        </button>
      </div>

      {viewMode === 'mobile' ? mobile : desktop}
    </div>
  );
}
