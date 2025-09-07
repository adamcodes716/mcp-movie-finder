// Database Factory - chooses between SQLite local DB and MySQL network DB
import { MediaDatabase } from "./db/index.ts";
import { MySQLNetworkAdapter, type MCPMovie } from "./mysql-adapter.ts";

export interface DatabaseAdapter {
  getMovies(filters?: { 
    watchedOnly?: boolean; 
    minRating?: number;
    genre?: string;
    director?: string;
    year?: number;
  }): Promise<MCPMovie[]>;
  
  addMovie(movieData: Partial<MCPMovie>): Promise<string>;
  updateMovie(id: string, updates: Partial<MCPMovie>): Promise<boolean>;
  getMovieById(id: string): Promise<MCPMovie | null>;
  getHighRatedMovies(minRating?: number): Promise<MCPMovie[]>;
  close?(): Promise<void>;
}

// Adapter to make MediaDatabase compatible with our interface
class SQLiteAdapter implements DatabaseAdapter {
  constructor(private db: MediaDatabase) {}

  async getMovies(filters?: { 
    watchedOnly?: boolean; 
    minRating?: number;
    genre?: string;
    director?: string;
    year?: number;
  }): Promise<MCPMovie[]> {
    const movies = await this.db.getMovies(filters);
    return movies.map(movie => ({
      id: movie.id,
      title: movie.title,
      year: movie.year || undefined,
      director: (movie as any).movie?.director || undefined,
      cast: (movie as any).movie?.cast || undefined,
      genre: movie.genres || undefined,
      watched: movie.watched,
      rating: movie.rating || undefined,
      notes: movie.notes || undefined,
    }));
  }

  async addMovie(movieData: Partial<MCPMovie>): Promise<string> {
    const id = Date.now().toString();
    const mediaData = {
      id,
      type: 'movie' as const,
      title: movieData.title || "Unknown Movie",
      year: movieData.year,
      watched: movieData.watched !== false,
      rating: movieData.rating,
      notes: movieData.notes,
      genres: movieData.genre,
    };
    
    const movieSpecificData = {
      mediaId: id,
      director: movieData.director,
      cast: movieData.cast,
    };
    
    await this.db.addMedia(mediaData, movieSpecificData);
    return id;
  }

  async updateMovie(id: string, updates: Partial<MCPMovie>): Promise<boolean> {
    return await this.db.updateMedia(id, {
      rating: updates.rating,
      watched: updates.watched,
      notes: updates.notes,
    });
  }

  async getMovieById(id: string): Promise<MCPMovie | null> {
    const movie = await this.db.getMediaById(id);
    if (!movie) return null;
    
    return {
      id: movie.id,
      title: movie.title,
      year: movie.year || undefined,
      director: (movie as any).movie?.director || undefined,
      cast: (movie as any).movie?.cast || undefined,
      genre: movie.genres || undefined,
      watched: movie.watched,
      rating: movie.rating || undefined,
      notes: movie.notes || undefined,
    };
  }

  async getHighRatedMovies(minRating = 7): Promise<MCPMovie[]> {
    const movies = await this.db.getHighRatedMedia('movie');
    return movies.map(movie => ({
      id: movie.id,
      title: movie.title,
      year: movie.year || undefined,
      director: (movie as any).movie?.director || undefined,
      cast: (movie as any).movie?.cast || undefined,
      genre: movie.genres || undefined,
      watched: movie.watched,
      rating: movie.rating || undefined,
      notes: movie.notes || undefined,
    }));
  }

  async close(): Promise<void> {
    this.db.close();
  }
}

export async function createDatabaseAdapter(): Promise<DatabaseAdapter> {
  const dbType = process.env.DATABASE_TYPE || 'sqlite';
  
  console.log(`[Database Factory] Using database type: ${dbType}`);
  
  if (dbType === 'mysql') {
    console.log('[Database Factory] Initializing MySQL network adapter...');
    const adapter = new MySQLNetworkAdapter();
    
    // Test connection
    const isConnected = await adapter.testConnection();
    if (!isConnected) {
      console.warn('[Database Factory] MySQL connection failed, falling back to SQLite');
      return createSQLiteAdapter();
    }
    
    console.log('✅ MySQL network database connected successfully');
    return adapter;
  } else {
    return createSQLiteAdapter();
  }
}

function createSQLiteAdapter(): DatabaseAdapter {
  console.log('[Database Factory] Initializing SQLite local database...');
  const mediaDb = new MediaDatabase();
  console.log('✅ SQLite local database initialized');
  return new SQLiteAdapter(mediaDb);
}
