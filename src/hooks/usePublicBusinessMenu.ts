import { useEffect, useState } from "react";
import publicMenuApi from "../api/publicMenueApi.ts"; // adjust path
import { errorMessage, isNotFound } from "../utils/errorMessage.ts";
import type { GuestBusinessInfo } from "../components/menu/GuestInfoPanel";

type Business = {
    id: string;
    name: string;
    slug?: string;
    customDomain?: string | null;
    /** AGF-S2-01: null when the restaurant has no logo */
    logoUrl?: string | null;
} & GuestBusinessInfo; // AGF-S2-03: hours, 24/7, time zone and contact

type Category = {
    id: string;
    menuId: string;
    name: string;
    sortOrder: number;
};

type MenuItem = {
    id: string;
    menuId: string;
    categoryId: string;
    name: string;
    description?: string;
    price: string;
    calories?: number;
    imageUrl?: string;
    ingredients?: string[];
    status: "AVAILABLE" | "UNAVAILABLE";
};

type Menu = {
    id: string;
    name: string;
    description?: string;
    currency: string;
    categories: Category[];
    items: MenuItem[];
};

type BusinessMenuResponse = {
    business: Business;
    menus: Menu[];
};

export function usePublicBusinessMenu(businessId?: string) {
    const [data, setData] = useState<BusinessMenuResponse | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string>("");
    // AGF-S2-33: 404 (unknown restaurant) vs other failures, and a way to try again
    const [notFound, setNotFound] = useState(false);
    const [attempt, setAttempt] = useState(0);

    useEffect(() => {
        if (!businessId) return;

        let alive = true;
        setLoading(true);
        setError("");

        publicMenuApi
            .listMenuTypes(`/venue/${businessId}/menu`)
            .then((res) => {
                if (!alive) return;
                setData(res.data);
                setNotFound(false);
            })
            .catch((err: any) => {
                if (!alive) return;
                setNotFound(isNotFound(err));
                setError(errorMessage(err, "Failed to load menu"));
                setData(null);
            })
            .finally(() => {
                if (!alive) return;
                setLoading(false);
            });

        return () => {
            alive = false;
        };
    }, [businessId, attempt]);

    return {
        business: data?.business,
        menus: data?.menus ?? [],
        loading,
        error,
        notFound,
        retry: () => setAttempt((n) => n + 1),
    };
}
