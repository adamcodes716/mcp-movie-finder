import { drizzle } from 'drizzle-orm/bun-sqlite';
import { Database } from 'bun:sqlite';
import { 
  media, movies, books, tvShows,
  mediaRelations, movieRelations, bookRelations, tvShowRelations,
  type Media, type NewMedia,
  type Movie, type NewMovie,
  type Book, type NewBook,
  type TVShow, type NewTVShow,
  type MediaWithMovie, type MediaWithBook, type MediaWithTVShow
} from './schema';
import { eq, and, gte, desc, asc, like, sql } from 'drizzle-orm';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Create SQLite database instance
const sqlite = new Database(join(dirname(__dirname), '..', 'media.db'));

// Create database with schema and relations
export const db = drizzle(sqlite, {
  schema: {
    media,
    movies,
    books,
    tvShows,
    mediaRelations,
    movieRelations,
    bookRelations,
    tvShowRelations,
  },
});

// Create tables if they don't exist - Updated schema for multi-media support
sqlite.run(`
  CREATE TABLE IF NOT EXISTS media (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL CHECK(type IN ('movie', 'book', 'tv_show')),
    title TEXT NOT NULL,
    year INTEGER,
    watched INTEGER NOT NULL DEFAULT 0,
    rating INTEGER CHECK(rating >= 1 AND rating <= 10),
    date_watched TEXT,
    notes TEXT,
    
    -- Common metadata fields
    genres TEXT,
    plot TEXT,
    language TEXT,
    country TEXT,
    poster_url TEXT,
    release_date TEXT,
    keywords TEXT,
    
    -- User preference analysis
    liked_aspects TEXT,
    disliked_aspects TEXT,
    mood TEXT,
    recommendation_context TEXT
  )
`);

sqlite.run(`
  CREATE TABLE IF NOT EXISTS movies (
    media_id TEXT PRIMARY KEY REFERENCES media(id) ON DELETE CASCADE,
    director TEXT,
    cast TEXT,
    runtime INTEGER,
    imdb_id TEXT,
    tmdb_id INTEGER,
    imdb_rating REAL,
    rotten_tomatoes_rating INTEGER,
    budget INTEGER,
    box_office INTEGER
  )
`);

sqlite.run(`
  CREATE TABLE IF NOT EXISTS books (
    media_id TEXT PRIMARY KEY REFERENCES media(id) ON DELETE CASCADE,
    author TEXT,
    isbn TEXT,
    pages INTEGER,
    publisher TEXT,
    google_books_id TEXT,
    goodreads_rating REAL,
    average_rating REAL,
    ratings_count INTEGER
  )
`);

sqlite.run(`
  CREATE TABLE IF NOT EXISTS tv_shows (
    media_id TEXT PRIMARY KEY REFERENCES media(id) ON DELETE CASCADE,
    creator TEXT,
    cast TEXT,
    seasons INTEGER,
    episodes INTEGER,
    episode_runtime INTEGER,
    network TEXT,
    status TEXT,
    tmdb_id INTEGER,
    imdb_id TEXT,
    imdb_rating REAL,
    first_air_date TEXT,
    last_air_date TEXT
  )
`);

export class MediaDatabase {
  // Generic media operations
  async addMedia(mediaData: NewMedia, specificData?: NewMovie | NewBook | NewTVShow): Promise<void> {
    await db.transaction(async (tx) => {
      // Insert into media table
      await tx.insert(media).values(mediaData);
      
      // Insert into specific table based on type
      if (specificData) {
        switch (mediaData.type) {
          case 'movie':
            await tx.insert(movies).values({ 
              mediaId: mediaData.id, 
              ...(specificData as NewMovie) 
            });
            break;
          case 'book':
            await tx.insert(books).values({ 
              mediaId: mediaData.id, 
              ...(specificData as NewBook) 
            });
            break;
          case 'tv_show':
            await tx.insert(tvShows).values({ 
              mediaId: mediaData.id, 
              ...(specificData as NewTVShow) 
            });
            break;
        }
      }
    });
  }

