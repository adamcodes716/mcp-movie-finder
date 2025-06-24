#!/usr/bin/env bun

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListResourcesRequestSchema,
  ListToolsRequestSchema,
  ReadResourceRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { MovieDatabase } from "./src/db/index.js";
import { movieService } from "./src/movie-service.js";
import type { NewMovie } from "./src/db/schema.js";

// Initialize database
const movieDb = new MovieDatabase();

// Create MCP server
const server = new Server(
  {
    name: "movie-recommendation-server",
    version: "0.5.0",
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
            likedAspects: {
              type: "string",
              description: "What you liked about the movie",
            },
            dislikedAspects: {
              type: "string",
              description: "What you didn't like about the movie",
            },
            mood: {
              type: "string",
              description: "When/why you watched it",
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
    ],
  };
});

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  switch (name) {
    case "search_and_add_movie": {
      try {
        // Check if movie already exists
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

        // Fetch metadata
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
          ...metadata, // Add all the fetched metadata
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

    case "add_movie_to_watchlist": {
      try {
        // Check if movie already exists
        const existingMovie = await movieDb.findMovieByTitle(args.title as string, args.year as number);
        if (existingMovie) {
          return {
            content: [
              {
                type: "text",
                text: `Movie "${args.title}" already exists in your collection`,
              },
            ],
          };
        }

        // Fetch metadata for watchlist item
        const metadata = await movieService.enrichMovieData(args.title as string, args.year as number);
        
        const movie: NewMovie = {
          id: Date.now().toString(),
          title: args.title as string,
          year: args.year as number || metadata.year,
          watched: false, // Watchlist items are not watched
          notes: args.notes as string | undefined,
          recommendationContext: args.recommendationContext as string | undefined,
          ...metadata,
        };
        
        await movieDb.addMovie(movie);
        
        return {
          content: [
            {
              type: "text",
              text: `Added to watchlist: ${movie.title}${movie.year ? ` (${movie.year})` : ''}${metadata.director ? ` - Directed by ${metadata.director}` : ''}`,
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error adding to watchlist: ${error instanceof Error ? error.message : 'Unknown error'}`,
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

    case "get_smart_recommendations": {
      try {
        const preferences = await movieDb.getPreferenceAnalysis();
        const watchedMovies = await movieDb.getMovies({ watchedOnly: true });
        const watchlist = await movieDb.getMovies({ watchedOnly: false });
        
        if (watchedMovies.length === 0) {
          return {
            content: [
              {
                type: "text",
                text: "No recommendations available yet. Add and rate some movies you've watched first to build your preference profile!",
              },
            ],
          };
        }

        // Build recommendation context
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

        // Add contextual recommendations based on mood/preferences
        const moodText = args.mood ? `Given your current mood (${args.mood}), ` : '';
        const genreText = args.genre_preference ? `with a preference for ${args.genre_preference}, ` : '';
        
        recommendationText += `${moodText}${genreText}here are some personalized recommendations:\n\n`;
        recommendationText += `🔍 Search for movies similar to your top-rated films: ${watchedMovies.filter(m => m.rating && m.rating >= 8).slice(0, 3).map(m => m.title).join(', ')}\n\n`;
        
        if (preferences.favoriteGenres.length > 0) {
          recommendationText += `🎯 Explore more ${preferences.favoriteGenres[0]} movies from different decades\n`;
          recommendationText += `🌟 Look for acclaimed ${preferences.favoriteGenres[0]} films you haven't seen\n\n`;
        }

        if (preferences.favoriteDirectors.length > 0) {
          recommendationText += `🎬 Check out more films by ${preferences.favoriteDirectors[0]}\n`;
          recommendationText += `🔗 Explore directors influenced by ${preferences.favoriteDirectors[0]}\n\n`;
        }

        recommendationText += `💡 Pro tip: Use "add_movie_to_watchlist" to save movies that interest you, then "mark_as_watched" when you see them!`;
        
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
              text: `Error generating recommendations: ${error instanceof Error ? error.message : 'Unknown error'}`,
            },
          ],
        };
      }
    }

    case "mark_as_watched": {
      try {
        const updates: any = {
          watched: true,
          dateWatched: new Date().toISOString(),
        };

        if (args.rating) updates.rating = args.rating as number;
        if (args.likedAspects) updates.likedAspects = args.likedAspects as string;
        if (args.dislikedAspects) updates.dislikedAspects = args.dislikedAspects as string;
        if (args.notes) updates.notes = args.notes as string;

        const updated = await movieDb.updateMovie(args.id as string, updates);
        
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
        const ratingText = movie?.rating ? ` and rated it ${movie.rating}/10` : '';
        
        return {
          content: [
            {
              type: "text",
              text: `Marked "${movie?.title}" as watched${ratingText}. This will now influence your recommendations!`,
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error marking as watched: ${error instanceof Error ? error.message : 'Unknown error'}`,
            },
          ],
        };
      }
    }

    case "analyze_preferences": {
      try {
        const preferences = await movieDb.getPreferenceAnalysis();
        
        if (preferences.totalWatched === 0) {
          return {
            content: [
              {
                type: "text",
                text: "No watched movies yet. Start adding movies you've seen to build your preference profile!",
              },
            ],
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
          content: [
            {
              type: "text",
              text: analysis,
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error analyzing preferences: ${error instanceof Error ? error.message : 'Unknown error'}`,
            },
          ],
        };
      }
    }

    case "update_movie": {
      try {
        const updates: any = {};
        
        if (args.rating !== undefined) updates.rating = args.rating as number;
        if (args.watched !== undefined) updates.watched = args.watched as boolean;
        if (args.notes !== undefined) updates.notes = args.notes as string;
        if (args.likedAspects !== undefined) updates.likedAspects = args.likedAspects as string;
        if (args.dislikedAspects !== undefined) updates.dislikedAspects = args.dislikedAspects as string;
        if (args.mood !== undefined) updates.mood = args.mood as string;

        const updated = await movieDb.updateMovie(args.id as string, updates);
        
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
              text: `Updated "${movie?.title}" successfully.`,
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
      {
        uri: "movie-db://watchlist",
        name: "Movie Watchlist",
        description: "Movies you want to watch",
        mimeType: "application/json",
      },
      {
        uri: "movie-db://preferences",
        name: "Preference Analysis",
        description: "Analysis of your movie preferences",
        mimeType: "application/json",
      },
    ],
  };
});

// Read resources
server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
  const { uri } = request.params;
  
  try {
    if (uri === "movie-db://collection") {
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
    }

    if (uri === "movie-db://watchlist") {
      const watchlist = await movieDb.getMovies({ watchedOnly: false });
      const unwatched = watchlist.filter(m => !m.watched);
      return {
        contents: [
          {
            uri,
            mimeType: "application/json",
            text: JSON.stringify({ watchlist: unwatched }, null, 2),
          },
        ],
      };
    }

    if (uri === "movie-db://preferences") {
      const preferences = await movieDb.getPreferenceAnalysis();
      return {
        contents: [
          {
            uri,
            mimeType: "application/json",
            text: JSON.stringify(preferences, null, 2),
          },
        ],
      };
    }
    
    throw new Error(`Resource not found: ${uri}`);
  } catch (error) {
    throw new Error(`Error reading resource: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
});

// Start the server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Movie Recommendation MCP server (Enhanced) running on stdio");
}

// Graceful shutdown
process.on("SIGINT", () => {
  movieDb.close();
  process.exit(0);
});

main().catch((error) => {
  console.error("Server error:", error);
  movieDb.close();
  process.exit(1);
});