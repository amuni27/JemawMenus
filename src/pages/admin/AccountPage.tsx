import { useState } from "react";
import { useAuth } from "../../app/context/AuthContext";
import UserProfileModal from "../../components/account/UserProfileModal";
import ChangePasswordModal from "../../components/account/ChangePasswordModal";
import BusinessProfileModal from "../../components/account/BusinessProfileModal";
import BusinessLogoModal from "../../components/account/BusinessLogoModal";
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

      <div className="grid gap-6 lg:grid-cols-2">
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
          <InfoRow label="Address" value={business.streetAddress} />
          <InfoRow label="City" value={business.city} />
          <InfoRow label="Region" value={business.state} />
          <InfoRow label="Subdomain" value={business.customSubdomain ? `${business.customSubdomain}.menuqrs.com` : undefined} />
        </Card>

        {/* Business Logo */}
        <Card title="Business Logo" onEdit={() => setLogoModal(true)}>
          <div className="flex items-center justify-center py-4">
            {(business as any).logoUrl ? (
              <img
                src={(business as any).logoUrl}
                alt="Business logo"
                className="h-24 w-24 rounded-2xl object-cover border border-gray-200 shadow-sm"
              />
            ) : (
              <div className="h-24 w-24 rounded-2xl border-2 border-dashed border-gray-300 flex items-center justify-center bg-gray-50">
                <span className="text-xs text-gray-400">No logo</span>
              </div>
            )}
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