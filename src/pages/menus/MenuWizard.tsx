import {useEffect, useState} from "react";
import WizardLayout from "../../components/wizard/WizardLayout";
import { FormInput } from "../../components/form/FormInput";
import { FormSelect } from "../../components/form/FormSelect";
import { FormTextarea } from "../../components/form/FormTextarea";
import Button from "../../components/ui/Button";
import {MenuDto, MenuType} from "../../types/menu";
import menuApi from "../../api/menuApi";

const steps = [
  { label: "Menu Details" },
  { label: "Menu Settings" },
  { label: "Publish & Review" },
];

interface Props {
  initial?: Partial<MenuDto>;
  onSave: (data: MenuDto) => Promise<void>;
}

export default function MenuWizard({ initial, onSave }: Props) {
  const [step, setStep] = useState(0);

  const [data, setData] = useState<MenuDto>(() => {
    const now = new Date().toISOString();
    return {
      id: initial?.id ?? "",
      businessId: initial?.businessId ?? "",
      name: initial?.name ?? "",
      menuId: initial?.menuId ?? "", // REQUIRED in your DTO
      description: initial?.description ?? "",
      currency: initial?.currency ?? "USD",
      createdAt: initial?.createdAt ?? now,
      updatedAt: initial?.updatedAt ?? now,
    };
  });

  const [errors, setErrors] = useState<Record<string, string>>({});


  const [menuTypes, setMenuTypes] = useState<MenuType[]>([]);
  const [menuTypesLoading, setMenuTypesLoading] = useState(false);
  const [menuTypesError, setMenuTypesError] = useState<string>("");

  useEffect(() => {
    let mounted = true;
    setMenuTypesLoading(true);
    setMenuTypesError("");

    menuApi
        .listMenuTypes()
        .then((items) => {
          setMenuTypes(items.data);
        })
        .catch((err: any) => {
          if (!mounted) return;
          setMenuTypesError(err?.message || "Failed to load menu types");
        })
        .finally(() => {
          if (!mounted) return;
          setMenuTypesLoading(false);
        });

    return () => {
      mounted = false;
    };
  }, []);

  const validateStep1 = () => {
    const e: Record<string, string> = {};
    if (!data.name.trim()) e.name = "Name is required";
    if (!data.menuId) e.menuId = "Menu type is required";
    if (!data.currency) e.currency = "Currency is required";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleNext = async () => {
    if (step === 0 && !validateStep1()) return;
    setStep((s) => Math.min(s + 1, steps.length - 1));
  };

  const handleBack = () => setStep((s) => Math.max(s - 1, 0));

  const handleChange = <K extends keyof MenuDto>(field: K, value: MenuDto[K]) => {
    setData((d) => ({
      ...d,
      [field]: value,
      updatedAt: new Date().toISOString(),
    }));

  };

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

              {/* menuId = Menu Type ID */}
              <FormSelect
                  label="Menu Type"
                  value={data.menuId} // ✅ stored id
                  error={errors.menuId || menuTypesError}
                  onChange={(e) => handleChange("menuId", e.target.value)} // ✅ set id
              >
                <option value="">
                  {menuTypesLoading ? "Loading..." : "-- select --"}
                </option>

                {menuTypes.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} {/* ✅ user sees name */}
                    </option>
                ))}
              </FormSelect>

              <FormTextarea
                  label="Description (optional)"
                  value={data.description ?? ""}
                  onChange={(e) => handleChange("description", e.target.value)}
              />

              <FormSelect
                  label="Currency"
                  value={data.currency}
                  error={errors.currency}
                  onChange={(e) => handleChange("currency", e.target.value)}
              >
                <option value="USD">USD</option>
                <option value="ETB">ETB</option>
              </FormSelect>
            </div>
        )}

        {step > 0 && <p className="text-gray-500">This step is WIP. Coming soon.</p>}

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
