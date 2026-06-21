import { ArrowUpRight, Clock3, FileStack } from 'lucide-react';
import { formatDateTime } from '../utils';

function getVisitorInitial(visitorName) {
  const initial = String(visitorName || '').trim().charAt(0);
  return initial ? initial.toUpperCase() : 'U';
}

function getSenderKind(message) {
  if (message.role === 'user' || message.sender_type === 'visitor') {
    return 'user';
  }

  if (message.role === 'system' || message.sender_type === 'system') {
    return 'system';
  }

  if (message.sender_type === 'agent') {
    return 'agent';
  }

  return 'assistant';
}

function Avatar({ kind, visitorName }) {
  if (kind === 'user') {
    return <div className="message-avatar message-avatar-user">{getVisitorInitial(visitorName)}</div>;
  }

  if (kind === 'agent') {
    return <div className="message-avatar message-avatar-agent">AT</div>;
  }

  if (kind === 'system') {
    return <div className="message-avatar message-avatar-system">S</div>;
  }

  return <div className="message-avatar message-avatar-bot">AT</div>;
}

function SourceList({ sources = [] }) {
  if (!sources.length) {
    return null;
  }

  return (
    <div className="message-sources">
      <span>Fontes usadas</span>
      {sources.slice(0, 3).map((source, index) => (
        <small key={`${source.concurso || 'fonte'}-${index}`}>
          {source.concurso || 'Concurso indexado'}
          {source.banca ? ` - ${source.banca}` : ''}
          {Number.isFinite(Number(source.score)) ? ` (${Number(source.score).toFixed(2)})` : ''}
        </small>
      ))}
    </div>
  );
}

function formatDate(value) {
  if (!value) {
    return 'Nao informado';
  }

  return new Intl.DateTimeFormat('pt-BR', { timeZone: 'UTC' }).format(new Date(`${value}T00:00:00Z`));
}

function CatalogTable({ rows = [] }) {
  if (!rows.length) {
    return null;
  }

  return (
    <div className="catalog-table-wrap">
      <table className="catalog-table">
        <thead>
          <tr>
            <th>Edital</th>
            <th>Banca</th>
            <th>Prazo</th>
            <th>Salario</th>
            <th>Link</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id || row.titulo}>
              <td>
                <strong>{row.titulo}</strong>
                <span>
                  {[row.orgao, row.uf, row.cidade].filter(Boolean).join(' - ')}
                </span>
              </td>
              <td>{row.banca || 'Nao informado'}</td>
              <td>{formatDate(row.dt_fim_inscricao)}</td>
              <td>{row.salario || 'Nao informado'}</td>
              <td>
                {row.link_edital ? (
                  <a href={row.link_edital} target="_blank" rel="noreferrer">
                    Abrir
                  </a>
                ) : (
                  'Nao informado'
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function StudyOptions({ options = [], onAction }) {
  if (!options.length) {
    return null;
  }

  return (
    <div className="study-option-list">
      {options.map((option) => (
        <button key={option.label} type="button" onClick={() => onAction?.(option)}>
          {option.label}
        </button>
      ))}
    </div>
  );
}

export default function MessageBubble({ message, onProtocolClick, visitorName, onAction }) {
  const kind = getSenderKind(message);

  if (message.type === 'protocol') {
    const record = message.record;

    return (
      <div className="message-row message-row-assistant">
        <Avatar kind="assistant" visitorName={visitorName} />
        <article className="message-shell message-shell-assistant protocol-card">
          <div className="protocol-header">
            <div>
              <p className="protocol-label">Solicitacao registrada</p>
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

          <button className="protocol-link" type="button" onClick={() => onProtocolClick?.(record.id)}>
            Abrir dossie
            <ArrowUpRight size={14} />
          </button>
        </article>
      </div>
    );
  }

  return (
    <div className={`message-row message-row-${kind}`}>
      {kind !== 'user' ? <Avatar kind={kind} visitorName={visitorName} /> : null}
      <article className={`message-shell message-shell-${kind === 'user' ? 'user' : 'assistant'}`}>
        {message.title ? <p className="message-title">{message.title}</p> : null}
        <p className="message-text">{message.text || message.message}</p>
        <CatalogTable rows={message.catalogResults || message.catalog_results || []} />
        <StudyOptions options={message.studyOptions || message.study_options || []} onAction={onAction} />
        <SourceList sources={message.sources || message.fontes_usadas || []} />
        <span className="message-time">{formatDateTime(message.createdAt || message.created_at)}</span>
      </article>
      {kind === 'user' ? <Avatar kind={kind} visitorName={visitorName} /> : null}
    </div>
  );
}
