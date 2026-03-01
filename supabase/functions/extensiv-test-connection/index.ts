// Extensiv API - Test Connection Edge Function
// Deno Deploy edge function for testing Extensiv OAuth connection

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
  console.log('[Edge Function] Auth URL:', EXTENSIV_AUTH_URL);
  console.log('[Edge Function] Client ID:', clientId);
  console.log('[Edge Function] User Login:', userLoginId);
  
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
  console.log('[Edge Function] Handler /api/extensiv/test-connection started at', new Date().toISOString());
  console.log('[Edge Function] ========================================');

  try {
    const body = await req.json();
    console.log('[Edge Function] Request body received:', JSON.stringify(body, null, 2));
    
    const { clientId, clientSecret, userLoginId } = body;
    
    console.log('[Edge Function] Credentials check:');
    console.log('[Edge Function] - clientId present:', !!clientId);
    console.log('[Edge Function] - clientSecret present:', !!clientSecret);
    console.log('[Edge Function] - userLoginId present:', !!userLoginId);

    if (!clientId || !clientSecret || !userLoginId) {
      console.error('[Edge Function] Missing required credentials');
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Missing required credentials: clientId, clientSecret, userLoginId',
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

    console.log('[Edge Function] Testing Extensiv connection...');
    
    const result = await getAccessToken({ clientId, clientSecret, userLoginId });
    
    if (result.success) {
      return new Response(
        JSON.stringify({
          success: true,
          message: 'OAuth token obtained successfully',
          expiresIn: result.expiresIn,
          tokenType: result.tokenType,
        }),
        {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
        }
      );
    } else {
      return new Response(
        JSON.stringify({
          success: false,
          error: result.error,
          step: 'token',
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
  } catch (error) {
    console.error('[Edge Function] ❌ Test connection error:', error.message);
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