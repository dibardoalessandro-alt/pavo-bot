/**
 * Automated Wispbyte Pterodactyl Deployer
 * Takes API key and automates:
 * 1. Clean old files
 * 2. Upload pavo-bot-online.zip
 * 3. Decompress files
 * 4. Start server
 */

const fs = require('fs');
const path = require('path');

const SERVER_ID = '43011a7e';
const BASE_URL = 'https://wispbyte.com/api/client';
const ZIP_PATH = 'c:\\Users\\dilar\\Desktop\\pavo-bot-online.zip';

async function deploy(apiKey) {
  const headers = {
    'Authorization': `Bearer ${apiKey.trim()}`,
    'Content-Type': 'application/json',
    'Accept': 'application/json'
  };

  console.log('[1/4] Connecting to Wispbyte server:', SERVER_ID);
  
  // 1. Get current files
  const listRes = await fetch(`${BASE_URL}/servers/${SERVER_ID}/files/list?directory=/`, { headers });
  if (!listRes.ok) {
    throw new Error(`API Auth failed (${listRes.status}): Please check your API key.`);
  }
  const fileList = await listRes.json();
  const fileNames = (fileList.data || []).map(f => f.attributes.name).filter(n => n !== '.pteroignore');
  
  if (fileNames.length > 0) {
    console.log(`[2/4] Cleaning ${fileNames.length} old files/folders...`);
    await fetch(`${BASE_URL}/servers/${SERVER_ID}/files/delete`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ root: '/', files: fileNames })
    });
  }

  // 2. Get upload URL
  console.log('[3/4] Requesting upload URL...');
  const upRes = await fetch(`${BASE_URL}/servers/${SERVER_ID}/files/upload`, { headers });
  const upData = await upRes.json();
  const uploadUrl = upData.attributes.url;

  // Upload file via FormData
  const fileBuffer = fs.readFileSync(ZIP_PATH);
  const formData = new FormData();
  const blob = new Blob([fileBuffer]);
  formData.append('files', blob, 'pavo-bot-online.zip');

  console.log('[3/4] Uploading pavo-bot-online.zip...');
  const uploadPost = await fetch(uploadUrl, {
    method: 'POST',
    body: formData
  });
  if (!uploadPost.ok) {
    throw new Error(`Upload failed with status: ${uploadPost.status}`);
  }

  // 3. Decompress
  console.log('[3/4] Decompressing archive...');
  await fetch(`${BASE_URL}/servers/${SERVER_ID}/files/decompress`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ root: '/', file: 'pavo-bot-online.zip' })
  });

  // 4. Start Server
  console.log('[4/4] Starting server...');
  await fetch(`${BASE_URL}/servers/${SERVER_ID}/power`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ signal: 'restart' })
  });

  console.log('✅ Deployment complete! Server is starting up.');
}

const key = process.argv[2];
if (!key) {
  console.error('Usage: node wispbyte_deploy.js <API_KEY>');
  process.exit(1);
}

deploy(key).catch(err => {
  console.error('❌ Error during deploy:', err.message);
  process.exit(1);
});
