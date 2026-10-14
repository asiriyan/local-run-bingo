const express = require('express');
const router = express.Router();
const { exec } = require('child_process');
const { db } = require('../config');

// Hardware info endpoint (gets real data from PC and saves to database)
router.get('/', (req, res) => {
    try {
        const hardware = {
            computer_uuid: '',
            cpu_id: '',
            bios_serial: ''
        };
        
        // Function to save hardware to database
        function saveHardwareToDB(uuid, cpu, bios) {
            try {
                db.prepare("INSERT OR REPLACE INTO hardware_lock (computer_uuid, cpu_id, bios_serial) VALUES (?, ?, ?)").run(uuid, cpu, bios);
                console.log('✅ Hardware data saved to database!');
                console.log(`   UUID: ${uuid}\n   CPU: ${cpu}\n   BIOS: ${bios}`);
            } catch (saveErr) {
                console.error('❌ Error saving hardware to database:', saveErr.message);
            }
        }
        
        function cleanHardwareString(str) {
            if (!str || str === undefined || str === null) return '';
            str = String(str).trim();
            str = str.replace(/[^\x20-\x7E]/g, '');
            str = str.replace(/\s+/g, ' ');
            str = str.toUpperCase();
            return str;
        }
        
        // Get UUID from WMI
        exec('wmic csproduct get uuid', (error, stdout) => {
            if (stdout) {
                const lines = stdout.split('\n');
                if (lines.length > 1) {
                    const uuid = lines[1].trim();
                    if (uuid) {
                        hardware.computer_uuid = cleanHardwareString(uuid);
                    }
                }
            }
            
            // Get CPU ID
            exec('wmic cpu get processorid', (error, stdout) => {
                if (stdout) {
                    const lines = stdout.split('\n');
                    if (lines.length > 1) {
                        const cpuId = lines[1].trim();
                        if (cpuId) {
                            hardware.cpu_id = cleanHardwareString(cpuId);
                        }
                    }
                }
                
                // Get BIOS Serial
                exec('wmic bios get serialnumber', (error, stdout) => {
                    if (stdout) {
                        const lines = stdout.split('\n');
                        if (lines.length > 1) {
                            const bios = lines[1].trim();
                            if (bios) {
                                hardware.bios_serial = cleanHardwareString(bios);
                            }
                        }
                    }
                    
                    // Get MachineGuid from registry as backup
                    exec('reg query "HKEY_LOCAL_MACHINE\\SOFTWARE\\Microsoft\\Cryptography" /v MachineGuid', (error, stdout) => {
                        if (stdout && stdout.match(/MachineGuid\s+REG_SZ\s+([A-F0-9-]+)/i)) {
                            const match = stdout.match(/MachineGuid\s+REG_SZ\s+([A-F0-9-]+)/i);
                            if (match && match[1]) {
                                hardware.computer_uuid = cleanHardwareString(match[1]);
                            }
                        }
                        
                        // Fill any missing values with NOT_FOUND
                        if (!hardware.computer_uuid) hardware.computer_uuid = 'NOT_FOUND';
                        if (!hardware.cpu_id) hardware.cpu_id = 'NOT_FOUND';
                        if (!hardware.bios_serial) hardware.bios_serial = 'NOT_FOUND';
                        
                        console.log('Hardware Info:', hardware);
                        
                        // Save hardware to database
                        saveHardwareToDB(hardware.computer_uuid, hardware.cpu_id, hardware.bios_serial);
                        
                        res.json(hardware);
                    });
                });
            });
        });
    } catch (error) {
        console.error('Hardware info error:', error);
        res.json({
            computer_uuid: 'NOT_FOUND',
            cpu_id: 'NOT_FOUND',
            bios_serial: 'NOT_FOUND'
        });
    }
});

module.exports = router;
