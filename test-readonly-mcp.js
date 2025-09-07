// Test script for the simplified read-only MCP server
const API_KEY = process.env.API_KEY || "4321";
const BASE_URL = "http://localhost:3002";

async function testEndpoint(method, params = {}, id = 1) {
  console.log(`\nTest: ${method}`);
  
  try {
    const response = await fetch(`${BASE_URL}/mcp`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${API_KEY}`
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        method: method,
        params: params,
        id: id
      })
    });
    
    const result = await response.json();
    console.log(`Status: ${response.status}`);
    console.log(`Response:`, JSON.stringify(result, null, 2));
    
    return result;
  } catch (error) {
    console.error(`Error testing ${method}:`, error);
  }
}

async function runTests() {
  console.log("🧪 Testing Read-Only Movie MCP Server");
  console.log("=====================================");
  
  // Test health check
  console.log("\n🔍 Health Check");
  try {
    const healthResponse = await fetch(`${BASE_URL}/health`);
    console.log(`Health check status: ${healthResponse.status}`);
    console.log(`Health check response: ${await healthResponse.text()}`);
  } catch (error) {
    console.error("Health check failed:", error);
    return;
  }
  
  // Test available methods
  await testEndpoint("list_movies", {});
  
  await testEndpoint("list_movies", { 
    watched_only: true 
  }, 2);
  
  await testEndpoint("list_movies", { 
    genre: "sci-fi" 
  }, 3);
  
  await testEndpoint("get_recommendations", {}, 4);
  
  // Test unknown method (should fail gracefully)
  await testEndpoint("unknown_method", {}, 5);
}

runTests().catch(console.error);
