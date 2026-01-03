import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import Landing from '../pages/public/Landing';
import Pricing from '../pages/public/Pricing';
import Login from '../pages/public/Login';
import RegisterWizard from '../pages/public/RegisterWizard';
import AdminLayout from '../components/layout/AdminLayout.tsx';
import CustomerMenu from '../pages/customer/CustomerMenu.tsx';
import Dashboard from '../pages/admin/Dashboard';
import AdminMenuPage from '../features/menu/pages/AdminMenuPage';
import QrListPage from '../pages/admin/QrListPage';
import DealsPage from '../pages/admin/DealsPage';
import AdsPage from '../pages/admin/AdsPage';
import React from "react";
import MenusListPage from "../pages/menus/MenusListPage.tsx";
import MenuCreatePage from "../pages/menus/MenuCreatePage.tsx";
import MenuDetailPage from "../pages/menus/MenuDetailPage.tsx";

const router = createBrowserRouter([
  {
    path: '/',
    element: <Landing />,
  },
  {
    path: '/pricing',
    element: <Pricing />,
  },
  {
    path: '/auth/login',
    element: <Login />,
  },
  {
    path: '/auth/register',
    element: <RegisterWizard />,
  },
  // Tenant routes (simulate subdomain with :tenantSlug)
  {
    path: '/:tenantSlug',
    children: [
      {
        path: 'menu',
        element: <CustomerMenu />,
      },
      {
        path: 'admin',
        element: <AdminLayout />,
        children: [
          { index: true, element: <Dashboard /> },
          { path: 'qr', element: <QrListPage /> },
          { path: 'deals', element: <DealsPage /> },
          {
            path: 'menus',
            children: [
              { index: true, element: <MenusListPage /> },
              { path: 'new', element: <MenuCreatePage /> },
              { path: ':menuId', element: <MenuDetailPage /> },
            ],
          },
          {path: 'menus/new', element: <MenuCreatePage />},
          { path: 'ads', element: <AdsPage /> },
        ],
      },
    ],
  },
]);

export function AppRouter() {
  return <RouterProvider router={router} />;
}
