import {createBrowserRouter, RouterProvider} from 'react-router-dom';
import Landing from '../pages/public/Landing';
import Pricing from '../pages/public/Pricing';
import Login from '../pages/public/Login';
import RegisterWizard from '../pages/public/RegisterWizard';
import AdminLayout from '../components/layout/AdminLayout.tsx';
import CustomerMenu from '../pages/customer/CustomerMenu.tsx';
import Dashboard from '../pages/admin/Dashboard';
import DealsPage from '../pages/admin/DealsPage';
import React from "react";
import MenusListPage from "../pages/menus/MenusListPage.tsx";
import MenuCreatePage from "../pages/menus/MenuCreatePage.tsx";
import MenuDetailPage from "../pages/menus/MenuDetailPage.tsx";
import QRPage from "../pages/menus/QRPage.tsx";
import MenuItemDetail from "../pages/customer/MenuItemDetail.tsx";
import MenuEditPage from "../pages/menus/MenuEditPage.tsx";
import AccountPage from "../pages/admin/AccountPage.tsx";

const router = createBrowserRouter([
    {
        path: '/',
        element: <Landing/>,
    },
    {
        path: '/pricing',
        element: <Pricing/>,
    },
    {
        path: '/auth/login',
        element: <Login/>,
    },
    {
        path: '/auth/register',
        element: <RegisterWizard/>,
    },
    // Tenant routes (simulate subdomain with :tenantSlug)
    {
        path: '/:tenantSlug',
        children: [
            {
                path: 'menu',
                element: <CustomerMenu/>,
                children: [
                    { path: "item/:itemId", element: <MenuItemDetail /> }, // child view
                ],

            },
            {
                path: 'admin',
                element: <AdminLayout/>,
                children: [
                    {index: true, element: <Dashboard/>},
                    {path: 'qrcode', element: <QRPage/>},
                    {path: 'deals', element: <DealsPage/>},
                    {
                        path: 'menus',
                        children: [
                            {index: true, element: <MenusListPage/>},
                            {path: 'new', element: <MenuCreatePage/>},
                            {path: ':menuId', element: <MenuDetailPage/>},
                            {path: ':menuId/edit', element: <MenuEditPage/>},
                        ],
                    },
                    {path: 'menus/new', element: <MenuCreatePage/>},
                    {path: 'account', element: <AccountPage/>},
                ],
            },
        ],
    },
]);

export function AppRouter() {
    return <RouterProvider router={router}/>;
}
