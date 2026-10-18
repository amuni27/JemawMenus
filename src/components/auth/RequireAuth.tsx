import type {ReactNode} from 'react';
import {Navigate, useLocation} from 'react-router-dom';
import {useAuth} from '../../app/context/AuthContext';
import {loginPath} from '../../services/session';

/**
 * Guards restaurant-owner pages (AGF-S1-11). Waits for the first session check, then sends visitors
 * without a valid session to login, with the reason (expired / inactive) and the page to return to.
 * The admin layout never renders for them. Guest pages are not wrapped, so they are never redirected.
 */
export default function RequireAuth({children}: { children: ReactNode }) {
    const {ready, isAuthenticated, endReason} = useAuth();
    const location = useLocation();

    if (!ready) {
        return (
            <div role="status" className="flex min-h-screen items-center justify-center text-gray-500">
                Checking your session…
            </div>
        );
    }

    if (!isAuthenticated) {
        return <Navigate to={loginPath(endReason, `${location.pathname}${location.search}`)} replace/>;
    }

    return <>{children}</>;
}
