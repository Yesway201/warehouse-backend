import express from 'express';
const router = express.Router();

const EXTENSIV_BASE_URL = 'https://secure-wms.com';
const EXTENSIV_AUTH_URL = `${EXTENSIV_BASE_URL}/AuthServer/api/Token`;

/**
 * Get OAuth 2.0 access token from Extensiv
 * Server-side only - no CORS issues
 */
async function getAccessToken(credentials) {
  const { clientId, clientSecret, userLoginId } = credentials;
  
  console.log('[Backend] Requesting OAuth token from Extensiv...');
  console.log('[Backend] Auth URL:', EXTENSIV_AUTH_URL);
  console.log('[Backend] Client ID:', clientId);
  console.log('[Backend] User Login:', userLoginId);
  
  // Create Base64 encoded authorization key (ClientID:ClientSecret)
  const authKey = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
  
  try {
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

    console.log('[Backend] Auth Response Status:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[Backend] Auth failed:', response.status, errorText);
      return {
        success: false,
        error: `Authentication failed (${response.status}): ${errorText}`,
      };
    }

    const data = await response.json();
    console.log('[Backend] ✅ Token obtained successfully');
    
    return {
      success: true,
      token: data.access_token,
      expiresIn: data.expires_in,
      tokenType: data.token_type,
    };
  } catch (error) {
    console.error('[Backend] Failed to get access token:', error);
    return {
      success: false,
      error: error.message || 'Network error',
    };
  }
}

/**
 * POST /api/extensiv/test-connection
 * Test OAuth connection only - no business data
 */
router.post('/test-connection', async (req, res) => {
  console.log('[Backend] ========================================');
  console.log('[Backend] Handler /api/extensiv/test-connection started at', new Date().toISOString());
  console.log('[Backend] ========================================');
  
  // Set JSON content type immediately
  res.setHeader('Content-Type', 'application/json');
  
  try {
    console.log('[Backend] Request body received:', JSON.stringify(req.body, null, 2));
    
    const { clientId, clientSecret, userLoginId } = req.body;
    
    console.log('[Backend] Credentials check:');
    console.log('[Backend] - clientId present:', !!clientId);
    console.log('[Backend] - clientSecret present:', !!clientSecret);
    console.log('[Backend] - userLoginId present:', !!userLoginId);

    if (!clientId || !clientSecret || !userLoginId) {
      console.error('[Backend] Missing required credentials');
      return res.status(400).json({
        success: false,
        error: 'Missing required credentials: clientId, clientSecret, userLoginId',
        step: 'credentials',
      });
    }

    console.log('[Backend] Testing Extensiv connection...');
    
    const result = await getAccessToken({ clientId, clientSecret, userLoginId });
    
    if (result.success) {
      return res.json({
        success: true,
        message: 'OAuth token obtained successfully',
        expiresIn: result.expiresIn,
        tokenType: result.tokenType,
      });
    } else {
      return res.status(401).json({
        success: false,
        error: result.error,
        step: 'token',
      });
    }
  } catch (error) {
    console.error('[Backend] ❌ Test connection error:', error.message);
    console.error('[Backend] Stack trace:', error.stack);
    return res.status(500).json({
      success: false,
      error: error.message || 'Internal server error',
      step: 'unknown',
      details: error.stack,
    });
  }
});

/**
 * POST /api/extensiv/sync-items
 * Sync items from Extensiv with pagination
 * Backend handles all Extensiv API calls
 */
