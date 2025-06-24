# Movie Recommendation MCP Server

A Model Context Protocol (MCP) server that tracks movies you've watched and provides recommendations based on your preferences. Built with Bun, SQLite (via Drizzle ORM), and supports both local (stdio) and remote (HTTP/SSE) connections.

## Features

- **Movie Tracking**: Add movies with ratings, watch status, and notes
- **Smart Filtering**: List movies by watch status and minimum rating
- **Recommendations**: Get movie suggestions based on your highly-rated films
- **Persistent Storage**: SQLite database with Drizzle ORM
- **Remote Access**: HTTP server with Server-Sent Events (SSE) support
- **Secure**: API key authentication for remote connections

## Installation

```bash
# Clone the repository
git clone <your-repo-url>
cd movie-rec-mcp

# Install dependencies
bun install
```

## Usage

### Local Mode (stdio)

For use with Claude Desktop or other MCP clients:

```bash
# Development (with file watching)
bun run dev

# Production
bun run start
```

### Remote Mode (HTTP/SSE)

For remote access over HTTP:

```bash
# Set environment variables
export API_KEY="your-secure-api-key"
export PORT=3000  # optional, defaults to 3000

# Development (with file watching)
bun run dev:http

# Production
bun run start:http
```

## Available Tools

### `search_and_add_movie`
Search for a movie and add it with auto-populated metadata from OMDB.

**Parameters:**
- `title` (required): Movie title to search for
- `year`: Release year (helps accuracy)
- `watched`: Whether you've watched it (default: false)
- `rating`: Your rating (1-10) if watched
- `notes`: Personal notes
- `likedAspects`: What you liked (comma-separated)
- `dislikedAspects`: What you didn't like
- `mood`: When/why you watched it
- `recommendationContext`: How this should influence recommendations

### `add_movie_to_watchlist`
Add a movie to your watchlist (movies you want to watch).

**Parameters:**
- `title` (required): Movie title
- `year`: Release year
- `notes`: Why you want to watch it
- `recommendationContext`: Why it was recommended

### `list_movies`
List movies with advanced filtering options.

**Parameters:**
- `watched_only`: Show only watched movies
- `watchlist_only`: Show only unwatched movies
- `min_rating`: Minimum rating filter (1-10)
- `genre`: Filter by genre
- `director`: Filter by director
- `year`: Filter by year

### `get_smart_recommendations`
Get intelligent recommendations based on your preferences.

**Parameters:**
- `mood`: Current mood (e.g., 'action-packed', 'thoughtful')
- `genre_preference`: Specific genre interest
- `length_preference`: Preferred length (short/medium/long/any)
- `count`: Number of recommendations (default: 5)

### `mark_as_watched`
Mark a watchlist movie as watched and rate it.

**Parameters:**
- `id` (required): Movie ID
- `rating`: Your rating (1-10)
- `likedAspects`: What you liked
- `dislikedAspects`: What you didn't like
- `notes`: Your thoughts

### `analyze_preferences`
Analyze your movie preferences to understand your taste.

### `update_movie`
Update an existing movie entry.

**Parameters:**
- `id` (required): Movie ID
- `rating`: New rating (1-10)
- `watched`: Update watch status
- `notes`: Update notes
- `likedAspects`: Update liked aspects
- `dislikedAspects`: Update disliked aspects
- `mood`: Update mood context

## Configuration

### Claude Desktop

Add to your Claude Desktop configuration:

```json
{
  "mcpServers": {
    "movie-rec": {
      "command": "bun",
      "args": ["run", "/path/to/movie-rec-mcp/index.ts"]
    }
  }
}
```

### Remote Client Configuration

Connect to the HTTP endpoint:

```
Endpoint: http://localhost:3000/mcp
Method: POST
Headers:
  - Content-Type: text/event-stream
  - Authorization: Bearer YOUR_API_KEY
```

## Environment Variables

- `PORT`: HTTP server port (default: 3000)
- `API_KEY`: Authentication key for remote access (required for HTTP mode)
- `OMDB_API_KEY`: API key for OMDB movie metadata (get free key at [omdbapi.com](http://www.omdbapi.com/))

## Movie Metadata

The server automatically fetches movie metadata from OMDB API including:
- Directors, cast, genres, plot summaries
- IMDb ratings, Rotten Tomatoes scores
- Release dates, runtime, box office data
- Poster images and more

To enable metadata fetching, get a free API key from [omdbapi.com](http://www.omdbapi.com/) and set:
```bash
export OMDB_API_KEY="your-api-key"
```

## Workflow

1. **Add movies you've watched**: Use `search_and_add_movie` with `watched: true` and your rating
2. **Build your watchlist**: Use `add_movie_to_watchlist` for movies you want to see
3. **Rate and analyze**: Use `mark_as_watched` when you watch something from your list
4. **Get recommendations**: Use `get_smart_recommendations` for personalized suggestions
5. **Understand your taste**: Use `analyze_preferences` to see your movie patterns

## Development

The project structure:
```
movie-rec-mcp/
├── index.ts              # Main stdio server
├── src/
│   ├── http-server.ts    # HTTP/SSE server
│   ├── sse-transport.ts  # SSE transport implementation
│   └── db/
│       ├── index.ts      # Database operations
│       └── schema.ts     # Drizzle schema definitions
├── movies.db            # SQLite database (auto-created)
└── package.json
```

## Security Notes

- Change the default API key when deploying
- The HTTP server includes CORS headers for development
- Consider using HTTPS in production
- Database file is gitignored for privacy

## License

MIT