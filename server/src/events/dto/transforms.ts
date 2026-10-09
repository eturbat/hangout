// Trims text before validation, so "  Luca " and "Luca" are the same name
export const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);
