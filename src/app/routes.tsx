import {Navigate, type RouteObject} from 'react-router-dom';
import Landing from '../pages/public/Landing';
import Login from '../pages/public/Login';
import RegisterWizard from '../pages/public/RegisterWizard';
import ForgotPassword from '../pages/public/ForgotPassword';
import ResetPassword from '../pages/public/ResetPassword';
import VerifyEmail from '../pages/public/VerifyEmail';
import AdminLayout from '../components/layout/AdminLayout.tsx';
import RequireAuth from '../components/auth/RequireAuth.tsx';
import CustomerMenu from '../pages/customer/CustomerMenu.tsx';
import Dashboard from '../pages/admin/Dashboard';
import React from "react";
import MenusListPage from "../pages/menus/MenusListPage.tsx";
import MenuCreatePage from "../pages/menus/MenuCreatePage.tsx";
import MenuDetailPage from "../pages/menus/MenuDetailPage.tsx";
import QRPage from "../pages/menus/QRPage.tsx";
import SpecialsPage from "../pages/admin/SpecialsPage.tsx";
import MenuItemDetail from "../pages/customer/MenuItemDetail.tsx";
import MenuEditPage from "../pages/menus/MenuEditPage.tsx";
import AccountPage from "../pages/admin/AccountPage.tsx";
import MenuPreviewPage from "../pages/menus/MenuPreviewPage.tsx";
import NotFound from "../components/NotFound.tsx";
import RouteError from "../components/RouteError.tsx";
import SuperAdminLogin from "../pages/superadmin/SuperAdminLogin.tsx";
import SuperAdminLayout from "../pages/superadmin/SuperAdminLayout.tsx";
import SuperAdminOverview from "../pages/superadmin/SuperAdminOverview.tsx";
import SuperAdminAuditLog from "../pages/superadmin/SuperAdminAuditLog.tsx";

// The app's route table, in its own module so route tests can use it (AGF-S2-29)
export const routes: RouteObject[] = [
    {
        // AGF-S2-33: branded error and not-found screens instead of the router's developer page
        errorElement: <RouteError/>,
        children: [
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
                path: '/auth/verify-email', // AGF-S2-22
                element: <VerifyEmail/>,
            },
            {
                path: '/auth/register',
                element: <RegisterWizard/>,
            },
            // AGF E4-M1: the platform Super Admin console (fixed paths outrank /:tenantSlug)
            {
                path: '/super-admin/login',
                element: <SuperAdminLogin/>,
            },
            {
                path: '/super-admin',
                element: <SuperAdminLayout/>,
                children: [
                    {index: true, element: <SuperAdminOverview/>},
                    {path: 'audit', element: <SuperAdminAuditLog/>},
                ],
            },
            // Tenant routes (simulate subdomain with :tenantSlug)
            {
                path: '/:tenantSlug',
                children: [
                    // AGF-S2-33 (D-NF-1): a bare business URL opens that restaurant's menu
                    {index: true, element: <Navigate to="menu" replace/>},
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
                            {path: 'specials', element: <SpecialsPage/>}, // AGF-S2-25
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
                            // AGF-S2-33: unknown owner URLs (inside the guard, so signed-out visitors still see login)
                            {path: '*', element: <NotFound context="owner"/>},
                        ],
                    },
                ],
            },
            {path: '*', element: <NotFound context="public"/>},
        ],
    },
];