  async getMedia(filters?: { 
    type?: 'movie' | 'book' | 'tv_show';
    watchedOnly?: boolean; 
    minRating?: number;
    genre?: string;
    director?: string;
    author?: string;
    year?: number;
  }): Promise<(MediaWithMovie | MediaWithBook | MediaWithTVShow)[]> {
    const conditions = [];
    
    if (filters?.type) {
      conditions.push(eq(media.type, filters.type));
    }
    
    if (filters?.watchedOnly) {
      conditions.push(eq(media.watched, true));
    }
    
    if (filters?.minRating) {
      conditions.push(gte(media.rating, filters.minRating));
    }

    if (filters?.genre) {
      conditions.push(like(media.genres, `%${filters.genre}%`));
    }

    if (filters?.year) {
      conditions.push(eq(media.year, filters.year));
    }
    
    const query = db.query.media.findMany({
      where: conditions.length > 0 ? and(...conditions) : undefined,
      with: {
        movie: true,
        book: true,
        tvShow: true,
      },
      orderBy: [desc(media.dateWatched), asc(media.title)],
    });
    
    return query as Promise<(MediaWithMovie | MediaWithBook | MediaWithTVShow)[]>;
  }

  async getMediaById(id: string): Promise<MediaWithMovie | MediaWithBook | MediaWithTVShow | null> {
    const result = await db.query.media.findFirst({
      where: eq(media.id, id),
      with: {
        movie: true,
        book: true,
        tvShow: true,
      },
    });
    
    return result as (MediaWithMovie | MediaWithBook | MediaWithTVShow) || null;
  }

  async findMediaByTitle(title: string, type?: 'movie' | 'book' | 'tv_show', year?: number): Promise<Media | null> {
    const conditions = [eq(media.title, title)];
    
    if (type) {
      conditions.push(eq(media.type, type));
    }
    
    if (year) {
      conditions.push(eq(media.year, year));
    }
    
    const results = await db.select()
      .from(media)
      .where(and(...conditions))
      .limit(1);
      
    return results[0] || null;
  }

  async updateMedia(id: string, updates: Partial<Media>, specificUpdates?: Partial<Movie | Book | TVShow>): Promise<boolean> {
    const mediaItem = await this.getMediaById(id);
    if (!mediaItem) return false;

    await db.transaction(async (tx) => {
      // Update media table
      const mediaUpdateData: any = {};
      Object.keys(updates).forEach(key => {
        if (updates[key as keyof Media] !== undefined) {
          mediaUpdateData[key] = updates[key as keyof Media];
        }
      });
      
      if (updates.watched && !mediaItem.dateWatched) {
        mediaUpdateData.dateWatched = new Date().toISOString();
      }
      
      if (Object.keys(mediaUpdateData).length > 0) {
        await tx.update(media)
          .set(mediaUpdateData)
          .where(eq(media.id, id));
      }

      // Update specific table if provided
      if (specificUpdates && Object.keys(specificUpdates).length > 0) {
        switch (mediaItem.type) {
          case 'movie':
            await tx.update(movies)
              .set(specificUpdates as Partial<Movie>)
              .where(eq(movies.mediaId, id));
            break;
          case 'book':
            await tx.update(books)
              .set(specificUpdates as Partial<Book>)
              .where(eq(books.mediaId, id));
            break;
          case 'tv_show':
            await tx.update(tvShows)
              .set(specificUpdates as Partial<TVShow>)
              .where(eq(tvShows.mediaId, id));
            break;
        }
      }
    });
    
    return true;
  }

  // Convenience methods for specific media types
  async getMovies(filters?: { 
    watchedOnly?: boolean; 
    minRating?: number;
    genre?: string;
    director?: string;
    year?: number;
  }): Promise<MediaWithMovie[]> {
    const results = await this.getMedia({ ...filters, type: 'movie' });
    return results.filter(item => item.type === 'movie') as MediaWithMovie[];
  }

  async getBooks(filters?: { 
    watchedOnly?: boolean; 
    minRating?: number;
    genre?: string;
    author?: string;
    year?: number;
  }): Promise<MediaWithBook[]> {
    const results = await this.getMedia({ ...filters, type: 'book' });
    return results.filter(item => item.type === 'book') as MediaWithBook[];
  }

