# Multi-Tenant QR Menu SaaS – Frontend (Vite + React + TypeScript + TailwindCSS)

This repo contains the **frontend MVP** for a multi-tenant QR Menu Software-as-a-Service.  
Hotels & restaurants can manage digital menus, deals, ads and subscriptions while guests scan a QR code to view the mobile-friendly menu.

---
## ✨  Features

* Multi-tenant routing using **sub-domain simulation** (`/:tenantSlug/*`) – ready to switch to real sub-domains in production.
* Admin dashboard (sidebar + topbar)
  * Auth (mock) – login, register, logout
  * Menu category & item CRUD
  * Deal & advertisement scheduling
  * QR code generator (SVG download)
* Customer mobile menu
  * Category pills, search, item modal, deals & ads sections
* **TailwindCSS** mobile-first responsive UI
* **Mock API layer** (localStorage JSON + latency) – *swap with real REST/GraphQL later without touching UI code*

---
## 📂  Project Structure (key paths)

```
src/
  api/            ← mock API (auth, tenant, menu, deals, ads)
  app/            ← router, context providers, layouts
  components/     ← reusable UI (+ domain modules)
  pages/          ← route components (public, admin, customer)
  types/          ← strong domain models shared by UI & API
  utils/          ← helpers (resolveTenant, etc.)
```

---
## 🚀  Getting Started

```bash
# 1. Install dependencies
pnpm i        # or npm i / yarn

# 2. Run in dev mode
pnpm dev      # http://localhost:5173

# 3. Build for production
pnpm build    # output in dist/
```

### Creating a Tenant Locally
1. Visit **`/auth/register`** – sign up with email + password + restaurant name.  
2. You’ll be taken to `/your-tenant/admin`.
3. Inside **Menu → Categories** create categories/items.
4. Generate a QR in **QR Codes** tab.  
   Scan it (or open) and it will load `/your-tenant/menu` using customer view.

---
## 🔌  Replacing the Mock API with a Real Backend

The UI **never imports `fetch` directly** – every data call goes through `src/api/*` functions.  
To integrate your backend:

1. Replace the implementations inside each file (keep function signatures).
2. Remove the `delay()` helper and localStorage usage.
3. Optional: create a thin `apiClient.ts` using `fetch` / Axios / TanStack Query.

Because domain models live in `src/types`, type-checking will ensure consistency across layers.

---
## 🌐  Multi-Tenant Strategy

* **Development** – tenants are simulated via the first URL segment:  
  `http://localhost:5173/demo-hotel/admin` → slug **`demo-hotel`**.
* **Production** – call `resolveTenant()` (in `utils/`) which will read `window.location.hostname` and extract the sub-domain (e.g. `demo-hotel.myapp.com`).

---
## 🛠️  Scripts

| Script          | Description                    |
| --------------- | ------------------------------ |
| `pnpm dev`      | Vite dev server + HMR          |
| `pnpm build`    | Production build (`dist/`)     |
| `pnpm preview`  | Preview built site             |
| `pnpm lint`     | ESLint                         |

---
## 📱  Responsive Design

* Built **mobile-first** – the customer menu is optimised for 320 px phones upward.  
* Admin dashboard uses Tailwind break-points (`md:`/`lg:`) so tables & forms adapt gracefully.  
* Modal and sidebar use flexbox & fixed widths; feel free to add a hamburger toggle for extra-small screens.

---
## 📋  TODO / Next Steps

* Integrate real authentication & subscription billing APIs.
* Add image upload to menu items.
* Collapsible admin sidebar on < 640 px.
* Internationalisation (i18n).

---
Made with ❤️ & Vite.
