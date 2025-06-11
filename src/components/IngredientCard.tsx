import React, { useState, useEffect } from 'react';
import { Save, Edit2 } from 'lucide-react';
import { ref, set, onValue } from 'firebase/database';
import { database } from '../firebase/config';
import { useIngredients } from '../context/IngredientsContext';
import Swal from 'sweetalert2';

interface IngredientCardProps {
  index: number;
  initialData: {
    name: string;
    initialVolume: number;
    currentVolume: number;
    density?: number;
  };
}

const IngredientCard = ({ index, initialData }: IngredientCardProps) => {
  const { editingIngredients, setEditingIngredient } = useIngredients();
  const [name, setName] = useState(initialData.name);
  const [initialVolume, setInitialVolume] = useState<string | number>('');
  const [density, setDensity] = useState<string | number>('');
  const [isEditing, setIsEditing] = useState(false);
  const isEditingName = editingIngredients.has(index);
  const [isEditingVolume, setIsEditingVolume] = useState(false);
  const [isEditingDensity, setIsEditingDensity] = useState(false);

  useEffect(() => {
    const ingredientRef = ref(database, `ingredientes/ingrediente${index + 1}`);
    onValue(ingredientRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        setInitialVolume(Number(data.currentVolume || 0).toFixed(2));
        setDensity(Number(data.density || 1).toFixed(2));
      }
    });
  }, [index]);

  const handleSave = async () => {
    const ingredientRef = ref(database, `ingredientes/ingrediente${index + 1}`);
    await set(ingredientRef, {
      name: isEditingName ? name : initialData.name,
      initialVolume: typeof initialVolume === 'string' ? parseFloat(initialVolume) : initialVolume,
      currentVolume: typeof initialVolume === 'string' ? parseFloat(initialVolume) : initialVolume,
      density: typeof density === 'string' ? parseFloat(density) : density
    });
    setIsEditing(false);
    setEditingIngredient(index, false);
    setIsEditingVolume(false);
    setIsEditingDensity(false);
    await Swal.fire({
      title: '¡Guardado!',
      text: 'Los cambios han sido guardados exitosamente.',
      icon: 'success',
      confirmButtonColor: '#3B82F6'
    });
  };

  const handleEditName = () => {
    setEditingIngredient(index, true);
    setIsEditing(true);
  };

  const handleVolumeClick = () => {
    if (!isEditingVolume) {
      setInitialVolume('');
      setIsEditingVolume(true);
      setIsEditing(true);
    }
  };

  const handleDensityClick = () => {
    if (!isEditingDensity) {
      setDensity('');
      setIsEditingDensity(true);
      setIsEditing(true);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6 space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold text-gray-800">
          {initialData.name || `Ingrediente ${index + 1}`}
        </h3>
        <div className="flex gap-2">
          {!isEditingName && initialData.name && (
            <button
              onClick={handleEditName}
              className="p-2 text-blue-500 hover:bg-blue-50 rounded-full"
            >
              <Edit2 size={20} />
            </button>
          )}
          <button
            onClick={handleSave}
            className={`p-2 text-green-500 hover:bg-green-50 rounded-full ${
              !isEditing ? 'opacity-50 cursor-not-allowed' : ''
            }`}
            disabled={!isEditing}
          >
            <Save size={20} />
          </button>
        </div>
      </div>

      <div className="space-y-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Nombre
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setIsEditing(true);
            }}
            disabled={!isEditingName}
            className={`w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
              !isEditingName ? 'bg-gray-100' : ''
            }`}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Volumen Inicial (ml)
          </label>
          <input
            type="number"
            value={initialVolume}
            onChange={(e) => {
              setInitialVolume(e.target.value);
              setIsEditing(true);
            }}
            onClick={handleVolumeClick}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Densidad (g/ml)
          </label>
          <input
            type="number"
            step="0.001"
            min="0.001"
            value={density}
            onChange={(e) => {
              setDensity(e.target.value);
              setIsEditing(true);
            }}
            onClick={handleDensityClick}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Volumen Actual (ml)
          </label>
          <div className="px-3 py-2 bg-gray-100 rounded-md text-gray-700">
            {Number(initialData.currentVolume).toFixed(2)}
          </div>
        </div>
      </div>
    </div>
  );
};

export default IngredientCard;