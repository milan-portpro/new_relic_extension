// Background script for handling navigation and cookie setting
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'navigateToNewRelic') {
    // Get the current active tab
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) {
        // Navigate to New Relic in the same tab
        chrome.tabs.update(tabs[0].id, {
          url: 'https://one.newrelic.com'
        });
      }
    });
  } else if (request.action === 'setCookies') {
    // Handle cookie setting from popup
    setCookiesFromBackground(request.cookies)
      .then(result => {
        sendResponse({ status: 'success', message: 'Cookies set successfully', result });
      })
      .catch(error => {
        console.error('Error setting cookies:', error);
        sendResponse({ status: 'error', message: error.message });
      });
    return true; // Keep the message channel open for async response
  }
});

// Function to set cookies from background script (handles HttpOnly cookies)
async function setCookiesFromBackground(cookies) {
  try {
    console.log('Setting cookies from background script:', cookies.length, 'cookies');
    
    const results = [];
    
    for (const cookie of cookies) {
      try {
        // Skip expired cookies
        if (cookie.expires && cookie.expires < Date.now() / 1000) {
          console.log(`⚠️ Skipping expired cookie: ${cookie.name}`);
          continue;
        }
        
        // Convert Puppeteer cookie format to Chrome extension format
        const cookieToSet = {
          url: 'https://one.newrelic.com',
          name: cookie.name,
          value: cookie.value,
          domain: cookie.domain || '.newrelic.com',
          path: cookie.path || '/',
          secure: cookie.secure !== undefined ? cookie.secure : true,
          httpOnly: cookie.httpOnly !== undefined ? cookie.httpOnly : false,
          sameSite: getValidSameSite(cookie.sameSite)
        };
        
        // Add expiration date if it exists and is valid
        if (cookie.expires && cookie.expires > 0) {
          cookieToSet.expirationDate = cookie.expires;
        }
        
        // Handle session cookies (expires: -1)
        if (cookie.expires === -1 || cookie.session) {
          // Don't set expirationDate for session cookies
          delete cookieToSet.expirationDate;
        }
        
        console.log('Setting cookie:', cookieToSet.name);
        
        // Set the cookie
        const result = await chrome.cookies.set(cookieToSet);
        
        if (result) {
          console.log(`✓ Cookie set successfully: ${cookie.name}`);
          results.push({ name: cookie.name, success: true });
        } else {
          console.warn(`✗ Failed to set cookie: ${cookie.name}`);
          results.push({ name: cookie.name, success: false, error: 'Failed to set cookie' });
        }
        
      } catch (cookieError) {
        console.error(`Error setting cookie ${cookie.name}:`, cookieError);
        results.push({ name: cookie.name, success: false, error: cookieError.message });
      }
    }
    
    const successCount = results.filter(r => r.success).length;
    console.log(`Cookie setting completed: ${successCount}/${cookies.length} successful`);
    
    // Verify critical cookies were set
    const criticalCookies = ['login_service_login_newrelic_com_tokens', 'login_service_session_management_login_newrelic_com'];
    const verificationResults = [];
    
    for (const cookieName of criticalCookies) {
      try {
        const verifyCookie = await chrome.cookies.get({
          url: 'https://one.newrelic.com',
          name: cookieName
        });
        verificationResults.push({
          name: cookieName,
          found: !!verifyCookie,
          value: verifyCookie ? verifyCookie.value.substring(0, 50) + '...' : 'Not found'
        });
        console.log(`Verification: ${cookieName} = ${verifyCookie ? 'Found' : 'Not found'}`);
      } catch (error) {
        console.error(`Error verifying cookie ${cookieName}:`, error);
        verificationResults.push({ name: cookieName, found: false, error: error.message });
      }
    }
    
    return {
      total: cookies.length,
      successful: successCount,
      failed: cookies.length - successCount,
      results: results,
      verification: verificationResults
    };
    
  } catch (error) {
    console.error('Error in setCookiesFromBackground:', error);
    throw error;
  }
}

// Function to convert sameSite values to valid Chrome extension values
function getValidSameSite(sameSite) {
  if (!sameSite || sameSite === 'undefined' || sameSite === undefined) return 'lax';
  
  const validValues = ['lax', 'no_restriction', 'strict', 'unspecified'];
  const lowerSameSite = sameSite.toLowerCase();
  
  // Direct match
  if (validValues.includes(lowerSameSite)) {
    return lowerSameSite;
  }
  
  // Common mappings from Puppeteer to Chrome
  const mappings = {
    'none': 'no_restriction',
    'no-restriction': 'no_restriction',
    'default': 'lax',
    '': 'lax'
  };
  
  return mappings[lowerSameSite] || 'lax';
}