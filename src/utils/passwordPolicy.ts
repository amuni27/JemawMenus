// Password policy shared by registration and change-password (AGF-S1-17); the backend enforces the same rule.
export const PASSWORD_POLICY_MESSAGE =
    "Password must be 8-72 characters and include an uppercase letter, a lowercase letter, a number and a symbol";

export function passwordChecks(password: string) {
    return {
        minLength: password.length >= 8,
        maxLength: new TextEncoder().encode(password).length <= 72,
        lowercase: /[a-z]/.test(password),
        uppercase: /[A-Z]/.test(password),
        number: /[0-9]/.test(password),
        symbol: /[^A-Za-z0-9]/.test(password),
    };
}

export function isStrongPassword(password: string) {
    return Object.values(passwordChecks(password)).every(Boolean);
}
