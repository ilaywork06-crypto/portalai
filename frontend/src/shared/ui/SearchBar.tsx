import { Icon } from "./Icon";

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}

export function SearchBar({ value, onChange, placeholder }: SearchBarProps) {
  return (
    <form
      role="search"
      onSubmit={(e) => e.preventDefault()}
      className="row"
      style={{
        gap: 11,
        width: "100%",
        background: "var(--surface)",
        border: "1.5px solid var(--border)",
        borderRadius: "var(--r-md)",
        padding: "9px 13px",
        boxShadow: "none",
        transition: "border-color .16s var(--ease), box-shadow .16s var(--ease)",
      }}
      onFocusCapture={(e) => {
        e.currentTarget.style.borderColor = "var(--accent)";
        e.currentTarget.style.boxShadow = "0 0 0 3px var(--c-100)";
      }}
      onBlurCapture={(e) => {
        e.currentTarget.style.borderColor = "var(--border)";
        e.currentTarget.style.boxShadow = "none";
      }}
    >
      <Icon name="search" size={17} style={{ color: "var(--muted)" }} />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        style={{ flex: 1, border: 0, outline: "none", background: "transparent", color: "var(--ink)", fontSize: 14, fontWeight: 450, minWidth: 0 }}
      />
      <kbd
        style={{
          fontFamily: "var(--mono)",
          fontSize: 11,
          color: "var(--muted)",
          border: "1px solid var(--border)",
          borderRadius: 5,
          padding: "2px 6px",
          background: "var(--n-50)",
        }}
      >
        /
      </kbd>
    </form>
  );
}
