import {useEffect, useState} from "react";
import { useFieldErrors } from "../../utils/fieldErrors";
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
    nameAm: initial?.nameAm ?? "", // AGF-S2-23
    // New menus: Public but Unpublished (PO-2). Edits send the menu's own state (never forced).
    visibility: isEdit ? initial?.visibility : "PUBLIC",
    isActive: isEdit ? initial?.isActive : false,
  }));

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const serverErrors = useFieldErrors(); // AGF-S2-11

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
      // AGF-S2-23: the Amharic name is sent when filled (new menu) or changed (edit; "" clears)
      const nameAm = (data.nameAm ?? "").trim();
      const payload: MenuDto = { ...data, nameAm };
      if (nameAm === (initial?.nameAm ?? "").trim()) delete payload.nameAm;
      if (payload.visibility === undefined) delete payload.visibility;
      if (payload.isActive === undefined) delete payload.isActive;
      await onSave(payload);
    } catch (err) {
      // Field errors appear under their fields; otherwise the server message is shown (AGF-S2-11)
      setSaveError(serverErrors.apply(err, {
        name: data.name, menuTypeId: data.menuTypeId, description: data.description ?? "", nameAm: (data.nameAm ?? "").trim(),
        visibility: data.visibility, isActive: data.isActive,
      }, "Failed to save menu") ?? "");
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
              error={errors.name || serverErrors.errorFor("name", data.name)}
              onChange={(e) => handleChange("name", e.target.value)}
          />

          {/* AGF-S2-23: shown to guests who choose Amharic */}
          <FormInput
              label="Name in Amharic (optional)"
              aria-label="Name in Amharic (optional)"
              lang="am"
              maxLength={255}
              value={data.nameAm ?? ""}
              error={serverErrors.errorFor("nameAm", (data.nameAm ?? "").trim())}
              onChange={(e) => handleChange("nameAm", e.target.value)}
          />

          <FormSelect
              label="Menu Type"
              value={data.menuTypeId}
              error={errors.menuTypeId || serverErrors.errorFor("menuTypeId", data.menuTypeId) || menuTypesError}
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
              error={serverErrors.errorFor("description", data.description ?? "")}
              onChange={(e) => handleChange("description", e.target.value)}
          />

          {/* Publishing controls (AGF-S1-15) with the guest impact of each choice */}
          <div>
            <FormSelect
                label="Visibility"
                value={data.visibility ?? "PUBLIC"}
                onChange={(e) => handleChange("visibility", e.target.value)}
            >
              <option value="PUBLIC">Public</option>
              <option value="PRIVATE">Private – only you</option>
            </FormSelect>
            <p className="mt-1 text-xs text-gray-500">
              {data.visibility === "PRIVATE"
                  ? "Only you can see this menu. Guests never see it, even when published."
                  : "Guests can see this menu on your QR menu once it is published."}
            </p>
          </div>

          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
              <input
                  type="checkbox"
                  checked={Boolean(data.isActive)}
                  onChange={(e) => handleChange("isActive", e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300"
              />
              Published
            </label>
            <p className="mt-1 text-xs text-gray-500">
              {data.isActive
                  ? data.visibility === "PRIVATE"
                      ? "Published, but Private: still hidden from guests."
                      : "Live: guests can see this menu."
                  : "Guests can't see this menu until you publish it."}
            </p>
          </div>
        </div>

        <div className="mt-8 flex justify-between">
          <Button onClick={saveMenu} disabled={saving}>
            {saving ? "Saving…" : isEdit ? "Update" : "Save Menu"}
          </Button>
        </div>
      </div>
  );
}
