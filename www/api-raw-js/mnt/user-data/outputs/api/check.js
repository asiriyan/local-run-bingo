// api/check.js
// Route version of check.php, since server.js mounts it as /api/check.
// See check.js (project root) for the same logic as a standalone CLI script.
//
// IMPORTANT: plain `better-sqlite3` has no cipher/encryption support — this
// will report no cipher-related pragmas on a stock install. If mccorlib.bin
// is actually SQLCipher-encrypted, swap to `better-sqlite3-multiple-ciphers`.
const express = require('express');
const router = express.Router();
const Database = require('better-sqlite3');

router.get('/', (req, res) => {
    const testDb = new Database(':memory:');
    const result = { cipherVersion: null, cipherPragmas: [] };

    try {
        result.cipherVersion = testDb.pragma('cipher_version', { simple: true });
    } catch (error) {
        result.cipherVersionError = error.message;
    }

    try {
        const pragmas = testDb.pragma('pragma_list');
        result.cipherPragmas = pragmas.filter(p =>
            Object.values(p).some(v => String(v).toLowerCase().includes('cipher'))
        );
    } catch (error) {
        result.cipherPragmasError = error.message;
    }

    testDb.close();
    res.json(result);
});

module.exports = router;
