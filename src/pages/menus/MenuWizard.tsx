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
    return {
      name: initial?.name ?? "",
      menuTypeId: initial?.menuTypeId ?? "", // REQUIRED in your DTO
      description: initial?.description ?? "",
      visibility: initial?.visibility ?? "PUBLIC",
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
    if (!data.menuTypeId) e.menuTypeId = "MenuTypeId is required";
    if (!data.description) e.name = "Name is required";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const saveMenu = async (data : MenuDto) => {
    if (!validateStep1()) return;
    onSave(data)
  };

  const handleChange = <K extends keyof MenuDto>(field: K, value: MenuDto[K]) => {
    setData((d) => ({
      ...d,
      [field]: value,
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

              {/* menuTypeId = Menu Type ID */}
              <FormSelect
                  label="Menu Type"
                  value={data.menuTypeId} // ✅ stored id
                  error={errors.menuTypeId || menuTypesError}
                  onChange={(e) => handleChange("menuTypeId", e.target.value)} // ✅ set id
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

            </div>
        )}

        <div className="mt-8 flex justify-between">
              <Button onClick={() => saveMenu(data)}>{initial ? "Update" : "Save Menu"}</Button>
        </div>
      </WizardLayout>
  );
}
