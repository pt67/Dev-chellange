/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// FIX: Import React to fix UMD global error.
import React from 'react';
// FIX: Import ReactDOM from react-dom/client for createRoot.
import ReactDOM from 'react-dom/client';
import { GoogleGenAI, Type } from "@google/genai";

// Define a type for our recipe object for better type safety
type Recipe = {
  recipeName: string;
  ingredients: string[];
  instructions: string[];
  servingSize: string;
  nutritionalInfo: {
    calories: string;
    protein: string;
    carbohydrates: string;
    fats: string;
  };
};

const App = () => {
  // FIX: Explicitly type state for better type safety.
  const [selectedImage, setSelectedImage] = React.useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = React.useState('');
  const [recipes, setRecipes] = React.useState<Recipe[]>([]);
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState('');
  
  // State for saved recipes and view management
  const [savedRecipes, setSavedRecipes] = React.useState<Recipe[]>([]);
  const [view, setView] = React.useState<'generator' | 'saved'>('generator');
  const [expandedRecipeIndex, setExpandedRecipeIndex] = React.useState<number | null>(null);

  // Load saved recipes from localStorage on initial render
  React.useEffect(() => {
    try {
      const storedRecipes = localStorage.getItem('savedRecipes');
      if (storedRecipes) {
        setSavedRecipes(JSON.parse(storedRecipes));
      }
    } catch (err) {
      console.error("Failed to parse saved recipes:", err);
      // If parsing fails, clear the corrupted data
      localStorage.removeItem('savedRecipes');
    }
  }, []);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedImage(file);
      setPreviewUrl(URL.createObjectURL(file));
      setRecipes([]);
      setError('');
    }
  };

  // FIX: Add type annotations to ensure the function returns a Promise<string>.
  // This resolves the TypeScript error where the result was inferred as `unknown`.
  const fileToBase64 = (file: File): Promise<string> => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    // FIX: Cast reader.result to string before calling split, as it can be an ArrayBuffer.
    reader.onload = () => resolve((reader.result as string).split(',')[1]);
    reader.onerror = (err) => reject(err);
  });

  const generateRecipes = async () => {
    if (!selectedImage) {
      setError('Please upload an image first.');
      return;
    }

    setIsLoading(true);
    setError('');
    setRecipes([]);

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const base64Image = await fileToBase64(selectedImage);

      const imagePart = {
        inlineData: {
          mimeType: selectedImage.type,
          data: base64Image,
        },
      };

      const textPart = {
        text: `Based on the ingredients in this image, suggest up to 3 simple recipes. For each recipe, provide the recipe name, a list of ingredients with quantities, step-by-step instructions, the serving size, and estimated nutritional information (calories, protein, carbohydrates, and fats).`,
      };
      
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: { parts: [imagePart, textPart] },
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                recipeName: {
                  type: Type.STRING,
                  description: 'The name of the recipe.',
                },
                ingredients: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING },
                  description: 'A list of ingredients with quantities.',
                },
                instructions: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING },
                  description: 'Step-by-step cooking instructions.',
                },
                servingSize: {
                  type: Type.STRING,
                  description: 'The recommended serving size for the recipe.'
                },
                nutritionalInfo: {
                  type: Type.OBJECT,
                  description: 'Estimated nutritional information per serving.',
                  properties: {
                    calories: { type: Type.STRING },
                    protein: { type: Type.STRING },
                    carbohydrates: { type: Type.STRING },
                    fats: { type: Type.STRING }
                  },
                  required: ['calories', 'protein', 'carbohydrates', 'fats']
                }
              },
              required: ['recipeName', 'ingredients', 'instructions', 'servingSize', 'nutritionalInfo'],
            },
          },
        },
      });

      const parsedRecipes = JSON.parse(response.text);
      setRecipes(parsedRecipes);

    } catch (err) {
      console.error(err);
      setError('Failed to generate recipes. The model may be unable to identify ingredients or the image is unclear. Please try another image.');
    } finally {
      setIsLoading(false);
    }
  };
  
  const saveRecipe = (recipeToSave: Recipe) => {
    if (savedRecipes.some(r => r.recipeName === recipeToSave.recipeName)) {
      return; // Avoid duplicates
    }
    const updatedRecipes = [...savedRecipes, recipeToSave];
    setSavedRecipes(updatedRecipes);
    localStorage.setItem('savedRecipes', JSON.stringify(updatedRecipes));
  };
  
  const deleteRecipe = (indexToDelete: number) => {
    const updatedRecipes = savedRecipes.filter((_, index) => index !== indexToDelete);
    setSavedRecipes(updatedRecipes);
    localStorage.setItem('savedRecipes', JSON.stringify(updatedRecipes));
  };

  const RecipeCard = ({ recipe, onSave, isSaved }: { recipe: Recipe, onSave?: () => void, isSaved?: boolean }) => (
    <div className="recipe-card">
      <h2>{recipe.recipeName}</h2>
      
      {recipe.servingSize && (
        <>
          <h3>Serving Size</h3>
          <p>{recipe.servingSize}</p>
        </>
      )}

      <h3>Ingredients</h3>
      <ul>
        {recipe.ingredients.map((ing, i) => <li key={i}>{ing}</li>)}
      </ul>
      
      <h3>Instructions</h3>
      <ol>
        {recipe.instructions.map((step, i) => <li key={i}>{step}</li>)}
      </ol>

      {recipe.nutritionalInfo && (
        <>
          <h3>Nutritional Information (estimated)</h3>
          <div className="nutritional-info">
            <span><strong>Calories:</strong> {recipe.nutritionalInfo.calories}</span>
            <span><strong>Protein:</strong> {recipe.nutritionalInfo.protein}</span>
            <span><strong>Carbs:</strong> {recipe.nutritionalInfo.carbohydrates}</span>
            <span><strong>Fats:</strong> {recipe.nutritionalInfo.fats}</span>
          </div>
        </>
      )}
      {onSave && (
         <button onClick={onSave} className="save-button" disabled={isSaved}>
            {isSaved ? 'Saved' : 'Save Recipe'}
          </button>
      )}
    </div>
  );


  return (
    <div className="app-container">
      <header>
        <h1>Visual Recipe Assistant</h1>
        <p>Upload a photo of your ingredients and get instant recipe ideas!</p>
        <div className="view-toggle">
            <button onClick={() => setView('generator')} className={view === 'generator' ? 'active' : ''}>
              Generate Recipes
            </button>
            <button onClick={() => setView('saved')} className={view === 'saved' ? 'active' : ''}>
              Saved Recipes ({savedRecipes.length})
            </button>
        </div>
      </header>

      {view === 'generator' && (
        <>
          <section className="uploader-section">
            <label htmlFor="file-upload" className="file-input-label">
              Choose an Image
            </label>
            <input id="file-upload" type="file" accept="image/*" onChange={handleImageChange} />
            
            {previewUrl && <img src={previewUrl} alt="Ingredients preview" className="image-preview" />}

            <button onClick={generateRecipes} disabled={isLoading || !selectedImage} className="generate-button">
              {isLoading ? 'Generating...' : 'Find Recipes'}
            </button>
          </section>

          {(isLoading || error || recipes.length > 0) && (
            <section className="results-section">
              <div className="status-container">
                {isLoading && <div className="loader"></div>}
                {error && <p className="error-message">{error}</p>}
              </div>

              {recipes.length > 0 && (
                <div className="recipes-container">
                  {recipes.map((recipe, index) => {
                    const isSaved = savedRecipes.some(r => r.recipeName === recipe.recipeName);
                    return <RecipeCard key={index} recipe={recipe} onSave={() => saveRecipe(recipe)} isSaved={isSaved} />;
                  })}
                </div>
              )}
            </section>
          )}
        </>
      )}

      {view === 'saved' && (
        <section className="saved-recipes-section">
          <h2>Your Saved Recipes</h2>
          {savedRecipes.length === 0 ? (
            <p className="empty-state-message">You haven't saved any recipes yet. Generate some and save your favorites!</p>
          ) : (
            <div className="saved-recipes-list">
              {savedRecipes.map((recipe, index) => (
                <div key={index} className="saved-recipe-item">
                  <div className="saved-recipe-header">
                    <span className="saved-recipe-title">{recipe.recipeName}</span>
                    <div className="saved-recipe-actions">
                      <button onClick={() => setExpandedRecipeIndex(expandedRecipeIndex === index ? null : index)}>
                        {expandedRecipeIndex === index ? 'Hide Details' : 'View Details'}
                      </button>
                      <button onClick={() => deleteRecipe(index)} className="delete-button">Delete</button>
                    </div>
                  </div>
                  {expandedRecipeIndex === index && (
                    <div className="expanded-recipe-details">
                      <RecipeCard recipe={recipe} />
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
};

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);