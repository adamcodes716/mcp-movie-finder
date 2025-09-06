

## This app is forked from https://github.com/imjoshnewton/mediasage.git and the bulk of the work can be attributed to that engineer


## pull upstream changes
git remote add upstream https://github.com/imjoshnewton/mediasage.git    # this is a one-time command
git fetch upstream
git merge upstream/master

## push changes to my repo
git push --set-upstream origin master

# MediaSage

A Model Context Protocol (MCP) server that tracks movies, books, and TV shows, providing intelligent recommendations based on your preferences. Built with Bun, SQLite (via Drizzle ORM), and supports both local (stdio) and remote (HTTP/SSE) connections.

## Features

- **Multi-Media Tracking**: Track movies, books, and TV shows with ratings, status, and notes
- **Smart Filtering**: List media by type, status, rating, genre, and more
- **Cross-Media Recommendations**: Get suggestions based on your preferences across all media types
- **Rich Metadata**: Automatic metadata fetching from OMDB (movies), Google Books (books), and TMDB (TV shows)
- **Preference Analysis**: Understand your favorite genres, creators, and what you typically enjoy
- **Persistent Storage**: SQLite database with Drizzle ORM and proper relations
- **Remote Access**: HTTP server with Server-Sent Events (SSE) support
- **Secure**: API key authentication for remote connections

## Installation

```bash
# Clone the repository
git clone <your-repo-url>
cd mediasage

# Install dependencies
bun install

# Set up API keys (required for metadata enrichment)
cp .env.example .env
# Edit .env and add your API keys:
# - OMDB_API_KEY (required for movies): Get from http://www.omdbapi.com/apikey.aspx
# - TMDB_API_KEY (required for TV shows): Get from https://www.themoviedb.org/settings/api
# - GOOGLE_BOOKS_API_KEY (optional for books): Get from Google Cloud Console

# Run migration if you have existing movie data
bun run src/migrate-to-media.ts
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

### Movie Tools

#### `search_and_add_movie`
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

### Book Tools

#### `search_and_add_book`
Search for a book and add it with auto-populated metadata from Google Books.

**Parameters:**
- `title` (required): Book title to search for
- `author`: Author name (helps accuracy)
- `read`: Whether you've read it (default: false)
- `rating`: Your rating (1-10) if read
- `notes`: Personal notes
- `likedAspects`: What you liked (comma-separated)
- `dislikedAspects`: What you didn't like
- `mood`: When/why you read it
- `recommendationContext`: How this should influence recommendations

### TV Show Tools

#### `search_and_add_tv_show`
Search for a TV show and add it with auto-populated metadata from TMDB.

**Parameters:**
- `title` (required): TV show title to search for
- `year`: Year first aired (helps accuracy)
- `watched`: Whether you've watched it (default: false)
- `rating`: Your rating (1-10) if watched
- `notes`: Personal notes
- `likedAspects`: What you liked (comma-separated)
- `dislikedAspects`: What you didn't like
- `mood`: When/why you watched it
- `recommendationContext`: How this should influence recommendations

### General Tools

#### `list_media`
List all media with advanced filtering options.

**Parameters:**
- `type`: Filter by media type ('movie', 'book', 'tv_show')
- `watched_only`: Show only watched/read items
- `watchlist_only`: Show only unwatched/unread items
- `min_rating`: Minimum rating filter (1-10)
- `genre`: Filter by genre
- `creator`: Filter by director/author/creator
- `year`: Filter by year

#### `add_movie_to_watchlist`
Add a movie to your watchlist (movies you want to watch).

**Parameters:**
- `title` (required): Movie title
- `year`: Release year
- `notes`: Why you want to watch it
- `recommendationContext`: Why it was recommended

#### `get_smart_recommendations`
Get intelligent recommendations based on your preferences across all media types.

**Parameters:**
- `mood`: Current mood (e.g., 'action-packed', 'thoughtful')
- `genre_preference`: Specific genre interest
- `length_preference`: Preferred length (short/medium/long/any)
- `count`: Number of recommendations (default: 5)

#### `mark_as_watched`
Mark a movie from your watchlist as watched and rate it.

**Parameters:**
- `id` (required): Movie ID
- `rating`: Your rating (1-10)
- `likedAspects`: What you liked
- `dislikedAspects`: What you didn't like
- `notes`: Your thoughts

#### `analyze_preferences`
Analyze your media preferences to understand your taste.

#### `update_movie`
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
    "mediasage": {
      "command": "bun",
      "args": ["run", "/path/to/mediasage/index.ts"]
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