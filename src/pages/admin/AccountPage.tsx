import { useState, useEffect } from "react";
import { displayCurrency } from "../../utils/currency";
import { formatSubdomain } from "../../utils/subdomain";
import { publicMenuUrl } from "../../utils/publicMenuUrl";
import { shareUrl } from "../../utils/shareUrl";
import CopyLinkButton from "../../components/ui/CopyLinkButton";
import { useAuth } from "../../app/context/AuthContext";
import UserProfileModal from "../../components/account/UserProfileModal";
import ChangePasswordModal from "../../components/account/ChangePasswordModal";
import BusinessProfileModal from "../../components/account/BusinessProfileModal";
import { countryName, countryOf } from "../../utils/countryRules";
import { timeZoneLabel } from "../../utils/timeZones";
import BusinessLogoModal from "../../components/account/BusinessLogoModal";
import BusinessLogo from "../../components/ui/BusinessLogo";
import BusinessHoursModal from "../../components/account/BusinessHoursModal";

function InfoRow({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="flex justify-between py-2 border-b border-gray-100 last:border-0">
      <span className="text-sm text-gray-500">{label}</span>
      <span className="text-sm font-medium text-gray-900 text-right">{value || "—"}</span>
    </div>
  );
}

function Card({
  title,
  onEdit,
  children,
}: {
  title: string;
  onEdit: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-base font-semibold text-gray-900">{title}</h3>
        <button
          onClick={onEdit}
          className="text-sm font-medium text-brand hover:underline"
        >
          Edit
        </button>
      </div>
      {children}
    </div>
  );
}

