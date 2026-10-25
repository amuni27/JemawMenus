import {Navigate, type RouteObject} from 'react-router-dom';
import Landing from '../pages/public/Landing';
import Login from '../pages/public/Login';
import RegisterWizard from '../pages/public/RegisterWizard';
import ForgotPassword from '../pages/public/ForgotPassword';
import ResetPassword from '../pages/public/ResetPassword';
import AdminLayout from '../components/layout/AdminLayout.tsx';
import RequireAuth from '../components/auth/RequireAuth.tsx';
import CustomerMenu from '../pages/customer/CustomerMenu.tsx';
import Dashboard from '../pages/admin/Dashboard';
import React from "react";
import MenusListPage from "../pages/menus/MenusListPage.tsx";
import MenuCreatePage from "../pages/menus/MenuCreatePage.tsx";
import MenuDetailPage from "../pages/menus/MenuDetailPage.tsx";
import QRPage from "../pages/menus/QRPage.tsx";
import MenuItemDetail from "../pages/customer/MenuItemDetail.tsx";
import MenuEditPage from "../pages/menus/MenuEditPage.tsx";
import AccountPage from "../pages/admin/AccountPage.tsx";
import MenuPreviewPage from "../pages/menus/MenuPreviewPage.tsx";

// The app's route table, in its own module so route tests can use it (AGF-S2-29)
export const routes: RouteObject[] = [
    {
        path: '/',
        element: <Landing/>,
    },
    {
        // AGF-S2-29: the invented pricing page is gone (D7); old links land on the home page
        path: '/pricing',
        element: <Navigate to="/" replace/>,
    },
    {
        path: '/auth/login',
        element: <Login/>,
    },
    {
        path: '/auth/forgot-password', // AGF-S2-13A
        element: <ForgotPassword/>,
    },
    {
        path: '/auth/reset-password',
        element: <ResetPassword/>,
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
                // AGF-S2-17: owner-only guest view of one menu; signed-in owners only, outside the admin layout
                path: 'admin/menus/:menuId/preview',
                element: <RequireAuth><MenuPreviewPage/></RequireAuth>,
                children: [
                    {path: 'item/:itemId', element: <MenuItemDetail/>},
                ],
            },
            {
                path: 'admin',
                element: <RequireAuth><AdminLayout/></RequireAuth>,
                children: [
                    {index: true, element: <Dashboard/>},
                    {path: 'qrcode', element: <QRPage/>},
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
];
