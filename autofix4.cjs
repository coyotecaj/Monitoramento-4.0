const fs = require('fs');

let lines = fs.readFileSync('src/pages/Trips.tsx', 'utf8').split('\n');

// I am going to search for the specific lines where I broke the markup during the multi_edit_file call
// Specifically around the "Machine of States Progress Bar" area.

const searchString = `                  {vehicle?.status !== 'MAINTENANCE' && (
                    <div className="space-y-1.5 bg-[#0a0e1a] p-3 rounded-lg border border-[#1f2d45]/80">`;

const codeString = lines.join('\n');
const matchIndex = codeString.indexOf(searchString);
if(matchIndex !== -1) {
  console.log("Found the target string");
  // Let's replace the corrupted block
} else {
  console.log("Not found");
}