export default function AccountPage() {
  const auth = useAuth();
  const user = auth.user;
  const business = auth.business;
  // AGF-S2-20: the configured guest menu address (null when the configuration is invalid)
  const guestMenuUrl = business?.id ? publicMenuUrl(business.id) : null;

  useEffect(() => { auth.refresh(); }, []);

  const [userModal, setUserModal] = useState(false);
  const [passwordModal, setPasswordModal] = useState(false);
  const [businessModal, setBusinessModal] = useState(false);
  const [logoModal, setLogoModal] = useState(false);
  const [hoursModal, setHoursModal] = useState(false);

  const initials = user?.fullName
    ? user.fullName.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase()
    : "?";

  if (!user || !business) {
    return <p className="text-gray-500">Loading account...</p>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <nav className="mb-1 text-sm text-gray-500">
          Venue <span className="mx-1">/</span> Account
        </nav>
        <h2 className="text-2xl font-bold text-gray-900">Account &amp; Settings</h2>
      </div>

      {/* AGF-S2-35 (Defect F2): a shrinkable phone column, so long values (e.g. the guest link) can't widen the page */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* User Profile */}
        <Card title="User Profile" onEdit={() => setUserModal(true)}>
          <div className="flex items-center gap-4 mb-4">
            <div className="h-14 w-14 rounded-full bg-pink-600 text-white flex items-center justify-center text-lg font-semibold shrink-0">
              {initials}
            </div>
            <div className="min-w-0">
              <p className="font-semibold text-gray-900 truncate">{user.fullName}</p>
              <p className="text-sm text-gray-500 truncate">{user.email}</p>
            </div>
          </div>
          <InfoRow label="Phone" value={user.phoneNumber} />
          <InfoRow label="Role" value={user.role} />
        </Card>

        {/* Business Profile */}
        <Card title="Business Profile" onEdit={() => setBusinessModal(true)}>
          <InfoRow label="Name" value={business.name} />
          <InfoRow label="Phone" value={business.businessPhone} />
          {/* AGF-S2-12 CR1: Ethiopian restaurants have no address rows (location = the Google Maps link) */}
          <InfoRow label="Country" value={countryName(countryOf(business.country))} />
          {countryOf(business.country) === "US" && (
            <>
              <InfoRow label="Address" value={business.streetAddress} />
              <InfoRow label="City" value={business.city} />
              <InfoRow label="State" value={business.state} />
              <InfoRow label="ZIP Code" value={business.zipcode} />
              <InfoRow label="Time zone" value={timeZoneLabel(business.timeZone)} />
            </>
          )}
          {/* AGF-S2-10: the stored host as-is (no second domain); the guest link is built exactly like the QR code */}
          <InfoRow label="Subdomain" value={formatSubdomain(business.customSubdomain)} />
          {business.id && (
            <div className="flex items-center justify-between gap-3 py-2 border-b border-gray-100 last:border-0">
              <span className="text-sm text-gray-500 shrink-0">Guest menu link</span>
              {guestMenuUrl ? (
                <span className="flex min-w-0 items-center gap-2">
                  <a
                    href={guestMenuUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="truncate text-sm font-medium text-blue-600 hover:underline"
                  >
                    {guestMenuUrl}
                  </a>
                  {/* AGF-S2-21: copies the share page (restaurant preview in chat apps); it opens the same guest menu */}
                  <CopyLinkButton url={shareUrl(business.id)} successMessage="Guest menu link copied" />
                </span>
              ) : (
                // AGF-S2-20: invalid configured address → no link and nothing to copy (fail closed)
                <span className="text-sm text-gray-500">Guest menu link unavailable</span>
              )}
            </div>
          )}
          {/* AGF-S2-12 */}
          <div className="flex items-center justify-between gap-3 py-2 border-b border-gray-100 last:border-0">
            <span className="text-sm text-gray-500 shrink-0">Google Maps link</span>
            {business.locationUrl ? (
              <a href={business.locationUrl} target="_blank" rel="noopener noreferrer" className="min-w-0 break-all text-right text-sm font-medium text-blue-600 hover:underline">
                {business.locationUrl}
              </a>
            ) : (
              <span className="text-sm font-medium text-gray-900">—</span>
            )}
          </div>
          <InfoRow label="Currency" value={displayCurrency(business.currency)} />
        </Card>

        {/* Business Logo */}
        <Card title="Business Logo" onEdit={() => setLogoModal(true)}>
          <div className="flex items-center justify-center py-4">
            {/* AGF-S2-01: the same logo guests see, or the initials when there is none */}
            <BusinessLogo
              name={business.name}
              logoUrl={business.logoUrl}
              className="h-24 w-24 rounded-2xl border border-gray-200 text-2xl shadow-sm"
            />
          </div>
        </Card>

        {/* Business Hours */}
        <Card title="Business Hours" onEdit={() => setHoursModal(true)}>
          {business.open24_7 ? (
            <p className="text-sm text-gray-600 py-2">Open 24 / 7</p>
          ) : (
            <p className="text-sm text-gray-400 py-2">Click Edit to view &amp; update hours.</p>
          )}
        </Card>
      </div>

      {/* Security */}
      <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <h3 className="text-base font-semibold text-gray-900 mb-4">Security</h3>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-700">Password</p>
            <p className="text-sm text-gray-400">Last updated: unknown</p>
          </div>
          <button
            onClick={() => setPasswordModal(true)}
            className="text-sm font-medium text-brand hover:underline"
          >
            Change
          </button>
        </div>
      </div>

      {/* Modals */}
      <UserProfileModal
        open={userModal}
        onClose={() => setUserModal(false)}
        user={user}
        onSaved={auth.refresh}
      />
      <ChangePasswordModal
        open={passwordModal}
        onClose={() => setPasswordModal(false)}
      />
      <BusinessProfileModal
        open={businessModal}
        onClose={() => setBusinessModal(false)}
        business={business}
        onSaved={auth.refresh}
      />
      <BusinessLogoModal
        open={logoModal}
        onClose={() => setLogoModal(false)}
        business={business}
        onSaved={auth.refresh}
      />
      <BusinessHoursModal
        open={hoursModal}
        onClose={() => setHoursModal(false)}
        business={business}
        onSaved={auth.refresh}
      />
    </div>
  );
}