const fs = require('fs');

let lines = fs.readFileSync('src/pages/Trips.tsx', 'utf8').split('\n');
const startLine = 510;
const endLine = 1250; // Just search in the body of the map

let tagStack = [];

for(let i = startLine; i < endLine; i++) {
   const line = lines[i];
   // Crude heuristic for opened and closed divs
   if (line.includes('<div') && !line.includes('/>') && !line.includes('</div')) {
      tagStack.push(i);
   } else if (line.includes('</div')) {
      if(tagStack.length > 0) {
         tagStack.pop();
      }
   }
}

console.log("Unclosed divs around lines:", tagStack);

