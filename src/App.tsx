import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import AdminLayout from "./components/layout/AdminLayout";
import MenusListPage from "./pages/menus/MenusListPage";
import MenuCreatePage from "./pages/menus/MenuCreatePage";
import MenuDetailPage from "./pages/menus/MenuDetailPage";

import { ToastProvider } from './components/ui/ToastContext';

export default function App() {
  return (
    <ToastProvider>
    <BrowserRouter>
      <Routes>
        {/* Redirect root to sample tenant */}
        <Route path="/" element={<Navigate to="/demo/admin/menus" />} />

        {/* Admin routes */}
        <Route path=":tenantSlug/admin" element={<AdminLayout />}>  {/* will not work; wrap in element? need layout as wrapper of nested routes with Outlet, but to keep simple we embed pages inside layout route */}
          {/* We'll handle nested inside below due to TSX limitations here. */}
        </Route>

        <Route
          path=":tenantSlug/admin/menus"
          element={
            <AdminLayout>
              <MenusListPage />
            </AdminLayout>
          }
        />
        <Route
          path=":tenantSlug/admin/menus/new"
          element={
            <AdminLayout>
              <MenuCreatePage />
            </AdminLayout>
          }
        />
        <Route
          path=":tenantSlug/admin/menus/:menuId"
          element={
            <AdminLayout>
              <MenuDetailPage />
            </AdminLayout>
          }
        />
      </Routes>
    </BrowserRouter>
    </ToastProvider>
  );
}