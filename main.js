import fetch from 'node-fetch';
import fs from 'fs/promises';
import log from './utils/logger.js';
import beddu from './utils/banner.js';

// The API base URL
const url = `https://api.hivera.org/`;

async function readUserFile(filePath) {
    try {
        const data = await fs.readFile(filePath, 'utf-8');
        const userArray = data.split('\n').map(line => line.trim()).filter(line => line);
        if (userArray.length === 0) {
            log.warn('No users found in the file.');
        }
        return userArray;
    } catch (error) {
        log.error('Error reading file:', error);
        return [];
    }
}

async function readProxyFile(filePath) {
    try {
        const data = await fs.readFile(filePath, 'utf-8');
        const proxyArray = data.split('\n').map(line => line.trim()).filter(line => line);
        if (proxyArray.length === 0) {
            log.warn('No proxies found in the file.');
        }
        return proxyArray;
    } catch (error) {
        log.error('Error reading proxy file:', error);
        return [];
    }
}

// Create agent with proxy
async function createProxyAgent(proxyUrl) {
    if (!proxyUrl) return null;
    const { HttpsProxyAgent } = await import('https-proxy-agent');
    return new HttpsProxyAgent(proxyUrl);
}

async function fetchAuthData(userData, agent) {
    try {
        const response = await fetch(`${url}auth?auth_data=${encodeURIComponent(userData)}`, {
            agent: agent
        });
        if (!response.ok) {
            throw new Error(`HTTP Error! Status: ${response.status}`);
        }
        return await response.json();
    } catch (error) {
        log.error("Error fetching auth data:", error);
        return null;
    }
}

async function fetchInfoData(userData, agent) {
    try {
        const response = await fetch(`${url}referral?referral_code=2b6a4dfc8&auth_data=${encodeURIComponent(userData)}`, {
            agent: agent
        });
        return response;
    } catch (error) {
        log.error("Error fetching info data:", error);
        return null;
    }
}

async function fetchPowerData(userData, agent) {
    try {
        const response = await fetch(`${url}engine/info?auth_data=${encodeURIComponent(userData)}`, {
            agent: agent
        });
        if (!response.ok) {
            throw new Error(`HTTP Error! Status: ${response.status}`);
        }
        return await response.json();
    } catch (error) {
        log.error("Error fetching power data:", error);
        return null;
    }
}

function generatePayload() {
    const fromDate = Date.now();
    const values = [75, 80, 85, 90, 95, 100];
    const qualityConnection = values[Math.floor(Math.random() * values.length)];
    return {
        from_date: fromDate,
        quality_connection: qualityConnection,
    };
}

async function contribute(userData, agent) {
    try {
        const payload = generatePayload();
        const response = await fetch(`${url}engine/contribute?auth_data=${encodeURIComponent(userData)}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload),
            agent: agent
        });
        if (!response.ok) {
            throw new Error(`HTTP Error! Status: ${response.status}`);
        }
        return await response.json();
    } catch (error) {
        log.error('Error in contribute:', error);
        return null;
    }
}

async function processUser(userData, proxy) {
    try {
        const agent = await createProxyAgent(proxy);
        const profile = await fetchAuthData(userData, agent);
        const username = profile?.result?.username || 'Unknown';

        const infoData = await fetchInfoData(userData, agent);
        const powerData = await fetchPowerData(userData, agent);

        const hivera = powerData?.result?.profile?.HIVERA || 0;
        let power = powerData?.result?.profile?.POWER || 0;

        log.info(`Username: ${username} | Hivera: ${hivera} | Power: ${power} | Proxy: ${proxy || 'None'}`);

        // Start mining
        while (power > 500) {
            const contributeData = await contribute(userData, agent);
            if (contributeData) {
                log.info(`Mining successfully for user: ${username}`);
                log.info(contributeData?.result?.profile);
                power = contributeData?.result?.profile?.POWER || 0;

                await new Promise(resolve => setTimeout(resolve, 30 * 1000));
            }
        }

        log.warn(`User ${username} does not have enough power to mine.`);
    } catch (error) {
        log.error(`Error processing user ${userData}:`, error);
    }
}

async function main() {
    log.info(beddu);
    const userDatas = await readUserFile('users.txt');
    const proxyList = await readProxyFile('proxies.txt');
    
    if (userDatas.length === 0) {
        log.error('No user data found in the file.');
        process.exit(0);
    }

    while (true) {
        log.info('Starting processing for all users...');
        await Promise.all(userDatas.map((userData, index) => {
            const proxy = proxyList[index % proxyList.length];
            return processUser(userData, proxy);
        }));

        log.warn('Power is not enough for all users, cooldown 35 minutes...');
        await new Promise(resolve => setTimeout(resolve, 35 * 60 * 1000));
    }
}

// Run
main().catch(error => {
    log.error('An unexpected error occurred:', error);
});
