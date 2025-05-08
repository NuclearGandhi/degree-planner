export const numberToHebrewLetter = (num: number): string => {
  if (num <= 0) return ''; // Or handle as an error
  // Simple mapping for 1-22 (Aleph to Tav). Extend if more are needed.
  const letters = [
    'א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ז', 'ח', 'ט', 'י', 
    'כ', 'ל', 'מ', 'נ', 'ס', 'ע', 'פ', 'צ', 'ק', 'ר', 'ש', 'ת'
  ];
  if (num > letters.length) return num.toString() + '׳'; // Fallback for numbers > 22, also add Geresh
  return letters[num - 1] + '׳'; // Add Geresh
}; 