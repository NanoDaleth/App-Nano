import React, { useState, useEffect } from 'react';
import { ref, set, onValue } from 'firebase/database';
import { database } from '../firebase/config';
import { FileLock as Cocktail, RefreshCw } from 'lucide-react';
import Swal from 'sweetalert2';

interface Ingredient {
  name: string;
  volume: number;
  enabled: boolean;
  proportion?: number;
  dbKey?: string;
}

const GLASS_TYPES = ['Vaso Alto', 'Vaso Old Fashioned'];
const MAX_VOLUMES: { [key: string]: number } = {
  'Vaso Alto': 180,
  'Vaso Old Fashioned': 120
};

const NewRecipe = () => {
  const [recipeName, setRecipeName] = useState('');
  const [selectedGlass, setSelectedGlass] = useState(GLASS_TYPES[0]);
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [exceedsLimit, setExceedsLimit] = useState(false);

  useEffect(() => {
    const ingredientsRef = ref(database, 'ingredientes');
    onValue(ingredientsRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const ingredientsArray = Array(6).fill(null).map((_, index) => {
          const key = `ingrediente${index + 1}`;
          return {
            name: data[key]?.name || '',
            volume: 15,
            enabled: false,
            proportion: 1,
            dbKey: key
          };
        });
        setIngredients(ingredientsArray);
        setIsLoading(false);
      }
    });
  }, []);

  useEffect(() => {
    const total = getTotalVolume();
    const maxVolume = MAX_VOLUMES[selectedGlass];
    setExceedsLimit(total > maxVolume);
  }, [ingredients, selectedGlass]);

  const handleVolumeChange = (index: number, volume: number) => {
    const newIngredients = [...ingredients];
    newIngredients[index] = {
      ...ingredients[index],
      volume: Math.max(15, Math.min(120, volume))
    };
    setIngredients(newIngredients);
  };

  const handleCreateRecipe = async () => {
    if (!recipeName.trim()) {
      await Swal.fire({
        title: 'Error',
        text: 'Por favor, ingrese un nombre para la receta',
        icon: 'error',
        confirmButtonColor: '#3B82F6'
      });
      return;
    }

    const totalVolume = getTotalVolume();
    const maxVolume = MAX_VOLUMES[selectedGlass];

    if (totalVolume > maxVolume) {
      await Swal.fire({
        title: 'Error de volumen',
        text: `El volumen total (${totalVolume}ml) excede la capacidad del ${selectedGlass} (${maxVolume}ml)`,
        icon: 'error',
        confirmButtonColor: '#3B82F6'
      });
      return;
    }

    const selectedIngredients = ingredients
      .filter(ing => ing.enabled)
      .reduce((acc, ing) => ({
        ...acc,
        [ing.dbKey!]: ing.volume
      }), {});

    const recipeRef = ref(database, `recetas/${recipeName}`);
    await set(recipeRef, {
      nombre: recipeName,
      vaso: selectedGlass,
      ...selectedIngredients
    });

    await Swal.fire({
      title: '¡Éxito!',
      text: 'Receta creada exitosamente',
      icon: 'success',
      confirmButtonColor: '#3B82F6'
    });
    
    handleReset();
  };

  const getTotalVolume = () => {
    return ingredients
      .filter(ing => ing.enabled)
      .reduce((total, ing) => total + ing.volume, 0);
  };

  const getVolumeRemaining = () => {
    const maxVolume = MAX_VOLUMES[selectedGlass];
    return Math.max(0, maxVolume - getTotalVolume());
  };

  const handleReset = () => {
    setRecipeName('');
    setSelectedGlass(GLASS_TYPES[0]);
    setIngredients(prev => prev.map(ing => ({
      ...ing,
      volume: 15,
      enabled: false,
      proportion: 1
    })));
  };

  const totalVolume = getTotalVolume();
  const maxVolume = MAX_VOLUMES[selectedGlass];
  const volumeRemaining = getVolumeRemaining();

  return (
    <div className="p-4 md:p-8">
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-2xl font-bold text-gray-800 mb-6">Nueva Receta</h2>
        
        <div className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Nombre de la Receta
            </label>
            <input
              type="text"
              value={recipeName}
              onChange={(e) => setRecipeName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Ingrese el nombre de la receta"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Tipo de Vaso
            </label>
            <select
              value={selectedGlass}
              onChange={(e) => setSelectedGlass(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {GLASS_TYPES.map(glass => (
                <option key={glass} value={glass}>{glass}</option>
              ))}
            </select>
            <div className={`mt-2 text-sm ${exceedsLimit ? 'text-red-600' : 'text-gray-600'}`}>
              Volumen total: {totalVolume}ml / {maxVolume}ml
              {!exceedsLimit && volumeRemaining > 0 && (
                <span className="ml-2 text-green-600">(Disponible: {volumeRemaining}ml)</span>
              )}
            </div>
            <div className="w-full bg-gray-200 h-2 mt-2 rounded-full overflow-hidden">
              <div 
                className={`h-2 ${exceedsLimit ? 'bg-red-500' : 'bg-green-500'} transition-all duration-300`}
                style={{ width: `${Math.min(100, (totalVolume / maxVolume) * 100)}%` }}
              ></div>
            </div>
          </div>

          {isLoading ? (
            <div className="flex justify-center items-center h-40">
              <RefreshCw className="h-8 w-8 animate-spin text-blue-500" />
            </div>
          ) : (
            <div>
              <h3 className="text-lg font-medium text-gray-800 mb-4">Ingredientes</h3>
              <div className="space-y-4">
                {ingredients.map((ingredient, index) => (
                  <div 
                    key={index} 
                    className={`p-4 border rounded-lg transition-all duration-300 ${
                      ingredient.enabled 
                        ? (exceedsLimit ? 'border-red-300 bg-red-50' : 'border-green-300 bg-green-50') 
                        : 'border-gray-200'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center">
                        <input
                          type="checkbox"
                          checked={ingredient.enabled}
                          onChange={(e) => {
                            const newIngredients = [...ingredients];
                            newIngredients[index] = {
                              ...ingredient,
                              enabled: e.target.checked
                            };
                            setIngredients(newIngredients);
                          }}
                          className={`h-4 w-4 rounded ${
                            ingredient.enabled 
                              ? (exceedsLimit ? 'text-red-500' : 'text-green-500') 
                              : 'text-blue-500'
                          }`}
                        />
                        <span className="ml-2 font-medium">{ingredient.name}</span>
                      </div>
                      <span className="text-gray-600 font-semibold">{ingredient.volume} ml</span>
                    </div>
                    <div className="relative">
                      <input
                        type="range"
                        min="15"
                        max="120"
                        step="1"
                        value={ingredient.volume}
                        onChange={(e) => handleVolumeChange(index, Number(e.target.value))}
                        disabled={!ingredient.enabled}
                        className={`w-full ${!ingredient.enabled ? 'opacity-50' : ''}`}
                      />
                      {ingredient.enabled && volumeRemaining === 0 && ingredient.volume < 120 && (
                        <div className="absolute right-0 top-0 transform translate-x-6 -translate-y-1">
                          <span className="text-xs text-red-500 bg-white px-1 rounded-full animate-pulse">
                            ¡Límite!
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex gap-4 pt-4">
            <button
              onClick={handleCreateRecipe}
              disabled={exceedsLimit}
              className={`flex-1 px-4 py-2 rounded-md flex items-center justify-center gap-2 text-white
                ${exceedsLimit 
                  ? 'bg-gray-400 cursor-not-allowed' 
                  : 'bg-blue-500 hover:bg-blue-600'}`}
            >
              <Cocktail size={20} />
              Crear Receta
            </button>
            <button
              onClick={handleReset}
              className="flex-1 bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded-md flex items-center justify-center gap-2"
            >
              <RefreshCw size={20} />
              Empezar de Nuevo
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default NewRecipe;