  async getTVShows(filters?: { 
    watchedOnly?: boolean; 
    minRating?: number;
    genre?: string;
    year?: number;
  }): Promise<MediaWithTVShow[]> {
    const results = await this.getMedia({ ...filters, type: 'tv_show' });
    return results.filter(item => item.type === 'tv_show') as MediaWithTVShow[];
  }

  async getHighRatedMedia(type?: 'movie' | 'book' | 'tv_show'): Promise<(MediaWithMovie | MediaWithBook | MediaWithTVShow)[]> {
    return this.getMedia({ 
      type,
      watchedOnly: true,
      minRating: 7 
    });
  }

  async getPreferenceAnalysis(type?: 'movie' | 'book' | 'tv_show'): Promise<{
    favoriteGenres: string[];
    favoriteCreators: string[]; // directors/authors/creators
    averageRating: number;
    totalWatched: number;
    commonLikedAspects: string[];
    mediaType?: string;
  }> {
    const watchedMedia = await this.getMedia({ type, watchedOnly: true });
    
    if (watchedMedia.length === 0) {
      return {
        favoriteGenres: [],
        favoriteCreators: [],
        averageRating: 0,
        totalWatched: 0,
        commonLikedAspects: [],
        mediaType: type
      };
    }

    const genreMap = new Map<string, { count: number; totalRating: number }>();
    const creatorMap = new Map<string, { count: number; totalRating: number }>();
    const likedAspects: string[] = [];
    
    let totalRating = 0;
    let ratedItems = 0;

    watchedMedia.forEach(item => {
      if (item.rating) {
        totalRating += item.rating;
        ratedItems++;
      }

      // Process genres
      if (item.genres) {
        try {
          const genres = JSON.parse(item.genres);
          genres.forEach((genre: string) => {
            const current = genreMap.get(genre) || { count: 0, totalRating: 0 };
            current.count++;
            if (item.rating) current.totalRating += item.rating;
            genreMap.set(genre, current);
          });
        } catch (e) {
          // Handle non-JSON genre data
          if (item.genres.includes(',')) {
            item.genres.split(',').forEach(genre => {
              const trimmed = genre.trim();
              const current = genreMap.get(trimmed) || { count: 0, totalRating: 0 };
              current.count++;
              if (item.rating) current.totalRating += item.rating;
              genreMap.set(trimmed, current);
            });
          }
        }
      }

      // Process creators (director/author/creator)
      let creator: string | undefined;
      if (item.type === 'movie' && item.movie?.director) {
        creator = item.movie.director;
      } else if (item.type === 'book' && item.book?.author) {
        creator = item.book.author;
      } else if (item.type === 'tv_show' && item.tvShow?.creator) {
        creator = item.tvShow.creator;
      }

      if (creator) {
        const current = creatorMap.get(creator) || { count: 0, totalRating: 0 };
        current.count++;
        if (item.rating) current.totalRating += item.rating;
        creatorMap.set(creator, current);
      }

      // Process liked aspects
      if (item.likedAspects) {
        likedAspects.push(...item.likedAspects.split(',').map(a => a.trim()));
      }
    });

    // Sort genres by average rating and frequency
    const favoriteGenres = Array.from(genreMap.entries())
      .filter(([_, data]) => data.count >= 2)
      .sort((a, b) => (b[1].totalRating / b[1].count) - (a[1].totalRating / a[1].count))
      .slice(0, 5)
      .map(([genre]) => genre);

    // Sort creators by rating
    const favoriteCreators = Array.from(creatorMap.entries())
      .filter(([_, data]) => data.count >= 1)
      .sort((a, b) => (b[1].totalRating / b[1].count) - (a[1].totalRating / a[1].count))
      .slice(0, 5)
      .map(([creator]) => creator);

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
      favoriteCreators,
      averageRating: ratedItems > 0 ? totalRating / ratedItems : 0,
      totalWatched: watchedMedia.length,
      commonLikedAspects,
      mediaType: type
    };
  }

  async getAllMedia(): Promise<(MediaWithMovie | MediaWithBook | MediaWithTVShow)[]> {
    return this.getMedia();
  }

  close() {
    // Bun's SQLite database doesn't have a close method
  }
}