import { drizzle } from 'drizzle-orm/bun-sqlite';
import { Database } from 'bun:sqlite';
import { movies, type Movie, type NewMovie } from './schema';
import { eq, and, gte, desc, asc, like, sql } from 'drizzle-orm';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Create SQLite database instance
const sqlite = new Database(join(dirname(__dirname), '..', 'movies.db'));
export const db = drizzle(sqlite);

// Create tables if they don't exist - Updated schema
sqlite.run(`
  CREATE TABLE IF NOT EXISTS movies (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    year INTEGER,
    watched INTEGER NOT NULL DEFAULT 0,
    rating INTEGER CHECK(rating >= 1 AND rating <= 10),
    date_watched TEXT,
    notes TEXT,
    
    -- Metadata fields
    imdb_id TEXT,
    tmdb_id INTEGER,
    genres TEXT,
    director TEXT,
    cast TEXT,
    plot TEXT,
    runtime INTEGER,
    language TEXT,
    country TEXT,
    imdb_rating REAL,
    rotten_tomatoes_rating INTEGER,
    poster_url TEXT,
    release_date TEXT,
    budget INTEGER,
    box_office INTEGER,
    keywords TEXT,
    
    -- User preference analysis
    liked_aspects TEXT,
    disliked_aspects TEXT,
    mood TEXT,
    recommendation_context TEXT
  )
`);

export class MovieDatabase {
  async addMovie(movie: NewMovie): Promise<void> {
    await db.insert(movies).values(movie);
  }

  async getMovies(filters?: { 
    watchedOnly?: boolean; 
    minRating?: number;
    genre?: string;
    director?: string;
    year?: number;
  }): Promise<Movie[]> {
    let query = db.select().from(movies);
    
    const conditions = [];
    
    if (filters?.watchedOnly) {
      conditions.push(eq(movies.watched, true));
    }
    
    if (filters?.minRating) {
      conditions.push(gte(movies.rating, filters.minRating));
    }

    if (filters?.genre) {
      conditions.push(like(movies.genres, `%${filters.genre}%`));
    }

    if (filters?.director) {
      conditions.push(like(movies.director, `%${filters.director}%`));
    }

    if (filters?.year) {
      conditions.push(eq(movies.year, filters.year));
    }
    
    if (conditions.length > 0) {
      query = query.where(and(...conditions));
    }
    
    return query.orderBy(desc(movies.dateWatched), asc(movies.title));
  }

  async getMovie(id: string): Promise<Movie | null> {
    const results = await db.select()
      .from(movies)
      .where(eq(movies.id, id))
      .limit(1);
    
    return results[0] || null;
  }

  async findMovieByTitle(title: string, year?: number): Promise<Movie | null> {
    let query = db.select()
      .from(movies)
      .where(eq(movies.title, title));
    
    if (year) {
      query = query.where(and(eq(movies.title, title), eq(movies.year, year)));
    }
    
    const results = await query.limit(1);
    return results[0] || null;
  }

  async updateMovie(id: string, updates: Partial<Movie>): Promise<boolean> {
    const movie = await this.getMovie(id);
    if (!movie) return false;

    const updateData: any = {};
    
    // Copy all provided updates
    Object.keys(updates).forEach(key => {
      if (updates[key as keyof Movie] !== undefined) {
        updateData[key] = updates[key as keyof Movie];
      }
    });
    
    if (updates.watched && !movie.dateWatched) {
      updateData.dateWatched = new Date().toISOString();
    }
    
    if (Object.keys(updateData).length > 0) {
      await db.update(movies)
        .set(updateData)
        .where(eq(movies.id, id));
    }
    
    return true;
  }

  async getHighRatedMovies(): Promise<Movie[]> {
    return db.select()
      .from(movies)
      .where(and(
        eq(movies.watched, true),
        gte(movies.rating, 7)
      ))
      .orderBy(desc(movies.rating));
  }

