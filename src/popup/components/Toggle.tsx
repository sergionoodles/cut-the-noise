interface ToggleProps {
  checked: boolean;
  label: string;
  onChange: (checked: boolean) => void;
  size?: "sm" | "md";
}

export function Toggle({ checked, label, onChange, size = "sm" }: ToggleProps) {
  return (
    <label className={`toggle toggle-${size}`}>
      <span className="sr-only">{label}</span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span className="toggle-track" aria-hidden="true">
        <i />
      </span>
    </label>
  );
}