router.post('/sync-items', async (req, res) => {
  // FIRST THING: Log that handler started
  console.log('[Backend] ========================================');
  console.log('[Backend] Handler /api/extensiv/sync-items started at', new Date().toISOString());
  console.log('[Backend] ========================================');
  
  // SECOND THING: Set JSON content type
  res.setHeader('Content-Type', 'application/json');
  
  // THIRD THING: Wrap EVERYTHING in try-catch
  try {
    // Log incoming request immediately
    console.log('[Backend] Full request body:', JSON.stringify(req.body, null, 2));
    
    const { clientId, clientSecret, userLoginId, customerId } = req.body;

    // Log credential presence
    console.log('[Backend] Credentials check:');
    console.log('[Backend] - clientId present:', !!clientId);
    console.log('[Backend] - clientSecret present:', !!clientSecret);
    console.log('[Backend] - userLoginId present:', !!userLoginId);
    console.log('[Backend] - userLoginId value:', userLoginId || 'MISSING');
    console.log('[Backend] - customerId present:', !!customerId);
    console.log('[Backend] - customerId value (full):', JSON.stringify(customerId));
    console.log('[Backend] - customerId type:', typeof customerId);

    // Early validation with detailed error
    if (!clientId) {
      console.error('[Backend] Missing clientId');
      return res.status(400).json({
        success: false,
        error: 'Missing required field: clientId',
        step: 'credentials',
        status: 400,
      });
    }
    
    if (!clientSecret) {
      console.error('[Backend] Missing clientSecret');
      return res.status(400).json({
        success: false,
        error: 'Missing required field: clientSecret',
        step: 'credentials',
        status: 400,
      });
    }
    
    if (!userLoginId) {
      console.error('[Backend] Missing userLoginId');
      return res.status(400).json({
        success: false,
        error: 'Missing required field: userLoginId',
        step: 'credentials',
        status: 400,
      });
    }
    
    if (!customerId) {
      console.error('[Backend] Missing customerId');
      return res.status(400).json({
        success: false,
        error: 'Missing required field: customerId',
        step: 'validation',
        status: 400,
      });
    }

    console.log('[Backend] ✅ All required fields present');

    // Step 1: Get OAuth token
    console.log('[Backend] STEP 1: Getting OAuth token...');
    const authResult = await getAccessToken({ clientId, clientSecret, userLoginId });
    
    if (!authResult.success) {
      console.error('[Backend] OAuth token failed:', authResult.error);
      return res.status(401).json({
        success: false,
        error: authResult.error,
        step: 'token',
        status: 401,
        details: 'Failed to obtain OAuth token from Extensiv',
      });
    }

    const accessToken = authResult.token;
    console.log('[Backend] ✅ OAuth token obtained');

    // Step 2: Fetch items with pagination
    console.log('[Backend] STEP 2: Fetching items from Extensiv...');
    const allItems = [];
    let currentPage = 1;
    const pageSize = 500;
    let hasMorePages = true;

    while (hasMorePages && currentPage <= 10) { // Safety limit: max 10 pages
      const endpoint = `${EXTENSIV_BASE_URL}/customers/${customerId}/items?pgsiz=${pageSize}&pgnum=${currentPage}`;
      
      console.log(`[Backend] Fetching page ${currentPage}...`);
      console.log(`[Backend] Full URL: ${endpoint}`);
      console.log(`[Backend] Headers: Authorization: Bearer ${accessToken.substring(0, 20)}..., Content-Type: application/hal+json`);

      try {
        const response = await fetch(endpoint, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/hal+json',
            'Accept': 'application/hal+json',
          },
        });

        console.log(`[Backend] Page ${currentPage} Response Status: ${response.status}`);
        console.log(`[Backend] Page ${currentPage} Response Headers:`, JSON.stringify([...response.headers.entries()]));

        if (!response.ok) {
          const errorText = await response.text();
          console.error(`[Backend] Failed to fetch page ${currentPage}:`, response.status);
          console.error(`[Backend] Error response (first 1000 chars):`, errorText.substring(0, 1000));
          
          return res.status(response.status).json({
            success: false,
            error: `Failed to fetch items page ${currentPage} (${response.status})`,
            step: 'items',
            status: response.status,
            details: errorText.substring(0, 1000),
            url: endpoint,
          });
        }

        const responseText = await response.text();
        console.log(`[Backend] Page ${currentPage} raw response (first 1000 chars):`, responseText.substring(0, 1000));
        
        let data;
        try {
          data = JSON.parse(responseText);
        } catch (parseError) {
          console.error(`[Backend] Failed to parse JSON response:`, parseError.message);
          return res.status(500).json({
            success: false,
            error: 'Invalid JSON response from Extensiv',
            step: 'items',
            status: 500,
            details: responseText.substring(0, 1000),
          });
        }

        console.log(`[Backend] Page ${currentPage} response structure:`, Object.keys(data));
        
        // Extract items from response (handle different response formats)
        let pageItems = [];
        
        if (data.ResourceList) {
          pageItems = data.ResourceList;
          console.log(`[Backend] Found items in data.ResourceList`);
        } else if (data.items) {
          pageItems = data.items;
          console.log(`[Backend] Found items in data.items`);
        } else if (data._embedded) {
          const embedded = data._embedded;
          pageItems = embedded['http://api.3plCentral.com/rels/customers/items'] || 
                      embedded.items || 
                      [];
          console.log(`[Backend] Found items in data._embedded`);
        } else if (Array.isArray(data)) {
          pageItems = data;
          console.log(`[Backend] Response is array`);
        } else {
          console.log(`[Backend] Unknown response structure, keys:`, Object.keys(data));
        }

        console.log(`[Backend] Page ${currentPage}: ${pageItems.length} items extracted`);
        
        if (pageItems.length === 0) {
          hasMorePages = false;
          console.log(`[Backend] No more items, stopping pagination`);
        } else {
          allItems.push(...pageItems);
          
          if (pageItems.length < pageSize) {
            hasMorePages = false;
            console.log(`[Backend] Last page (${pageItems.length} < ${pageSize}), stopping`);
          } else {
            currentPage++;
            console.log(`[Backend] More pages available, continuing to page ${currentPage}`);
          }
        }
      } catch (fetchError) {
        console.error(`[Backend] Network error fetching page ${currentPage}:`, fetchError.message);
        console.error(`[Backend] Stack trace:`, fetchError.stack);
        return res.status(500).json({
          success: false,
          error: `Network error on page ${currentPage}: ${fetchError.message}`,
          step: 'items',
          status: 500,
          details: fetchError.stack,
        });
      }
    }

    console.log(`[Backend] ✅ Fetched ${allItems.length} total items across ${currentPage - 1} pages`);

    // Step 3: Return items to frontend
    return res.json({
      success: true,
      items: allItems,
      totalItems: allItems.length,
      pagesProcessed: currentPage - 1,
    });
  } catch (error) {
    console.error('[Backend] ❌ UNHANDLED EXCEPTION in sync-items:', error.message);
    console.error('[Backend] Stack trace:', error.stack);
    return res.status(500).json({
      success: false,
      error: error.message || 'Internal server error',
      step: 'unknown',
      status: 500,
      details: error.stack,
    });
  }
});

export default router;