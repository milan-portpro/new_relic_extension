// Test script to verify the API endpoint is working
// Run with: node test-api.js

const testAPI = async () => {
  try {
    console.log('🧪 Testing New Relic API endpoint...');
    
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
      console.log('✅ API Response:', {
        statusCode: data.statusCode,
        message: data.message,
        cookiesCount: data.data?.cookies?.length || 0,
        portCode: data.data?.portCode,
        userName: data.data?.userName,
        hitCount: data.data?.hitCount,
        isDisable: data.data?.isDisable,
        sessionFailed: data.data?.sessionFailed
      });
      
      const cookies = data.data?.cookies;
      if (cookies) {
        console.log('🍪 Sample cookies:');
        cookies.slice(0, 3).forEach(cookie => {
          console.log(`  - ${cookie.name}: ${cookie.value.substring(0, 50)}...`);
        });
        
        // Show important authentication cookies
        const authCookies = cookies.filter(c => 
          c.name.includes('token') || 
          c.name.includes('session') || 
          c.name.includes('login')
        );
        if (authCookies.length > 0) {
          console.log('🔐 Authentication cookies found:');
          authCookies.forEach(cookie => {
            console.log(`  - ${cookie.name}: ${cookie.httpOnly ? 'HttpOnly' : 'Regular'}, ${cookie.secure ? 'Secure' : 'Not Secure'}, sameSite: ${cookie.sameSite || 'undefined'}`);
          });
        }
        
        // Show cookie expiration info
        const expiredCookies = cookies.filter(c => c.expires && c.expires < Date.now() / 1000);
        if (expiredCookies.length > 0) {
          console.log('⚠️  Expired cookies:', expiredCookies.map(c => c.name).join(', '));
        }
      }
    } else {
      console.error('❌ API Error:', response.status, response.statusText);
      const errorText = await response.text();
      console.error('Error details:', errorText);
    }
  } catch (error) {
    console.error('❌ Network Error:', error.message);
  }
};

// Run the test
testAPI();
