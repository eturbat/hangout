// Trims text before validation, so "  Luca " and "Luca" are the same name
export const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

// Treats "" like a missing field, so an empty optional input isn't a value
export const emptyToUndefined = ({ value }: { value: unknown }) => (value === '' ? undefined : value);
