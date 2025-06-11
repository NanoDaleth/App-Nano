import React, { createContext, useContext, useState, useEffect } from 'react';
import { ref, onValue } from 'firebase/database';
import { database } from '../firebase/config';

interface Ingredient {
  name: string;
  initialVolume: number;
  currentVolume: number;
}

interface IngredientsContextType {
  ingredients: { [key: string]: Ingredient };
  editingIngredients: Set<number>;
  setEditingIngredient: (index: number, isEditing: boolean) => void;
}

const IngredientsContext = createContext<IngredientsContextType | null>(null);

export const IngredientsProvider = ({ children }: { children: React.ReactNode }) => {
  const [ingredients, setIngredients] = useState<{ [key: string]: Ingredient }>({});
  const [editingIngredients, setEditingIngredients] = useState<Set<number>>(new Set());

  useEffect(() => {
    const ingredientsRef = ref(database, 'ingredientes');
    
    onValue(ingredientsRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        setIngredients(data);
      }
    });
  }, []);

  const setEditingIngredient = (index: number, isEditing: boolean) => {
    setEditingIngredients(prev => {
      const newSet = new Set(prev);
      if (isEditing) {
        newSet.add(index);
      } else {
        newSet.delete(index);
      }
      return newSet;
    });
  };

  return (
    <IngredientsContext.Provider value={{ ingredients, editingIngredients, setEditingIngredient }}>
      {children}
    </IngredientsContext.Provider>
  );
};

export const useIngredients = () => {
  const context = useContext(IngredientsContext);
  if (!context) {
    throw new Error('useIngredients must be used within an IngredientsProvider');
  }
  return context;
};