#!/usr/bin/env bun

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
import { MovieDatabase } from "./db/index.js";
import type { NewMovie } from "./db/schema.js";
import { SSEServerTransport } from "./sse-transport.js";

// Initialize database
const movieDb = new MovieDatabase();

// Environment configuration
const PORT = process.env.PORT || 3000;
const API_KEY = process.env.API_KEY || "default-api-key-change-in-production";

// Create MCP server factory
function createMCPServer() {
  const server = new Server(
    {
      name: "movie-recommendation-server",
      version: "0.4.0",
    },
    {
      capabilities: {
        resources: {},
        tools: {},
      },
    }
  );

  // List available tools
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: [
        {
          name: "add_movie",
          description: "Add a new movie to your watch history",
          inputSchema: {
            type: "object",
            properties: {
              title: {
                type: "string",
                description: "The title of the movie",
              },
              year: {
                type: "number",
                description: "The year the movie was released",
              },
              watched: {
                type: "boolean",
                description: "Whether you've watched the movie",
                default: true,
              },
              rating: {
                type: "number",
                description: "Your rating of the movie (1-10)",
                minimum: 1,
                maximum: 10,
              },
              notes: {
                type: "string",
                description: "Any notes about the movie",
              },
            },
            required: ["title"],
          },
        },
        {
          name: "list_movies",
          description: "List all movies in your collection",
          inputSchema: {
            type: "object",
            properties: {
              watched_only: {
                type: "boolean",
                description: "Show only watched movies",
                default: false,
              },
              min_rating: {
                type: "number",
                description: "Minimum rating filter",
                minimum: 1,
                maximum: 10,
              },
            },
          },
        },
        {
          name: "get_recommendations",
          description: "Get movie recommendations based on your preferences",
          inputSchema: {
            type: "object",
            properties: {
              count: {
                type: "number",
                description: "Number of recommendations to return",
                default: 5,
              },
            },
          },
        },
        {
          name: "update_movie",
          description: "Update an existing movie entry",
          inputSchema: {
            type: "object",
            properties: {
              id: {
                type: "string",
                description: "The ID of the movie to update",
              },
              rating: {
                type: "number",
                description: "New rating (1-10)",
                minimum: 1,
                maximum: 10,
              },
              watched: {
                type: "boolean",
                description: "Update watched status",
              },
              notes: {
                type: "string",
                description: "Update notes",
              },
            },
            required: ["id"],
          },
        },
      ],
    };
  });

  // Handle tool calls
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    switch (name) {
      case "add_movie": {
        const movie: NewMovie = {
          id: Date.now().toString(),
          title: args.title as string,
          year: args.year as number | undefined,
          watched: args.watched !== false,
          rating: args.rating as number | undefined,
          dateWatched: args.watched !== false ? new Date().toISOString() : undefined,
          notes: args.notes as string | undefined,
        };
        
        try {
          await movieDb.addMovie(movie);
          return {
            content: [
              {
                type: "text",
                text: `Added movie: ${movie.title}${movie.year ? ` (${movie.year})` : ''}${movie.rating ? ` - Rating: ${movie.rating}/10` : ''}`,
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
      }

      case "list_movies": {
        try {
          const movies = await movieDb.getMovies({
            watchedOnly: args.watched_only as boolean,
            minRating: args.min_rating as number,
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
            `• ${m.title}${m.year ? ` (${m.year})` : ''} - ${m.watched ? 'Watched' : 'Not watched'}${m.rating ? ` - ${m.rating}/10` : ''}${m.notes ? ` - "${m.notes}"` : ''}`
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
      }

      case "get_recommendations": {
        try {
          const likedMovies = await movieDb.getHighRatedMovies();
          
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
          
          const recommendations = `Based on your preferences (you enjoyed ${likedMovies.slice(0, 3).map(m => m.title).join(', ')}), here are some recommendations:\n\n` +
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
      }

      case "update_movie": {
        try {
          const updated = await movieDb.updateMovie(args.id as string, {
            rating: args.rating as number | undefined,
            watched: args.watched as boolean | undefined,
            notes: args.notes as string | undefined,
          });
          
          if (!updated) {
            return {
              content: [
                {
                  type: "text",
                  text: `Movie with ID ${args.id} not found.`,
                },
              ],
            };
          }
          
          const movie = await movieDb.getMovie(args.id as string);
          return {
            content: [
              {
                type: "text",
                text: `Updated movie: ${movie?.title}`,
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
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  });

  // List resources
  server.setRequestHandler(ListResourcesRequestSchema, async () => {
    return {
      resources: [
        {
          uri: "movie-db://collection",
          name: "Movie Collection",
          description: "Your personal movie collection and ratings",
          mimeType: "application/json",
        },
      ],
    };
  });

  // Read resources
  server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
    const { uri } = request.params;
    
    if (uri === "movie-db://collection") {
      try {
        const movies = await movieDb.getAllMovies();
        return {
          contents: [
            {
              uri,
              mimeType: "application/json",
              text: JSON.stringify({ movies }, null, 2),
            },
          ],
        };
      } catch (error) {
        throw new Error(`Error reading collection: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }
    
    throw new Error(`Resource not found: ${uri}`);
  });

  return server;
}

// Create HTTP server
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

      // Create a new MCP server instance for this connection
      const mcpServer = createMCPServer();

      // Create SSE response
      const stream = new WritableStream({
        async write(chunk) {
          // This will be used by SSEServerTransport
        },
      });

      const writer = stream.getWriter();
      const transport = new SSEServerTransport(request, writer);

      // Connect the MCP server to the transport
      await mcpServer.connect(transport);
      await transport.start();

      return new Response(stream, {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          "Connection": "keep-alive",
          "Access-Control-Allow-Origin": "*",
        },
      });
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