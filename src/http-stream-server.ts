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
import { movieService } from "./movie-service.js";
import type { NewMovie } from "./db/schema.js";

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
      version: "0.6.0",
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

  // Add all the tool handlers from the main server
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
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

      // Add other tool handlers here (copy from main server)...
      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  });

  return server;
}

// Simple HTTP Stream transport
class SimpleStreamTransport {
  private messageHandler?: (message: any) => Promise<any>;

  constructor(private request: Request) {}

  onMessage(handler: (message: any) => Promise<any>) {
    this.messageHandler = handler;
  }

  async handleRequest(): Promise<Response> {
    if (!this.messageHandler) {
      throw new Error("No message handler set");
    }

    try {
      const message = await this.request.json();
      const response = await this.messageHandler(message);
      
      return new Response(JSON.stringify(response), {
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      });
    } catch (error) {
      return new Response(JSON.stringify({
        error: {
          code: -1,
          message: error instanceof Error ? error.message : "Unknown error"
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

    // MCP endpoint
    if (url.pathname === "/mcp" && request.method === "POST") {
      // Check API key via Authorization header
      const authHeader = request.headers.get("Authorization");
      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return new Response("Unauthorized", { status: 401 });
      }

      const token = authHeader.substring(7);
      if (token !== API_KEY) {
        return new Response("Invalid API key", { status: 403 });
      }

      // Create a new MCP server instance and handle the request
      const mcpServer = createMCPServer();
      const transport = new SimpleStreamTransport(request);
      
      // Handle MCP requests directly
      transport.onMessage(async (message) => {
        return await mcpServer.handleRequest(message);
      });

      return transport.handleRequest();
    }

    return new Response("Not found", { status: 404 });
  },
});

console.log(`Movie Recommendation MCP server (HTTP Stream) running on http://localhost:${PORT}`);
console.log(`MCP endpoint: http://localhost:${PORT}/mcp`);

// Graceful shutdown
process.on("SIGINT", () => {
  httpServer.stop();
  movieDb.close();
  process.exit(0);
});