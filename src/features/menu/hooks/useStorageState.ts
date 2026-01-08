import { useEffect, useState } from "react";

type StorageKind = "session" | "local";

function getStorage(kind: StorageKind) {
    return kind === "local" ? window.localStorage : window.sessionStorage;
}

export function useStorageState<T>(
    key: string,
    initialValue: T,
    kind: StorageKind = "session"
) {
    const [value, setValue] = useState<T>(() => {
        try {
            const raw = getStorage(kind).getItem(key);
            return raw ? (JSON.parse(raw) as T) : initialValue;
        } catch {
            return initialValue;
        }
    });

    useEffect(() => {
        try {
            getStorage(kind).setItem(key, JSON.stringify(value));
        } catch {
            // ignore quota / disabled storage errors
        }
    }, [key, kind, value]);

    return [value, setValue] as const;
}
