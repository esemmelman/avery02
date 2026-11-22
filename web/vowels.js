export const vowels = [
  ["patah", "אַ"],
  ["qamatz", "אָ"],
  ["segol", "אֶ"],
  ["tsere", "אֵ"],
  ["hiriq", "אִ"],
  ["holam", "אֹ"],
  ["qubuts", "אֻ"],
  ["shuruk", "אוּ"],
  ["sheva", "אְ"],
  ["hataf-segol", "אֱ"],
  ["hataf-patah", "אֲ"],
  ["hataf-qamatz", "אֳ"],
  ["qamatz-qatan", "אׇ"],
];

const practiceLetters = ["מ", "נ", "ל", "ר", "שׁ"];
const practiceVowels = ["ַ", "ֶ", "ִ", "ֹ", "ֻ"];

export const practicePairs = practiceLetters.flatMap((letter) =>
  practiceVowels.map((mark) => (letter + mark).normalize("NFC"))
);
