import express from 'express';
import { loadSettings } from '../lib/extensivSettingsStore.js';
import { query, getClient } from '../db.js';

const router = express.Router();

const EXTENSIV_BASE_URL = 'https://secure-wms.com';
const EXTENSIV_AUTH_URL = `${EXTENSIV_BASE_URL}/AuthServer/api/Token`;

// ⚠️ DO NOT MODIFY — WORKING EXTENSIV INTEGRATION BASELINE
// This configuration is CONFIRMED WORKING as of commit: stable-extensiv-items-working
// - OAuth 2.0 token flow: WORKING
// - Items endpoint: /customers/{customerId}/items?pgsiz=100&pgnum={page}
// - NO detail parameter (causes QueryParameterException)
// - pgsiz MAX = 100 (Extensiv enforced limit)
// - Parsing: data.ResourceList with _embedded fallback
// - Tested: 38 items syncing successfully for customer ID 208
const EXTENSIV_ITEMS_API_VERSION = 'v1-stable';

/**
 * Get OAuth 2.0 access token from Extensiv
 * Server-side only - no CORS issues
 * ⚠️ DO NOT MODIFY — WORKING BASELINE
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
 * ⚠️ DO NOT MODIFY — WORKING BASELINE
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
 * 
 * ⚠️ DO NOT MODIFY — WORKING EXTENSIV INTEGRATION BASELINE
 * API Version: v1-stable
 * 
 * CRITICAL: Extensiv API Requirements (CONFIRMED WORKING)
 * - Endpoint: /customers/{customerId}/items?pgsiz=100&pgnum={page}
 * - Max pgsiz = 100 (enforced by Extensiv)
 * - NO detail parameter supported (causes QueryParameterException)
 * - Items returned in HAL format with ResourceList or _embedded
 * - Authorization: Bearer token (from getAccessToken)
 * - Accept: application/hal+json
 * 
 * Returns comprehensive diagnostics for troubleshooting
 */
