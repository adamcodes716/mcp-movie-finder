// MySQL Schema Setup for Relational Database Mode
// This creates the same sophisticated schema in MySQL that we have in SQLite
import mysql from 'mysql2/promise';
import { drizzle } from 'drizzle-orm/mysql2';
import { mysqlTable, varchar, int, boolean, text, decimal, timestamp } from 'drizzle-orm/mysql-core';
import { relations } from 'drizzle-orm';

// MySQL version of our sophisticated schema
export const media = mysqlTable('media', {
  id: varchar('id', { length: 255 }).primaryKey(),
  type: varchar('type', { length: 20 }).notNull(), // 'movie' | 'book' | 'tv_show'
  title: varchar('title', { length: 500 }).notNull(),
  year: int('year'),
  watched: boolean('watched').notNull().default(false),
  rating: int('rating'),
  dateWatched: varchar('date_watched', { length: 50 }),
  notes: text('notes'),
  
  // Common metadata fields
  genres: text('genres'), // JSON array as string
  plot: text('plot'),
  language: varchar('language', { length: 50 }),
  country: varchar('country', { length: 100 }),
  posterUrl: varchar('poster_url', { length: 500 }),
  releaseDate: varchar('release_date', { length: 50 }),
  keywords: text('keywords'), // JSON array as string
  
  // User preference analysis
  likedAspects: text('liked_aspects'),
  dislikedAspects: text('disliked_aspects'),
  mood: varchar('mood', { length: 200 }),
  recommendationContext: text('recommendation_context'),
  
  // Timestamps
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow().onUpdateNow(),
});

export const movies = mysqlTable('movies', {
  mediaId: varchar('media_id', { length: 255 }).primaryKey(),
  director: varchar('director', { length: 200 }),
  cast: text('cast'), // JSON array as string
  runtime: int('runtime'), // minutes
  imdbId: varchar('imdb_id', { length: 20 }),
  tmdbId: int('tmdb_id'),
  imdbRating: decimal('imdb_rating', { precision: 3, scale: 1 }),
  rottenTomatoesRating: int('rotten_tomatoes_rating'),
  budget: int('budget'),
  boxOffice: int('box_office'),
});

export const books = mysqlTable('books', {
  mediaId: varchar('media_id', { length: 255 }).primaryKey(),
  author: varchar('author', { length: 200 }),
  isbn: varchar('isbn', { length: 20 }),
  pages: int('pages'),
  publisher: varchar('publisher', { length: 200 }),
  goodreadsId: varchar('goodreads_id', { length: 20 }),
  goodreadsRating: decimal('goodreads_rating', { precision: 3, scale: 2 }),
});

export const tvShows = mysqlTable('tv_shows', {
  mediaId: varchar('media_id', { length: 255 }).primaryKey(),
  creators: text('creators'), // JSON array as string
  network: varchar('network', { length: 100 }),
  seasons: int('seasons'),
  episodes: int('episodes'),
  status: varchar('status', { length: 50 }), // 'ongoing', 'ended', 'cancelled'
  imdbId: varchar('imdb_id', { length: 20 }),
  tmdbId: int('tmdb_id'),
  imdbRating: decimal('imdb_rating', { precision: 3, scale: 1 }),
});

// Relations (same as SQLite version)
export const mediaRelations = relations(media, ({ one }) => ({
  movie: one(movies, {
    fields: [media.id],
    references: [movies.mediaId],
  }),
  book: one(books, {
    fields: [media.id],
    references: [books.mediaId],
  }),
  tvShow: one(tvShows, {
    fields: [media.id],
    references: [tvShows.mediaId],
  }),
}));

export const moviesRelations = relations(movies, ({ one }) => ({
  media: one(media, {
    fields: [movies.mediaId],
    references: [media.id],
  }),
}));

export const booksRelations = relations(books, ({ one }) => ({
  media: one(media, {
    fields: [books.mediaId],
    references: [media.id],
  }),
}));

export const tvShowsRelations = relations(tvShows, ({ one }) => ({
  media: one(media, {
    fields: [tvShows.mediaId],
    references: [media.id],
  }),
}));

// Migration utility to import your existing my_reviews data
export async function migrateFromMyReviews(connection: mysql.Connection) {
  const db = drizzle(connection, { 
    schema: { media, movies, mediaRelations, moviesRelations }
  });
  
  console.log("🔄 Checking for existing my_reviews data to migrate...");
  
  try {
    // Check if my_reviews table exists
    const [tables] = await connection.execute(`
      SELECT COUNT(*) as count 
      FROM information_schema.tables 
      WHERE table_schema = DATABASE() 
      AND table_name = 'my_reviews'
    `);
    
    if ((tables as any)[0].count > 0) {
      // Get existing reviews
      const [reviews] = await connection.execute('SELECT * FROM my_reviews LIMIT 5');
      console.log(`📚 Found ${(reviews as any[]).length} reviews to potentially migrate`);
      console.log("Sample review structure:", reviews[0]);
      
      // You can implement migration logic here
      // For now, just log what we found
      return true;
    }
  } catch (error) {
    console.log("ℹ️ No my_reviews table found, starting fresh");
  }
  
  return false;
}
