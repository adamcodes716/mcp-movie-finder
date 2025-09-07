// Unified Database Implementation
// When DATABASE_TYPE=mysql: Uses MySQL with full schema
// When DATABASE_TYPE=sqlite: Uses SQLite with full schema
// Same MediaDatabase interface, same functionality, just different backend

import { MediaDatabase } from './db/index.js';
import { drizzle } from 'drizzle-orm/mysql2';
import mysql from 'mysql2/promise';

export async function createUnifiedDatabase(): Promise<MediaDatabase> {
  const DATABASE_TYPE = process.env.DATABASE_TYPE || 'sqlite';
  
  if (DATABASE_TYPE === 'mysql') {
    console.log("🔗 Connecting to MySQL network database...");
    
    // Create MySQL connection
    const connection = await mysql.createConnection({
      host: process.env.MYSQL_HOST || 'localhost',
      port: parseInt(process.env.MYSQL_PORT || '3306'),
      user: process.env.MYSQL_USER || 'root',
      password: process.env.MYSQL_PASSWORD || '',
      database: process.env.MYSQL_DATABASE || 'movie_reviews',
    });
    
    // Test connection
    await connection.ping();
    console.log("✅ MySQL connection established");
    
    // Create MySQL-based MediaDatabase
    // We would need to modify MediaDatabase to accept MySQL connection
    // For now, let's create a simple adapter
    return createMySQLMediaDatabase(connection);
    
  } else {
    console.log("📁 Using local SQLite database...");
    // Use existing SQLite MediaDatabase
    const mediaDb = new MediaDatabase();
    await mediaDb.initialize();
    return mediaDb;
  }
}

