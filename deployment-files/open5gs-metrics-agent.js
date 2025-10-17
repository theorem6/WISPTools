#!/usr/bin/env node

const https = require('https');
const http = require('http');
const os = require('os');
const fs = require('fs');
const { execSync } = require('child_process');

const HSS_API_URL = process.env.HSS_API_URL || 'https://us-central1-lte-pci-mapper-65450042-bbf71.cloudfunctions.net/hssProxy';
const EPC_ID = process.env.EPC_ID;
const TENANT_ID = process.env.TENANT_ID;

// Function to get network statistics
function getNetworkStats() {
    try {
        const interfaces = os.networkInterfaces();
        const stats = {};
        
        for (const [name, addrs] of Object.entries(interfaces)) {
            if (name !== 'lo' && addrs.some(addr => addr.family === 'IPv4')) {
                try {
                    const rxBytes = fs.readFileSync(`/sys/class/net/${name}/statistics/rx_bytes`, 'utf8').trim();
                    const txBytes = fs.readFileSync(`/sys/class/net/${name}/statistics/tx_bytes`, 'utf8').trim();
                    stats[name] = {
                        rx_bytes: parseInt(rxBytes),
                        tx_bytes: parseInt(txBytes)
                    };
                } catch (e) {
                    // Interface might not have stats
                }
            }
        }
        return stats;
    } catch (error) {
        return {};
    }
}

// Function to get disk usage
function getDiskUsage() {
    try {
        const output = execSync('df -B1 / | tail -1', { encoding: 'utf8' });
        const parts = output.trim().split(/\s+/);
        return {
            total: parseInt(parts[1]),
            used: parseInt(parts[2]),
            available: parseInt(parts[3]),
            percent: parseInt(parts[4])
        };
    } catch (error) {
        return null;
    }
}

// Function to get CPU usage percentage
function getCpuUsage() {
    try {
        const output = execSync('top -bn1 | grep "Cpu(s)"', { encoding: 'utf8' });
        const match = output.match(/([0-9.]+)\s*id/);
        if (match) {
            return 100 - parseFloat(match[1]);
        }
    } catch (error) {
        // Fallback to load average
        const load = os.loadavg()[0];
        const cpus = os.cpus().length;
        return (load / cpus) * 100;
    }
    return 0;
}

// Function to get active subscriber count from MongoDB
function getSubscriberCount(callback) {
    try {
        // Try to connect to Open5GS MongoDB
        const MongoClient = require('mongodb').MongoClient;
        const url = 'mongodb://localhost:27017';
        
        MongoClient.connect(url, { useUnifiedTopology: true }, (err, client) => {
            if (err) {
                callback(0);
                return;
            }
            
            const db = client.db('open5gs');
            db.collection('subscribers').countDocuments({}, (err, count) => {
                client.close();
                callback(err ? 0 : count);
            });
        });
    } catch (error) {
        callback(0);
    }
}

// Function to get connected UE count
function getConnectedUEs() {
    try {
        // Check MME for connected UEs
        const output = execSync('sudo open5gs-mmed -v 2>&1 | grep -c "UE Context" || echo 0', { encoding: 'utf8' });
        return parseInt(output.trim()) || 0;
    } catch (error) {
        return 0;
    }
}

// Function to check service status with details
function checkService(serviceName) {
    try {
        const status = execSync(`systemctl is-active ${serviceName}`, { encoding: 'utf8' }).trim();
        const isActive = status === 'active';
        
        if (isActive) {
            try {
                // Get memory usage for the service
                const memInfo = execSync(`systemctl status ${serviceName} | grep Memory`, { encoding: 'utf8' });
                const memMatch = memInfo.match(/([0-9.]+[KMGT])/);
                return {
                    status: 'active',
                    memory: memMatch ? memMatch[1] : 'N/A'
                };
            } catch (e) {
                return { status: 'active', memory: 'N/A' };
            }
        }
        return { status: status, memory: 'N/A' };
    } catch (error) {
        return { status: 'inactive', memory: 'N/A' };
    }
}

// Function to collect comprehensive metrics
function collectMetrics(callback) {
    const networkStats = getNetworkStats();
    const diskUsage = getDiskUsage();
    const cpuUsage = getCpuUsage();
    const memTotal = os.totalmem();
    const memFree = os.freemem();
    const memUsed = memTotal - memFree;
    
    const metrics = {
        timestamp: new Date().toISOString(),
        epc_id: EPC_ID,
        tenant_id: TENANT_ID,
        system: {
            hostname: os.hostname(),
            uptime: os.uptime(),
            loadavg: os.loadavg(),
            cpu_percent: Math.round(cpuUsage * 100) / 100,
            memory: {
                total: memTotal,
                free: memFree,
                used: memUsed,
                percent: Math.round((memUsed / memTotal) * 100 * 100) / 100
            },
            disk: diskUsage,
            network: networkStats,
            cpus: os.cpus().length
        },
        services: {
            mme: checkService('open5gs-mmed'),
            sgwc: checkService('open5gs-sgwcd'),
            sgwu: checkService('open5gs-sgwud'),
            smf: checkService('open5gs-smfd'),
            upf: checkService('open5gs-upfd'),
            pcrf: checkService('open5gs-pcrfd')
        }
    };
    
    // Get subscriber count asynchronously
    getSubscriberCount((count) => {
        metrics.subscribers = {
            total: count,
            connected: getConnectedUEs()
        };
        callback(metrics);
    });
}

// Function to send heartbeat
function sendHeartbeat() {
    collectMetrics((metrics) => {
        const postData = JSON.stringify({
            epc_id: EPC_ID,
            tenant_id: TENANT_ID,
            metrics: metrics,
            status: 'online'
        });
        
        const apiUrl = new URL(HSS_API_URL + '/api/epc/' + EPC_ID + '/heartbeat');
        
        const options = {
            hostname: apiUrl.hostname,
            port: apiUrl.port || 443,
            path: apiUrl.pathname,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(postData),
                'X-Tenant-ID': TENANT_ID
            }
        };
        
        const protocol = apiUrl.protocol === 'https:' ? https : http;
        
        const req = protocol.request(options, (res) => {
            let responseData = '';
            
            res.on('data', (chunk) => {
                responseData += chunk;
            });
            
            res.on('end', () => {
                if (res.statusCode === 200) {
                    console.log(`[${new Date().toISOString()}] Heartbeat sent successfully`);
                } else {
                    console.log(`[${new Date().toISOString()}] Heartbeat failed: ${res.statusCode} - ${responseData}`);
                }
            });
        });
        
        req.on('error', (error) => {
            console.error(`[${new Date().toISOString()}] Heartbeat error:`, error.message);
        });
        
        req.write(postData);
        req.end();
    });
}

// Send heartbeat every 60 seconds
setInterval(sendHeartbeat, 60000);

// Send initial heartbeat after 5 seconds (give services time to start)
setTimeout(sendHeartbeat, 5000);

console.log('Open5GS Metrics Agent started for EPC:', EPC_ID);
console.log('Tenant ID:', TENANT_ID);
console.log('Sending metrics to:', HSS_API_URL);

