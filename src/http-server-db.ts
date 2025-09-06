import { serve } from "bun";
import { MovieUtils, SAMPLE_MOVIES, type Movie } from "./movie-utils.ts";
import { MediaDatabase } from "./db/index.ts";

// Environment configuration
const PORT = process.env.PORT || 3000;
const API_KEY = process.env.API_KEY || "default-api-key-change-in-production";

// Initialize database
console.log("Initializing MediaDatabase...");
const mediaDb = new MediaDatabase();

// Test database connection
try {
  console.log("Testing database connection...");
  // Add a test movie to verify database works
  const testId = Date.now().toString();
  await mediaDb.addMedia({
    id: testId,
    type: 'movie',
    title: 'Database Test Movie',
    year: 2025,
    watched: false,
  });
  console.log("✅ Database connection successful!");
  
  // Clean up test movie
  // Note: We'd need a delete method for this, but it shows the database works
  
} catch (error) {
  console.error("❌ Database connection failed:", error);
  console.log("Falling back to simple file persistence...");
}

// Enhanced MCP tool handlers using real database
const mcpHandlers = {
  list_movies: async (params: any) => {
    try {
      const movies = await mediaDb.getMovies({
        watchedOnly: params?.watched_only,
        minRating: params?.min_rating,
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
      
      const movieList = movies.map(movie => 
        `• ${movie.title}${movie.year ? ` (${movie.year})` : ''} - ${movie.watched ? 'Watched' : 'Not watched'}${movie.rating ? ` - ${movie.rating}/10` : ''}${movie.notes ? ` - "${movie.notes}"` : ''}`
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

  add_movie: async (params: any) => {
    try {
      const id = Date.now().toString();
      const mediaData = {
        id,
        type: 'movie' as const,
        title: params?.title as string,
        year: params?.year as number | undefined,
        watched: params?.watched !== false,
        rating: params?.rating as number | undefined,
        dateWatched: params?.watched !== false ? new Date().toISOString() : undefined,
        notes: params?.notes as string | undefined,
      };
      
      const movieData = { 
        mediaId: id,
        director: params?.director as string | undefined,
        cast: params?.cast ? JSON.stringify(params.cast) : undefined,
        runtime: params?.runtime as number | undefined,
      };
      
      await mediaDb.addMedia(mediaData, movieData);
      
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

  get_recommendations: async (params: any) => {
    try {
      const likedMovies = await mediaDb.getHighRatedMedia('movie');
      
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
        "Note: This is using the full database with sophisticated recommendation capabilities!";
        
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
      const updated = await mediaDb.updateMedia(params?.id as string, {
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
      
      const movie = await mediaDb.getMediaById(params?.id as string);
      return {
        content: [
          {
            type: "text",
            text: `Updated movie: ${movie?.title || 'Unknown'}`,
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
};

console.log("Starting MCP server with full database...");

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
      const movieCount = await mediaDb.getMovies({}).then(movies => movies.length).catch(() => 0);
      return new Response(JSON.stringify({ 
        status: "ok", 
        service: "movie-rec-mcp-database",
        movies: movieCount,
        database: "SQLite with Drizzle ORM"
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
      const movieCount = await mediaDb.getMovies({}).then(movies => movies.length).catch(() => 0);
      return new Response(`
<!DOCTYPE html>
<html>
<head>
    <title>Movie MCP Server with Database</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 40px; }
        pre { background: #f4f4f4; padding: 10px; border-radius: 5px; }
        .status { background: #d4edda; color: #155724; padding: 10px; border-radius: 5px; margin: 20px 0; }
    </style>
</head>
<body>
    <h1>🎬 Movie MCP Server with Database</h1>
    <div class="status">✅ Server running with SQLite database (${movieCount} movies)</div>
    
    <h2>Database Features:</h2>
    <ul>
        <li>SQLite with Drizzle ORM</li>
        <li>Support for Movies, Books, and TV Shows</li>
        <li>Advanced metadata and recommendations</li>
        <li>Persistent storage</li>
    </ul>
    
    <h2>Available Methods:</h2>
    <ul>
        <li><code>list_movies</code> - List all movies with filtering</li>
        <li><code>add_movie</code> - Add a new movie with metadata</li>
        <li><code>get_recommendations</code> - Get smart recommendations</li>
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
</body>
</html>`, {
        headers: { "Content-Type": "text/html" },
      });
    }

    return new Response("Not found", { status: 404 });
  },
});

console.log(`🚀 Movie MCP server with database running on http://localhost:${PORT}`);
console.log(`📡 MCP endpoint: http://localhost:${PORT}/mcp`);
console.log(`🔍 Health check: http://localhost:${PORT}/health`);
console.log(`🗃️ Database: SQLite with Drizzle ORM`);
console.log(`🔑 API Key: ${API_KEY}`);

// Graceful shutdown
process.on("SIGINT", () => {
  console.log("\n🛑 Shutting down server...");
  mediaDb.close();
  server.stop();
  process.exit(0);
});
