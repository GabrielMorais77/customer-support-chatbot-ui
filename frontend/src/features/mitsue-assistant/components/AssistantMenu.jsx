export default function AssistantMenu({ options, selectedArea, onSelect }) {
  return (
    <div className="assistant-menu">
      {options.map((option) => (
        <button
          key={option.areaKey}
          className={`assistant-menu-button ${selectedArea === option.areaKey ? 'is-active' : ''}`}
          onClick={() => onSelect(option.areaKey)}
          type="button"
        >
          <strong>{option.label}</strong>
          <span>{option.description}</span>
        </button>
      ))}
    </div>
  );
}
