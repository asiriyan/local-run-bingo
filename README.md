# Bingo Project - Local First Bingo Game

A complete Bingo game application with encrypted local storage and hardware-based licensing. Play bingo on your computer, save your game progress, and track bonuses. All data stays on your device - no internet connection needed for gameplay.

## Architecture

Frontend (Three.js/jQuery) -> Node.js/Express -> Encrypted SQLite DB

- Raw-JS API layer (api-raw-js/)
- Compiled API layer (api/*.jsc)
- Session-based authentication
- Hardware fingerprinting for licensing

## Core Technologies

| Technology | Purpose |
|------------|---------|
| Node.js | Runtime |
| Express.js | Server |
| SQLite | Encrypted DB |
| Three.js | 3D UI |
| jQuery | DOM/AJAX |
| bcrypt | Passwords |
| express-session | Sessions |
| bytenode | Compiled JS |

## Security

### Hardware Licensing
- Collects: computer_uuid, cpu_id, bios_serial
- Password-hashed verification
- Stored in system_verification & hardware_lock tables

### Database Encryption
- AES-256 via better-sqlite3-multiple-ciphers
- Config key in api/config.js

## Database Tables

*user_info* - Users, passwords (bcrypt), email
*system_verification* - Verification status, hashed password
*hardware_lock* - Hardware fingerprint
*gamestatus* - Game data, earnings, status
*tablestat* - Table statistics
*cartela* - Bingo cards
*agent_bonus_settings* - Bonus rules & commissions
*balanced* - Balance tracking
*cloud_sync* - Cloud sync data
*push_random* - Notification hashes

## API Endpoints

### Auth
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /api/login | User login |
| POST | /api/hardware-verify | Verify hardware |
| GET | /api/verification-status | Status check |
| GET | /api/hardware-info | Get fingerprint |
| GET | /api/session-check | Session check |

### Game
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/getlastgame | Next game number |
| POST | /api/savegame | Save results |
| POST | /api/update | Update status |
| GET | /api/get_cartela | Get card |
| GET | /api/balance | Get balance |
| POST | /api/updatebalance | Update balance |
| POST | /api/get-bonus-settings | Get bonus rules |
| POST | /api/updatebonus | Save bonus rules |

## Setup

1. Start server: node www/server.js
2. Access: http://127.0.0.1:3000
3. First run creates encrypted database
4. Configure key in api/config.js

*Last Updated: 2026*
