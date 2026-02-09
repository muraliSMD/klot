
const source = "227873";
const target = "521719";

const sDigits = source.split('').map(Number);
const tDigits = target.split('').map(Number);

console.log("Source:", source);
console.log("Target:", target);

// 1. Direct Difference (Mod 10)
const diff = sDigits.map((s, i) => (tDigits[i] - s + 10) % 10);
console.log("Difference Pattern:", diff.join(''));

// 2. Reverse Difference
const sRev = [...sDigits].reverse();
const diffRev = sRev.map((s, i) => (tDigits[i] - s + 10) % 10);
console.log("Reverse Difference:", diffRev.join(''));

// 3. Date 7 Relation
// Target Date is 7th.
// Diff: 3, 0, 4, 9, 4, 6
// 3 = 7 - 4?
// 0 = 7 - 7?
// 4 = 7 - 3?

// 4. Pairs analysis
// 22 -> 52 (+30)
// 78 -> 17 (-61)
// 73 -> 19 (-54)

console.log("Analysis Complete");
