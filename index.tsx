/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// FIX: Import React to fix UMD global error.
import React from 'react';
// FIX: Import ReactDOM from react-dom/client for createRoot.
import ReactDOM from 'react-dom/client';
import { GoogleGenAI, Type } from "@google/genai";

const App = () => {
  const [selectedImage, setSelectedImage] = React.useState(null);
  const [previewUrl, setPreviewUrl] = React.useState('');
  const [recipes, setRecipes] = React.useState([]);
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState('');

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setSelectedImage(file);
      setPreviewUrl(URL.createObjectURL(file));
      setRecipes([]);
      setError('');
    }
  };

  const fileToBase64 = (file) => new Promise((resolve, reject) => {
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
        text: `Based on the ingredients in this image, suggest up to 3 simple recipes. For each recipe, provide the recipe name, a list of ingredients with quantities, and step-by-step instructions.`,
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
              },
              required: ['recipeName', 'ingredients', 'instructions'],
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

  return (
    <div className="app-container">
      <header>
        <h1>Visual Recipe Assistant</h1>
        <p>Upload a photo of your ingredients and get instant recipe ideas!</p>
      </header>

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
              {recipes.map((recipe, index) => (
                <div key={index} className="recipe-card">
                  <h2>{recipe.recipeName}</h2>
                  <h3>Ingredients</h3>
                  <ul>
                    {recipe.ingredients.map((ing, i) => <li key={i}>{ing}</li>)}
                  </ul>
                  <h3>Instructions</h3>
                  <ol>
                    {recipe.instructions.map((step, i) => <li key={i}>{step}</li>)}
                  </ol>
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
