// check.js - Check SQLCipher capabilities (standalone script: run with `node check.js`)
//
// IMPORTANT: plain `better-sqlite3` has NO cipher/encryption support at all —
// this check will basically always fail on a stock install. If your PHP app
// was actually relying on SQLCipher encryption for mccorlib.bin, you need
// `better-sqlite3-multiple-ciphers` instead (drop-in API-compatible replacement
// with SQLCipher support), not plain better-sqlite3. Flag this back to me if
// encryption is actually in use so I can adjust config.js accordingly.
const Database = require('better-sqlite3');

const db = new Database(':memory:');

try {
    const result = db.pragma('cipher_version');
    console.log('Cipher Version:', result);
} catch (error) {
    console.log('Error getting cipher version:', error.message);
    console.log('SQLCipher might not be properly installed.');
}

try {
    const pragmas = db.pragma('pragma_list');
    const cipherPragmas = pragmas.filter(p =>
        Object.values(p).some(v => String(v).toLowerCase().includes('cipher'))
    );
    console.log('\nAvailable cipher-related PRAGMAs:');
    console.log(cipherPragmas);
} catch (error) {
    console.log('Error listing pragmas:', error.message);
}

db.close();
module.exports = router;
