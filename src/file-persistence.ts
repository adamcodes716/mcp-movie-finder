// Simple file-based persistence for movies
import { type Movie } from "./movie-utils.ts";

export class FilePersistence {
  private filePath: string;
  
  constructor(filePath = "/app/data/movies.json") {
    this.filePath = filePath;
  }

  // Load movies from file
  async loadMovies(): Promise<Movie[]> {
    try {
      const file = Bun.file(this.filePath);
      const exists = await file.exists();
      
      if (!exists) {
        console.log(`[FilePersistence] No existing data file at ${this.filePath}, starting fresh`);
        return [];
      }
      
      const content = await file.text();
      const movies = JSON.parse(content) as Movie[];
      console.log(`[FilePersistence] Loaded ${movies.length} movies from ${this.filePath}`);
      return movies;
      
    } catch (error) {
      console.error(`[FilePersistence] Error loading movies:`, error);
      return [];
    }
  }

  // Save movies to file
  async saveMovies(movies: Movie[]): Promise<boolean> {
    try {
      await Bun.write(this.filePath, JSON.stringify(movies, null, 2));
      console.log(`[FilePersistence] Saved ${movies.length} movies to ${this.filePath}`);
      return true;
      
    } catch (error) {
      console.error(`[FilePersistence] Error saving movies:`, error);
      console.log(`[FilePersistence] Note: Directory may not exist. In production, ensure /app/data directory exists.`);
      return false;
    }
  }

  // Get file info for debugging
  async getFileInfo(): Promise<{ exists: boolean; size?: number; path: string }> {
    try {
      const file = Bun.file(this.filePath);
      const exists = await file.exists();
      
      if (exists) {
        const size = file.size;
        return { exists, size, path: this.filePath };
      }
      
      return { exists: false, path: this.filePath };
      
    } catch (error) {
      console.error(`[FilePersistence] Error getting file info:`, error);
      return { exists: false, path: this.filePath };
    }
  }
}
