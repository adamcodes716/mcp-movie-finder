import { serve } from "bun";
import { MovieUtils, SAMPLE_MOVIES, type Movie } from "./movie-utils.ts";
import { MovieStore } from "./movie-store.ts";

// Environment configuration
const PORT = process.env.PORT || 3000;
const API_KEY = process.env.API_KEY || "default-api-key-change-in-production";

// Initialize movie store with sample data and persistence
const movieStore = new MovieStore(SAMPLE_MOVIES, true);

// Initialize persistence asynchronously
console.log("Initializing movie store with persistence...");
await movieStore.initialize();
console.log("Movie store initialized successfully!");

// Simple MCP tool handlers
const mcpHandlers = {
  list_movies: async (params: any) => {
    const movies = movieStore.getMovies({
      watchedOnly: params?.watched_only,
      minRating: params?.min_rating
    });
    
    return {
      content: [
        {
          type: "text",
          text: movies.map(movie => MovieUtils.formatMovie(movie)).join('\n')
        }
      ]
    };
  },

  add_movie: async (params: any) => {
    const newMovie = MovieUtils.createMovie(
      params?.title || "Unknown Movie",
      params?.year || new Date().getFullYear(),
      params?.watched !== false,
      params?.rating || null
    );
    await movieStore.addMovie(newMovie);
    
    return {
      content: [
        {
          type: "text",
          text: `Added movie: ${newMovie.title} (${newMovie.year})`
        }
      ]
    };
  },

  get_recommendations: async (params: any) => {
    const allMovies = movieStore.getMovies();
    return {
      content: [
        {
          type: "text",
          text: MovieUtils.getRecommendations(allMovies)
        }
      ]
    };
  },

  update_movie: async (params: any) => {
    const movieId = params?.id;
    const updatedMovie = await movieStore.updateMovie(movieId, {
      rating: params?.rating,
      watched: params?.watched
    });
    
    if (!updatedMovie) {
      return {
        content: [
          {
            type: "text",
            text: `Movie with ID ${movieId} not found.`
          }
        ]
      };
    }

    return {
      content: [
        {
          type: "text",
          text: `Updated movie: ${updatedMovie.title}`
        }
      ]
    };
  }
};

console.log("Starting simple HTTP MCP server...");

const server = serve({
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

    // Health check
    if (url.pathname === "/health") {
      return new Response(JSON.stringify({ 
        status: "ok", 
        service: "movie-rec-mcp-simple",
        movies: movieStore.getCount() 
      }), {
        headers: { 
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*"
        },
      });
    }

    // MCP endpoint
    if (url.pathname === "/mcp" && request.method === "POST") {
      // Check API key
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
        console.log("[MCP] Received:", body.method, body.params);

        let result;
        
        // Handle MCP method calls
        if (body.method === "list_media" || body.method === "list_movies") {
          result = await mcpHandlers.list_movies(body.params || {});
        } else if (body.method === "add_movie_to_watchlist" || body.method === "add_movie") {
          result = await mcpHandlers.add_movie(body.params || {});
        } else if (body.method === "get_smart_recommendations" || body.method === "get_recommendations") {
          result = await mcpHandlers.get_recommendations(body.params || {});
        } else if (body.method === "update_movie" || body.method === "mark_as_watched") {
          result = await mcpHandlers.update_movie(body.params || {});
        } else {
          result = { 
            content: [{ 
              type: "text", 
              text: `Unknown method: ${body.method}. Available: list_movies, add_movie, get_recommendations, update_movie` 
            }] 
          };
        }

        return new Response(JSON.stringify({
          jsonrpc: "2.0",
          result,
          id: body.id || 1
        }), {
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        });

      } catch (err) {
        console.error("[MCP] Error:", err);
        return new Response(JSON.stringify({ 
          jsonrpc: "2.0",
          error: { code: -32603, message: "Internal error", data: String(err) },
          id: null
        }), {
          status: 500,
          headers: { 
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*"
          },
        });
      }
    }

    // Info page
    if (url.pathname === "/" && request.method === "GET") {
      return new Response(`
<!DOCTYPE html>
<html>
<head>
    <title>Simple Movie MCP Server</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 40px; }
        pre { background: #f4f4f4; padding: 10px; border-radius: 5px; }
        .status { background: #d4edda; color: #155724; padding: 10px; border-radius: 5px; margin: 20px 0; }
    </style>
</head>
<body>
    <h1>🎬 Simple Movie MCP Server</h1>
    <div class="status">✅ Server is running with ${movieStore.getCount()} movies</div>
    
    <h2>Available Methods:</h2>
    <ul>
        <li><code>list_movies</code> - List all movies</li>
        <li><code>add_movie</code> - Add a new movie</li>
        <li><code>get_recommendations</code> - Get movie recommendations</li>
        <li><code>update_movie</code> - Update an existing movie</li>
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

    <h2>Current Movie Data:</h2>
    <pre>${JSON.stringify(movieStore.exportData(), null, 2)}</pre>
</body>
</html>`, {
        headers: { "Content-Type": "text/html" },
      });
    }

    return new Response("Not found", { status: 404 });
  },
});

console.log(`🚀 Simple Movie MCP server running on http://localhost:${PORT}`);
console.log(`📡 MCP endpoint: http://localhost:${PORT}/mcp`);
console.log(`🔍 Health check: http://localhost:${PORT}/health`);
console.log(`🔑 API Key: ${API_KEY}`);

// Graceful shutdown
process.on("SIGINT", () => {
  console.log("\n🛑 Shutting down server...");
  server.stop();
  process.exit(0);
});
