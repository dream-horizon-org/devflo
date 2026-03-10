import { RichTextEditor } from "./RichTextEditor";

interface CustomAnswerInputProps {
  value: string;
  onChange: (value: string) => void;
  hasOptions: boolean;
}

export function CustomAnswerInput({ value, onChange, hasOptions }: CustomAnswerInputProps) {
  return (
    <div className="mt-4">
      <label className="block text-xs font-medium text-text-secondary mb-1.5">
        {hasOptions ? "Or type your own answer:" : "Your answer:"}
      </label>
      <RichTextEditor
        value={value}
        onChange={onChange}
        placeholder="Type your answer here..."
        minHeight="72px"
        accentColor="blue"
      />
    </div>
  );
}
