interface GoogleBooksItem {
  id: string;
  volumeInfo: {
    title: string;
    authors?: string[];
    publishedDate?: string;
    description?: string;
    pageCount?: number;
    categories?: string[];
    averageRating?: number;
    ratingsCount?: number;
    imageLinks?: {
      thumbnail?: string;
      smallThumbnail?: string;
    };
    publisher?: string;
    industryIdentifiers?: Array<{
      type: string;
      identifier: string;
    }>;
    language?: string;
    country?: string;
  };
}

interface GoogleBooksResponse {
  items?: GoogleBooksItem[];
  totalItems: number;
}

export interface BookData {
  id: string;
  title: string;
  author: string;
  year?: number;
  isbn?: string;
  pages?: number;
  publisher?: string;
  description?: string;
  genres?: string[];
  averageRating?: number;
  ratingsCount?: number;
  imageUrl?: string;
  language?: string;
  country?: string;
}

export class BookMetadataService {
  private readonly baseUrl = 'https://www.googleapis.com/books/v1/volumes';
  
  async searchBook(title: string, author?: string): Promise<BookData | null> {
    try {
      // Build search query
      let query = `intitle:"${title}"`;
      if (author) {
        query += `+inauthor:"${author}"`;
      }
      
      const url = `${this.baseUrl}?q=${encodeURIComponent(query)}&maxResults=1`;
      
      const response = await fetch(url);
      if (!response.ok) {
        console.error(`Google Books API error: ${response.status}`);
        return null;
      }
      
      const data: GoogleBooksResponse = await response.json();
      
      if (!data.items || data.items.length === 0) {
        console.log(`No books found for "${title}"`);
        return null;
      }
      
      return this.parseBookData(data.items[0]);
    } catch (error) {
      console.error('Error fetching book data from Google Books:', error);
      return null;
    }
  }
  
  async searchBookByISBN(isbn: string): Promise<BookData | null> {
    try {
      const url = `${this.baseUrl}?q=isbn:${isbn}&maxResults=1`;
      
      const response = await fetch(url);
      if (!response.ok) {
        console.error(`Google Books API error: ${response.status}`);
        return null;
      }
      
      const data: GoogleBooksResponse = await response.json();
      
      if (!data.items || data.items.length === 0) {
        console.log(`No books found for ISBN "${isbn}"`);
        return null;
      }
      
      return this.parseBookData(data.items[0]);
    } catch (error) {
      console.error('Error fetching book data by ISBN from Google Books:', error);
      return null;
    }
  }
  
  private parseBookData(item: GoogleBooksItem): BookData {
    const volumeInfo = item.volumeInfo;
    
    // Extract ISBN
    let isbn: string | undefined;
    if (volumeInfo.industryIdentifiers) {
      const isbn13 = volumeInfo.industryIdentifiers.find(id => id.type === 'ISBN_13');
      const isbn10 = volumeInfo.industryIdentifiers.find(id => id.type === 'ISBN_10');
      isbn = isbn13?.identifier || isbn10?.identifier;
    }
    
    // Extract year from published date
    let year: number | undefined;
    if (volumeInfo.publishedDate) {
      const yearMatch = volumeInfo.publishedDate.match(/^\d{4}/);
      if (yearMatch) {
        year = parseInt(yearMatch[0]);
      }
    }
    
    // Get best available image
    const imageUrl = volumeInfo.imageLinks?.thumbnail || volumeInfo.imageLinks?.smallThumbnail;
    
    return {
      id: item.id,
      title: volumeInfo.title,
      author: volumeInfo.authors?.join(', ') || 'Unknown Author',
      year,
      isbn,
      pages: volumeInfo.pageCount,
      publisher: volumeInfo.publisher,
      description: volumeInfo.description,
      genres: volumeInfo.categories,
      averageRating: volumeInfo.averageRating,
      ratingsCount: volumeInfo.ratingsCount,
      imageUrl,
      language: volumeInfo.language,
      country: volumeInfo.country,
    };
  }
  
  async enrichBookData(title: string, author?: string): Promise<Partial<BookData> | null> {
    const bookData = await this.searchBook(title, author);
    if (!bookData) return null;
    
    return {
      author: bookData.author,
      year: bookData.year,
      isbn: bookData.isbn,
      pages: bookData.pages,
      publisher: bookData.publisher,
      genres: bookData.genres,
      plot: bookData.description,
      averageRating: bookData.averageRating,
      ratingsCount: bookData.ratingsCount,
      posterUrl: bookData.imageUrl,
      language: bookData.language,
      country: bookData.country,
    };
  }
}