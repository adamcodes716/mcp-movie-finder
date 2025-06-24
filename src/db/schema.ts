import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core';

export const movies = sqliteTable('movies', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  year: integer('year'),
  watched: integer('watched', { mode: 'boolean' }).notNull().default(false),
  rating: integer('rating'),
  dateWatched: text('date_watched'),
  notes: text('notes'),
  
  // Metadata fields
  imdbId: text('imdb_id'),
  tmdbId: integer('tmdb_id'),
  genres: text('genres'), // JSON array as string
  director: text('director'),
  cast: text('cast'), // JSON array as string
  plot: text('plot'),
  runtime: integer('runtime'), // minutes
  language: text('language'),
  country: text('country'),
  imdbRating: real('imdb_rating'),
  rottenTomatoesRating: integer('rotten_tomatoes_rating'),
  posterUrl: text('poster_url'),
  releaseDate: text('release_date'),
  budget: integer('budget'),
  boxOffice: integer('box_office'),
  keywords: text('keywords'), // JSON array as string
  
  // User preference analysis
  likedAspects: text('liked_aspects'), // What user liked about it
  dislikedAspects: text('disliked_aspects'), // What user didn't like
  mood: text('mood'), // When/why they watched it
  recommendationContext: text('recommendation_context'), // Context for recommendations
});

export type Movie = typeof movies.$inferSelect;
export type NewMovie = typeof movies.$inferInsert;