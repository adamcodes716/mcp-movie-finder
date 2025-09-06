// Simple in-memory movie store with optional persistence
import { type Movie } from "./movie-utils.ts";
import { FilePersistence } from "./file-persistence.ts";

export class MovieStore {
  private movies: Movie[] = [];
  private persistence?: FilePersistence;
  
  constructor(initialMovies: Movie[] = [], enablePersistence = false) {
    this.movies = [...initialMovies];
    
    if (enablePersistence) {
      this.persistence = new FilePersistence();
    }
  }

  // Initialize from file if persistence is enabled
  async initialize(): Promise<void> {
    if (this.persistence) {
      const loadedMovies = await this.persistence.loadMovies();
      if (loadedMovies.length > 0) {
        this.movies = loadedMovies;
        console.log(`[MovieStore] Initialized with ${loadedMovies.length} movies from file`);
      } else {
        console.log(`[MovieStore] No persisted data found, using initial movies`);
        await this.save(); // Save initial data
      }
    }
  }

  // Save to file if persistence is enabled
  private async save(): Promise<void> {
    if (this.persistence) {
      await this.persistence.saveMovies(this.movies);
    }
  }

  // Get all movies with optional filtering
  getMovies(filters?: { watchedOnly?: boolean; minRating?: number }): Movie[] {
    let result = [...this.movies];
    
    if (filters?.watchedOnly) {
      result = result.filter(m => m.watched);
    }
    
    if (filters?.minRating !== undefined) {
      result = result.filter(m => m.rating !== null && m.rating >= filters.minRating!);
    }
    
    return result;
  }

  // Add a new movie
  async addMovie(movie: Movie): Promise<Movie> {
    this.movies.push(movie);
    await this.save();
    return movie;
  }

  // Find movie by ID
  findById(id: string): Movie | undefined {
    return this.movies.find(m => m.id === id);
  }

  // Update a movie
  async updateMovie(id: string, updates: Partial<Pick<Movie, 'rating' | 'watched'>>): Promise<Movie | null> {
    const movie = this.findById(id);
    if (!movie) return null;
    
    if (updates.rating !== undefined) movie.rating = updates.rating;
    if (updates.watched !== undefined) movie.watched = updates.watched;
    
    await this.save();
    return movie;
  }

  // Get high-rated movies for recommendations
  getHighRatedMovies(minRating = 7): Movie[] {
    return this.movies.filter(m => 
      m.watched && m.rating !== null && m.rating >= minRating
    );
  }

  // Get total count
  getCount(): number {
    return this.movies.length;
  }

  // Export all data (for debugging/inspection)
  exportData(): Movie[] {
    return [...this.movies];
  }

  // Get persistence info for debugging
  async getPersistenceInfo(): Promise<any> {
    if (this.persistence) {
      return await this.persistence.getFileInfo();
    }
    return { persistence: false };
  }
}
