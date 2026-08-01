const fs = require('fs');
let code = fs.readFileSync('src/pages/Trips.tsx', 'utf8');

// I am going to try running prettier directly on the string in JS with a crude bracket matcher and replace the mismatches
// Actually, I'll just write a quick script that uses ts-morph or babel to see where it breaks, but since it's hard, I'll just restore a backup if I can find one. Let's see if there are any git backups. 

