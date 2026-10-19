/** Show text starting with a capital letter, however it was typed (or stored). */
export const cap = (text: string): string => text.charAt(0).toUpperCase() + text.slice(1);
