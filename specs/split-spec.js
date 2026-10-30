// Script to help identify sections in the original spec
// Run with: node split-spec.js

const fs = require('fs');

const content = fs.readFileSync('../../MIGRATION_SPECIFICATION.md', 'utf8');
const lines = content.split('\n');

// Find all major sections
const sections = [];
let currentSection = null;
let startLine = 0;

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  if (line.startsWith('## ')) {
    if (currentSection) {
      sections.push({ name: currentSection, start: startLine, end: i - 1 });
    }
    currentSection = line.replace('## ', '');
    startLine = i;
  }
}

// Add last section
if (currentSection) {
  sections.push({ name: currentSection, start: startLine, end: lines.length - 1 });
}

console.log('Found sections:');
sections.forEach((s, i) => {
  console.log(`${i + 1}. ${s.name} (lines ${s.start}-${s.end})`);
});
