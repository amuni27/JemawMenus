import { useState } from "react";
import WizardLayout from "../../components/wizard/WizardLayout";
import { FormInput } from "../../components/form/FormInput";
import { FormSelect } from "../../components/form/FormSelect";
import { FormTextarea } from "../../components/form/FormTextarea";
import Button from "../../components/ui/Button";
import { MenuType, Currency } from "../../types/menu";

export interface MenuWizardData {
  name: string;
  displayName: string;
  type: MenuType;
  description: string;
  currency: Currency;
  language: string;
  // step2+ placeholders
}

const steps = [
  { label: "Menu Details" },
  { label: "Menu Settings" },
  { label: "Publish & Review" },
];

interface Props {
  initial?: Partial<MenuWizardData>;
  onSave: (data: MenuWizardData) => Promise<void>;
}

export default function MenuWizard({ initial, onSave }: Props) {
  const [step, setStep] = useState(0);
  const [data, setData] = useState<MenuWizardData>({
    name: initial?.name ?? "",
    displayName: initial?.displayName ?? "",
    type: (initial?.type ?? "FOOD") as MenuType,
    description: initial?.description ?? "",
    currency: (initial?.currency ?? "USD") as Currency,
    language: initial?.language ?? "",
  });

  const [errors, setErrors] = useState<{ [k: string]: string }>({});
  const validateStep1 = () => {
    const e: { [k: string]: string } = {};
    if (!data.name.trim()) e.name = "Name is required";
    if (!data.currency) e.currency = "Currency is required";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleNext = async () => {
    if (step === 0) {
      if (!validateStep1()) return;
    }
    setStep((s) => Math.min(s + 1, steps.length - 1));
  };
  const handleBack = () => setStep((s) => Math.max(s - 1, 0));

  const handleChange = (field: keyof MenuWizardData, value: any) =>
    setData((d) => ({ ...d, [field]: value }));

  return (
    <WizardLayout steps={steps} current={step} completed={step - 1}>
      {step === 0 && (
        <div className="space-y-4">
          <FormInput
            label="Menu Name"
            value={data.name}
            error={errors.name}
            onChange={(e) => handleChange("name", e.target.value)}
          />
          <FormInput
            label="Menu Display Name (optional)"
            value={data.displayName}
            onChange={(e) => handleChange("displayName", e.target.value)}
          />
          <FormSelect
            label="Menu Type"
            value={data.type}
            onChange={(e) => handleChange("type", e.target.value as MenuType)}
          >
            <option value="FOOD">Food</option>
            <option value="DRINK">Drink</option>
            <option value="DESSERT">Dessert</option>
            <option value="OTHER">Other</option>
          </FormSelect>
          <FormTextarea
            label="Description (optional)"
            value={data.description}
            onChange={(e) => handleChange("description", e.target.value)}
          />
          <FormSelect
            label="Currency"
            value={data.currency}
            error={errors.currency}
            onChange={(e) => handleChange("currency", e.target.value as Currency)}
          >
            <option value="USD">USD</option>
            <option value="ETB">ETB</option>
          </FormSelect>
          <FormSelect
            label="Menu Language (optional)"
            value={data.language}
            onChange={(e) => handleChange("language", e.target.value)}
          >
            <option value="">-- select --</option>
            <option value="English">English</option>
            <option value="Amharic">Amharic</option>
          </FormSelect>
        </div>
      )}
      {step > 0 && <p className="text-gray-500">This step is WIP. Coming soon.</p>}

      {/* Navigation buttons */}
      <div className="mt-8 flex justify-between">
        {step > 0 ? (
          <Button variant="secondary" onClick={handleBack}>
            Back
          </Button>
        ) : (
          <span />
        )}
        {step === steps.length - 1 ? (
          <Button onClick={() => onSave(data)}>Save Menu</Button>
        ) : (
          <Button onClick={handleNext}>Next</Button>
        )}
      </div>
    </WizardLayout>
  );
}
