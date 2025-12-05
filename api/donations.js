/**
 * Donations API Endpoint
 * Endpoint ini digunakan oleh Roblox server untuk mengambil donations baru
 * dengan autentikasi dan rate limiting
 */

// Import donations dari webhook handler
const webhookHandler = require('./webhook.js');

// Rate limiting untuk Roblox requests
const robloxRateLimit = new Map();
const ROBLOX_RATE_LIMIT = 60; // Max 60 requests per minute per server
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute

/**
 * Validasi API Key
 */
function validateApiKey(apiKey) {
  const validApiKey = process.env.API_KEY;
  if (!validApiKey) return false;
  if (!apiKey) return false;
  
  // Constant-time comparison
  const crypto = require('crypto');
  try {
    return crypto.timingSafeEqual(
      Buffer.from(apiKey),
      Buffer.from(validApiKey)
    );
  } catch {
    return false;
  }
}

/**
 * Check rate limit untuk Roblox server
 */
function checkRobloxRateLimit(identifier) {
  const now = Date.now();
  const requests = robloxRateLimit.get(identifier) || [];
  
  // Remove old requests
  const validRequests = requests.filter(time => now - time < RATE_LIMIT_WINDOW);
  
  if (validRequests.length >= ROBLOX_RATE_LIMIT) {
    return false;
  }
  
  validRequests.push(now);
  robloxRateLimit.set(identifier, validRequests);
  return true;
}

module.exports = async (req, res) => {
  // Set CORS headers untuk Roblox
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Api-Key');
  
  // Handle preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  // Only accept GET
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  
  try {
    // Get API key from header
    const apiKey = req.headers['x-api-key'] || req.query.key;
    
    // Validate API key
    if (!validateApiKey(apiKey)) {
      console.warn('Invalid API key attempt');
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    // Get identifier for rate limiting (use API key hash)
    const crypto = require('crypto');
    const identifier = crypto.createHash('sha256').update(apiKey).digest('hex').substring(0, 16);
    
    // Check rate limit
    if (!checkRobloxRateLimit(identifier)) {
      console.warn(`Rate limit exceeded for identifier: ${identifier}`);
      return res.status(429).json({ error: 'Too many requests' });
    }
    
    // Get unprocessed donations
    const donations = webhookHandler.donations || [];
    const unprocessedDonations = donations.filter(d => !d.processed);
    
    // Mark donations as processed
    unprocessedDonations.forEach(d => {
      d.processed = true;
    });
    
    // Return donations in format yang mudah untuk Roblox
    const response = {
      success: true,
      count: unprocessedDonations.length,
      donations: unprocessedDonations.map(d => ({
        id: d.id,
        donor_name: d.donor_name,
        amount: d.amount,
        message: d.message,
        timestamp: d.timestamp
      }))
    };
    
    console.log(`Sent ${unprocessedDonations.length} donations to Roblox`);
    
    return res.status(200).json(response);
    
  } catch (error) {
    console.error('Donations API error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};
