const fs = require('fs');

let lines = fs.readFileSync('src/pages/Trips.tsx', 'utf8').split('\n');
console.log(lines[525]);
console.log(lines[526]);
console.log(lines[527]);
console.log(lines[528]);
console.log(lines[529]);

