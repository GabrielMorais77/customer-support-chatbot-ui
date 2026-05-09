import { ArrowUpRight, Clock3, FileStack } from 'lucide-react';
import { formatDateTime } from '../utils';

export default function MessageBubble({ message, onProtocolClick }) {
  if (message.type === 'protocol') {
    const record = message.record;

    return (
      <article className="message-shell message-shell-assistant protocol-card">
        <div className="protocol-header">
          <div>
            <p className="protocol-label">Solicitação registrada</p>
            <h4>{record.protocol}</h4>
          </div>
          <span className={`priority-pill ${record.priority}`}>
            {record.priority === 'urgent' ? 'Urgente' : 'Normal'}
          </span>
        </div>

        <p className="protocol-text">{record.assessment.summary}</p>

        <div className="protocol-meta">
          <span>
            <Clock3 size={14} />
            {record.expectedReturn}
          </span>
          <span>
            <FileStack size={14} />
            {record.documents.length} documento(s)
          </span>
        </div>

        <button className="protocol-link" onClick={() => onProtocolClick?.(record.id)}>
          Abrir dossiê
          <ArrowUpRight size={14} />
        </button>
      </article>
    );
  }

  return (
    <article className={`message-shell ${message.role === 'user' ? 'message-shell-user' : 'message-shell-assistant'}`}>
      {message.title ? <p className="message-title">{message.title}</p> : null}
      <p className="message-text">{message.text}</p>
      <span className="message-time">{formatDateTime(message.createdAt)}</span>
    </article>
  );
}
