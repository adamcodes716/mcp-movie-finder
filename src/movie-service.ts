// Movie metadata service using OMDB API (free tier available)
// You can also use TMDB API for more comprehensive data

interface OMDBMovieData {
  Title: string;
  Year: string;
  Rated: string;
  Released: string;
  Runtime: string;
  Genre: string;
  Director: string;
  Writer: string;
  Actors: string;
  Plot: string;
  Language: string;
  Country: string;
  Awards: string;
  Poster: string;
  Ratings: Array<{
    Source: string;
    Value: string;
  }>;
  Metascore: string;
  imdbRating: string;
  imdbVotes: string;
  imdbID: string;
  Type: string;
  DVD: string;
  BoxOffice: string;
  Production: string;
  Website: string;
  Response: string;
}

export class MovieMetadataService {
  private apiKey: string;
  private baseUrl = 'http://www.omdbapi.com/';

  constructor(apiKey?: string) {
    this.apiKey = apiKey || process.env.OMDB_API_KEY || '';
  }

  async searchMovie(title: string, year?: number): Promise<OMDBMovieData | null> {
    if (!this.apiKey) {
      console.warn('OMDB API key not provided. Movie metadata will not be fetched.');
      return null;
    }

    try {
      const params = new URLSearchParams({
        apikey: this.apiKey,
        t: title,
        type: 'movie',
        plot: 'full'
      });

      if (year) {
        params.set('y', year.toString());
      }

      const response = await fetch(`${this.baseUrl}?${params}`);
      const data = await response.json() as OMDBMovieData;

      if (data.Response === 'False') {
        return null;
      }

      return data;
    } catch (error) {
      console.error('Error fetching movie metadata:', error);
      return null;
    }
  }

  parseMovieData(omdbData: OMDBMovieData) {
    const parseRating = (ratingStr: string): number | undefined => {
      const rating = parseFloat(ratingStr);
      return isNaN(rating) ? undefined : rating;
    };

    const parseRuntime = (runtime: string): number | undefined => {
      const match = runtime.match(/(\d+)/);
      return match ? parseInt(match[1]) : undefined;
    };

    const parseBoxOffice = (boxOffice: string): number | undefined => {
      const match = boxOffice.match(/\$?([\d,]+)/);
      return match ? parseInt(match[1].replace(/,/g, '')) : undefined;
    };

    const getRottenTomatoesRating = (ratings: typeof omdbData.Ratings): number | undefined => {
      const rtRating = ratings.find(r => r.Source === 'Rotten Tomatoes');
      if (rtRating) {
        const match = rtRating.Value.match(/(\d+)%/);
        return match ? parseInt(match[1]) : undefined;
      }
      return undefined;
    };

    return {
      imdbId: omdbData.imdbID,
      genres: JSON.stringify(omdbData.Genre.split(', ')),
      director: omdbData.Director !== 'N/A' ? omdbData.Director : undefined,
      cast: JSON.stringify(omdbData.Actors !== 'N/A' ? omdbData.Actors.split(', ') : []),
      plot: omdbData.Plot !== 'N/A' ? omdbData.Plot : undefined,
      runtime: parseRuntime(omdbData.Runtime),
      language: omdbData.Language !== 'N/A' ? omdbData.Language : undefined,
      country: omdbData.Country !== 'N/A' ? omdbData.Country : undefined,
      imdbRating: parseRating(omdbData.imdbRating),
      rottenTomatoesRating: getRottenTomatoesRating(omdbData.Ratings),
      posterUrl: omdbData.Poster !== 'N/A' ? omdbData.Poster : undefined,
      releaseDate: omdbData.Released !== 'N/A' ? omdbData.Released : undefined,
      boxOffice: parseBoxOffice(omdbData.BoxOffice || ''),
    };
  }

  async enrichMovieData(title: string, year?: number) {
    const omdbData = await this.searchMovie(title, year);
    if (!omdbData) {
      return {};
    }

    return this.parseMovieData(omdbData);
  }
}

export const movieService = new MovieMetadataService();