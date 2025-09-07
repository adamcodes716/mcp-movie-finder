import { serve } from "bun";
import { createMovieDatabase, type DatabaseAdapter } from './simple-movie-db.js';

// Environment configuration
const PORT = process.env.PORT || 3000;
const API_KEY = process.env.API_KEY || "default-api-key-change-in-production";
const DATABASE_TYPE = process.env.DATABASE_TYPE || 'sqlite';

// Initialize database adapter
console.log("Initializing database adapter...");
let dbAdapter: DatabaseAdapter;

async function initializeServer() {
  dbAdapter = await createMovieDatabase();
  await dbAdapter.initialize();
  
  console.log(`🚀 Read-only Movie MCP server running on http://localhost:${PORT}`);
  console.log(`📡 MCP endpoint: http://localhost:${PORT}/mcp`);
  console.log(`🔍 Health check: http://localhost:${PORT}/health`);
  console.log(`🗃️ Database: ${DATABASE_TYPE === 'mysql' ? 'MySQL Network' : 'SQLite Local'} (DATABASE_TYPE=${DATABASE_TYPE})`);
  console.log(`🔑 API Key: ${API_KEY}`);
  console.log(`🔒 Read-only mode: Query existing movie reviews`);
}

// Start initialization
initializeServer().catch(console.error);

// Simple MCP tool handlers (read-only)
const mcpHandlers = {
  list_movies: async (params: any) => {
    try {
      const movies = await dbAdapter.getMovies({
        watchedOnly: params?.watched_only,
        minRating: params?.min_rating,
        genre: params?.genre,
        year: params?.year
      });
      
      return {
        content: [
          {
            type: "text",
            text: `Found ${movies.length} movies:\n\n` +
              movies.map((movie, index) => 
                `${index + 1}. ${movie.title} (${movie.year || 'Unknown'})` +
                (movie.director ? ` - Dir: ${movie.director}` : '') +
                (movie.rating ? ` - Rating: ${movie.rating}/10` : '') +
                (movie.watched ? ' ✅' : ' 📋')
              ).join('\n')
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Failed to list movies: ${error}`,
          },
        ],
      };
    }
  },

  get_recommendations: async (params: any) => {
    try {
      const recommendations = await dbAdapter.getRecommendations();
      
      if (recommendations.length === 0) {
        return {
          content: [
            {
              type: "text",
              text: "No recommendations available yet. Add and rate some movies you've watched first!",
            },
          ],
        };
      }
      
      const dbTypeText = DATABASE_TYPE === 'mysql' ? 'your network MySQL database' : 'local SQLite database';
      const unwatchedCount = recommendations.filter(m => !m.watched).length;
      
      let recommendationText;
      if (unwatchedCount > 0) {
        recommendationText = `🎬 Movie recommendations based on your preferences from ${dbTypeText}:\n\n` +
          recommendations.map((movie, index) => 
            `${index + 1}. ${movie.title} (${movie.year || 'Unknown'}) - Rating: ${movie.rating || 'N/A'}/10` +
            (movie.watched ? ' [REWATCH]' : ' [NEW]')
          ).join('\n') + 
          `\n\nFound ${unwatchedCount} unwatched movies that match your taste!`;
      } else {
        recommendationText = `Based on your highly rated movies from ${dbTypeText}:\n\n` +
          recommendations.map((movie, index) => 
            `${index + 1}. ${movie.title} (${movie.year || 'Unknown'}) - Rating: ${movie.rating || 'N/A'}/10 [REWATCH]`
          ).join('\n') + 
          "\n\nThese are movies you've rated highly - consider rewatching!";
      }
        
      return {
        content: [
          {
            type: "text",
            text: recommendationText,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Failed to get recommendations: ${error}`,
          },
        ],
      };
    }
  },
};

