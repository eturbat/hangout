/** Trims strings before validation, so "  Luca " and "Luca" are the same name. */
export const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

/** Treats an empty string as "not provided", so a blank password field is fine. */
export const emptyToUndefined = ({ value }: { value: unknown }) => (value === '' ? undefined : value);