router.post('/sync-items', async (req, res) => {
  console.log('[Backend] ========================================');
  console.log('[Backend] Handler /api/extensiv/sync-items started at', new Date().toISOString());
  console.log(`[Backend] API Version: ${EXTENSIV_ITEMS_API_VERSION}`);
  console.log('[Backend] ========================================');
  
  res.setHeader('Content-Type', 'application/json');
  
  const syncStartTime = new Date().toISOString();
  
  // Initialize diagnostics object
  const diagnostics = {
    apiVersion: EXTENSIV_ITEMS_API_VERSION,
    syncStartTime,
    customerId: null,
    request: {
      urlTemplate: `${EXTENSIV_BASE_URL}/customers/{customerId}/items?pgsiz=100&pgnum={page}`,
      pgsiz: 100,
      pagesRequested: [],
      lastUrlCalled: null,
    },
    response: {
      httpStatusByPage: [],
      rawSnippetByPage: [],
      detectedItemsPath: 'none',
      totalResultsReported: null,
      itemsFoundByPage: [],
      totalItemsExtracted: 0,
    },
    storage: {
      upsertKey: 'customerId+itemNumber',
      inserted: 0,
      updated: 0,
      finalTotalForCustomer: 0,
    },
    syncEndTime: null,
  };
  
  try {
    console.log('[Backend] Full request body:', JSON.stringify(req.body, null, 2));
    
    const { clientId, clientSecret, userLoginId, customerId } = req.body;
    diagnostics.customerId = customerId;

    console.log('[Backend] Credentials check:');
    console.log('[Backend] - clientId present:', !!clientId);
    console.log('[Backend] - clientSecret present:', !!clientSecret);
    console.log('[Backend] - userLoginId present:', !!userLoginId);
    console.log('[Backend] - customerId present:', !!customerId);

    if (!clientId || !clientSecret || !userLoginId || !customerId) {
      console.error('[Backend] Missing required fields');
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: clientId, clientSecret, userLoginId, customerId',
        step: 'validation',
        status: 400,
        diagnostics,
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
        diagnostics,
      });
    }

    const accessToken = authResult.token;
    console.log('[Backend] ✅ OAuth token obtained');

    // Step 2: Fetch items with pagination
    // ⚠️ DO NOT MODIFY — CONFIRMED WORKING CONFIGURATION
    // - pgsiz=100 max (Extensiv enforced)
    // - NO detail parameter (causes QueryParameterException)
    console.log('[Backend] STEP 2: Fetching items from Extensiv...');
    console.log('[Backend] ⚠️  Using pgsiz=100 (Extensiv max), NO detail parameter');
    
    const allItems = [];
    let currentPage = 1;
    const pageSize = 100;
    let hasMorePages = true;

    while (hasMorePages && currentPage <= 50) {
      const endpoint = `${EXTENSIV_BASE_URL}/customers/${customerId}/items?pgsiz=${pageSize}&pgnum=${currentPage}`;
      diagnostics.request.pagesRequested.push(currentPage);
      diagnostics.request.lastUrlCalled = endpoint;
      
      console.log(`[Backend] Fetching page ${currentPage}...`);
      console.log(`[Backend] Full URL: ${endpoint}`);

      try {
        const response = await fetch(endpoint, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Accept': 'application/hal+json',
            'Content-Type': 'application/hal+json',
          },
        });

        console.log(`[Backend] Page ${currentPage} Response Status: ${response.status}`);
        diagnostics.response.httpStatusByPage.push({ page: currentPage, status: response.status });

        if (!response.ok) {
          const errorText = await response.text();
          console.error(`[Backend] Failed to fetch page ${currentPage}:`, response.status);
          console.error(`[Backend] Error response:`, errorText.substring(0, 1000));
          
          diagnostics.response.rawSnippetByPage.push({
            page: currentPage,
            snippet: errorText.substring(0, 300),
          });
          
          return res.status(response.status).json({
            success: false,
            error: `Failed to fetch items page ${currentPage} (${response.status})`,
            step: 'items',
            status: response.status,
            details: errorText.substring(0, 1000),
            url: endpoint,
            diagnostics,
          });
        }

        const responseText = await response.text();
        console.log(`[Backend] Page ${currentPage} raw response (first 1000 chars):`, responseText.substring(0, 1000));
        
        const sanitizedSnippet = responseText.substring(0, 500).replace(/Bearer\s+[\w-]+/gi, 'Bearer [REDACTED]');
        diagnostics.response.rawSnippetByPage.push({
          page: currentPage,
          snippet: sanitizedSnippet,
        });
        
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
            diagnostics,
          });
        }

        console.log(`[Backend] Page ${currentPage} response keys:`, Object.keys(data));
        
        // Store TotalResults if present
        if (data.TotalResults !== undefined && diagnostics.response.totalResultsReported === null) {
          diagnostics.response.totalResultsReported = data.TotalResults;
          console.log(`[Backend] TotalResults reported by Extensiv: ${data.TotalResults}`);
        }
        
        // ⚠️ DO NOT MODIFY — CONFIRMED WORKING PARSING LOGIC
        // Priority-based parsing for HAL format responses
        let pageItems = [];
        let detectedPath = 'none';
        
        // Priority 1: Check ResourceList (most common for Extensiv)
        if (Array.isArray(data?.ResourceList)) {
          pageItems = data.ResourceList;
          detectedPath = 'ResourceList';
          console.log(`[Backend] ✅ Found ${pageItems.length} items in data.ResourceList`);
        }
        // Priority 2: Check _embedded (HAL format)
        else if (data?._embedded) {
          const embeddedArrays = Object.values(data._embedded);
          const found = embeddedArrays.find(v => Array.isArray(v));
          if (found) {
            pageItems = found;
            detectedPath = `_embedded (found array with ${found.length} items)`;
            console.log(`[Backend] ✅ Found ${pageItems.length} items in data._embedded`);
          }
        }
        // Priority 3: Check if response itself is an array
        else if (Array.isArray(data)) {
          pageItems = data;
          detectedPath = 'root array';
          console.log(`[Backend] ✅ Response is array with ${pageItems.length} items`);
        }
        // Priority 4: Check legacy 'items' property
        else if (Array.isArray(data?.items)) {
          pageItems = data.items;
          detectedPath = 'items';
          console.log(`[Backend] ✅ Found ${pageItems.length} items in data.items`);
        }
        else {
          detectedPath = `unknown (keys: ${Object.keys(data).join(', ')})`;
          console.log(`[Backend] ⚠️  No items found. Response structure:`, Object.keys(data));
          console.log(`[Backend] ⚠️  Full response (first 2000 chars):`, JSON.stringify(data).substring(0, 2000));
        }

        // Update detected path (only once)
        if (diagnostics.response.detectedItemsPath === 'none' && detectedPath !== 'none') {
          diagnostics.response.detectedItemsPath = detectedPath;
        }

        console.log(`[Backend] Page ${currentPage}: ${pageItems.length} items extracted`);
        diagnostics.response.itemsFoundByPage.push({ page: currentPage, count: pageItems.length });
        
        // Pagination logic: continue until items < pageSize
        if (pageItems.length === 0) {
          hasMorePages = false;
          console.log(`[Backend] No items on page ${currentPage}, stopping pagination`);
        } else {
          allItems.push(...pageItems);
          
          if (pageItems.length < pageSize) {
            hasMorePages = false;
            console.log(`[Backend] Last page (${pageItems.length} < ${pageSize}), stopping`);
          } else {
            currentPage++;
            console.log(`[Backend] Full page received, continuing to page ${currentPage}`);
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
          diagnostics,
        });
      }
    }

    diagnostics.response.totalItemsExtracted = allItems.length;
    console.log(`[Backend] ✅ Fetched ${allItems.length} total items across ${currentPage - 1} pages`);
    
    if (diagnostics.response.totalResultsReported !== null) {
      console.log(`[Backend] 📊 Extensiv reported ${diagnostics.response.totalResultsReported} total, extracted ${allItems.length}`);
    }

    // Step 3: Simulate storage for diagnostics
    let inserted = 0;
    let updated = 0;
    
    if (allItems.length > 0) {
      inserted = allItems.length;
      diagnostics.storage.inserted = inserted;
      diagnostics.storage.updated = updated;
      diagnostics.storage.finalTotalForCustomer = allItems.length;
    }

    diagnostics.syncEndTime = new Date().toISOString();

    // Step 4: Return items to frontend with full diagnostics
    return res.json({
      success: true,
      items: allItems,
      totalItems: allItems.length,
      pagesProcessed: currentPage - 1,
      diagnostics,
    });
  } catch (error) {
    console.error('[Backend] ❌ UNHANDLED EXCEPTION in sync-items:', error.message);
    console.error('[Backend] Stack trace:', error.stack);
    diagnostics.syncEndTime = new Date().toISOString();
    return res.status(500).json({
      success: false,
      error: error.message || 'Internal server error',
      step: 'unknown',
      status: 500,
      details: error.stack,
      diagnostics,
    });
  }
});

