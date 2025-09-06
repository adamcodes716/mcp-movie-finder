#!/usr/bin/env bun

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { serve } from "bun";
import {
  CallToolRequestSchema,
  ListResourcesRequestSchema,
  ListToolsRequestSchema,
  ReadResourceRequestSchema,
  JSONRPCRequest,
  JSONRPCResponse,
} from "@modelcontextprotocol/sdk/types.js";
import { MovieDatabase } from "./src/db/index.js";
import { movieService } from "./src/movie-service.js";
import type { NewMovie } from "./src/db/schema.js";

// Initialize database
const movieDb = new MovieDatabase();

// Environment configuration
const PORT = process.env.PORT || 8000;
const API_KEY = process.env.API_KEY || "jacvz78t";

// Create MCP server
const mcpServer = new Server(
  {
    name: "movie-recommendation-server",
    version: "0.7.0",
  },
  {
    capabilities: {
      resources: {},
      tools: {},
    },
  }
);

// Setup all the handlers (copy from your main index.ts)
mcpServer.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "search_and_add_movie",
        description: "Search for a movie and add it to your collection with metadata auto-populated",
        inputSchema: {
          type: "object",
          properties: {
            title: {
              type: "string",
              description: "The title of the movie to search for",
            },
            year: {
              type: "number",
              description: "The year the movie was released (helps with accuracy)",
            },
            watched: {
              type: "boolean",
              description: "Whether you've watched the movie",
              default: false,
            },
            rating: {
              type: "number",
              description: "Your rating of the movie (1-10) - only if watched",
              minimum: 1,
              maximum: 10,
            },
            notes: {
              type: "string",
              description: "Your personal notes about the movie",
            },
            likedAspects: {
              type: "string",
              description: "What you liked about the movie (comma-separated)",
            },
            dislikedAspects: {
              type: "string",
              description: "What you didn't like about the movie (comma-separated)",
            },
            mood: {
              type: "string",
              description: "When/why you watched it or want to watch it",
            },
            recommendationContext: {
              type: "string",
              description: "Context for how this movie should influence recommendations",
            },
          },
          required: ["title"],
        },
      },
      {
        name: "add_movie_to_watchlist",
        description: "Add a movie to your watchlist (movies you want to watch)",
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
            notes: {
              type: "string",
              description: "Why you want to watch this movie or where you heard about it",
            },
            recommendationContext: {
              type: "string",
              description: "Why this was recommended (e.g., 'similar to movies I liked', 'recommended by Claude')",
            },
          },
          required: ["title"],
        },
      },
      {
        name: "list_movies",
        description: "List movies in your collection with various filters",
        inputSchema: {
          type: "object",
          properties: {
            watched_only: {
              type: "boolean",
              description: "Show only watched movies",
              default: false,
            },
            watchlist_only: {
              type: "boolean",
              description: "Show only movies in watchlist (not watched)",
              default: false,
            },
            min_rating: {
              type: "number",
              description: "Minimum rating filter",
              minimum: 1,
              maximum: 10,
            },
            genre: {
              type: "string",
              description: "Filter by genre",
            },
            director: {
              type: "string",
              description: "Filter by director",
            },
            year: {
              type: "number",
              description: "Filter by year",
            },
          },
        },
      },
      {
        name: "get_smart_recommendations",
        description: "Get intelligent movie recommendations based on your preferences and viewing history",
        inputSchema: {
          type: "object",
          properties: {
            mood: {
              type: "string",
              description: "What mood are you in? (e.g., 'action-packed', 'thoughtful', 'light-hearted')",
            },
            genre_preference: {
              type: "string",
              description: "Any specific genre you're interested in right now",
            },
            length_preference: {
              type: "string",
              enum: ["short", "medium", "long", "any"],
              description: "Preferred movie length",
              default: "any",
            },
            count: {
              type: "number",
              description: "Number of recommendations to return",
              default: 5,
              maximum: 20,
            },
          },
        },
      },
      {
        name: "mark_as_watched",
        description: "Mark a movie from your watchlist as watched and rate it",
        inputSchema: {
          type: "object",
          properties: {
            id: {
              type: "string",
              description: "The ID of the movie to mark as watched",
            },
            rating: {
              type: "number",
              description: "Your rating of the movie (1-10)",
              minimum: 1,
              maximum: 10,
            },
            likedAspects: {
              type: "string",
              description: "What you liked about the movie",
            },
            dislikedAspects: {
              type: "string",
              description: "What you didn't like about the movie",
            },
            notes: {
              type: "string",
              description: "Your thoughts about the movie",
            },
          },
          required: ["id"],
        },
      },
      {
        name: "analyze_preferences",
        description: "Analyze your movie preferences to understand your taste",
        inputSchema: {
          type: "object",
          properties: {},
        },
      },
    ],
  };
});

