
console.log("STARTING MCP SERVER");
try {

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { 
  serve,
  type Server as BunServer 
} from "bun";
import {
  CallToolRequestSchema,
  ListResourcesRequestSchema,
  ListToolsRequestSchema,
  ReadResourceRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { MediaDatabase } from "./db/index.ts";
import type { NewMovie } from "./db/schema.js";
import { SSEServerTransport } from "./sse-transport.js";

// Initialize database
const movieDb = new MediaDatabase();

// Environment configuration
const PORT = process.env.PORT || 3000;
const API_KEY = process.env.API_KEY || "default-api-key-change-in-production";

// Create MCP server factory
function createMCPServer() {
  // --- MCP tool handlers exposed for HTTP dispatcher ---
  return {
    add_movie: async (params: any) => {
      try {
        const id = Date.now().toString();
        const mediaData = {
          id,
          type: 'movie' as 'movie',
          title: params?.title as string,
          year: params?.year as number | undefined,
          watched: params?.watched !== false,
          rating: params?.rating as number | undefined,
          dateWatched: params?.watched !== false ? new Date().toISOString() : undefined,
          notes: params?.notes as string | undefined,
        };
        const movieData = { mediaId: id };
        await movieDb.addMedia(mediaData, movieData);
        return {
          content: [
            {
              type: "text",
              text: `Added movie: ${mediaData.title}`,
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error adding movie: ${error instanceof Error ? error.message : 'Unknown error'}`,
            },
          ],
        };
      }
    },
    list_movies: async (params: any) => {
      try {
        const movies = await movieDb.getMovies({
          watchedOnly: params?.watched_only as boolean,
          minRating: params?.min_rating as number,
        });
        if (movies.length === 0) {
          return {
            content: [
              {
                type: "text",
                text: "No movies found matching your criteria.",
              },
            ],
          };
        }
        const movieList = movies.map(m => 
          `• ${m.title}${m.year ? ` (${m.year})` : ''} - ${m.watched ? 'Watched' : 'Not watched'}${m.rating ? ` - ${m.rating}/10` : ''}${m.notes ? ` - \"${m.notes}\"` : ''}`
        ).join('\n');
        return {
          content: [
            {
              type: "text",
              text: movieList,
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error listing movies: ${error instanceof Error ? error.message : 'Unknown error'}`,
            },
          ],
        };
      }
    },
    get_recommendations: async (params: any) => {
      try {
        const likedMovies = await movieDb.getHighRatedMedia('movie');
        if (likedMovies.length === 0) {
          return {
            content: [
              {
                type: "text",
                text: "No recommendations available yet. Add and rate some movies you've watched first!",
              },
            ],
          };
        }
        const recommendations = `Based on your preferences (you enjoyed ${likedMovies.slice(0, 3).map((m: any) => m.title).join(', ')}), here are some recommendations:\n\n` +
          "1. Consider similar genres and directors\n" +
          "2. Look for movies from the same time period\n" +
          "3. Check out sequels or related films\n\n" +
          "Note: This is a basic recommendation system. Future updates will include better recommendation algorithms!";
        return {
          content: [
            {
              type: "text",
              text: recommendations,
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error getting recommendations: ${error instanceof Error ? error.message : 'Unknown error'}`,
            },
          ],
        };
      }
    },
    update_movie: async (params: any) => {
      try {
        const updated = await movieDb.updateMedia(params?.id as string, {
          rating: params?.rating as number | undefined,
          watched: params?.watched as boolean | undefined,
          notes: params?.notes as string | undefined,
        });
        if (!updated) {
          return {
            content: [
              {
                type: "text",
                text: `Movie with ID ${params?.id} not found.`,
              },
            ],
          };
        }
        const movie = await movieDb.getMediaById(params?.id as string);
        return {
          content: [
            {
              type: "text",
              text: `Updated movie: ${movie && movie.title}`,
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error updating movie: ${error instanceof Error ? error.message : 'Unknown error'}`,
            },
          ],
        };
      }
    },
  };

console.log("About to start Bun HTTP server");
const httpServer: BunServer = serve({
  port: PORT,
  async fetch(request) {
    const url = new URL(request.url);

    // CORS preflight
    if (request.method === "OPTIONS") {
      return new Response(null, {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, Authorization",
          "Access-Control-Max-Age": "86400",
        },
      });
    }

    // Health check endpoint
    if (url.pathname === "/health") {
      return new Response(JSON.stringify({ status: "ok", service: "movie-rec-mcp" }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    // Authentication page for Claude Desktop
    if (url.pathname === "/auth" && request.method === "GET") {
      return new Response(
        `<!DOCTYPE html>
<html>
<head>
    <title>Movie Recommendation MCP - Authentication</title>
    <style>
        body { 
            font-family: Arial, sans-serif; 
            max-width: 400px; 
            margin: 100px auto; 
            padding: 20px;
            background: #f5f5f5;
        }
        .auth-box {
            background: white;
            padding: 30px;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        input[type="password"] {
            width: 100%;
            padding: 12px;
            margin: 10px 0 20px 0;
            border: 1px solid #ddd;
            border-radius: 4px;
            box-sizing: border-box;
        }
        button {
            background: #007cba;
            color: white;
            padding: 12px 30px;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            width: 100%;
        }
        button:hover { background: #005a87; }
        .error { color: red; margin-top: 10px; }
    </style>
</head>
<body>
    <div class="auth-box">
        <h2>🎬 Movie Recommendation MCP</h2>
        <p>Enter your API key to connect:</p>
        <form onsubmit="authenticate(event)">
            <input type="password" id="apikey" placeholder="API Key" required>
            <button type="submit">Connect</button>
        </form>
        <div id="error" class="error"></div>
    </div>
    
    <script>
        function authenticate(event) {
            event.preventDefault();
            const apikey = document.getElementById('apikey').value;
            
            // Redirect to MCP endpoint with token
            const mcpUrl = '/mcp?token=' + encodeURIComponent(apikey);
            
            // For Claude Desktop, we need to signal successful auth
            // This creates a postMessage to parent window (Claude Desktop)
            if (window.parent !== window) {
                window.parent.postMessage({
                    type: 'mcp_auth_success',
                    endpoint: mcpUrl
                }, '*');
            } else {
                // Fallback - redirect directly
                window.location.href = mcpUrl;
            }
        }
    </script>
</body>
</html>`,
        {
          headers: { "Content-Type": "text/html" },
        }
      );
    }

    // Handle auth POST
    if (url.pathname === "/auth" && request.method === "POST") {
      const formData = await request.formData();
      const apikey = formData.get("apikey");
      
      if (apikey === API_KEY) {
        // Redirect to MCP endpoint with valid token
        return Response.redirect(`/mcp?token=${apikey}`, 302);
      } else {
        return new Response("Invalid API key", { status: 401 });
      }
    }

    // SSE endpoint for MCP
    if (url.pathname === "/mcp" && request.method === "POST") {
      // Check API key via Authorization header (for mcp-remote proxy)
      const authHeader = request.headers.get("Authorization");
      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return new Response("Unauthorized", { status: 401 });
      }

      const token = authHeader.substring(7);
      if (token !== API_KEY) {
        return new Response("Invalid API key", { status: 403 });
      }

      try {
        const body: any = await request.json();
        console.log("[MCP DEBUG] Incoming body:", body);
        const mcp = createMCPServer();
        let result;
        try {
          if (body.method === "list_media") {
            result = await mcp.list_movies(body.params || {});
          } else if (body.method === "add_movie_to_watchlist") {
            result = await mcp.add_movie({
              ...body.params,
              watched: false
            });
          } else if (body.method === "get_smart_recommendations") {
            result = await mcp.get_recommendations(body.params || {});
          } else if (body.method === "update_movie") {
            result = await mcp.update_movie(body.params || {});
          } else if (body.method === "mark_as_watched") {
            result = await mcp.update_movie({
              ...body.params,
              watched: true
            });
          } else if (body.method === "analyze_preferences") {
            result = { content: [{ type: "text", text: "Preference analysis not implemented." }] };
          } else {
            result = { error: "Unknown method" };
          }
        } catch (handlerErr) {
          console.error("[MCP DEBUG] Handler error:", handlerErr);
          result = { error: String(handlerErr) };
        }
        return new Response(JSON.stringify({
          jsonrpc: "2.0",
          result,
          id: body && (body.id ?? 1)
        }), {
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        });
      } catch (err) {
        console.error("[MCP DEBUG] Top-level error:", err);
        return new Response(JSON.stringify({ error: "Invalid JSON or server error" }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }
    }

    // Client test page
    if (url.pathname === "/" && request.method === "GET") {
      return new Response(
        `<!DOCTYPE html>
<html>
<head>
    <title>Movie Recommendation MCP Server</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 40px; }
        .container { max-width: 800px; margin: 0 auto; }
        pre { background: #f4f4f4; padding: 10px; border-radius: 5px; }
        .status { margin: 20px 0; padding: 10px; border-radius: 5px; }
        .status.connected { background: #d4edda; color: #155724; }
        .status.disconnected { background: #f8d7da; color: #721c24; }
    </style>
</head>
<body>
    <div class="container">
        <h1>Movie Recommendation MCP Server</h1>
        <div class="status disconnected" id="status">Disconnected</div>
        
        <h2>API Information</h2>
        <p>This is a Model Context Protocol (MCP) server that provides movie tracking and recommendation tools.</p>
        
        <h3>Available Tools:</h3>
        <ul>
            <li><strong>add_movie</strong> - Add a new movie to your watch history</li>
            <li><strong>list_movies</strong> - List all movies in your collection</li>
            <li><strong>update_movie</strong> - Update an existing movie entry</li>
            <li><strong>get_recommendations</strong> - Get movie recommendations based on your preferences</li>
        </ul>
        
        <h3>Connection Details:</h3>
        <pre>
Endpoint: ${url.protocol}//${url.host}/mcp
Method: POST
Headers:
  - Content-Type: text/event-stream
  - Authorization: Bearer YOUR_API_KEY
        </pre>
        
        <h3>Environment Variables:</h3>
        <ul>
            <li><code>PORT</code> - Server port (default: 3000)</li>
            <li><code>API_KEY</code> - Authentication key for the MCP endpoint</li>
        </ul>
    </div>
</body>
</html>`,
        {
          headers: { "Content-Type": "text/html" },
        }
      );
    }

    return new Response("Not found", { status: 404 });
  },
});

console.log(`Movie Recommendation MCP server (HTTP/SSE) running on http://localhost:${PORT}`);
console.log(`API endpoint: http://localhost:${PORT}/mcp`);
console.log(`Health check: http://localhost:${PORT}/health`);

// Graceful shutdown
process.on("SIGINT", () => {
  httpServer.stop();
  movieDb.close();
  process.exit(0);
});
} catch (err) {
  console.error("FATAL ERROR DURING SERVER STARTUP:", err);
}
}