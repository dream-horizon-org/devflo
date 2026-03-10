import type { QuestionOption } from "../types";

interface OptionButtonProps {
  option: QuestionOption;
  selected: boolean;
  onSelect: () => void;
  multiSelect?: boolean;
}

export function OptionButton({ option, selected, onSelect, multiSelect }: OptionButtonProps) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`w-full text-left p-3.5 rounded-lg border transition-all duration-200 group ${
        selected
          ? "border-accent-blue bg-accent-blue/10"
          : "border-surface-border bg-surface-2 hover:border-text-muted hover:bg-surface-3"
      }`}
    >
      <div className="flex items-start gap-3">
        <div className="mt-0.5 shrink-0">
          {multiSelect ? (
            <div
              className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-colors ${
                selected ? "border-accent-blue bg-accent-blue" : "border-text-muted"
              }`}
            >
              {selected && (
                <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={4}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              )}
            </div>
          ) : (
            <div
              className={`w-4 h-4 rounded-full border-2 flex items-center justify-center transition-colors ${
                selected ? "border-accent-blue" : "border-text-muted"
              }`}
            >
              {selected && <div className="w-2 h-2 rounded-full bg-accent-blue" />}
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className={`text-sm font-medium ${selected ? "text-accent-blue" : "text-text-primary"}`}>
            {option.label}
          </p>
          {option.description && (
            <p className="text-xs text-text-secondary mt-0.5">{option.description}</p>
          )}
        </div>
      </div>
    </button>
  );
}
