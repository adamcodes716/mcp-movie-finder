// MySQL Network Database Adapter
// This connects to your existing my_reviews table and maps it to the MCP interface
import mysql from 'mysql2/promise';

export interface NetworkMovie {
  id?: number;
  review_year?: number;
  director?: string;
  actors?: string;
  genre?: string;
  rating_10?: number;
  rating_5?: number;
  review_body?: string;
  // Add any other columns you have in your my_reviews table
}

export interface MCPMovie {
  id: string;
  title: string;
  year?: number;
  director?: string;
  cast?: string;
  genre?: string;
  watched: boolean;
  rating?: number;
  notes?: string;
}

export class MySQLNetworkAdapter {
  private connection: mysql.Connection | null = null;
  private config: mysql.ConnectionOptions;

  constructor() {
    this.config = {
      host: process.env.MYSQL_HOST || '192.168.1.100',
      port: parseInt(process.env.MYSQL_PORT || '3306'),
      user: process.env.MYSQL_USERNAME || 'xbmc',
      password: process.env.MYSQL_PASSWORD || 'xbmc',
      database: process.env.MYSQL_DATABASE || 'movie_reviews',
      timezone: 'Z', // Use UTC
    };
  }

  async connect(): Promise<void> {
    try {
      this.connection = await mysql.createConnection(this.config);
      console.log(`[MySQL] Connected to ${this.config.host}:${this.config.port}/${this.config.database}`);
    } catch (error) {
      console.error('[MySQL] Connection failed:', error);
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    if (this.connection) {
      await this.connection.end();
      this.connection = null;
      console.log('[MySQL] Disconnected');
    }
  }

  // Map your database row to MCP format
  private mapToMCPMovie(row: NetworkMovie): MCPMovie {
    return {
      id: row.id?.toString() || Date.now().toString(),
      title: `Movie ${row.id}`, // You might need to add a title column or derive it
      year: row.review_year,
      director: row.director || undefined,
      cast: row.actors || undefined,
      genre: row.genre || undefined,
      watched: true, // Assuming all movies in your reviews table are watched
      rating: row.rating_10 || undefined,
      notes: row.review_body || undefined,
    };
  }

  // Map MCP format back to your database format
  private mapFromMCPMovie(movie: Partial<MCPMovie>): Partial<NetworkMovie> {
    return {
      review_year: movie.year,
      director: movie.director,
      actors: movie.cast,
      genre: movie.genre,
      rating_10: movie.rating,
      rating_5: movie.rating ? Math.round(movie.rating / 2) : undefined, // Convert 10-scale to 5-scale
      review_body: movie.notes,
    };
  }

  async getMovies(filters?: { 
    watchedOnly?: boolean; 
    minRating?: number;
    genre?: string;
    director?: string;
    year?: number;
  }): Promise<MCPMovie[]> {
    if (!this.connection) await this.connect();

    let query = `SELECT * FROM ${process.env.MYSQL_TABLE || 'my_reviews'}`;
    const conditions: string[] = [];
    const params: any[] = [];

    // Apply filters
    if (filters?.minRating) {
      conditions.push('rating_10 >= ?');
      params.push(filters.minRating);
    }

    if (filters?.genre) {
      conditions.push('genre LIKE ?');
      params.push(`%${filters.genre}%`);
    }

    if (filters?.director) {
      conditions.push('director LIKE ?');
      params.push(`%${filters.director}%`);
    }

    if (filters?.year) {
      conditions.push('review_year = ?');
      params.push(filters.year);
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }

    query += ' ORDER BY review_year DESC, rating_10 DESC';

    try {
      const [rows] = await this.connection!.execute(query, params) as [NetworkMovie[], any];
      return rows.map(row => this.mapToMCPMovie(row));
    } catch (error) {
      console.error('[MySQL] Query failed:', error);
      return [];
    }
  }

  async addMovie(movieData: Partial<MCPMovie>): Promise<string> {
    if (!this.connection) await this.connect();

    const dbData = this.mapFromMCPMovie(movieData);
    
    const fields = Object.keys(dbData).filter(key => dbData[key as keyof NetworkMovie] !== undefined);
    const values = fields.map(key => dbData[key as keyof NetworkMovie]);
    const placeholders = fields.map(() => '?').join(', ');

    const query = `INSERT INTO ${process.env.MYSQL_TABLE || 'my_reviews'} (${fields.join(', ')}) VALUES (${placeholders})`;

    try {
      const [result] = await this.connection!.execute(query, values) as [mysql.ResultSetHeader, any];
      const newId = result.insertId.toString();
      console.log(`[MySQL] Added movie with ID: ${newId}`);
      return newId;
    } catch (error) {
      console.error('[MySQL] Insert failed:', error);
      throw error;
    }
  }

  async updateMovie(id: string, updates: Partial<MCPMovie>): Promise<boolean> {
    if (!this.connection) await this.connect();

    const dbUpdates = this.mapFromMCPMovie(updates);
    const fields = Object.keys(dbUpdates).filter(key => dbUpdates[key as keyof NetworkMovie] !== undefined);
    
    if (fields.length === 0) return false;

    const setClause = fields.map(field => `${field} = ?`).join(', ');
    const values = fields.map(key => dbUpdates[key as keyof NetworkMovie]);
    values.push(parseInt(id));

    const query = `UPDATE ${process.env.MYSQL_TABLE || 'my_reviews'} SET ${setClause} WHERE id = ?`;

    try {
      const [result] = await this.connection!.execute(query, values) as [mysql.ResultSetHeader, any];
      console.log(`[MySQL] Updated movie ID: ${id}, affected rows: ${result.affectedRows}`);
      return result.affectedRows > 0;
    } catch (error) {
      console.error('[MySQL] Update failed:', error);
      return false;
    }
  }

  async getMovieById(id: string): Promise<MCPMovie | null> {
    if (!this.connection) await this.connect();

    const query = `SELECT * FROM ${process.env.MYSQL_TABLE || 'my_reviews'} WHERE id = ?`;

    try {
      const [rows] = await this.connection!.execute(query, [parseInt(id)]) as [NetworkMovie[], any];
      if (rows.length === 0) return null;
      
      return this.mapToMCPMovie(rows[0]);
    } catch (error) {
      console.error('[MySQL] Select failed:', error);
      return null;
    }
  }

  async getHighRatedMovies(minRating = 7): Promise<MCPMovie[]> {
    return this.getMovies({ minRating });
  }

  async testConnection(): Promise<boolean> {
    try {
      if (!this.connection) await this.connect();
      await this.connection!.ping();
      console.log('[MySQL] Connection test successful');
      return true;
    } catch (error) {
      console.error('[MySQL] Connection test failed:', error);
      return false;
    }
  }
}