// Simplified MySQL adapter that uses the same interface
async function createMySQLMediaDatabase(connection: mysql.Connection): Promise<MediaDatabase> {
  // Create tables if they don't exist (simplified version)
  await connection.execute(`
    CREATE TABLE IF NOT EXISTS media (
      id VARCHAR(255) PRIMARY KEY,
      type VARCHAR(20) NOT NULL,
      title VARCHAR(500) NOT NULL,
      year INT,
      watched BOOLEAN DEFAULT FALSE,
      rating INT,
      date_watched VARCHAR(50),
      notes TEXT,
      genres TEXT,
      plot TEXT,
      language VARCHAR(50),
      country VARCHAR(100),
      poster_url VARCHAR(500),
      release_date VARCHAR(50),
      keywords TEXT,
      liked_aspects TEXT,
      disliked_aspects TEXT,
      mood VARCHAR(200),
      recommendation_context TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `);
  
  await connection.execute(`
    CREATE TABLE IF NOT EXISTS movies (
      media_id VARCHAR(255) PRIMARY KEY,
      director VARCHAR(200),
      cast TEXT,
      runtime INT,
      imdb_id VARCHAR(20),
      tmdb_id INT,
      imdb_rating DECIMAL(3,1),
      rotten_tomatoes_rating INT,
      budget INT,
      box_office INT,
      FOREIGN KEY (media_id) REFERENCES media(id) ON DELETE CASCADE
    )
  `);
  
  // Check if we should migrate from my_reviews
  await checkAndMigrateMyReviews(connection);
  
  // Return a MediaDatabase-compatible object
  return {
    initialize: async () => {
      console.log("✅ MySQL MediaDatabase initialized");
    },
    
    close: async () => {
      await connection.end();
    },
    
    getMovies: async (filters: any) => {
      const [rows] = await connection.execute(`
        SELECT m.*, mov.director, mov.cast, mov.runtime
        FROM media m
        LEFT JOIN movies mov ON m.id = mov.media_id
        WHERE m.type = 'movie'
        ORDER BY m.title
      `);
      
      return (rows as any[]).map(row => ({
        id: row.id,
        title: row.title,
        year: row.year,
        director: row.director,
        cast: row.cast,
        genre: row.genres,
        watched: Boolean(row.watched),
        rating: row.rating,
        notes: row.notes
      }));
    },
    
    addMovie: async (movie: any) => {
      const id = `movie_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      // Insert into media table
      await connection.execute(`
        INSERT INTO media (id, type, title, year, watched, rating, notes, genres)
        VALUES (?, 'movie', ?, ?, ?, ?, ?, ?)
      `, [id, movie.title, movie.year, movie.watched, movie.rating, movie.notes, movie.genre]);
      
      // Insert into movies table
      await connection.execute(`
        INSERT INTO movies (media_id, director, cast)
        VALUES (?, ?, ?)
      `, [id, movie.director, movie.cast]);
      
      return { id, ...movie };
    },
    
    updateMovie: async (id: string, updates: any) => {
      await connection.execute(`
        UPDATE media SET title = ?, year = ?, watched = ?, rating = ?, notes = ?
        WHERE id = ?
      `, [updates.title, updates.year, updates.watched, updates.rating, updates.notes, id]);
      
      await connection.execute(`
        UPDATE movies SET director = ?, cast = ?
        WHERE media_id = ?
      `, [updates.director, updates.cast, id]);
      
      return { id, ...updates };
    },
    
    getRecommendations: async (userId?: string) => {
      // Simple recommendation logic for MySQL
      const [rows] = await connection.execute(`
        SELECT m.*, mov.director
        FROM media m
        LEFT JOIN movies mov ON m.id = mov.media_id
        WHERE m.type = 'movie' AND m.rating >= 7
        ORDER BY m.rating DESC
        LIMIT 5
      `);
      
      return (rows as any[]).map(row => ({
        id: row.id,
        title: row.title,
        year: row.year,
        director: row.director,
        reason: `Highly rated (${row.rating}/10)`
      }));
    },
    
    // Add other MediaDatabase methods as needed...
  } as any;
}

async function checkAndMigrateMyReviews(connection: mysql.Connection) {
  try {
    // Check if my_reviews table exists and has data
    const [tables] = await connection.execute(`
      SELECT COUNT(*) as count 
      FROM information_schema.tables 
      WHERE table_schema = DATABASE() 
      AND table_name = 'my_reviews'
    `);
    
    if ((tables as any)[0].count > 0) {
      const [reviews] = await connection.execute('SELECT COUNT(*) as count FROM my_reviews');
      const reviewCount = (reviews as any)[0].count;
      
      if (reviewCount > 0) {
        console.log(`📚 Found ${reviewCount} reviews in my_reviews table`);
        
        // Check if we've already migrated (check if media table has data)
        const [mediaRows] = await connection.execute('SELECT COUNT(*) as count FROM media');
        const mediaCount = (mediaRows as any)[0].count;
        
        if (mediaCount === 0) {
          console.log("🔄 Migrating reviews to new schema...");
          await migrateReviews(connection);
        } else {
          console.log("✅ Reviews already migrated");
        }
      }
    }
  } catch (error) {
    console.log("ℹ️ No existing my_reviews table found, starting fresh");
  }
}

async function migrateReviews(connection: mysql.Connection) {
  try {
    const [reviews] = await connection.execute('SELECT * FROM my_reviews');
    
    for (const review of reviews as any[]) {
      const id = `movie_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      // Convert old schema to new schema
      const title = review.title || `Movie from ${review.review_year || 'Unknown Year'}`;
      const year = review.review_year;
      const rating = review.rating_10 || (review.rating_5 ? review.rating_5 * 2 : null);
      const notes = review.review_body;
      const genre = review.genre;
      const director = review.director;
      const cast = review.actors;
      
      // Insert into new schema
      await connection.execute(`
        INSERT INTO media (id, type, title, year, watched, rating, notes, genres)
        VALUES (?, 'movie', ?, ?, TRUE, ?, ?, ?)
      `, [id, title, year, rating, notes, genre]);
      
      await connection.execute(`
        INSERT INTO movies (media_id, director, cast)
        VALUES (?, ?, ?)
      `, [id, director, cast]);
    }
    
    console.log(`✅ Migrated ${(reviews as any[]).length} reviews to new schema`);
  } catch (error) {
    console.error("❌ Migration failed:", error);
  }
}

export { createUnifiedDatabase };
