const fs = require('fs');
const p = 'c:/Users/david/Downloads/WISPTools/docs/ENHANCEMENTS.md';
let s = fs.readFileSync(p, 'utf8');
// Remove duplicate --- and the orphan "8. Hardware module" block (apostrophe may be U+2019)
const re = /\n---\n\n\n---\n\n\n8\. \*\*Hardware module\*\*  \n    EPC edit field is readonly\/disabled; consider allowing edit when appropriate or clarifying why it. fixed\.\n\n---\n/g;
s = s.replace(re, '\n---\n');
fs.writeFileSync(p, s);
console.log('Written');
