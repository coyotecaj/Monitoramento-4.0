const fs = require('fs');
let code = fs.readFileSync('src/pages/Trips.tsx', 'utf8').split('\n');

const addDivBefore = (lines) => {
  lines.forEach(line => {
    code.splice(line - 1, 0, '                   </div>');
  });
};

addDivBefore([1151, 1134, 1108, 967, 943, 858, 793, 775, 774, 755, 705, 685, 665, 643, 530, 528, 520]);

fs.writeFileSync('src/pages/Trips.tsx', code.join('\n'));
