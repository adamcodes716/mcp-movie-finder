// Simple utility functions for movie operations
export interface Movie {
  id: string;
  title: string;
  year: number;
  watched: boolean;
  rating: number | null;
}

export class MovieUtils {
  static formatMovie(movie: Movie): string {
    return `• ${movie.title} (${movie.year}) - ${movie.watched ? 'Watched' : 'Not watched'}${movie.rating ? ` - ${movie.rating}/10` : ''}`;
  }

  static createMovie(title: string, year: number, watched = false, rating: number | null = null): Movie {
    return {
      id: Date.now().toString(),
      title,
      year,
      watched,
      rating
    };
  }

  static getRecommendations(movies: Movie[]): string {
    const watchedMovies = movies.filter(m => m.watched && m.rating && m.rating >= 7);
    
    if (watchedMovies.length === 0) {
      return "No recommendations available yet. Add and rate some movies you've watched first!";
    }

    return `Based on your preferences (you enjoyed ${watchedMovies.slice(0, 3).map(m => m.title).join(', ')}), here are some recommendations:\n\n` +
      "1. Consider similar genres and directors\n" +
      "2. Look for movies from the same time period\n" +
      "3. Check out sequels or related films\n\n" +
      "Note: This is a basic recommendation system.";
  }
}

export const SAMPLE_MOVIES: Movie[] = [
  { id: "1", title: "The Matrix", year: 1999, watched: true, rating: 9 },
  { id: "2", title: "Inception", year: 2010, watched: true, rating: 8 },
  { id: "3", title: "Blade Runner 2049", year: 2017, watched: false, rating: null }
];
