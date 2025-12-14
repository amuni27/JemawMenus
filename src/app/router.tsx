import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import Landing from '../pages/public/Landing';
import Pricing from '../pages/public/Pricing';
import Login from '../pages/public/Login';
import Register from '../pages/public/Register';
import AdminLayout from '../app/layout/AdminLayout';
import CustomerMenu from '../pages/customer/MenuPage';
import Dashboard from '../pages/admin/Dashboard';
import AdminMenuPage from '../features/menu/pages/AdminMenuPage';
import QrListPage from '../pages/admin/QrListPage';
import DealsPage from '../pages/admin/DealsPage';
import AdsPage from '../pages/admin/AdsPage';

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
    element: <Register />,
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
          { path: 'menu', element: <AdminMenuPage /> },
          { path: 'qr', element: <QrListPage /> },
          { path: 'deals', element: <DealsPage /> },
          { path: 'ads', element: <AdsPage /> },
        ],
      },
    ],
  },
]);

export function AppRouter() {
  return <RouterProvider router={router} />;
}
