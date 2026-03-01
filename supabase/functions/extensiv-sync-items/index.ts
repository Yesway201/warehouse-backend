// Extensiv API - Sync Items Edge Function
// Deno Deploy edge function for syncing items from Extensiv with pagination

const EXTENSIV_BASE_URL = 'https://secure-wms.com';
const EXTENSIV_AUTH_URL = `${EXTENSIV_BASE_URL}/AuthServer/api/Token`;

/**
 * Get OAuth 2.0 access token from Extensiv
 */
async function getAccessToken(credentials: {
  clientId: string;
  clientSecret: string;
  userLoginId: string;
}) {
  const { clientId, clientSecret, userLoginId } = credentials;
  
  console.log('[Edge Function] Requesting OAuth token from Extensiv...');
  
  // Create Base64 encoded authorization key (ClientID:ClientSecret)
  const authKey = btoa(`${clientId}:${clientSecret}`);
  
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

    console.log('[Edge Function] Auth Response Status:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[Edge Function] Auth failed:', response.status, errorText);
      return {
        success: false,
        error: `Authentication failed (${response.status}): ${errorText}`,
      };
    }

    const data = await response.json();
    console.log('[Edge Function] ✅ Token obtained successfully');
    
    return {
      success: true,
      token: data.access_token,
      expiresIn: data.expires_in,
      tokenType: data.token_type,
    };
  } catch (error) {
    console.error('[Edge Function] Failed to get access token:', error);
    return {
      success: false,
      error: error.message || 'Network error',
    };
  }
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    });
  }

  // Only allow POST
  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ success: false, error: 'Method not allowed' }),
      {
        status: 405,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      }
    );
  }

  console.log('[Edge Function] ========================================');
  console.log('[Edge Function] Handler /api/extensiv/sync-items started at', new Date().toISOString());
  console.log('[Edge Function] ========================================');

  try {
    const body = await req.json();
    console.log('[Edge Function] Full request body:', JSON.stringify(body, null, 2));
    
    const { clientId, clientSecret, userLoginId, customerId } = body;

    // Log credential presence
    console.log('[Edge Function] Credentials check:');
    console.log('[Edge Function] - clientId present:', !!clientId);
    console.log('[Edge Function] - clientSecret present:', !!clientSecret);
    console.log('[Edge Function] - userLoginId present:', !!userLoginId);
    console.log('[Edge Function] - customerId present:', !!customerId);

    // Early validation with detailed error
    if (!clientId) {
      console.error('[Edge Function] Missing clientId');
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Missing required field: clientId',
          step: 'credentials',
        }),
        {
          status: 400,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
        }
      );
    }
    
    if (!clientSecret) {
      console.error('[Edge Function] Missing clientSecret');
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Missing required field: clientSecret',
          step: 'credentials',
        }),
        {
          status: 400,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
        }
      );
    }
    
    if (!userLoginId) {
      console.error('[Edge Function] Missing userLoginId');
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Missing required field: userLoginId',
          step: 'credentials',
        }),
        {
          status: 400,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
        }
      );
    }
    
    if (!customerId) {
      console.error('[Edge Function] Missing customerId');
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Missing required field: customerId',
          step: 'validation',
        }),
        {
          status: 400,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
        }
      );
    }

    console.log('[Edge Function] ✅ All required fields present');

    // Step 1: Get OAuth token
    console.log('[Edge Function] STEP 1: Getting OAuth token...');
    const authResult = await getAccessToken({ clientId, clientSecret, userLoginId });
    
    if (!authResult.success) {
      console.error('[Edge Function] OAuth token failed:', authResult.error);
      return new Response(
        JSON.stringify({
          success: false,
          error: authResult.error,
          step: 'token',
          details: 'Failed to obtain OAuth token from Extensiv',
        }),
        {
          status: 401,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
        }
      );
    }

    const accessToken = authResult.token;
    console.log('[Edge Function] ✅ OAuth token obtained');

    // Step 2: Fetch items with pagination
    console.log('[Edge Function] STEP 2: Fetching items from Extensiv...');
    const allItems = [];
    let currentPage = 1;
    const pageSize = 500;
    let hasMorePages = true;

    while (hasMorePages && currentPage <= 10) { // Safety limit: max 10 pages
      const endpoint = `${EXTENSIV_BASE_URL}/customers/${customerId}/items?pgsiz=${pageSize}&pgnum=${currentPage}`;
      
      console.log(`[Edge Function] Fetching page ${currentPage}...`);
      console.log(`[Edge Function] Full URL: ${endpoint}`);

      try {
        const response = await fetch(endpoint, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/hal+json',
            'Accept': 'application/hal+json',
          },
        });

        console.log(`[Edge Function] Page ${currentPage} Response Status: ${response.status}`);

        if (!response.ok) {
          const errorText = await response.text();
          console.error(`[Edge Function] Failed to fetch page ${currentPage}:`, response.status);
          console.error(`[Edge Function] Error response (first 1000 chars):`, errorText.substring(0, 1000));
          
          return new Response(
            JSON.stringify({
              success: false,
              error: `Failed to fetch items page ${currentPage} (${response.status})`,
              step: 'items',
              details: errorText.substring(0, 1000),
              url: endpoint,
            }),
            {
              status: response.status,
              headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
              },
            }
          );
        }

        const responseText = await response.text();
        console.log(`[Edge Function] Page ${currentPage} raw response (first 1000 chars):`, responseText.substring(0, 1000));
        
        let data;
        try {
          data = JSON.parse(responseText);
        } catch (parseError) {
          console.error(`[Edge Function] Failed to parse JSON response:`, parseError.message);
          return new Response(
            JSON.stringify({
              success: false,
              error: 'Invalid JSON response from Extensiv',
              step: 'items',
              details: responseText.substring(0, 1000),
            }),
            {
              status: 500,
              headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
              },
            }
          );
        }

        console.log(`[Edge Function] Page ${currentPage} response structure:`, Object.keys(data));
        
        // Extract items from response (handle different response formats)
        let pageItems = [];
        
        if (data.ResourceList) {
          pageItems = data.ResourceList;
          console.log(`[Edge Function] Found items in data.ResourceList`);
        } else if (data.items) {
          pageItems = data.items;
          console.log(`[Edge Function] Found items in data.items`);
        } else if (data._embedded) {
          const embedded = data._embedded;
          pageItems = embedded['http://api.3plCentral.com/rels/customers/items'] || 
                      embedded.items || 
                      [];
          console.log(`[Edge Function] Found items in data._embedded`);
        } else if (Array.isArray(data)) {
          pageItems = data;
          console.log(`[Edge Function] Response is array`);
        } else {
          console.log(`[Edge Function] Unknown response structure, keys:`, Object.keys(data));
        }

        console.log(`[Edge Function] Page ${currentPage}: ${pageItems.length} items extracted`);
        
        if (pageItems.length === 0) {
          hasMorePages = false;
          console.log(`[Edge Function] No more items, stopping pagination`);
        } else {
          allItems.push(...pageItems);
          
          if (pageItems.length < pageSize) {
            hasMorePages = false;
            console.log(`[Edge Function] Last page (${pageItems.length} < ${pageSize}), stopping`);
          } else {
            currentPage++;
            console.log(`[Edge Function] More pages available, continuing to page ${currentPage}`);
          }
        }
      } catch (fetchError) {
        console.error(`[Edge Function] Network error fetching page ${currentPage}:`, fetchError.message);
        console.error(`[Edge Function] Stack trace:`, fetchError.stack);
        return new Response(
          JSON.stringify({
            success: false,
            error: `Network error on page ${currentPage}: ${fetchError.message}`,
            step: 'items',
            details: fetchError.stack,
          }),
          {
            status: 500,
            headers: {
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': '*',
            },
          }
        );
      }
    }

    console.log(`[Edge Function] ✅ Fetched ${allItems.length} total items across ${currentPage - 1} pages`);

    // Step 3: Return items to frontend
    return new Response(
      JSON.stringify({
        success: true,
        items: allItems,
        totalItems: allItems.length,
        pagesProcessed: currentPage - 1,
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      }
    );
  } catch (error) {
    console.error('[Edge Function] ❌ UNHANDLED EXCEPTION in sync-items:', error.message);
    console.error('[Edge Function] Stack trace:', error.stack);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || 'Internal server error',
        step: 'unknown',
        details: error.stack,
      }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      }
    );
  }
});