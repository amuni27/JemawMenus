import { useEffect, useState } from "react";
import Modal from "../ui/Modal";
import ModalHeader from "../ui/ModalHeader";
import Button from "../ui/Button";
import { profileApi, BusinessHourEntry } from "../../api/profileApi";
import { useToast } from "../ui/ToastContext";
import { BusinessDTO } from "../../services/authService";

interface Props {
  open: boolean;
  onClose: () => void;
  business: BusinessDTO;
  onSaved: () => void;
}

interface DayHours {
  enabled: boolean;
  start: string;
  end: string;
}

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const DAY_MAP: Record<string, string> = {
  Mon: "MONDAY", Tue: "TUESDAY", Wed: "WEDNESDAY", Thu: "THURSDAY",
  Fri: "FRIDAY", Sat: "SATURDAY", Sun: "SUNDAY",
};

const DAY_REVERSE: Record<string, string> = Object.fromEntries(
  Object.entries(DAY_MAP).map(([k, v]) => [v, k])
);

const defaultDays = (): Record<string, DayHours> =>
  DAYS.reduce<Record<string, DayHours>>((acc, d) => {
    acc[d] = { enabled: false, start: "09:00", end: "22:00" };
    return acc;
  }, {});

function fromApiHours(entries: BusinessHourEntry[]): Record<string, DayHours> {
  const days = defaultDays();
  for (const e of entries) {
    const key = DAY_REVERSE[e.dayOfWeek];
    if (key) days[key] = { enabled: e.isOpen, start: e.startTime ?? "09:00", end: e.endTime ?? "22:00" };
  }
  return days;
}

export default function BusinessHoursModal({ open, onClose, business, onSaved }: Props) {
  const toast = useToast();
  const [open247, setOpen247] = useState(business.open24_7 ?? false);
  const [days, setDays] = useState<Record<string, DayHours>>(defaultDays);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    console.log("dfjhgsdf")
    setOpen247(business.open24_7 ?? false);
    setError("");
    setLoading(true);

    profileApi
      .getBusinessHours(business.id)
      .then((res: any) => {
        console.log("API hours response: ", res);
        const raw = res.data?.data ?? res.data;
        const entries: BusinessHourEntry[] = Array.isArray(raw) ? raw : [];
        setDays(fromApiHours(entries));
      })
      .catch(() => setDays(defaultDays()))
      .finally(() => setLoading(false));
  }, [open, business]);

  const setDay = (day: string, patch: Partial<DayHours>) =>
    setDays((prev) => ({ ...prev, [day]: { ...prev[day], ...patch } }));

  const handleSave = async () => {
    setSaving(true);
    setError("");
    try {
      await profileApi.updateBusinessHours(business.id, {
        open24_7: open247,
        businessHours: DAYS.map((d) => ({
          dayOfWeek: DAY_MAP[d],
          isOpen: days[d].enabled,
          startTime: days[d].enabled ? days[d].start : null,
          endTime: days[d].enabled ? days[d].end : null,
        })),
      });
      toast("Business hours updated");
      onSaved();
      onClose();
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || "Failed to update hours");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} className="max-w-xl">
      <ModalHeader title="Edit Business Hours" onClose={onClose} />
      <div className="space-y-4">
        {error && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>
        )}

        {/* Open 24/7 toggle */}
        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={open247}
            onChange={(e) => setOpen247(e.target.checked)}
            className="h-4 w-4 rounded border-gray-300 accent-brand"
          />
          <span className="text-sm font-medium text-gray-700">Open 24 / 7</span>
        </label>

        {/* Per-day hours */}
        {!open247 && (
          <div className="space-y-3">
            {loading ? (
              <p className="text-sm text-gray-400">Loading hours...</p>
            ) : (
              DAYS.map((day) => (
                <div key={day} className="flex items-center gap-3">
                  <span className="w-8 text-sm font-medium text-gray-700">{day}</span>

                  <input
                    type="checkbox"
                    checked={days[day].enabled}
                    onChange={(e) => setDay(day, { enabled: e.target.checked })}
                    className="h-4 w-4 rounded border-gray-300 accent-brand"
                  />

                  <input
                    type="time"
                    value={days[day].start}
                    disabled={!days[day].enabled}
                    onChange={(e) => setDay(day, { start: e.target.value })}
                    className="rounded-lg border border-gray-200 px-2 py-1 text-sm disabled:opacity-40"
                  />
                  <span className="text-xs text-gray-400">to</span>
                  <input
                    type="time"
                    value={days[day].end}
                    disabled={!days[day].enabled}
                    onChange={(e) => setDay(day, { end: e.target.value })}
                    className="rounded-lg border border-gray-200 px-2 py-1 text-sm disabled:opacity-40"
                  />
                </div>
              ))
            )}
          </div>
        )}

        <div className="flex justify-end gap-3 pt-2">
          <Button variant="secondary" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={handleSave} isLoading={saving}>Save Hours</Button>
        </div>
      </div>
    </Modal>
  );
}