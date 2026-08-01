const fs = require('fs');

let lines = fs.readFileSync('src/pages/Trips.tsx', 'utf8').split('\n');

let cleanedLines = [];
let i = 0;
let depth = 0;

// Just run prettier ignoring errors, see if it fixes it. No, that failed.

// The issue was:
// src/pages/Trips.tsx(519,31): error TS1005: ')' expected.

console.log(lines[517]); // 518 in editor
console.log(lines[518]);
console.log(lines[519]);
console.log(lines[520]);

