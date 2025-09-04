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
      showStatus('Connecting to API...');

      // Try to get cookies from API first, fallback to cookie.json
      let cookies = [];
      let apiSuccess = false;
      
      try {
        console.log('Attempting to fetch cookies from API...');
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
          console.log('API Response:', data);
          
          // Handle the actual API response format - cookies are nested under data.cookies
          if (data.data && data.data.cookies && Array.isArray(data.data.cookies)) {
            cookies = data.data.cookies;
            apiSuccess = true;
            console.log(`✓ Received ${cookies.length} cookies from API`);
            showStatus(`Got ${cookies.length} fresh cookies from API...`);
          } else if (data.cookies && Array.isArray(data.cookies)) {
            // Fallback for direct format
            cookies = data.cookies;
            apiSuccess = true;
            console.log(`✓ Received ${cookies.length} cookies from API (direct format)`);
            showStatus(`Got ${cookies.length} fresh cookies from API...`);
          } else {
            throw new Error('Invalid API response format - no cookies found');
          }
        } else {
          throw new Error(`API call failed: ${response.status} ${response.statusText}`);
        }
      } catch (apiError) {
        console.log('API failed, using fallback cookies:', apiError.message);
        showStatus('API failed, using backup cookies...');
        cookies = await getFallbackCookies();
        console.log(`Using ${cookies.length} fallback cookies`);
      }
      
      // Process and set cookies
      showStatus('Setting cookies...');
      console.log('Processing cookies for browser...');
      
      // Send cookies to background script to set them (handles HttpOnly cookies)
      const cookieResponse = await new Promise((resolve) => {
        chrome.runtime.sendMessage({ action: 'setCookies', cookies }, (response) => {
          resolve(response);
        });
      });
      
      if (cookieResponse && cookieResponse.status === 'success') {
        console.log('✓ Cookies set successfully by background script');
        console.log(`Successfully set ${cookieResponse.result?.successful || 0} cookies`);
        console.log('Cookie setting results:', cookieResponse.result);
        
        // Check verification results
        const verification = cookieResponse.result?.verification || [];
        const criticalCookiesFound = verification.filter(v => v.found).length;
        console.log(`Critical cookies verification: ${criticalCookiesFound}/${verification.length} found`);
        
        if (criticalCookiesFound < verification.length) {
          console.warn('⚠️ Some critical cookies were not set properly:', verification);
          showStatus(`Warning: ${criticalCookiesFound}/${verification.length} critical cookies set`);
        } else {
          showStatus(`Cookies set successfully! (${cookieResponse.result?.successful || 0} cookies)`);
        }
      } else {
        console.error('Failed to set cookies:', cookieResponse);
        throw new Error('Failed to set cookies: ' + (cookieResponse?.message || 'Unknown error'));
      }

      // Wait a moment for cookies to be processed
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Send message to background script to navigate
      showStatus('Navigating to New Relic...');
      chrome.runtime.sendMessage({ action: 'navigateToNewRelic' });

      // Show success and close button
      const successMessage = apiSuccess ? 
        `Login successful! Used fresh cookies from API.` : 
        `Login successful! Used backup cookies.`;
      
      showStatus(successMessage, 'success');
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
        sameSite: cookie.sameSite || "lax",
        expires: cookie.expirationDate || cookie.expires
      }));
    } catch (error) {
      console.error('Failed to load fallback cookies:', error);
      throw new Error('Failed to load fallback cookies: ' + error.message);
    }
  }
});