// Handle tool calls (simplified version - add the full implementation from your main server)
mcpServer.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  switch (name) {
    case "search_and_add_movie": {
      try {
        const existingMovie = await movieDb.findMovieByTitle(args.title as string, args.year as number);
        if (existingMovie) {
          return {
            content: [
              {
                type: "text",
                text: `Movie "${args.title}" already exists in your collection (ID: ${existingMovie.id})`,
              },
            ],
          };
        }

        const metadata = await movieService.enrichMovieData(args.title as string, args.year as number);
        
        const movie: NewMovie = {
          id: Date.now().toString(),
          title: args.title as string,
          year: args.year as number || metadata.year,
          watched: args.watched !== false,
          rating: args.rating as number | undefined,
          dateWatched: args.watched !== false ? new Date().toISOString() : undefined,
          notes: args.notes as string | undefined,
          likedAspects: args.likedAspects as string | undefined,
          dislikedAspects: args.dislikedAspects as string | undefined,
          mood: args.mood as string | undefined,
          recommendationContext: args.recommendationContext as string | undefined,
          ...metadata,
        };
        
        await movieDb.addMovie(movie);
        
        const statusText = movie.watched ? 'watched' : 'added to watchlist';
        const ratingText = movie.rating ? ` - Rating: ${movie.rating}/10` : '';
        const metadataText = metadata.director ? ` (Director: ${metadata.director})` : '';
        
        return {
          content: [
            {
              type: "text",
              text: `Successfully ${statusText}: ${movie.title}${movie.year ? ` (${movie.year})` : ''}${ratingText}${metadataText}`,
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
        let filters: any = {};
        
        if (args.watched_only) {
          filters.watchedOnly = true;
        } else if (args.watchlist_only) {
          filters.watchedOnly = false;
        }
        
        if (args.min_rating) filters.minRating = args.min_rating as number;
        if (args.genre) filters.genre = args.genre as string;
        if (args.director) filters.director = args.director as string;
        if (args.year) filters.year = args.year as number;
        
        const movies = await movieDb.getMovies(filters);
        
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

        const movieList = movies.map(m => {
          const status = m.watched ? 'Watched' : '📋 Watchlist';
          const rating = m.rating ? ` - ${m.rating}/10` : '';
          const director = m.director ? ` - Dir: ${m.director}` : '';
          const genres = m.genres ? ` [${JSON.parse(m.genres).slice(0, 2).join(', ')}]` : '';
          const notes = m.notes ? ` - "${m.notes}"` : '';
          
          return `• ${m.title}${m.year ? ` (${m.year})` : ''} - ${status}${rating}${director}${genres}${notes}`;
        }).join('\n');
        
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

    // Add other handlers as needed...
    default:
      return {
        content: [
          {
            type: "text",
            text: `Tool "${name}" not yet implemented in HTTP server`,
          },
        ],
      };
  }
});

// Add resource handlers
mcpServer.setRequestHandler(ListResourcesRequestSchema, async () => {
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

mcpServer.setRequestHandler(ReadResourceRequestSchema, async (request) => {
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

// HTTP server
const httpServer = serve({
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
      return new Response(JSON.stringify({ status: "ok", service: "movie-rec-mcp-http" }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    // MCP endpoint
    if (url.pathname === "/mcp" && request.method === "POST") {
      // Check API key
      const authHeader = request.headers.get("Authorization");
      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return new Response(JSON.stringify({
          error: { code: -32600, message: "Unauthorized" }
        }), { 
          status: 401,
          headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
        });
      }

      const token = authHeader.substring(7);
      if (token !== API_KEY) {
        return new Response(JSON.stringify({
          error: { code: -32600, message: "Invalid API key" }
        }), { 
          status: 403,
          headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
        });
      }

      try {
        // Parse JSON-RPC request
        const rpcRequest: JSONRPCRequest = await request.json();
        
        // Create a simple transport to handle the request
        const mockTransport = {
          start: () => Promise.resolve(),
          close: () => Promise.resolve(),
          send: (response: JSONRPCResponse) => {
            // We'll capture the response here
            return Promise.resolve();
          },
          onMessage: (handler: (message: JSONRPCRequest) => void) => {
            // Immediately handle the incoming request
            setTimeout(() => handler(rpcRequest), 0);
          },
          onClose: () => {},
          onError: () => {},
        };

        // Capture the response
        let capturedResponse: JSONRPCResponse | null = null;
        const originalSend = mockTransport.send;
        mockTransport.send = (response: JSONRPCResponse) => {
          capturedResponse = response;
          return Promise.resolve();
        };

        // Connect the server to our mock transport
        await mcpServer.connect(mockTransport);
        
        // Wait a bit for the response to be captured
        await new Promise(resolve => setTimeout(resolve, 100));
        
        if (capturedResponse) {
          return new Response(JSON.stringify(capturedResponse), {
            headers: {
              "Content-Type": "application/json",
              "Access-Control-Allow-Origin": "*",
            },
          });
        } else {
          throw new Error("No response received from MCP server");
        }
      } catch (error) {
        console.error("Error handling MCP request:", error);
        return new Response(JSON.stringify({
          error: { 
            code: -32603, 
            message: error instanceof Error ? error.message : "Internal error" 
          }
        }), {
          status: 500,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        });
      }
    }

    return new Response("Not found", { status: 404 });
  },
});

console.log(`Movie Recommendation MCP HTTP server running on http://localhost:${PORT}`);
console.log(`MCP endpoint: http://localhost:${PORT}/mcp`);
console.log(`Test with: npx mcp-remote http://localhost:${PORT}/mcp --header "Authorization:Bearer ${API_KEY}" --allow-http`);

// Graceful shutdown
process.on("SIGINT", () => {
  console.log("Shutting down...");
  movieDb.close();
  httpServer.stop();
  process.exit(0);
});