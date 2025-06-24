interface TMDBTVShow {
  id: number;
  name: string;
  overview?: string;
  first_air_date?: string;
  last_air_date?: string;
  genre_ids?: number[];
  genres?: Array<{ id: number; name: string }>;
  origin_country?: string[];
  original_language?: string;
  poster_path?: string;
  backdrop_path?: string;
  vote_average?: number;
  vote_count?: number;
  popularity?: number;
  adult?: boolean;
  created_by?: Array<{ id: number; name: string }>;
  networks?: Array<{ id: number; name: string; logo_path?: string }>;
  number_of_episodes?: number;
  number_of_seasons?: number;
  episode_run_time?: number[];
  status?: string;
}

interface TMDBSearchResponse {
  page: number;
  results: TMDBTVShow[];
  total_pages: number;
  total_results: number;
}

interface TMDBTVDetails extends TMDBTVShow {
  external_ids?: {
    imdb_id?: string;
    tvdb_id?: number;
  };
  aggregate_credits?: {
    cast?: Array<{ name: string; character?: string; total_episode_count?: number }>;
  };
}

export interface TVShowData {
  id: number;
  title: string;
  creator?: string;
  year?: number;
  description?: string;
  genres?: string[];
  seasons?: number;
  episodes?: number;
  episodeRuntime?: number;
  network?: string;
  status?: string;
  tmdbId?: number;
  imdbId?: string;
  imdbRating?: number;
  imageUrl?: string;
  language?: string;
  country?: string;
  firstAirDate?: string;
  lastAirDate?: string;
  cast?: string[];
}

export class TVMetadataService {
  // Using TMDB API - you'll need to get a free API key from https://www.themoviedb.org/settings/api
  private readonly apiKey = process.env.TMDB_API_KEY || '';
  private readonly baseUrl = 'https://api.themoviedb.org/3';
  private readonly imageBaseUrl = 'https://image.tmdb.org/t/p/w500';
  
  constructor() {
    if (!this.apiKey) {
      console.warn('TMDB_API_KEY not found in environment variables. TV show metadata will not be available.');
    }
  }
  
  async searchTVShow(title: string, year?: number): Promise<TVShowData | null> {
    if (!this.apiKey) {
      console.warn('TMDB API key not configured');
      return null;
    }
    
    try {
      let query = encodeURIComponent(title);
      let url = `${this.baseUrl}/search/tv?api_key=${this.apiKey}&query=${query}`;
      
      if (year) {
        url += `&first_air_date_year=${year}`;
      }
      
      const response = await fetch(url);
      if (!response.ok) {
        console.error(`TMDB API error: ${response.status}`);
        return null;
      }
      
      const data: TMDBSearchResponse = await response.json();
      
      if (!data.results || data.results.length === 0) {
        console.log(`No TV shows found for "${title}"`);
        return null;
      }
      
      // Get detailed information for the first result
      const basicResult = data.results[0];
      return await this.getTVShowDetails(basicResult.id);
    } catch (error) {
      console.error('Error fetching TV show data from TMDB:', error);
      return null;
    }
  }
  
  async getTVShowDetails(tmdbId: number): Promise<TVShowData | null> {
    if (!this.apiKey) return null;
    
    try {
      const url = `${this.baseUrl}/tv/${tmdbId}?api_key=${this.apiKey}&append_to_response=external_ids,aggregate_credits`;
      
      const response = await fetch(url);
      if (!response.ok) {
        console.error(`TMDB API error: ${response.status}`);
        return null;
      }
      
      const data: TMDBTVDetails = await response.json();
      return this.parseTVShowData(data);
    } catch (error) {
      console.error('Error fetching TV show details from TMDB:', error);
      return null;
    }
  }
  
  private parseTVShowData(data: TMDBTVDetails): TVShowData {
    // Extract year from first air date
    let year: number | undefined;
    if (data.first_air_date) {
      const yearMatch = data.first_air_date.match(/^\d{4}/);
      if (yearMatch) {
        year = parseInt(yearMatch[0]);
      }
    }
    
    // Get primary network
    const network = data.networks && data.networks.length > 0 ? data.networks[0].name : undefined;
    
    // Get creator/show runner
    const creator = data.created_by && data.created_by.length > 0 
      ? data.created_by.map(c => c.name).join(', ') 
      : undefined;
    
    // Get genres
    const genres = data.genres ? data.genres.map(g => g.name) : undefined;
    
    // Get main cast
    const cast = data.aggregate_credits?.cast
      ?.slice(0, 10) // Top 10 cast members
      ?.map(c => c.name);
    
    // Get average episode runtime
    const episodeRuntime = data.episode_run_time && data.episode_run_time.length > 0 
      ? data.episode_run_time[0] 
      : undefined;
    
    // Build image URL
    const imageUrl = data.poster_path ? `${this.imageBaseUrl}${data.poster_path}` : undefined;
    
    // Get country
    const country = data.origin_country && data.origin_country.length > 0 
      ? data.origin_country[0] 
      : undefined;
    
    return {
      id: data.id,
      title: data.name,
      creator,
      year,
      description: data.overview,
      genres,
      seasons: data.number_of_seasons,
      episodes: data.number_of_episodes,
      episodeRuntime,
      network,
      status: data.status,
      tmdbId: data.id,
      imdbId: data.external_ids?.imdb_id,
      imdbRating: data.vote_average,
      imageUrl,
      language: data.original_language,
      country,
      firstAirDate: data.first_air_date,
      lastAirDate: data.last_air_date,
      cast,
    };
  }
  
  async enrichTVShowData(title: string, year?: number): Promise<Partial<TVShowData> | null> {
    const tvData = await this.searchTVShow(title, year);
    if (!tvData) return null;
    
    return {
      creator: tvData.creator,
      year: tvData.year,
      genres: tvData.genres,
      plot: tvData.description,
      seasons: tvData.seasons,
      episodes: tvData.episodes,
      episodeRuntime: tvData.episodeRuntime,
      network: tvData.network,
      status: tvData.status,
      tmdbId: tvData.tmdbId,
      imdbId: tvData.imdbId,
      imdbRating: tvData.imdbRating,
      posterUrl: tvData.imageUrl,
      language: tvData.language,
      country: tvData.country,
      firstAirDate: tvData.firstAirDate,
      lastAirDate: tvData.lastAirDate,
      cast: tvData.cast,
    };
  }
}