const server = serve({
  port: PORT,
  async fetch(request) {
    const url = new URL(request.url);

    // CORS headers
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    };

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    // Health check
    if (url.pathname === "/health" && request.method === "GET") {
      return new Response("OK", { 
        headers: { "Content-Type": "text/plain", ...corsHeaders } 
      });
    }

    // MCP endpoint
    if (url.pathname === "/mcp" && request.method === "POST") {
      try {
        const authHeader = request.headers.get("Authorization");
        if (!authHeader || !authHeader.startsWith("Bearer ")) {
          return new Response("Unauthorized", { 
            status: 401, 
            headers: corsHeaders 
          });
        }

        const token = authHeader.substring(7);
        if (token !== API_KEY) {
          return new Response("Invalid API key", { 
            status: 401, 
            headers: corsHeaders 
          });
        }

        const body = await request.json() as any;
        let result;

        if (body.method === "list_movies") {
          result = await mcpHandlers.list_movies(body.params || {});
        } else if (body.method === "get_recommendations") {
          result = await mcpHandlers.get_recommendations(body.params || {});
        } else {
          result = {
            jsonrpc: "2.0",
            error: { 
              code: -32601, 
              message: "Method not found",
              data: { 
                text: `Unknown method: ${body.method}. Available: list_movies, get_recommendations` 
              }
            },
            id: body.id || 1
          };
        }

        return new Response(JSON.stringify(result), {
          headers: { "Content-Type": "application/json", ...corsHeaders },
        });
      } catch (error) {
        return new Response(
          JSON.stringify({
            jsonrpc: "2.0",
            error: { code: -32603, message: `Internal error: ${error}` },
            id: null
          }), 
          {
            status: 500,
            headers: { "Content-Type": "application/json", ...corsHeaders },
          }
        );
      }
    }

    // Info page
    if (url.pathname === "/" && request.method === "GET") {
      const movieCount = await dbAdapter.getMovies({}).then(movies => movies.length).catch(() => 0);
      const dbTypeDisplay = DATABASE_TYPE === 'mysql' ? 'MySQL Network Database' : 'SQLite Local Database';
      
      return new Response(`
<!DOCTYPE html>
<html>
<head>
    <title>Read-Only Movie MCP Server</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 40px; }
        pre { background: #f4f4f4; padding: 10px; border-radius: 5px; }
        .status { background: #d4edda; color: #155724; padding: 10px; border-radius: 5px; margin: 20px 0; }
        .db-info { background: #e7f3ff; color: #004085; padding: 10px; border-radius: 5px; margin: 10px 0; }
        .readonly { background: #fff3cd; color: #856404; padding: 10px; border-radius: 5px; margin: 10px 0; }
    </style>
</head>
<body>
    <h1>🎬 Read-Only Movie MCP Server</h1>
    <div class="status">✅ Server running with ${movieCount} movies</div>
    <div class="db-info">📊 Using: ${dbTypeDisplay} (DATABASE_TYPE=${DATABASE_TYPE})</div>
    <div class="readonly">🔒 Read-only mode: Query your existing movie reviews</div>
    
    <h2>Database Features:</h2>
    <ul>
        <li>🔄 Hybrid mode: Switch between SQLite local and MySQL network</li>
        <li>🗃️ Current: ${dbTypeDisplay}</li>
        <li>📖 Read-only: Query existing movies, no modifications</li>
        <li>⚙️ Configure via DATABASE_TYPE environment variable</li>
    </ul>
    
    <h2>Available Methods:</h2>
    <ul>
        <li><code>list_movies</code> - List all movies with filtering</li>
        <li><code>get_recommendations</code> - Get highly rated movies</li>
    </ul>
    
    <h2>Test Endpoint:</h2>
    <pre>POST ${url.protocol}//${url.host}/mcp
Authorization: Bearer ${API_KEY}
Content-Type: application/json

{
  "jsonrpc": "2.0",
  "method": "list_movies",
  "params": {},
  "id": 1
}</pre>
    
    <h2>Switch Database:</h2>
    <p>To use your network MySQL database:</p>
    <pre>DATABASE_TYPE=mysql</pre>
    <p>To use local SQLite database:</p>
    <pre>DATABASE_TYPE=sqlite</pre>
</body>
</html>`, {
        headers: { "Content-Type": "text/html" },
      });
    }

    return new Response("Not found", { status: 404 });
  },
});

// Graceful shutdown
process.on("SIGINT", async () => {
  console.log("\n🛑 Shutting down server...");
  if (dbAdapter && 'close' in dbAdapter) {
    await (dbAdapter as any).close();
  }
  server.stop();
  process.exit(0);
});
