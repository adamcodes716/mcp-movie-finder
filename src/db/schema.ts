import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core';
import { relations } from 'drizzle-orm';

// Base media table for common fields
export const media = sqliteTable('media', {
  id: text('id').primaryKey(),
  type: text('type').$type<'movie' | 'book' | 'tv_show'>().notNull(),
  title: text('title').notNull(),
  year: integer('year'),
  watched: integer('watched', { mode: 'boolean' }).notNull().default(false),
  rating: integer('rating'),
  dateWatched: text('date_watched'),
  notes: text('notes'),
  
  // Common metadata fields
  genres: text('genres'), // JSON array as string
  plot: text('plot'),
  language: text('language'),
  country: text('country'),
  posterUrl: text('poster_url'),
  releaseDate: text('release_date'),
  keywords: text('keywords'), // JSON array as string
  
  // User preference analysis
  likedAspects: text('liked_aspects'), // What user liked about it
  dislikedAspects: text('disliked_aspects'), // What user didn't like
  mood: text('mood'), // When/why they watched it
  recommendationContext: text('recommendation_context'), // Context for recommendations
});

// Movie-specific table
export const movies = sqliteTable('movies', {
  mediaId: text('media_id').primaryKey().references(() => media.id, { onDelete: 'cascade' }),
  director: text('director'),
  cast: text('cast'), // JSON array as string
  runtime: integer('runtime'), // minutes
  imdbId: text('imdb_id'),
  tmdbId: integer('tmdb_id'),
  imdbRating: real('imdb_rating'),
  rottenTomatoesRating: integer('rotten_tomatoes_rating'),
  budget: integer('budget'),
  boxOffice: integer('box_office'),
});

// Book-specific table
export const books = sqliteTable('books', {
  mediaId: text('media_id').primaryKey().references(() => media.id, { onDelete: 'cascade' }),
  author: text('author'),
  isbn: text('isbn'),
  pages: integer('pages'),
  publisher: text('publisher'),
  googleBooksId: text('google_books_id'),
  goodreadsRating: real('goodreads_rating'),
  averageRating: real('average_rating'),
  ratingsCount: integer('ratings_count'),
});

// TV show-specific table
export const tvShows = sqliteTable('tv_shows', {
  mediaId: text('media_id').primaryKey().references(() => media.id, { onDelete: 'cascade' }),
  creator: text('creator'),
  cast: text('cast'), // JSON array as string
  seasons: integer('seasons'),
  episodes: integer('episodes'),
  episodeRuntime: integer('episode_runtime'), // minutes per episode
  network: text('network'),
  status: text('status'), // 'ongoing' | 'completed' | 'cancelled'
  tmdbId: integer('tmdb_id'),
  imdbId: text('imdb_id'),
  imdbRating: real('imdb_rating'),
  firstAirDate: text('first_air_date'),
  lastAirDate: text('last_air_date'),
});

// Relations
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

export const movieRelations = relations(movies, ({ one }) => ({
  media: one(media, {
    fields: [movies.mediaId],
    references: [media.id],
  }),
}));

export const bookRelations = relations(books, ({ one }) => ({
  media: one(media, {
    fields: [books.mediaId],
    references: [media.id],
  }),
}));

export const tvShowRelations = relations(tvShows, ({ one }) => ({
  media: one(media, {
    fields: [tvShows.mediaId],
    references: [media.id],
  }),
}));

// Type exports
export type Media = typeof media.$inferSelect;
export type NewMedia = typeof media.$inferInsert;
export type Movie = typeof movies.$inferSelect;
export type NewMovie = typeof movies.$inferInsert;
export type Book = typeof books.$inferSelect;
export type NewBook = typeof books.$inferInsert;
export type TVShow = typeof tvShows.$inferSelect;
export type NewTVShow = typeof tvShows.$inferInsert;

// Combined types for convenience
export type MediaWithMovie = Media & { movie: Movie };
export type MediaWithBook = Media & { book: Book };
export type MediaWithTVShow = Media & { tvShow: TVShow };