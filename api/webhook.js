/**
 * Saweria Webhook Handler
 * Endpoint ini menerima webhook dari Saweria dan menyimpan data donasi
 * dengan keamanan dan validasi yang ketat
 */

const crypto = require('crypto');

// In-memory storage untuk donations (untuk production, gunakan database)
// Data akan expire setelah 5 menit untuk mencegah memory leak
const donations = [];
const MAX_DONATIONS = 100; // Maximum donations to keep in memory
const DONATION_EXPIRY = 5 * 60 * 1000; // 5 minutes

// Rate limiting untuk mencegah spam
const webhookRateLimit = new Map();
const WEBHOOK_RATE_LIMIT = 10; // Max 10 webhooks per minute per IP
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute

// Duplicate detection
const recentDonationIds = new Set();
const DUPLICATE_CHECK_WINDOW = 10 * 60 * 1000; // 10 minutes

/**
 * Validasi signature webhook dari Saweria
 */
function validateWebhookSignature(payload, signature, secret) {
  if (!signature || !secret) return false;
  
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(JSON.stringify(payload));
  const calculatedSignature = hmac.digest('hex');
  
  // Constant-time comparison untuk mencegah timing attacks
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(calculatedSignature)
  );
}

/**
 * Check rate limit berdasarkan IP
 */
function checkRateLimit(ip) {
  const now = Date.now();
  const requests = webhookRateLimit.get(ip) || [];
  
  // Remove old requests outside the window
  const validRequests = requests.filter(time => now - time < RATE_LIMIT_WINDOW);
  
  if (validRequests.length >= WEBHOOK_RATE_LIMIT) {
    return false;
  }
  
  validRequests.push(now);
  webhookRateLimit.set(ip, validRequests);
  return true;
}

/**
 * Check duplicate donation
 */
function isDuplicate(donationId) {
  if (recentDonationIds.has(donationId)) {
    return true;
  }
  
  recentDonationIds.add(donationId);
  
  // Clean up old IDs after window expires
  setTimeout(() => {
    recentDonationIds.delete(donationId);
  }, DUPLICATE_CHECK_WINDOW);
  
  return false;
}

/**
 * Clean up expired donations
 */
function cleanupExpiredDonations() {
  const now = Date.now();
  const validDonations = donations.filter(
    d => now - d.timestamp < DONATION_EXPIRY
  );
  
  // Replace array contents
  donations.length = 0;
  donations.push(...validDonations);
}

/**
 * Validasi data donasi
 */
function validateDonationData(data) {
  if (!data) return false;
  
  // Required fields
  if (!data.donor_name || typeof data.donor_name !== 'string') return false;
  if (!data.amount || typeof data.amount !== 'number') return false;
  if (data.amount <= 0 || data.amount > 100000000) return false; // Max 100 juta
  
  // Sanitize donor name (max 50 chars, no special characters)
  if (data.donor_name.length > 50) return false;
  if (!/^[a-zA-Z0-9\s_-]+$/.test(data.donor_name)) return false;
  
  // Sanitize message (max 200 chars)
  if (data.message && data.message.length > 200) return false;
  
  return true;
}

module.exports = async (req, res) => {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Webhook-Signature');
  
  // Handle preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  // Only accept POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  
  try {
    // Get client IP
    const clientIp = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
    
    // Check rate limit
    if (!checkRateLimit(clientIp)) {
      console.warn(`Rate limit exceeded for IP: ${clientIp}`);
      return res.status(429).json({ error: 'Too many requests' });
    }
    
    // Get webhook signature from header
    const signature = req.headers['x-webhook-signature'] || req.headers['x-saweria-signature'];
    const webhookSecret = process.env.WEBHOOK_SECRET;
    
    // Validate signature (jika ada)
    if (webhookSecret && signature) {
      const isValid = validateWebhookSignature(req.body, signature, webhookSecret);
      if (!isValid) {
        console.warn('Invalid webhook signature');
        return res.status(401).json({ error: 'Invalid signature' });
      }
    }
    
    // Parse donation data
    const donationData = req.body;
    
    // Validate donation data
    if (!validateDonationData(donationData)) {
      console.warn('Invalid donation data:', donationData);
      return res.status(400).json({ error: 'Invalid donation data' });
    }
    
    // Generate unique donation ID
    const donationId = `${donationData.donor_name}_${donationData.amount}_${Date.now()}`;
    
    // Check duplicate
    if (isDuplicate(donationId)) {
      console.warn('Duplicate donation detected:', donationId);
      return res.status(200).json({ 
        success: true, 
        message: 'Duplicate donation ignored' 
      });
    }
    
    // Create donation object
    const donation = {
      id: crypto.randomBytes(16).toString('hex'),
      donor_name: donationData.donor_name.trim(),
      amount: donationData.amount,
      message: donationData.message ? donationData.message.trim() : '',
      timestamp: Date.now(),
      processed: false
    };
    
    // Add to donations array
    donations.push(donation);
    
    // Cleanup if too many donations
    if (donations.length > MAX_DONATIONS) {
      donations.shift(); // Remove oldest
    }
    
    // Cleanup expired donations
    cleanupExpiredDonations();
    
    console.log('New donation received:', {
      id: donation.id,
      donor: donation.donor_name,
      amount: donation.amount
    });
    
    return res.status(200).json({
      success: true,
      message: 'Donation received',
      donation_id: donation.id
    });
    
  } catch (error) {
    console.error('Webhook error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

// Export donations untuk diakses oleh endpoint lain
module.exports.donations = donations;