  async getMoviesByGenre(genre: string): Promise<Movie[]> {
    return db.select()
      .from(movies)
      .where(like(movies.genres, `%${genre}%`))
      .orderBy(desc(movies.rating));
  }

  async getMoviesByDirector(director: string): Promise<Movie[]> {
    return db.select()
      .from(movies)
      .where(like(movies.director, `%${director}%`))
      .orderBy(desc(movies.rating));
  }

  async getPreferenceAnalysis(): Promise<{
    favoriteGenres: string[];
    favoriteDirectors: string[];
    averageRating: number;
    totalWatched: number;
    commonLikedAspects: string[];
  }> {
    const watchedMovies = await this.getMovies({ watchedOnly: true });
    
    if (watchedMovies.length === 0) {
      return {
        favoriteGenres: [],
        favoriteDirectors: [],
        averageRating: 0,
        totalWatched: 0,
        commonLikedAspects: []
      };
    }

    // Calculate favorite genres
    const genreMap = new Map<string, { count: number; totalRating: number }>();
    const directorMap = new Map<string, { count: number; totalRating: number }>();
    const likedAspects: string[] = [];
    
    let totalRating = 0;
    let ratedMovies = 0;

    watchedMovies.forEach(movie => {
      if (movie.rating) {
        totalRating += movie.rating;
        ratedMovies++;
      }

      // Process genres
      if (movie.genres) {
        try {
          const genres = JSON.parse(movie.genres);
          genres.forEach((genre: string) => {
            const current = genreMap.get(genre) || { count: 0, totalRating: 0 };
            current.count++;
            if (movie.rating) current.totalRating += movie.rating;
            genreMap.set(genre, current);
          });
        } catch (e) {
          // Handle non-JSON genre data
          if (movie.genres.includes(',')) {
            movie.genres.split(',').forEach(genre => {
              const trimmed = genre.trim();
              const current = genreMap.get(trimmed) || { count: 0, totalRating: 0 };
              current.count++;
              if (movie.rating) current.totalRating += movie.rating;
              genreMap.set(trimmed, current);
            });
          }
        }
      }

      // Process directors
      if (movie.director) {
        const current = directorMap.get(movie.director) || { count: 0, totalRating: 0 };
        current.count++;
        if (movie.rating) current.totalRating += movie.rating;
        directorMap.set(movie.director, current);
      }

      // Process liked aspects
      if (movie.likedAspects) {
        likedAspects.push(...movie.likedAspects.split(',').map(a => a.trim()));
      }
    });

    // Sort genres by average rating and frequency
    const favoriteGenres = Array.from(genreMap.entries())
      .filter(([_, data]) => data.count >= 2) // At least 2 movies
      .sort((a, b) => (b[1].totalRating / b[1].count) - (a[1].totalRating / a[1].count))
      .slice(0, 5)
      .map(([genre]) => genre);

    // Sort directors by rating
    const favoriteDirectors = Array.from(directorMap.entries())
      .filter(([_, data]) => data.count >= 1)
      .sort((a, b) => (b[1].totalRating / b[1].count) - (a[1].totalRating / a[1].count))
      .slice(0, 5)
      .map(([director]) => director);

    // Get common liked aspects
    const aspectCounts = new Map<string, number>();
    likedAspects.forEach(aspect => {
      aspectCounts.set(aspect, (aspectCounts.get(aspect) || 0) + 1);
    });
    
    const commonLikedAspects = Array.from(aspectCounts.entries())
      .filter(([_, count]) => count >= 2)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([aspect]) => aspect);

    return {
      favoriteGenres,
      favoriteDirectors,
      averageRating: ratedMovies > 0 ? totalRating / ratedMovies : 0,
      totalWatched: watchedMovies.length,
      commonLikedAspects
    };
  }

  async getAllMovies(): Promise<Movie[]> {
    return this.getMovies();
  }

  close() {
    // Bun's SQLite database doesn't have a close method
  }
}