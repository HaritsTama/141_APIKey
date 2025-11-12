const express = require('express');
const path = require('path');
const crypto = require('crypto');
require('dotenv').config();

const db = require('./config/database');

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.post('/create', async (req, res) => {
  try {
    const randomKey = crypto.randomBytes(32).toString('hex');
    const fullApiKey = `sk-itumy-v1-api_${randomKey}`;
 
    const query = `
      INSERT INTO api_keys (api_key, prefix, is_active, usage_count) 
      VALUES (?, ?, ?, ?)
    `;
    
    const [result] = await db.execute(query, [
      fullApiKey,
      'sk-itumy-v1-api_',
      true,
      0
    ]);
    
    res.json({
      success: true,
      apiKey: fullApiKey,
      message: 'API Key berhasil dibuat dan disimpan ke database',
      id: result.insertId
    });
  } catch (error) {
    console.error('Error creating API key:', error);

    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({
        success: false,
        message: 'API Key sudah ada di database'
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Gagal membuat API Key',
      error: error.message
    });
  }
});

app.post('/checkapi', async (req, res) => {
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

    const query = `
      SELECT * FROM api_keys 
      WHERE api_key = ? 
      LIMIT 1
    `;
    
    const [rows] = await db.execute(query, [apikey]);
    
    if (rows.length === 0) {
      return res.status(401).json({
        success: false,
        valid: false,
        message: 'API key tidak ditemukan',
        apikey: apikey
      });
    }
    
    const apiKeyData = rows[0];

    if (!apiKeyData.is_active) {
      return res.status(401).json({
        success: false,
        valid: false,
        message: 'API key sudah tidak aktif',
        apikey: apikey,
        isActive: false
      });
    }

    if (apiKeyData.expires_at && new Date(apiKeyData.expires_at) < new Date()) {
      return res.status(401).json({
        success: false,
        valid: false,
        message: 'API key sudah expired',
        apikey: apikey,
        expiresAt: apiKeyData.expires_at
      });
    }

    const updateQuery = `
      UPDATE api_keys 
      SET usage_count = usage_count + 1, 
          last_used_at = CURRENT_TIMESTAMP 
      WHERE api_key = ?
    `;
    
    await db.execute(updateQuery, [apikey]);

    res.json({
      success: true,
      valid: true,
      message: 'API key valid',
      apikey: apikey,
      prefix: apiKeyData.prefix,
      createdAt: apiKeyData.created_at,
      usageCount: apiKeyData.usage_count + 1,
      lastUsedAt: new Date(),
      isActive: apiKeyData.is_active
    });
    
  } catch (error) {
    console.error('Error checking API key:', error);
    res.status(500).json({
      success: false,
      valid: false,
      message: 'Terjadi kesalahan server',
      error: error.message
    });
  }
});

app.get('/apikeys', async (req, res) => {
  try {
    const query = `
      SELECT 
        id,
        api_key,
        prefix,
        is_active,
        usage_count,
        created_at,
        last_used_at,
        expires_at
      FROM api_keys 
      ORDER BY created_at DESC
    `;
    
    const [rows] = await db.execute(query);
    
    res.json({
      success: true,
      total: rows.length,
      apikeys: rows
    });
  } catch (error) {
    console.error('Error fetching API keys:', error);
    res.status(500).json({
      success: false,
      message: 'Gagal mengambil data',
      error: error.message
    });
  }
});

app.delete('/apikeys/:apikey', async (req, res) => {
  try {
    const { apikey } = req.params;
    
    const query = `DELETE FROM api_keys WHERE api_key = ?`;
    const [result] = await db.execute(query, [apikey]);
    
    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: 'API key tidak ditemukan'
      });
    }
    
    res.json({
      success: true,
      message: 'API key berhasil dihapus',
      deletedKey: apikey
    });
  } catch (error) {
    console.error('Error deleting API key:', error);
    res.status(500).json({
      success: false,
      message: 'Gagal menghapus API key',
      error: error.message
    });
  }
});

app.patch('/apikeys/:apikey/deactivate', async (req, res) => {
  try {
    const { apikey } = req.params;
    
    const query = `
      UPDATE api_keys 
      SET is_active = FALSE 
      WHERE api_key = ?
    `;
    
    const [result] = await db.execute(query, [apikey]);
    
    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: 'API key tidak ditemukan'
      });
    }
    
    res.json({
      success: true,
      message: 'API key berhasil dinonaktifkan',
      apiKey: apikey,
      isActive: false
    });
  } catch (error) {
    console.error('Error deactivating API key:', error);
    res.status(500).json({
      success: false,
      message: 'Gagal menonaktifkan API key',
      error: error.message
    });
  }
});

app.patch('/apikeys/:apikey/activate', async (req, res) => {
  try {
    const { apikey } = req.params;
    
    const query = `
      UPDATE api_keys 
      SET is_active = TRUE 
      WHERE api_key = ?
    `;
    
    const [result] = await db.execute(query, [apikey]);
    
    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: 'API key tidak ditemukan'
      });
    }
    
    res.json({
      success: true,
      message: 'API key berhasil diaktifkan',
      apiKey: apikey,
      isActive: true
    });
  } catch (error) {
    console.error('Error activating API key:', error);
    res.status(500).json({
      success: false,
      message: 'Gagal mengaktifkan API key',
      error: error.message
    });
  }
});

app.patch('/apikeys/:apikey/expire', async (req, res) => {
  try {
    const { apikey } = req.params;
    const { days } = req.body;
    
    if (!days || days <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Parameter days harus lebih dari 0'
      });
    }
    
    const query = `
      UPDATE api_keys 
      SET expires_at = DATE_ADD(NOW(), INTERVAL ? DAY)
      WHERE api_key = ?
    `;
    
    const [result] = await db.execute(query, [days, apikey]);
    
    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: 'API key tidak ditemukan'
      });
    }
    
    const [rows] = await db.execute(
      'SELECT expires_at FROM api_keys WHERE api_key = ?',
      [apikey]
    );
    
    res.json({
      success: true,
      message: `API key akan expired dalam ${days} hari`,
      apiKey: apikey,
      expiresAt: rows[0].expires_at
    });
  } catch (error) {
    console.error('Error setting expiration:', error);
    res.status(500).json({
      success: false,
      message: 'Gagal set expiration',
      error: error.message
    });
  }
});

app.listen(port, () => {
  console.log(`🚀 Server berjalan di http://localhost:${port}`);
});