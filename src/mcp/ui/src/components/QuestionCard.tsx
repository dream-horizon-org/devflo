import { useState } from "react";
import { useDashboard } from "../context/DashboardContext";
import { OptionButton } from "./OptionButton";
import { CustomAnswerInput } from "./CustomAnswerInput";

export function QuestionCard() {
  const { state, setAnswer, nextQuestion, prevQuestion, submitAnswers } =
    useDashboard();
  const [customText, setCustomText] = useState<Record<string, string>>({});

  if (!state.questionBatch) return null;

  const isStale = !!state.questionBatch?.stale;
  const { questions } = state.questionBatch;
  const question = questions[state.currentQuestionIndex];
  if (!question) return null;

  const totalQuestions = questions.length;
  const currentIndex = state.currentQuestionIndex;
  const currentAnswer = state.answers[question.id];
  const isLast = currentIndex === totalQuestions - 1;
  const hasOptions = !!question.options?.length;
  const customValue = customText[question.id] ?? "";

  function handleOptionSelect(optionId: string) {
    if (question.allowMultiple) {
      const current = Array.isArray(currentAnswer) ? currentAnswer : [];
      const updated = current.includes(optionId)
        ? current.filter((id) => id !== optionId)
        : [...current, optionId];
      setAnswer(question.id, updated);
      setCustomText((prev) => ({ ...prev, [question.id]: "" }));
    } else {
      setAnswer(question.id, optionId);
      setCustomText((prev) => ({ ...prev, [question.id]: "" }));
    }
  }

  function handleCustomTextChange(value: string) {
    setCustomText((prev) => ({ ...prev, [question.id]: value }));
    if (value.trim()) {
      setAnswer(question.id, value.trim());
    }
  }

  const allAnswered = questions.every((q) => {
    const ans = state.answers[q.id];
    if (Array.isArray(ans)) return ans.length > 0;
    return !!ans;
  });

  return (
    <div className={`bg-surface-1 border-2 rounded-xl p-6 ${isStale ? "border-text-muted/30 opacity-70" : "border-accent-blue/30"}`}>
      {isStale && (
        <div className="flex items-center gap-2 mb-4 px-3 py-2 bg-surface-2 rounded-lg text-xs text-text-secondary">
          <svg className="w-4 h-4 text-text-muted shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
          </svg>
          Session expired — this question is from a previous server session and can no longer be answered.
        </div>
      )}
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-base font-semibold text-text-primary">
            {state.currentPhase || "DevFlo"}
          </h2>
          <p className="text-xs text-text-secondary mt-0.5">
            Question {currentIndex + 1} of {totalQuestions}
          </p>
        </div>

        {/* Pagination dots */}
        <div className="flex items-center gap-1.5">
          {questions.map((_, i) => {
            const answered = !!state.answers[questions[i].id];
            return (
              <div
                key={i}
                className={`w-2 h-2 rounded-full transition-all duration-200 ${
                  i === currentIndex
                    ? "bg-accent-blue w-5"
                    : answered
                      ? "bg-accent-green"
                      : "bg-surface-3"
                }`}
              />
            );
          })}
        </div>
      </div>

      {/* Question */}
      <div className="max-h-[50vh] overflow-y-auto">
        <p className="text-base text-text-primary font-medium mb-4 leading-relaxed">
          {question.prompt}
        </p>

        {/* Options */}
        {hasOptions && (
          <div className="space-y-2.5">
            {question.options!.map((opt) => {
              const isSelected = question.allowMultiple
                ? Array.isArray(currentAnswer) && currentAnswer.includes(opt.id)
                : currentAnswer === opt.id;

              return (
                <OptionButton
                  key={opt.id}
                  option={opt}
                  selected={isSelected}
                  onSelect={() => handleOptionSelect(opt.id)}
                  multiSelect={question.allowMultiple}
                />
              );
            })}
          </div>
        )}

        {/* Custom answer */}
        <CustomAnswerInput
          value={customValue}
          onChange={handleCustomTextChange}
          hasOptions={hasOptions}
        />
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between pt-4 mt-4 border-t border-surface-border">
        <button
          type="button"
          onClick={prevQuestion}
          disabled={currentIndex === 0}
          className="px-4 py-2 text-sm rounded-lg border border-surface-border text-text-secondary hover:text-text-primary hover:bg-surface-2 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          Previous
        </button>

        <div className="flex gap-2">
          {!isLast && (
            <button
              type="button"
              onClick={nextQuestion}
              className="px-4 py-2 text-sm rounded-lg bg-surface-3 text-text-primary hover:bg-surface-border transition-colors"
            >
              Next
            </button>
          )}
          <button
            type="button"
            onClick={submitAnswers}
            disabled={!allAnswered || isStale}
            className="px-5 py-2 text-sm font-medium rounded-lg bg-accent-blue text-white hover:bg-accent-blue/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {isStale ? "Expired" : "Submit"}
          </button>
        </div>
      </div>
    </div>
  );
}