/**
 * POST /api/extensiv/send-receiving
 * Create a new receiver in Extensiv with PALLET-LEVEL SPLITTING
 * 
 * UPDATED: Uses palletInfo structure with palletId and label fields
 * - Splits items with fullPallets into separate receiveItems entries
 * - Each full pallet becomes a separate entry
 * - Partial cases become a separate entry
 * - Mixed pallets handled separately
 * - Uses palletInfo (not pallet) with empty palletId and label fields
 */
router.post('/send-receiving', async (req, res) => {
  console.log('[Backend] ========================================');
  console.log('[Backend] Handler /api/extensiv/send-receiving started at', new Date().toISOString());
  console.log('[Backend] ========================================');
  
  res.setHeader('Content-Type', 'application/json');
  
  try {
    console.log('[Backend] Request body keys:', Object.keys(req.body));
    
    const { clientId, clientSecret, userLoginId, facilityId, receivingSession } = req.body;
    
    console.log('[Backend] Credentials check:');
    console.log('[Backend] - clientId present:', !!clientId);
    console.log('[Backend] - clientSecret present:', !!clientSecret);
    console.log('[Backend] - userLoginId present:', !!userLoginId);
    console.log('[Backend] - facilityId present:', !!facilityId);
    console.log('[Backend] - receivingSession present:', !!receivingSession);
    
    if (!clientId || !clientSecret || !userLoginId || !facilityId) {
      console.error('[Backend] Missing required credentials');
      return res.status(400).json({
        success: false,
        error: 'Missing required credentials: clientId, clientSecret, userLoginId, facilityId',
      });
    }
    
    if (!receivingSession) {
      console.error('[Backend] Missing receivingSession in request body');
      return res.status(400).json({
        success: false,
        error: 'Missing required field: receivingSession',
      });
    }

    // DEBUG LOGS - Incoming receivingSession fields
    console.log('[Backend] 🔍 DEBUG - Incoming receivingSession fields:');
    console.log('[Backend] receivingSession.customerId:', receivingSession.customerId);
    console.log('[Backend] receivingSession.customerName:', receivingSession.customerName);
    console.log('[Backend] receivingSession.containerNumber:', receivingSession.containerNumber);
    console.log('[Backend] receivingSession.poNumber:', receivingSession.poNumber);
    console.log('[Backend] receivingSession.items?.length:', receivingSession.items?.length);

    // DEBUG LOGS - Facility ID being used
    console.log('[Backend] 🔍 DEBUG - Stored facilityId being used:', facilityId);

    // Step 0.5: Auto-generate reference number from customer's atomic counter
    let autoReferenceNumber = null;
    let referenceCounter = null;
    let referenceRolledBack = false;
    let extensivCustomerId = null; // The numeric customer ID from Extensiv's system
    
    // Check if a custom reference was provided by the frontend
    const customReference = req.body.referenceNumber || null;
    
    if (customReference) {
      autoReferenceNumber = customReference;
      console.log(`[Backend] 📋 Using custom reference number from frontend: ${autoReferenceNumber}`);
    }
    
    // Always look up the customer to get extensiv_customer_id (and auto-generate reference if needed)
    try {
      const customerId = receivingSession.customerId;
      console.log(`[Backend] 🔢 Looking up customer for ID: ${customerId}`);
      
      const client = await getClient();
      try {
        await client.query('BEGIN');
        
        if (customReference) {
          // Just look up the customer without incrementing counter
          const lookupResult = await client.query(
            `SELECT id, name, reference_prefix, reference_counter, extensiv_customer_id
             FROM customers
             WHERE id = $1 OR threel_id = $2`,
            [customerId, String(customerId)]
          );
          
          if (lookupResult.rows.length > 0) {
            const customer = lookupResult.rows[0];
            extensivCustomerId = customer.extensiv_customer_id;
            console.log(`[Backend] ✅ Customer found: ${customer.name} (dbId: ${customer.id}, extensivId: ${extensivCustomerId})`);
          } else {
            console.log(`[Backend] ⚠️ Customer ${customerId} not found in DB`);
          }
          await client.query('COMMIT');
        } else {
          // Auto-generate reference from customer's counter
          // Look up customer by database id OR threel_id (3PL ID)
          // Frontend sends thirdPartyLogisticsId (threel_id) as customerId
          const refResult = await client.query(
            `UPDATE customers 
             SET reference_counter = reference_counter + 1,
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = $1 OR threel_id = $2
             RETURNING id, name, reference_prefix, reference_counter, extensiv_customer_id`,
            [customerId, String(customerId)]
          );
          
          if (refResult.rows.length > 0) {
            const customer = refResult.rows[0];
            const dbCustomerId = customer.id; // Use actual DB id for logging
            const prefix = customer.reference_prefix || 'REF';
            referenceCounter = customer.reference_counter;
            autoReferenceNumber = `${prefix}${referenceCounter}`;
            extensivCustomerId = customer.extensiv_customer_id;
            
            // Log to reference_log using actual database ID
            await client.query(
              `INSERT INTO reference_log (customer_id, reference_number, counter_value, used_for, session_id)
               VALUES ($1, $2, $3, $4, $5)`,
              [dbCustomerId, autoReferenceNumber, referenceCounter, 'extensiv-receiver', receivingSession.id]
            );
            
            await client.query('COMMIT');
            console.log(`[Backend] ✅ Auto-generated reference: ${autoReferenceNumber} (counter: ${referenceCounter}, dbId: ${dbCustomerId}, extensivId: ${extensivCustomerId}, lookupId: ${customerId})`);
          } else {
            await client.query('ROLLBACK');
            console.log(`[Backend] ⚠️ Customer ${customerId} not found in DB by id or threel_id, using fallback reference`);
            autoReferenceNumber = receivingSession.containerNumber || `REF-${Date.now()}`;
          }
        }
      } catch (dbError) {
        await client.query('ROLLBACK');
        console.error('[Backend] ⚠️ DB error during customer lookup/reference generation:', dbError.message);
        if (!autoReferenceNumber) {
          autoReferenceNumber = receivingSession.containerNumber || `REF-${Date.now()}`;
        }
      } finally {
        client.release();
      }
    } catch (poolError) {
      console.error('[Backend] ⚠️ Pool error, using fallback reference:', poolError.message);
      if (!autoReferenceNumber) {
        autoReferenceNumber = receivingSession.containerNumber || `REF-${Date.now()}`;
      }
    }
    
    console.log(`[Backend] 📋 Final reference number: ${autoReferenceNumber}`);
    console.log(`[Backend] 📋 Extensiv customer ID: ${extensivCustomerId || 'NOT SET - will fallback to parsed customerId'}`);

    // Step 1: Get OAuth token using provided credentials
    console.log('[Backend] STEP 1: Getting OAuth token using provided credentials...');
    const authResult = await getAccessToken({ 
      clientId, 
      clientSecret, 
      userLoginId 
    });
    
    if (!authResult.success) {
      console.error('[Backend] OAuth token failed:', authResult.error);
      return res.status(401).json({
        success: false,
        error: authResult.error,
        step: 'token',
      });
    }

    const accessToken = authResult.token;
    console.log('[Backend] ✅ OAuth token obtained using provided credentials');

    // Step 2: Transform our receiving session to Extensiv format WITH PALLET SPLITTING
    console.log('[Backend] STEP 2: Transforming receiving session to Extensiv format with pallet splitting...');
    
    // NEW: Pallet-splitting logic with palletInfo structure
    const receiveItems = [];
    
    receivingSession.items.forEach(item => {
      console.log(`[Backend] 🔍 Processing item: ${item.itemNumber}`);
      console.log(`[Backend]   - fullPallets: ${item.fullPallets || 0}`);
      console.log(`[Backend]   - casesPerPallet: ${item.casesPerPallet || 0}`);
      console.log(`[Backend]   - partialCases: ${item.partialCases || 0}`);
      console.log(`[Backend]   - mixedPallet: ${item.mixedPallet || false}`);
      console.log(`[Backend]   - mixedPalletQty: ${item.mixedPalletQty || 0}`);
      
      // Create separate entries for each FULL pallet
      if (item.fullPallets && item.fullPallets > 0 && item.casesPerPallet && item.casesPerPallet > 0) {
        for (let i = 0; i < item.fullPallets; i++) {
          const palletEntry = {
            itemIdentifier: {
              sku: item.itemNumber,
            },
            qty: item.casesPerPallet,
            palletInfo: {
              palletId: "",
              label: "",
              palletTypeIdentifier: {
                name: "Pallet"
              }
            }
          };
          
          receiveItems.push(palletEntry);
          console.log(`[Backend]   ✅ Created full pallet entry ${i + 1}/${item.fullPallets}: ${item.casesPerPallet} cases`);
        }
      }
      
      // Create entry for PARTIAL cases (if any)
      if (item.partialCases && item.partialCases > 0) {
        const partialEntry = {
          itemIdentifier: {
            sku: item.itemNumber,
          },
          qty: item.partialCases,
          palletInfo: {
            palletId: "",
            label: "",
            palletTypeIdentifier: {
              name: "Pallet"
            }
          }
        };
        
        receiveItems.push(partialEntry);
        console.log(`[Backend]   ✅ Created partial pallet entry: ${item.partialCases} cases`);
      }
      
      // Create entry for MIXED pallet (if any)
      if (item.mixedPallet && item.mixedPalletQty && item.mixedPalletQty > 0) {
        const mixedEntry = {
          itemIdentifier: {
            sku: item.itemNumber,
          },
          qty: item.mixedPalletQty,
          palletInfo: {
            palletId: "",
            label: "",
            palletTypeIdentifier: {
              name: "Pallet"
            }
          }
        };
        
        receiveItems.push(mixedEntry);
        console.log(`[Backend]   ✅ Created mixed pallet entry: ${item.mixedPalletQty} cases`);
      }
      
      // Handle damaged/defective items
      if (item.condition === 'damaged' || item.condition === 'defective') {
        receiveItems.forEach(entry => {
          if (entry.itemIdentifier.sku === item.itemNumber) {
            entry.onHold = true;
            entry.onHoldReason = `Item condition: ${item.condition}`;
          }
        });
      }
    });
    
    console.log(`[Backend] 📦 Total pallet entries created: ${receiveItems.length}`);
    
    // Use extensiv_customer_id from DB if available, otherwise try to parse customerId
    const resolvedExtensivCustomerId = extensivCustomerId || parseInt(receivingSession.customerId) || 0;
    console.log(`[Backend] 🔍 Resolved Extensiv customer ID: ${resolvedExtensivCustomerId} (from DB: ${extensivCustomerId}, from session: ${receivingSession.customerId})`);
    
    if (!extensivCustomerId) {
      console.warn(`[Backend] ⚠️ WARNING: extensiv_customer_id not set in DB for this customer. Using fallback: ${resolvedExtensivCustomerId}. Please set extensiv_customer_id in customer settings.`);
    }
    
    const extensivPayload = {
      customerIdentifier: {
        id: resolvedExtensivCustomerId,
      },
      facilityIdentifier: {
        id: parseInt(facilityId) || 0,
      },
      warehouseTransactionSourceEnum: 7, // How the transaction entered the system
      transactionEntryType: 4, // The Agent creating the transaction
      isReturn: false,
      deferNotification: false,
      referenceNum: autoReferenceNumber || receivingSession.containerNumber || `REF-${Date.now()}`,
      poNum: receivingSession.poNumber || '',
      externalId: receivingSession.id || '',
      arrivalDate: receivingSession.completedAt || new Date().toISOString(),
      expectedDate: receivingSession.startedAt || new Date().toISOString(),
      notes: [
        `Received by: ${receivingSession.startedBy}`,
        receivingSession.reviewNotes ? `Review notes: ${receivingSession.reviewNotes}` : '',
        receivingSession.type === 'blind' ? 'Blind receipt (no ASN)' : '',
        `Pallet-level receiving: ${receiveItems.length} pallet entries`,
      ].filter(Boolean).join(' | '),
      receiveItems: receiveItems,
    };

    // DEBUG LOGS - Final Extensiv payload fields
    console.log('[Backend] 🔍 DEBUG - Final Extensiv payload fields:');
    console.log('[Backend] extensivPayload.customerIdentifier.id:', extensivPayload.customerIdentifier.id);
    console.log('[Backend] extensivPayload.facilityIdentifier.id:', extensivPayload.facilityIdentifier.id);
    console.log('[Backend] extensivPayload.referenceNum:', extensivPayload.referenceNum);
    console.log('[Backend] extensivPayload.poNum:', extensivPayload.poNum);
    console.log('[Backend] extensivPayload.externalId:', extensivPayload.externalId);

    console.log('[Backend] Transformed payload:');
    console.log('[Backend] - Customer ID:', extensivPayload.customerIdentifier.id);
    console.log('[Backend] - Facility ID:', extensivPayload.facilityIdentifier.id);
    console.log('[Backend] - Reference #:', extensivPayload.referenceNum);
    console.log('[Backend] - PO #:', extensivPayload.poNum);
    console.log('[Backend] - Pallet entries count:', extensivPayload.receiveItems.length);
    console.log('[Backend] Full payload (first 3000 chars):', JSON.stringify(extensivPayload, null, 2).substring(0, 3000));

    // Step 3: Send to Extensiv
    console.log('[Backend] STEP 3: Sending receiver with pallet-level data to Extensiv...');
    const endpoint = `${EXTENSIV_BASE_URL}/inventory/receivers`;
    console.log('[Backend] POST', endpoint);

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json; charset=utf-8',
        'Accept': 'application/hal+json',
        'Accept-Language': 'en-US,en;q=0.8',
      },
      body: JSON.stringify(extensivPayload),
    });

    console.log('[Backend] Response Status:', response.status);

    const responseText = await response.text();
    console.log('[Backend] Response text (first 2000 chars):', responseText.substring(0, 2000));

    if (!response.ok) {
      console.error('[Backend] Failed to create receiver:', response.status);
      console.error('[Backend] Error response:', responseText);
      
      // Rollback the reference counter if we auto-generated one
      if (referenceCounter !== null && !referenceRolledBack) {
        try {
          const customerId = receivingSession.customerId;
          console.log(`[Backend] 🔄 Rolling back reference counter for customer ${customerId} (counter: ${referenceCounter})`);
          
          // Look up customer by database id OR threel_id (3PL ID) for rollback
          const rollbackResult = await query(
            `UPDATE customers 
             SET reference_counter = reference_counter - 1,
                 updated_at = CURRENT_TIMESTAMP
             WHERE (id = $1 OR threel_id = $3) AND reference_counter = $2
             RETURNING id, reference_counter`,
            [customerId, referenceCounter, String(customerId)]
          );
          
          if (rollbackResult.rows.length > 0) {
            referenceRolledBack = true;
            const dbCustomerId = rollbackResult.rows[0].id;
            console.log(`[Backend] ✅ Reference counter rolled back to ${rollbackResult.rows[0].reference_counter}`);
            
            // Mark as rolled back in log using actual database ID
            await query(
              `UPDATE reference_log 
               SET rolled_back = TRUE, rolled_back_at = CURRENT_TIMESTAMP
               WHERE customer_id = $1 AND reference_number = $2 AND rolled_back = FALSE`,
              [dbCustomerId, autoReferenceNumber]
            );
          } else {
            console.log('[Backend] ⚠️ Rollback skipped - counter mismatch');
          }
        } catch (rollbackError) {
          console.error('[Backend] ⚠️ Failed to rollback reference counter:', rollbackError.message);
        }
      }
      
      return res.status(response.status).json({
        success: false,
        error: `Failed to create receiver in Extensiv (${response.status})`,
        details: responseText.substring(0, 1000),
        payload: extensivPayload,
        referenceRolledBack,
      });
    }

    // Parse response
    let receiverData;
    try {
      receiverData = JSON.parse(responseText);
    } catch (parseError) {
      console.error('[Backend] Failed to parse receiver response:', parseError.message);
      return res.status(500).json({
        success: false,
        error: 'Invalid JSON response from Extensiv',
        details: responseText.substring(0, 1000),
      });
    }

    console.log('[Backend] ✅ Receiver created successfully with pallet-level data');
    console.log('[Backend] Receiver response keys:', Object.keys(receiverData));
    console.log('[Backend] Receiver readOnly keys:', receiverData.readOnly ? Object.keys(receiverData.readOnly) : 'no readOnly');
    console.log('[Backend] Full receiver response (first 3000 chars):', JSON.stringify(receiverData, null, 2).substring(0, 3000));
    
    // Extract receiver ID from response
    // Extensiv returns the receiver ID in readOnly.receiverId (HAL format)
    const receiverId = receiverData.readOnly?.receiverId 
      || receiverData.readOnly?.ReceiverId
      || receiverData.ReadOnly?.receiverId
      || receiverData.ReadOnly?.ReceiverId
      || receiverData.receiverId
      || receiverData.ReceiverId
      || receiverData.Id 
      || receiverData.id 
      || null;
    const receiverNumber = receiverData.readOnly?.referenceNum
      || receiverData.readOnly?.ReferenceNum
      || receiverData.ReadOnly?.referenceNum
      || receiverData.ReferenceNum 
      || receiverData.referenceNum 
      || extensivPayload.referenceNum;
    
    console.log('[Backend] Receiver ID (extracted):', receiverId);
    console.log('[Backend] Receiver Number (extracted):', receiverNumber);
    console.log('[Backend] Total pallets sent:', receiveItems.length);

    return res.json({
      success: true,
      receiverId: receiverId,
      receiverNumber: receiverNumber,
      referenceNumber: autoReferenceNumber,
      totalPallets: receiveItems.length,
      extensivResponse: receiverData,
      message: `Receiver created successfully in Extensiv with ${receiveItems.length} pallet entries`,
    });

  } catch (error) {
    console.error('[Backend] ❌ UNHANDLED EXCEPTION in send-receiving:', error.message);
    console.error('[Backend] Stack trace:', error.stack);
    return res.status(500).json({
      success: false,
      error: error.message || 'Internal server error',
      details: error.stack,
    });
  }
});

export default router;