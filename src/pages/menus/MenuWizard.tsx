import {useEffect, useState} from "react";
import { FormInput } from "../../components/form/FormInput";
import { FormSelect } from "../../components/form/FormSelect";
import { FormTextarea } from "../../components/form/FormTextarea";
import Button from "../../components/ui/Button";
import {MenuDto, MenuType} from "../../types/menu";
import menuApi from "../../api/menuApi";
import { errorMessage } from "../../utils/errorMessage";

interface Props {
  initial?: Partial<MenuDto>;
  onSave: (data: MenuDto) => Promise<void>;
}

// Single-step menu form (AGF-S1-14: the unused 3-step stepper was removed; same card style)
export default function MenuWizard({ initial, onSave }: Props) {
  const isEdit = Boolean(initial);

  const [data, setData] = useState<MenuDto>(() => ({
    name: initial?.name ?? "",
    menuTypeId: initial?.menuTypeId ?? "",
    description: initial?.description ?? "",
    // New menus keep today's default; edits send the menu's own visibility (never forced to PUBLIC)
    visibility: isEdit ? initial?.visibility : "PUBLIC",
  }));

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  const [menuTypes, setMenuTypes] = useState<MenuType[]>([]);
  const [menuTypesLoading, setMenuTypesLoading] = useState(true);
  const [menuTypesError, setMenuTypesError] = useState<string>("");

  useEffect(() => {
    let mounted = true;

    menuApi
        .listMenuTypes()
        .then((items) => {
          if (!mounted) return;
          setMenuTypes(items.data);
        })
        .catch((err) => {
          if (!mounted) return;
          setMenuTypesError(errorMessage(err, "Failed to load menu types"));
        })
        .finally(() => {
          if (!mounted) return;
          setMenuTypesLoading(false);
        });

    return () => {
      mounted = false;
    };
  }, []);

  // Each field gets its own error; the description is optional
  const validate = () => {
    const e: Record<string, string> = {};
    if (!data.name.trim()) e.name = "Name is required";
    if (!data.menuTypeId) e.menuTypeId = "Menu type is required";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  // Wait for the save; on failure show the API error and stay on the form
  const saveMenu = async () => {
    if (!validate()) return;
    setSaving(true);
    setSaveError("");
    try {
      const payload: MenuDto = { ...data };
      if (payload.visibility === undefined) delete payload.visibility;
      await onSave(payload);
    } catch (err) {
      setSaveError(errorMessage(err, "Failed to save menu"));
      setSaving(false);
    }
  };

  const handleChange = <K extends keyof MenuDto>(field: K, value: MenuDto[K]) => {
    setData((d) => ({
      ...d,
      [field]: value,
    }));
  };

  return (
      <div className="bg-white rounded-2xl border border-gray-200 p-8 mx-auto max-w-xl shadow-sm">
        <h2 className="mb-6 text-lg font-semibold text-gray-900">{isEdit ? "Edit menu" : "Create menu"}</h2>

        {saveError && (
            <p role="alert" className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{saveError}</p>
        )}

        <div className="space-y-4">
          <FormInput
              label="Menu Name"
              value={data.name}
              error={errors.name}
              onChange={(e) => handleChange("name", e.target.value)}
          />

          <FormSelect
              label="Menu Type"
              value={data.menuTypeId}
              error={errors.menuTypeId || menuTypesError}
              onChange={(e) => handleChange("menuTypeId", e.target.value)}
          >
            <option value="">
              {menuTypesLoading ? "Loading..." : "-- select --"}
            </option>

            {menuTypes.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
            ))}
          </FormSelect>

          <FormTextarea
              label="Description (optional)"
              value={data.description ?? ""}
              onChange={(e) => handleChange("description", e.target.value)}
          />
        </div>

        <div className="mt-8 flex justify-between">
          <Button onClick={saveMenu} disabled={saving}>
            {saving ? "Saving…" : isEdit ? "Update" : "Save Menu"}
          </Button>
        </div>
      </div>
  );
}
