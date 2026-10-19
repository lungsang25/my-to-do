import { useEffect, useId, useRef, type ReactNode } from "react";

interface Props {
  label: string;
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  disabled?: boolean;
  /** When given, a × button above the field's top-right corner calls this. */
  onClose?: () => void;
  children?: ReactNode;
}

/** A labelled text field with an Enter-key icon; Enter or clicking the icon submits. */
export default function PromptInput({
  label,
  value,
  onChange,
  onSubmit,
  disabled,
  onClose,
  children,
}: Props) {
  const id = useId();
  const inputRef = useRef<HTMLInputElement>(null);

  // Keep focus in the field across submissions and label changes.
  useEffect(() => {
    if (!disabled) inputRef.current?.focus();
  }, [label, disabled]);

  const submit = () => {
    if (!disabled && value.trim()) onSubmit();
  };

  return (
    <div className="prompt">
      <div className="prompt-header">
        <label htmlFor={id} className="prompt-label">
          {label}
        </label>
        {onClose && (
          <button
            type="button"
            className="icon-button prompt-close"
            onClick={onClose}
            aria-label="Close"
            title="Close"
          >
            <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
              <path d="M6 6l12 12M18 6 6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
        )}
      </div>
      <div className="prompt-field">
        <input
          ref={inputRef}
          id={id}
          type="text"
          value={value}
          autoComplete="off"
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.nativeEvent.isComposing) {
              e.preventDefault();
              submit();
            }
          }}
          disabled={disabled}
        />
        <button
          type="button"
          className="enter-key"
          onClick={submit}
          disabled={disabled}
          aria-label="Press Enter to submit"
          title="Press Enter"
        >
          {/* Return / Enter key */}
          <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
            <path
              d="M20 5v7a3 3 0 0 1-3 3H6m0 0 4-4m-4 4 4 4"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      </div>
      {children}
    </div>
  );
}
