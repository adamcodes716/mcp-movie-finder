// Simple Movie-Only Database Implementation
// DATABASE_TYPE=mysql: Uses your existing my_reviews table
// DATABASE_TYPE=sqlite: Uses simple local movies table
// Focus: Just movies, no books/TV for now

export interface Movie {
  id: string;
  title: string;
  year?: number;
  director?: string;
  cast?: string;
  genre?: string;
  watched: boolean;
  rating?: number;
  notes?: string;
}

export interface MovieUpdate {
  title?: string;
  year?: number;
  director?: string;
  cast?: string;
  genre?: string;
  watched?: boolean;
  rating?: number;
  notes?: string;
}

export interface DatabaseAdapter {
  initialize(): Promise<void>;
  close(): Promise<void>;
  getMovies(filters: any): Promise<Movie[]>;
  getRecommendations(): Promise<Movie[]>;
  getWatchedMovies(): Promise<Movie[]>;
  analyzePreferences(): Promise<{genres: string[], directors: string[], avgRating: number}>;
}

export async function createMovieDatabase(): Promise<DatabaseAdapter> {
  const DATABASE_TYPE = process.env.DATABASE_TYPE || 'sqlite';
  
  if (DATABASE_TYPE === 'mysql') {
    return new MySQLMovieDatabase();
  } else {
    return new SQLiteMovieDatabase();
  }
}

// MySQL implementation using your existing my_reviews table
class MySQLMovieDatabase implements DatabaseAdapter {
  private connection: any = null;
  
  async initialize(): Promise<void> {
    // We'll implement this once we install mysql2
    console.log("🔗 MySQL movie database initialized (placeholder)");
  }
  
  async close(): Promise<void> {
    if (this.connection) {
      await this.connection.end();
    }
  }
  
  async getMovies(filters: any): Promise<Movie[]> {
    // Will query your my_reviews table and map to Movie interface
    return [];
  }
  
  async getWatchedMovies(): Promise<Movie[]> {
    // Will get watched movies from your my_reviews table
    return [];
  }
  
  async analyzePreferences(): Promise<{genres: string[], directors: string[], avgRating: number}> {
    // Will analyze your my_reviews table for preferences
    return { genres: [], directors: [], avgRating: 0 };
  }
  
  async getRecommendations(): Promise<Movie[]> {
    // Will find highly rated movies from your my_reviews
    return [];
  }
}

// Simple SQLite implementation for local development
class SQLiteMovieDatabase implements DatabaseAdapter {
  private movies: Movie[] = [];
  
  async initialize(): Promise<void> {
    console.log("📁 SQLite movie database initialized");
    
    // Add some sample movies if empty
    if (this.movies.length === 0) {
      this.movies = [
        // Watched movies (your collection)
        {
          id: "movie_1",
          title: "The Matrix",
          year: 1999,
          director: "The Wachowskis",
          cast: "Keanu Reeves, Laurence Fishburne",
          genre: "Sci-Fi",
          watched: true,
          rating: 9,
          notes: "Mind-bending classic"
        },
        {
          id: "movie_2", 
          title: "Inception",
          year: 2010,
          director: "Christopher Nolan",
          cast: "Leonardo DiCaprio, Marion Cotillard",
          genre: "Sci-Fi",
          watched: true,
          rating: 8,
          notes: "Dreams within dreams"
        },
        {
          id: "movie_3",
          title: "The Dark Knight",
          year: 2008,
          director: "Christopher Nolan",
          cast: "Christian Bale, Heath Ledger",
          genre: "Action",
          watched: true,
          rating: 9,
          notes: "Best Batman movie"
        },
        // Unwatched movies (recommendations)
        {
          id: "movie_4",
          title: "Interstellar",
          year: 2014,
          director: "Christopher Nolan", // Same director as highly rated movies
          cast: "Matthew McConaughey, Anne Hathaway",
          genre: "Sci-Fi", // Same genre as highly rated movies
          watched: false,
          rating: 8, // High rating
          notes: "Space exploration epic"
        },
        {
          id: "movie_5",
          title: "Blade Runner 2049",
          year: 2017,
          director: "Denis Villeneuve",
          cast: "Ryan Gosling, Harrison Ford",
          genre: "Sci-Fi", // Same genre
          watched: false,
          rating: 8,
          notes: "Cyberpunk masterpiece"
        },
        {
          id: "movie_6",
          title: "Ex Machina",
          year: 2014,
          director: "Alex Garland",
          cast: "Domhnall Gleeson, Alicia Vikander",
          genre: "Sci-Fi", // Same genre
          watched: false,
          rating: 7,
          notes: "AI thriller"
        }
      ];
    }
  }
  
  async close(): Promise<void> {
    console.log("📁 SQLite database closed");
  }
  
  async getMovies(filters: any): Promise<Movie[]> {
    let result = [...this.movies];
    
    if (filters.genre) {
      result = result.filter(m => m.genre?.toLowerCase().includes(filters.genre.toLowerCase()));
    }
    if (filters.year) {
      result = result.filter(m => m.year === filters.year);
    }
    if (filters.watched !== undefined) {
      result = result.filter(m => m.watched === filters.watched);
    }
    
    return result;
  }
  
  async getWatchedMovies(): Promise<Movie[]> {
    return this.movies.filter(m => m.watched);
  }
  
  async analyzePreferences(): Promise<{genres: string[], directors: string[], avgRating: number}> {
    const watched = await this.getWatchedMovies();
    const ratedMovies = watched.filter(m => m.rating);
    
    // Get genres
    const genreCount = new Map<string, number>();
    const directorCount = new Map<string, number>();
    
    watched.forEach(movie => {
      if (movie.genre) {
        genreCount.set(movie.genre, (genreCount.get(movie.genre) || 0) + 1);
      }
      if (movie.director) {
        directorCount.set(movie.director, (directorCount.get(movie.director) || 0) + 1);
      }
    });
    
    const topGenres = Array.from(genreCount.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([genre]) => genre);
      
    const topDirectors = Array.from(directorCount.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([director]) => director);
    
    const avgRating = ratedMovies.length > 0 
      ? ratedMovies.reduce((sum, m) => sum + (m.rating || 0), 0) / ratedMovies.length 
      : 0;
    
    return {
      genres: topGenres,
      directors: topDirectors,
      avgRating
    };
  }

  async getRecommendations(): Promise<Movie[]> {
    // Get preferences from watched movies
    const preferences = await this.analyzePreferences();
    const unwatchedMovies = this.movies.filter(m => !m.watched);
    
    if (unwatchedMovies.length > 0) {
      // Recommend unwatched movies that match preferences
      const scored = unwatchedMovies.map(movie => {
        let score = 0;
        
        // Boost score for preferred genres
        if (movie.genre && preferences.genres.includes(movie.genre)) {
          score += 3;
        }
        
        // Boost score for preferred directors
        if (movie.director && preferences.directors.includes(movie.director)) {
          score += 2;
        }
        
        // Boost score for high ratings
        if (movie.rating && movie.rating >= preferences.avgRating) {
          score += 1;
        }
        
        return { movie, score };
      });
      
      return scored
        .sort((a, b) => b.score - a.score)
        .slice(0, 5)
        .map(item => item.movie);
    }
    
    // If no unwatched movies, suggest rewatching top-rated ones
    return this.movies
      .filter(m => m.rating && m.rating >= 8)
      .sort((a, b) => (b.rating || 0) - (a.rating || 0))
      .slice(0, 3);
  }
}
