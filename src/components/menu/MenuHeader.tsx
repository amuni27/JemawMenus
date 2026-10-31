import React from "react";
import { MenuPicker } from "./MenuPicker.tsx";
import BusinessLogo from "../ui/BusinessLogo";
import { LanguageSwitch } from "./LanguageSwitch";
import { useGuestLanguage } from "../../utils/guestLanguage";

type Props = {
  businessName?: string;
  logoUrl?: string;
  activeMenuCurrency?: string;
  menus: any[];
  activeMenuId: string | null;
  handleSelectMenu: (menuId: string) => void;
  loading: boolean;

  // NEW
  orderCount?: number;
  onOpenOrder?: () => void;

  /** AGF-S2-05 */
  searchQuery?: string;
  onSearchChange?: (q: string) => void;
};

export function MenuHeader({
  businessName,
  logoUrl,
  activeMenuCurrency,
  menus,
  activeMenuId,
  handleSelectMenu,
  loading,
  orderCount = 0,
  onOpenOrder,
  searchQuery,
  onSearchChange,
}: Props) {
  const { available: languageSwitch } = useGuestLanguage(); // AGF-S2-23
  return (
    <header className="border-b bg-white lg:sticky lg:top-0 lg:z-40">
      {/* Top row */}
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-x-4 gap-y-1 px-3 pt-2">
        {/* Brand */}
        <div className="inline-flex items-center px-2 py-1">
          {/* AGF-S2-01: the restaurant's own logo, or its initials */}
          <BusinessLogo name={businessName} logoUrl={logoUrl} className="h-10 w-10 text-sm" />
          <p className="pl-2 text-xl font-extrabold text-gray-900">
            {businessName ?? "Menu"}
          </p>
        </div>

        {/* AGF-S2-23: only when the restaurant has Amharic text; its own line on phones, inline from sm */}
        {languageSwitch && (
          <div className="order-last flex w-full justify-end px-2 sm:order-none sm:ml-auto sm:w-auto sm:px-0">
            <LanguageSwitch />
          </div>
        )}

        {/* Right actions */}
        <div className="flex items-center gap-3">
          {activeMenuCurrency ? (
            <div className="hidden text-sm font-semibold text-gray-600 sm:block">
              Currency: <span className="text-gray-900">{activeMenuCurrency}</span>
            </div>
          ) : null}

          {/* Order / Waiter list button */}
          <button
            onClick={onOpenOrder}
            className="relative inline-flex h-10 w-10 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-700 transition hover:bg-gray-50 active:scale-[0.97]"
            aria-label="View order"
          >
            <ReceiptIcon className="h-5 w-5" />

            {orderCount > 0 && (
              <span className="absolute -right-1 -top-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-emerald-700 px-1 text-xs font-bold text-white">
                {orderCount}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Menu picker row */}
      <div className="mx-auto max-w-7xl px-6">
        <MenuPicker
          menus={menus ?? []}
          activeMenuId={activeMenuId}
          onSelectMenu={handleSelectMenu}
          loading={loading}
          searchQuery={searchQuery}
          onSearchChange={onSearchChange}
        />
      </div>
    </header>
  );
}

/* -------- Icon (receipt / order list) -------- */
function ReceiptIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" {...props}>
      <path
        d="M7 3h10a2 2 0 0 1 2 2v16l-3-2-3 2-3-2-3 2V5a2 2 0 0 1 2-2Z"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M9 7h6M9 11h6M9 15h4" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
