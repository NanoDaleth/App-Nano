import React, { useEffect, useState } from 'react';
import { ref, onValue } from 'firebase/database';
import { database } from '../firebase/config';
import IngredientCard from './IngredientCard';

interface Ingredient {
  name: string;
  initialVolume: number;
  currentVolume: number;
}

const Ingredients = () => {
  const [ingredients, setIngredients] = useState<Ingredient[]>(Array(6).fill({
    name: '',
    initialVolume: 0,
    currentVolume: 0
  }));

  useEffect(() => {
    const ingredientsRef = ref(database, 'ingredientes');
    
    onValue(ingredientsRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const ingredientsArray = Array(6).fill(null).map((_, index) => {
          const ingredientKey = `ingrediente${index + 1}`;
          return data[ingredientKey] || {
            name: '',
            initialVolume: 0,
            currentVolume: 0
          };
        });
        setIngredients(ingredientsArray);
      }
    });
  }, []);

  return (
    <div className="p-4 md:p-8">
      <h2 className="text-2xl font-bold text-gray-800 mb-6">
        Configuración de Ingredientes
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
        {ingredients.map((ingredient, index) => (
          <IngredientCard
            key={index}
            index={index}
            initialData={ingredient}
          />
        ))}
      </div>
    </div>
  );
};

export default Ingredients;