// Simple Node.js/Bun script to test MCP HTTP server health and endpoint (ESM version)
import http from 'http';

const API_KEY = '4321'; // Replace with your actual API_KEY
const PORT = 3002; // Change if using a different port
const HOST = 'localhost';

function checkHealth() {
  http.get({
    hostname: HOST,
    port: PORT,
    path: '/health',
    timeout: 3000,
  }, (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
      console.log('Health check status:', res.statusCode);
      console.log('Health check response:', data);
      testMcpEndpoint();
    });
  }).on('error', (e) => {
    console.error('Health check failed:', e.message);
  });
}

function testMcpEndpoint() {
  const tests = [
    {
      name: 'list_media (movies)',
      body: {
        jsonrpc: "2.0",
        method: "list_media",
        params: { type: "movie" },
        id: 1
      }
    },
    {
      name: 'add_movie_to_watchlist',
      body: {
        jsonrpc: "2.0",
        method: "add_movie_to_watchlist",
        params: { title: "The Matrix", notes: "Classic sci-fi to rewatch" },
        id: 2
      }
    },
    {
      name: 'get_smart_recommendations',
      body: {
        jsonrpc: "2.0",
        method: "get_smart_recommendations",
        params: { mood: "thoughtful", genre_preference: "sci-fi", count: 3 },
        id: 3
      }
    }
  ];

  function runTest(index) {
    if (index >= tests.length) return;
    const test = tests[index];
    const options = {
      hostname: HOST,
      port: PORT,
      path: '/mcp',
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json',
      },
    };
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        console.log(`Test: ${test.name}`);
        console.log('Status:', res.statusCode);
        console.log('Response:', data);
        runTest(index + 1);
      });
    });
    req.on('error', (e) => {
      console.error(`Test ${test.name} failed:`, e.message);
      runTest(index + 1);
    });
    req.write(JSON.stringify(test.body));
    req.end();
  }

  runTest(0);
}

checkHealth();
