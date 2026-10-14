const fs = require('fs');
const path = require('path');
const bcrypt = require('bcrypt');
const db = require('./config'); // SQLite/SQLCipher connection

// Database setup
function setupDatabase() {
  const appData = process.env.LOCALAPPDATA;
  const targetDir = path.join(appData, 'Programs', 'Common', 'cache');
  const finalDbPath = path.join(targetDir, 'mccorlib.bin');

  if (!fs.existsSync(finalDbPath)) {
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
      console.log("Created folder:", targetDir);
    }

    const testFile = path.join(__dirname, 'mccorlib.bin');
    if (fs.existsSync(testFile)) {
      fs.copyFileSync(testFile, finalDbPath);
      console.log("✓ Database copied from local file");
    } else {
      console.error("✗ Database setup failed!");
    }
  }
}

// Hardware verification (simplified placeholder)
async function verifyHardware(req) {
  const currentHardware = {
    computer_uuid: "SIMULATED_UUID",
    cpu_id: "SIMULATED_CPU",
    bios_serial: "SIMULATED_BIOS"
  };

  const stored = await new Promise((resolve, reject) => {
    db.get("SELECT computer_uuid, cpu_id, bios_serial FROM hardware_lock LIMIT 1", [], (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });

  const verification = await new Promise((resolve, reject) => {
    db.get("SELECT is_verified, verification_code FROM system_verification LIMIT 1", [], (err, row) => {
      if (err) reject(err);
      else resolve(row || { is_verified: 0, verification_code: '' });
    });
  });

  if (verification.is_verified === 1) {
    if (req.session.hardware_verified) return true;
    if (!stored) throw new Error("No hardware registered in database.");
    const match = (
      stored.computer_uuid === currentHardware.computer_uuid &&
      stored.cpu_id === currentHardware.cpu_id &&
      stored.bios_serial === currentHardware.bios_serial
    );
    if (match) {
      req.session.hardware_verified = true;
      return true;
    } else {
      throw new Error("License is not valid for this computer.");
    }
  } else {
    throw new Error("System verification required.");
  }
}

// Handle verification form
async function handleVerification(req, res) {
  const password = (req.body.verify_password || '').trim();

  const verification = await new Promise((resolve, reject) => {
    db.get("SELECT is_verified, verification_code FROM system_verification LIMIT 1", [], (err, row) => {
      if (err) reject(err);
      else resolve(row || { is_verified: 0, verification_code: '' });
    });
  });

  const stored = await new Promise((resolve, reject) => {
    db.get("SELECT computer_uuid, cpu_id, bios_serial FROM hardware_lock LIMIT 1", [], (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });

  const currentHardware = {
    computer_uuid: "SIMULATED_UUID",
    cpu_id: "SIMULATED_CPU",
    bios_serial: "SIMULATED_BIOS"
  };

  const match = stored &&
    stored.computer_uuid === currentHardware.computer_uuid &&
    stored.cpu_id === currentHardware.cpu_id &&
    stored.bios_serial === currentHardware.bios_serial;

  const ok = await bcrypt.compare(password, verification.verification_code || '');
  if (ok && match) {
    await new Promise((resolve, reject) => {
      db.run("UPDATE system_verification SET is_verified = 1, verified_at = datetime('now')", [], (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
    req.session.hardware_verified = true;
    return res.redirect('/index'); // reload index
  } else {
    return res.json({ error: "Invalid verification or license mismatch" });
  }
}

// Login handling
async function loginHandler(req, res) {
  const { email, password } = req.body;

  if (!req.session.hardware_verified) {
    return res.json({ error: "System verification required!" });
  }

  db.get("SELECT * FROM user_info WHERE username = ? LIMIT 1", [email], (err, row) => {
    if (err) return res.json({ error: err.message });
    if (!row) return res.json({ error: "Invalid user account" });

    bcrypt.compare(password, row.password, (err2, match) => {
      if (err2 || !match) {
        return res.json({ error: "Invalid password" });
      }
      req.session.username = row.username;
      return res.redirect('/newgame'); // redirect to newgame.php equivalent
    });
  });
}

module.exports = {
  setupDatabase,
  verifyHardware,
  handleVerification,
  loginHandler
};
