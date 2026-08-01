const fs = require('fs');

let code = fs.readFileSync('src/pages/Trips.tsx', 'utf8');
code = code.replace(/<\/span>\s*<\/span>\s*<\/div>\s*<\/div>/g, '</span>');
code = code.replace(/<\/span>\s*<\/>s*<\/div>\s*<\/div>/g, '</span></>');
code = code.replace(/<\/div>\s*<\/div>\s*<\/div>\s*<\/div>\s*<\/div>\s*<\/div>\s*<\/div>\s*\)}/g, ')}');
code = code.replace(/<\/div>\s*<\/div>\s*\)}/g, ')}');

fs.writeFileSync('src/pages/Trips.tsx', code);
