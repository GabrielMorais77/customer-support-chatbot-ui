export default function ChatField({ field, value, onChange }) {
  if (field.type === 'select') {
    return (
      <label className="field-card">
        <span className="field-label">{field.label}</span>
        <select value={value || ''} onChange={(event) => onChange(field.name, event.target.value)}>
          {field.options.map((option) => (
            <option key={option.value || 'empty'} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
    );
  }

  if (field.type === 'textarea') {
    return (
      <label className="field-card field-card-full">
        <span className="field-label">{field.label}</span>
        <textarea
          rows="4"
          value={value || ''}
          placeholder={field.placeholder}
          onChange={(event) => onChange(field.name, event.target.value)}
        />
      </label>
    );
  }

  return (
    <label className="field-card">
      <span className="field-label">{field.label}</span>
      <input
        type={field.type}
        value={value || ''}
        placeholder={field.placeholder}
        onChange={(event) => onChange(field.name, event.target.value)}
      />
    </label>
  );
}
