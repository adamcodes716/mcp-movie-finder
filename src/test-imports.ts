// Test file to demonstrate Bun import resolution
import { MovieUtils, SAMPLE_MOVIES, type Movie } from "./movie-utils.ts";

console.log("🧪 Testing Bun imports...");

try {
  console.log("✅ Import successful!");
  
  // Test the utility functions
  console.log("\n📽️ Sample movies:");
  SAMPLE_MOVIES.forEach(movie => {
    console.log(MovieUtils.formatMovie(movie));
  });
  
  // Test creating a new movie
  console.log("\n➕ Creating new movie:");
  const newMovie = MovieUtils.createMovie("Dune", 2021, true, 8);
  console.log(MovieUtils.formatMovie(newMovie));
  
  // Test recommendations
  console.log("\n🎯 Recommendations:");
  console.log(MovieUtils.getRecommendations(SAMPLE_MOVIES));
  
  console.log("\n✅ All import tests passed!");
  
} catch (error) {
  console.error("❌ Import test failed:", error);
  process.exit(1);
}
