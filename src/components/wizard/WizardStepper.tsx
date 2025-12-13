import clsx from "clsx";

interface Step {
  label: string;
}
interface Props {
  steps: Step[];
  current: number;
  completed: number; // highest completed index
  onStepClick?: (index: number) => void;
}

export default function WizardStepper({ steps, current, completed, onStepClick }: Props) {
  return (
    <div className="flex items-center justify-center gap-4 mb-8">
      {steps.map((step, idx) => {
        const state = idx < completed ? "done" : idx === current ? "active" : "pending";
        return (
          <div key={step.label} className="flex items-center gap-2">
            <button
              type="button"
              disabled={!onStepClick}
              onClick={() => onStepClick?.(idx)}
              className={clsx(
                "w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold border-2",
                {
                  "bg-brand text-white border-brand": state === "active",
                  "bg-green-500 text-white border-green-500": state === "done",
                  "bg-gray-200 text-gray-600 border-gray-200": state === "pending",
                }
              )}
            >
              {state === "done" ? "✓" : idx + 1}
            </button>
            <span className="text-sm font-medium text-gray-700 hidden sm:inline">{step.label}</span>
            {idx !== steps.length - 1 && (
              <div className="w-8 h-px bg-gray-300 sm:w-12" aria-hidden />
            )}
          </div>
        );
      })}
    </div>
  );
}
