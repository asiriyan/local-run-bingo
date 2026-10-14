const fs = require('fs');
const path = require('path');
const bytenode = require('bytenode');

const apiDir = path.join(__dirname, '..', 'www', 'api');

function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(full);
    } else if (entry.name.endsWith('.js')) {
      bytenode.compileFile({ filename: full, output: full.replace(/\.js$/, '.jsc') });
      console.log('compiled:', full);
    }
  }
}

walk(apiDir);