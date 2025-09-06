#!/usr/bin/env bun

import { serve } from "bun";
import { MovieDatabase } from "./src/db/index.js";
import { movieService } from "./src/movie-service.js";
import type { NewMovie } from "./src/db/schema.js";

// Initialize database
const movieDb = new MovieDatabase();

// Environment configuration
const PORT = process.env.PORT || 8000;
const API_KEY = process.env.API_KEY || "jacvz78t";

// JSON-RPC handler
async function handleMCPRequest(request: any): Promise<any> {
  const { method, params, id } = request;

  try {
    switch (method) {
      case "initialize":
        return {
          jsonrpc: "2.0",
          id,
          result: {
            protocolVersion: "2024-11-05",
            capabilities: {
              tools: {},
              resources: {},
            },
            serverInfo: {
              name: "movie-recommendation-server",
              version: "0.8.0",
            },
          },
        };

      case "tools/list":
        return {
          jsonrpc: "2.0",
          id,
          result: {
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
                name: "analyze_preferences",
                description: "Analyze your movie preferences to understand your taste",
                inputSchema: {
                  type: "object",
                  properties: {},
                },
              },
            ],
          },
        };

      case "tools/call":
        const { name: toolName, arguments: args } = params;
        
        switch (toolName) {
          case "search_and_add_movie": {
            const existingMovie = await movieDb.findMovieByTitle(args.title, args.year);
            if (existingMovie) {
              return {
                jsonrpc: "2.0",
                id,
                result: {
                  content: [
                    {
                      type: "text",
                      text: `Movie "${args.title}" already exists in your collection (ID: ${existingMovie.id})`,
                    },
                  ],
                },
              };
            }

            const metadata = await movieService.enrichMovieData(args.title, args.year);
            
            const movie: NewMovie = {
              id: Date.now().toString(),
              title: args.title,
              year: args.year || metadata.year,
              watched: args.watched !== false,
              rating: args.rating,
              dateWatched: args.watched !== false ? new Date().toISOString() : undefined,
              notes: args.notes,
              likedAspects: args.likedAspects,
              dislikedAspects: args.dislikedAspects,
              mood: args.mood,
              recommendationContext: args.recommendationContext,
              ...metadata,
            };
            
            await movieDb.addMovie(movie);
            
            const statusText = movie.watched ? 'watched' : 'added to watchlist';
            const ratingText = movie.rating ? ` - Rating: ${movie.rating}/10` : '';
            const metadataText = metadata.director ? ` (Director: ${metadata.director})` : '';
            
            return {
              jsonrpc: "2.0",
              id,
              result: {
                content: [
                  {
                    type: "text",
                    text: `Successfully ${statusText}: ${movie.title}${movie.year ? ` (${movie.year})` : ''}${ratingText}${metadataText}`,
                  },
                ],
              },
            };
          }

          case "list_movies": {
            let filters: any = {};
            
            if (args.watched_only) {
              filters.watchedOnly = true;
            } else if (args.watchlist_only) {
              filters.watchedOnly = false;
            }
            
            if (args.min_rating) filters.minRating = args.min_rating;
            if (args.genre) filters.genre = args.genre;
            if (args.director) filters.director = args.director;
            if (args.year) filters.year = args.year;
            
            const movies = await movieDb.getMovies(filters);
            
            if (movies.length === 0) {
              return {
                jsonrpc: "2.0",
                id,
                result: {
                  content: [
                    {
                      type: "text",
                      text: "No movies found matching your criteria.",
                    },
                  ],
                },
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
              jsonrpc: "2.0",
              id,
              result: {
                content: [
                  {
                    type: "text",
                    text: movieList,
                  },
                ],
              },
            };
          }

          case "get_smart_recommendations": {
            const preferences = await movieDb.getPreferenceAnalysis();
            const watchedMovies = await movieDb.getMovies({ watchedOnly: true });
            const watchlist = await movieDb.getMovies({ watchedOnly: false });
            
            if (watchedMovies.length === 0) {
              return {
                jsonrpc: "2.0",
                id,
                result: {
                  content: [
                    {
                      type: "text",
                      text: "No recommendations available yet. Add and rate some movies you've watched first to build your preference profile!",
                    },
                  ],
                },
              };
            }

            let recommendationText = `Based on your viewing history (${preferences.totalWatched} movies watched, avg rating: ${preferences.averageRating.toFixed(1)}/10):\n\n`;
            
            if (preferences.favoriteGenres.length > 0) {
              recommendationText += `🎬 Your favorite genres: ${preferences.favoriteGenres.join(', ')}\n`;
            }
            
            if (preferences.favoriteDirectors.length > 0) {
              recommendationText += `🎭 Directors you love: ${preferences.favoriteDirectors.slice(0, 3).join(', ')}\n`;
            }

            if (preferences.commonLikedAspects.length > 0) {
              recommendationText += `💝 What you typically enjoy: ${preferences.commonLikedAspects.slice(0, 5).join(', ')}\n`;
            }

            recommendationText += `\n📋 Current watchlist has ${watchlist.filter(m => !m.watched).length} movies\n\n`;

            const moodText = args.mood ? `Given your current mood (${args.mood}), ` : '';
            const genreText = args.genre_preference ? `with a preference for ${args.genre_preference}, ` : '';
            
            recommendationText += `${moodText}${genreText}here are some personalized recommendations:\n\n`;
            recommendationText += `🔍 Search for movies similar to your top-rated films: ${watchedMovies.filter(m => m.rating && m.rating >= 8).slice(0, 3).map(m => m.title).join(', ')}\n\n`;
            
            if (preferences.favoriteGenres.length > 0) {
              recommendationText += `🎯 Explore more ${preferences.favoriteGenres[0]} movies from different decades\n`;
              recommendationText += `🌟 Look for acclaimed ${preferences.favoriteGenres[0]} films you haven't seen\n\n`;
            }

            recommendationText += `💡 Pro tip: Use "search_and_add_movie" to save movies that interest you!`;
            
            return {
              jsonrpc: "2.0",
              id,
              result: {
                content: [
                  {
                    type: "text",
                    text: recommendationText,
                  },
                ],
              },
            };
          }

          case "analyze_preferences": {
            const preferences = await movieDb.getPreferenceAnalysis();
            
            if (preferences.totalWatched === 0) {
              return {
                jsonrpc: "2.0",
                id,
                result: {
                  content: [
                    {
                      type: "text",
                      text: "No watched movies yet. Start adding movies you've seen to build your preference profile!",
                    },
                  ],
                },
              };
            }

            let analysis = `🎬 Your Movie Taste Profile:\n\n`;
            analysis += `📊 Total watched: ${preferences.totalWatched} movies\n`;
            analysis += `⭐ Average rating: ${preferences.averageRating.toFixed(1)}/10\n\n`;

            if (preferences.favoriteGenres.length > 0) {
              analysis += `🎭 Favorite genres:\n${preferences.favoriteGenres.map((g, i) => `${i + 1}. ${g}`).join('\n')}\n\n`;
            }

            if (preferences.favoriteDirectors.length > 0) {
              analysis += `🎬 Favorite directors:\n${preferences.favoriteDirectors.map((d, i) => `${i + 1}. ${d}`).join('\n')}\n\n`;
            }

            if (preferences.commonLikedAspects.length > 0) {
              analysis += `💝 What you typically enjoy:\n${preferences.commonLikedAspects.map((a, i) => `• ${a}`).join('\n')}\n\n`;
            }

            analysis += `This analysis helps me recommend movies that match your taste!`;

            return {
              jsonrpc: "2.0",
              id,
              result: {
                content: [
                  {
                    type: "text",
                    text: analysis,
                  },
                ],
              },
            };
          }

          default:
            throw new Error(`Unknown tool: ${toolName}`);
        }

      default:
        throw new Error(`Unknown method: ${method}`);
    }
  } catch (error) {
    return {
      jsonrpc: "2.0",
      id,
      error: {
        code: -32603,
        message: error instanceof Error ? error.message : "Internal error",
      },
    };
  }
}

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
      return new Response(JSON.stringify({ status: "ok", service: "movie-rec-mcp-simple" }), {
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
        const rpcRequest = await request.json();
        console.log("Received MCP request:", JSON.stringify(rpcRequest, null, 2));
        
        // Handle the request
        const response = await handleMCPRequest(rpcRequest);
        console.log("Sending MCP response:", JSON.stringify(response, null, 2));
        
        return new Response(JSON.stringify(response), {
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        });
      } catch (error) {
        console.error("Error handling MCP request:", error);
        return new Response(JSON.stringify({
          jsonrpc: "2.0",
          id: null,
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

console.log(`Movie Recommendation MCP Simple HTTP server running on http://localhost:${PORT}`);
console.log(`MCP endpoint: http://localhost:${PORT}/mcp`);
console.log(`Test with: npx mcp-remote http://localhost:${PORT}/mcp --header "Authorization:Bearer ${API_KEY}" --allow-http`);

// Graceful shutdown
process.on("SIGINT", () => {
  console.log("Shutting down...");
  movieDb.close();
  httpServer.stop();
  process.exit(0);
});