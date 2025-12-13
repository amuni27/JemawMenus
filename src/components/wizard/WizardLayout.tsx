import { PropsWithChildren } from "react";
import WizardStepper from "./WizardStepper";

interface Step {
  label: string;
}
interface Props extends PropsWithChildren {
  steps: Step[];
  current: number;
  completed: number;
  onStepClick?: (idx: number) => void;
}

export default function WizardLayout({ steps, current, completed, onStepClick, children }: Props) {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-8 mx-auto max-w-xl shadow-sm">
      <WizardStepper steps={steps} current={current} completed={completed} onStepClick={onStepClick} />
      {children}
    </div>
  );
}
