const express = require('express');
const path = require('path');
const crypto = require('crypto');
const app = express();
const port = 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const validApiKeys = new Set();

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.post('/create', (req, res) => {
  try {
    const randomKey = crypto.randomBytes(32).toString('hex');
    const fullApiKey = `sk-itumy-v1-api_${randomKey}`;

    validApiKeys.add(fullApiKey);
    
    res.json({
      success: true,
      apiKey: fullApiKey,
      message: 'API Key berhasil dibuat'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Gagal membuat API Key',
      error: error.message
    });
  }
});

app.post('/checkapi', (req, res) => {
  try {
    const { apikey } = req.body;

    if (!apikey) {
      return res.status(400).json({
        success: false,
        valid: false,
        message: 'API key tidak boleh kosong'
      });
    }

    if (!apikey.startsWith('sk-itumy-v1-api_')) {
      return res.status(400).json({
        success: false,
        valid: false,
        message: 'Format API key tidak valid'
      });
    }

    const isValid = validApiKeys.has(apikey);

    if (isValid) {
      res.json({
        success: true,
        valid: true,
        message: 'API key valid',
        apikey: apikey,
        prefix: 'sk-itumy-v1-api_',
        created: true
      });
    } else {
      res.status(401).json({
        success: false,
        valid: false,
        message: 'API key tidak ditemukan atau sudah expired',
        apikey: apikey
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      valid: false,
      message: 'Terjadi kesalahan server',
      error: error.message
    });
  }
});

app.get('/apikeys', (req, res) => {
  res.json({
    success: true,
    total: validApiKeys.size,
    apikeys: Array.from(validApiKeys)
  });
});

app.listen(port, () => {
  console.log(`Server berjalan di http://localhost:${port}`);
});