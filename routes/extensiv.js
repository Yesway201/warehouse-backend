import express from 'express';
const router = express.Router();

// Extensiv API Configuration
const EXTENSIV_BASE_URL = 'https://secure-wms.com';
const EXTENSIV_AUTH_URL = `${EXTENSIV_BASE_URL}/AuthServer/api/Token`;

// Token cache: { key: { token, expiresAt } }
const tokenCache = new Map();
const TOKEN_EXPIRY_BUFFER = 5 * 60 * 1000; // Refresh 5 minutes before expiry

/**
 * Get cache key for credentials
 */
function getCacheKey(clientId, customerId, userLoginId) {
  return `${clientId}:${customerId}:${userLoginId}`;
}

/**
 * Get Extensiv Access Token (with caching)
 * @param {string} clientId - Extensiv Client ID
 * @param {string} clientSecret - Extensiv Client Secret
 * @param {string} customerId - Customer ID (from Extensiv)
 * @param {string} userLoginId - User Login ID
 * @returns {Promise<string>} Access token
 */
async function getAccessToken(clientId, clientSecret, customerId, userLoginId) {
  const cacheKey = getCacheKey(clientId, customerId, userLoginId);
  
  // Check if we have a valid cached token
  const cached = tokenCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now() + TOKEN_EXPIRY_BUFFER) {
    console.log('Using cached Extensiv token');
    return cached.token;
  }

  console.log('Fetching new Extensiv token');
  
  // Create Base64 encoded authorization key
  const authKey = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

  const response = await fetch(EXTENSIV_AUTH_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${authKey}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    body: JSON.stringify({
      grant_type: 'client_credentials',
      user_login: userLoginId,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to get access token: ${response.status} ${errorText}`);
  }

  const data = await response.json();
  
  // Cache the token (expires_in is in seconds, default 3600)
  const expiresIn = (data.expires_in || 3600) * 1000;
  tokenCache.set(cacheKey, {
    token: data.access_token,
    expiresAt: Date.now() + expiresIn,
  });

  return data.access_token;
}

/**
 * Test Extensiv Connection
 * POST /api/extensiv/test-connection
 * Body: { clientId, clientSecret, customerId, facilityId, userLoginId }
 */
router.post('/test-connection', async (req, res) => {
  try {
    const { clientId, clientSecret, customerId, facilityId, userLoginId } = req.body;

    // Validate required fields
    if (!clientId || !clientSecret || !customerId || !facilityId || !userLoginId) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: clientId, clientSecret, customerId, facilityId, userLoginId',
      });
    }

    // Step 1: Get access token
    const accessToken = await getAccessToken(clientId, clientSecret, customerId, userLoginId);

    // Step 2: Validate token by calling a real API endpoint
    // Using the inventory stock summaries endpoint as a lightweight test
    const testUrl = `${EXTENSIV_BASE_URL}/inventory/stocksummaries?customerid=${customerId}&facilityid=${facilityId}&pgsiz=1&pgnum=1`;
    
    const testResponse = await fetch(testUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/hal+json',
        'Accept': 'application/hal+json',
      },
    });

    if (!testResponse.ok) {
      const errorText = await testResponse.text();
      throw new Error(`API validation failed: ${testResponse.status} ${errorText}`);
    }

    const testData = await testResponse.json();

    // Connection successful
    res.json({
      success: true,
      message: 'Successfully connected to Extensiv API',
      tokenReceived: true,
      apiValidated: true,
      customerId: customerId,
      facilityId: facilityId,
      testEndpoint: 'inventory/stocksummaries',
    });
  } catch (error) {
    console.error('Extensiv connection test failed:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * Get Inventory Stock Summaries
 * POST /api/extensiv/get-inventory
 * Body: { clientId, clientSecret, customerId, facilityId, userLoginId, pageSize?, pageNum? }
 */
router.post('/get-inventory', async (req, res) => {
  try {
    const { clientId, clientSecret, customerId, facilityId, userLoginId, pageSize = 100, pageNum = 1 } = req.body;

    if (!clientId || !clientSecret || !customerId || !facilityId || !userLoginId) {
      return res.status(400).json({
        success: false,
        error: 'Missing required credentials',
      });
    }

    // Get access token (cached if available)
    const accessToken = await getAccessToken(clientId, clientSecret, customerId, userLoginId);

    // Make API call to get inventory
    const url = `${EXTENSIV_BASE_URL}/inventory/stocksummaries?customerid=${customerId}&facilityid=${facilityId}&pgsiz=${pageSize}&pgnum=${pageNum}`;
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/hal+json',
        'Accept': 'application/hal+json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to fetch inventory: ${response.status} ${errorText}`);
    }

    const inventory = await response.json();

    res.json({
      success: true,
      inventory: inventory,
    });
  } catch (error) {
    console.error('Failed to get inventory:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * Get Orders
 * POST /api/extensiv/get-orders
 * Body: { clientId, clientSecret, customerId, facilityId, userLoginId, orderId? }
 */
router.post('/get-orders', async (req, res) => {
  try {
    const { clientId, clientSecret, customerId, facilityId, userLoginId, orderId } = req.body;

    if (!clientId || !clientSecret || !customerId || !facilityId || !userLoginId) {
      return res.status(400).json({
        success: false,
        error: 'Missing required credentials',
      });
    }

    // Get access token (cached if available)
    const accessToken = await getAccessToken(clientId, clientSecret, customerId, userLoginId);

    // Build URL
    let url = `${EXTENSIV_BASE_URL}/orders`;
    if (orderId) {
      url += `/${orderId}?detail=All`;
    } else {
      url += `?customerid=${customerId}&facilityid=${facilityId}`;
    }

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/hal+json',
        'Accept': 'application/hal+json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to fetch orders: ${response.status} ${errorText}`);
    }

    const orders = await response.json();

    res.json({
      success: true,
      orders: orders,
    });
  } catch (error) {
    console.error('Failed to get orders:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * Create Order
 * POST /api/extensiv/create-order
 * Body: { clientId, clientSecret, customerId, facilityId, userLoginId, orderData }
 */
router.post('/create-order', async (req, res) => {
  try {
    const { clientId, clientSecret, customerId, facilityId, userLoginId, orderData } = req.body;

    if (!clientId || !clientSecret || !customerId || !facilityId || !userLoginId || !orderData) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields',
      });
    }

    // Get access token (cached if available)
    const accessToken = await getAccessToken(clientId, clientSecret, customerId, userLoginId);

    // Create order
    const response = await fetch(`${EXTENSIV_BASE_URL}/orders`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/hal+json',
        'Accept': 'application/hal+json',
      },
      body: JSON.stringify({
        customerIdentifier: { id: customerId },
        facilityIdentifier: { id: facilityId },
        ...orderData,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to create order: ${response.status} ${errorText}`);
    }

    const result = await response.json();

    res.json({
      success: true,
      order: result,
    });
  } catch (error) {
    console.error('Failed to create order:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * Clear token cache (for testing/debugging)
 * POST /api/extensiv/clear-cache
 */
router.post('/clear-cache', (req, res) => {
  tokenCache.clear();
  res.json({
    success: true,
    message: 'Token cache cleared',
  });
});

export default router;