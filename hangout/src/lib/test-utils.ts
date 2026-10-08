// Newer ICU versions put a narrow no-break space before AM/PM ("9:00\u202fAM").
// Tests compare against plain spaces so they pass on any Node version.
export const plain = (text: string | null | undefined) => text?.replace(/[\u202f\u00a0]/g, ' ') ?? text
