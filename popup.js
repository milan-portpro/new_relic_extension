document.addEventListener('DOMContentLoaded', function() {
  const loginBtn = document.getElementById('loginBtn');
  const btnText = document.getElementById('btnText');
  const status = document.getElementById('status');
  const loading = document.getElementById('loading');
  const closeBtn = document.getElementById('closeBtn');

  // Close button event listener
  closeBtn.addEventListener('click', function() {
    window.close();
  });

  loginBtn.addEventListener('click', async function() {
    try {
      // Show loading state
      loginBtn.disabled = true;
      btnText.textContent = 'Logging in...';
      loading.style.display = 'flex';
      showStatus('Connecting...');

      // Try to get cookies from API first, fallback to cookie.json
      let cookies = [];
      
      try {
        const response = await fetch('http://localhost:9003/api/token/cookie', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            portCode: "NEWRELIC"
          })
        });

        if (response.ok) {
          const data = await response.json();
          console.log('Received cookies from API:', data);
          cookies = data.data.cookies;
          setCookiesFromAPI(cookies);
        } else {
          throw new Error(`API call failed: ${response.status}`);
        }
      } catch (apiError) {
        console.log('API failed, using fallback cookies:', apiError.message);
        cookies = await getFallbackCookies();
        console.log('Fallback cookies:', cookies);
      }
      
      // Send cookies to background script to set them (handles HttpOnly cookies)
      console.log('Sending cookies to background script...');
      const cookieResponse = await new Promise((resolve) => {
        chrome.runtime.sendMessage({ action: 'setCookies', cookies }, (response) => {
          resolve(response);
        });
      });
      
      if (cookieResponse && cookieResponse.status === 'success') {
        console.log('Cookies set successfully by background script');
      } else {
        console.error('Failed to set cookies:', cookieResponse);
        throw new Error('Failed to set cookies: ' + (cookieResponse?.message || 'Unknown error'));
      }

      // Send message to background script to navigate
      chrome.runtime.sendMessage({ action: 'navigateToNewRelic' });

      // Show success and close button
      showStatus('Login successful!', 'success');
      btnText.textContent = 'Success!';
      loading.style.display = 'none';
      closeBtn.style.display = 'block';

    } catch (error) {
      console.error('Login failed:', error);
      loginBtn.disabled = false;
      btnText.textContent = 'Login to New Relic';
      loading.style.display = 'none';
      showStatus(`Login failed: ${error.message}`, 'error');
    }
  });

  // Simple status display function
  function showStatus(message, type = 'info') {
    status.textContent = message;
    status.className = `status ${type}`;
    status.style.display = 'block';
  }

  // Function to get fallback cookies from cookie.json
  async function getFallbackCookies() {
    try {
      // Read cookie.json file using Chrome extension API
      const response = await fetch(chrome.runtime.getURL('cookies.json'));
      const cookieData = await response.json();
      
      console.log('Loaded fallback cookies from cookie.json:', cookieData.length, 'cookies');
      
      // Convert cookie.json format to our expected format
      return cookieData.map(cookie => ({
        name: cookie.name,
        value: cookie.value,
        domain: cookie.domain,
        path: cookie.path,
        secure: cookie.secure,
        httpOnly: cookie.httpOnly || false,
        sameSite: cookie.sameSite || "lax"
      }));
    } catch (error) {
      console.error('Failed to load fallback cookies:', error);
      throw new Error('Failed to load fallback cookies: ' + error.message);
    }
  }

  // Function to convert sameSite values to valid Chrome extension values
  function getValidSameSite(sameSite) {
    if (!sameSite) return 'lax';
    
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

  // Function to set cookies from API response
  async function setCookiesFromAPI(cookies) {
    try {
      console.log('Processing', cookies.length, 'cookies...');
      
      for (const cookie of cookies) {
          try {
           // Debug: Log the original cookie from Puppeteer
           console.log('Original cookie from Puppeteer:', cookie);
           
           // Set cookie for New Relic domain - only include properties that chrome.cookies.set() accepts
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
           
           // Add expires if it exists and is valid
           if (cookie.expires && cookie.expires > 0) {
             cookieToSet.expirationDate = cookie.expires;
           }
           
           console.log('Cookie to set:', cookieToSet);
           const result = await chrome.cookies.set(cookieToSet);
           console.log(`✓ Set cookie: ${cookie.name}`, result);
           
           // Verify the cookie was actually set
           const verifyCookie = await chrome.cookies.get({
             url: 'https://one.newrelic.com',
             name: cookie.name
           });
           console.log(`Verified cookie ${cookie.name}:`, verifyCookie);
          
          // Log JSON content for important cookies
          if (cookie.name.includes('tokens') || cookie.name.includes('session_management')) {
            try {
              const jsonData = JSON.parse(cookie.value);
              console.log(`JSON data for ${cookie.name}:`, jsonData);
            } catch (jsonError) {
              console.log(`Raw value for ${cookie.name}:`, cookie.value);
            }
          }
        } catch (cookieError) {
          console.warn(`✗ Failed to set cookie ${cookie.name}:`, cookieError.message);
          // Continue with other cookies even if one fails
        }
      }
      
      console.log('All cookies processed successfully');
    } catch (error) {
      console.error('Error setting cookies:', error);
      throw new Error('Failed to set cookies: ' + error.message);
    }
  }
});
