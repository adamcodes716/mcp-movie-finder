import { Database } from 'bun:sqlite';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Migration script to transfer existing movie data to new media schema
async function migrateMoviesToMedia() {
  console.log('Starting migration from movies to media schema...');
  
  // Open the existing database
  const oldDb = new Database(join(dirname(__dirname), '..', 'movies.db'));
  const newDb = new Database(join(dirname(__dirname), '..', 'media.db'));
  
  try {
    // Get all movies from old schema
    const oldMovies = oldDb.query('SELECT * FROM movies').all();
    console.log(`Found ${oldMovies.length} movies to migrate`);
    
    // Begin transaction for new database
    newDb.transaction(() => {
      const insertMedia = newDb.prepare(`
        INSERT INTO media (
          id, type, title, year, watched, rating, date_watched, notes,
          genres, plot, language, country, poster_url, release_date, keywords,
          liked_aspects, disliked_aspects, mood, recommendation_context
        ) VALUES (
          ?, 'movie', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
        )
      `);
      
      const insertMovie = newDb.prepare(`
        INSERT INTO movies (
          media_id, director, cast, runtime, imdb_id, tmdb_id,
          imdb_rating, rotten_tomatoes_rating, budget, box_office
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      
      for (const movie of oldMovies) {
        // Insert into media table
        insertMedia.run(
          movie.id,
          movie.title,
          movie.year,
          movie.watched,
          movie.rating,
          movie.date_watched,
          movie.notes,
          movie.genres,
          movie.plot,
          movie.language,
          movie.country,
          movie.poster_url,
          movie.release_date,
          movie.keywords,
          movie.liked_aspects,
          movie.disliked_aspects,
          movie.mood,
          movie.recommendation_context
        );
        
        // Insert into movies table
        insertMovie.run(
          movie.id,
          movie.director,
          movie.cast,
          movie.runtime,
          movie.imdb_id,
          movie.tmdb_id,
          movie.imdb_rating,
          movie.rotten_tomatoes_rating,
          movie.budget,
          movie.box_office
        );
      }
    })();
    
    console.log('Migration completed successfully!');
    console.log('You can now safely delete the old movies.db file if desired.');
    
  } catch (error) {
    console.error('Migration failed:', error);
    throw error;
  } finally {
    oldDb.close();
    newDb.close();
  }
}

// Run migration
if (import.meta.main) {
  migrateMoviesToMedia().catch(console.error);
}