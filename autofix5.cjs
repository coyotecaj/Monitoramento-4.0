const fs = require('fs');

let lines = fs.readFileSync('src/pages/Trips.tsx', 'utf8').split('\n');

for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('<div className="bg-[#0a0e1a] p-2.5 rounded-lg border border-[#1f2d45]/60">')) {
    // Check if the previous line is an empty div, if not we need to add a closing div 3 lines down
    lines.splice(i+3, 0, '                      </div>');
  }
}

fs.writeFileSync('src/pages/Trips.tsx', lines.join('\n'));
