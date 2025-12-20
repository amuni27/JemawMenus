import { useEffect, useState } from "react";
import publicMenuApi from "../../../api/publicMenueApi.ts"; // adjust path

type Business = {
    id: string;
    name: string;
    slug?: string;
    customDomain?: string | null;
};

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

    useEffect(() => {
        if (!businessId) return;

        let alive = true;
        setLoading(true);
        setError("");

        publicMenuApi
            .listMenuTypes(`/venue/${businessId}/menu`)
            .then((res) => {
                console.log(res)
                if (!alive) return;
                setData(res.data);
            })
            .catch((err: any) => {
                if (!alive) return;
                setError(err?.response?.data?.message || err?.message || "Failed to load menu");
                setData(null);
            })
            .finally(() => {
                if (!alive) return;
                setLoading(false);
            });

        return () => {
            alive = false;
        };
    }, [businessId]);

    return {
        business: data?.business,
        menus: data?.menus ?? [],
        loading,
        error,
    };
}
