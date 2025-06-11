import React, { useEffect, useState } from 'react';
import { ref, onValue, remove } from 'firebase/database';
import { database } from '../firebase/config';
import { Trash2, ChevronDown, ChevronUp } from 'lucide-react';
import Swal from 'sweetalert2';

interface HistoryEntry {
  nombre: string;
  fecha: string;
  vaso: string;
  estado?: string;
  completadoEn?: string;
  usuario?: string;
  ingredientes?: {[key: string]: number};
  [key: string]: any;
}

interface Ingredient {
  name: string;
  initialVolume: number;
  currentVolume: number;
}

const History = () => {
  const [historial, setHistorial] = useState<{ [key: string]: HistoryEntry }>({});
  const [expandedEntries, setExpandedEntries] = useState<{[key: string]: boolean}>({});
  const [ingredients, setIngredients] = useState<{ [key: string]: Ingredient }>({});

  useEffect(() => {
    const historialRef = ref(database, 'historial');
    const ingredientsRef = ref(database, 'ingredientesConsumidos');
    
    onValue(historialRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        setHistorial(data);
      } else {
        setHistorial({});
      }
    });

    onValue(ingredientsRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        setIngredients(data);
      }
    });
  }, []);

  const handleDeleteHistory = async () => {
    const result = await Swal.fire({
      title: '¿Está seguro?',
      text: 'Se eliminará todo el historial. Esta acción no se puede deshacer.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#EF4444',
      cancelButtonColor: '#6B7280',
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'Cancelar'
    });

    if (result.isConfirmed) {
      const historialRef = ref(database, 'historial');
      await remove(historialRef);
      await Swal.fire({
        title: '¡Eliminado!',
        text: 'El historial ha sido eliminado completamente.',
        icon: 'success',
        confirmButtonColor: '#3B82F6'
      });
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString();
  };

  const toggleExpand = (key: string) => {
    setExpandedEntries(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  const getIngredientName = (ingredientKey: string): string => {
    const ingredientNumber = ingredientKey.slice(-1);
    const dbKey = `ingrediente${ingredientNumber}`;
    return ingredients[dbKey]?.name || `Ingrediente ${ingredientNumber}`;
  };

  return (
    <div className="p-4 md:p-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <h2 className="text-2xl font-bold text-gray-800">Historial de Bebidas</h2>
        <button
          onClick={handleDeleteHistory}
          className="w-full sm:w-auto bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-md flex items-center justify-center gap-2"
        >
          <Trash2 size={20} />
          Eliminar Historial
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
        {Object.entries(historial).map(([key, entry]) => (
          <div key={key} className="bg-white rounded-lg shadow-md p-4 md:p-6">
            <div className="flex justify-between items-center mb-2">
              <h3 className="text-xl font-semibold text-gray-800">{entry.nombre}</h3>
              <button 
                onClick={() => toggleExpand(key)}
                className="text-gray-500 hover:text-gray-700"
              >
                {expandedEntries[key] ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
              </button>
            </div>
            
            <p className="text-gray-600 mb-1">{entry.vaso}</p>
            {entry.usuario && <p className="text-gray-600 mb-1">Usuario: {entry.usuario}</p>}
            {entry.estado && <p className="text-gray-600 mb-1">Estado: {entry.estado}</p>}
            <p className="text-gray-500 text-sm">Fecha: {formatDate(entry.fecha)}</p>
            {entry.completadoEn && (
              <p className="text-gray-500 text-sm mb-2">Completado: {formatDate(entry.completadoEn)}</p>
            )}
            
            {expandedEntries[key] && (
              <div className="mt-4 pt-3 border-t border-gray-200">
                <h4 className="font-medium text-gray-700 mb-2">Ingredientes:</h4>
                <div className="space-y-2">
                  {entry.ingredientesConsumidos ? (
                    Object.entries(entry.ingredientesConsumidos).map(([ingKey, value]) => (
                      <div key={ingKey} className="flex justify-between items-center">
                        <span className="text-gray-600">{getIngredientName(ingKey)}</span>
                        <span className="font-medium">{value} ml</span>
                      </div>
                    ))
                  ) : (
                    Object.entries(entry).map(([key, value]) => {
                      if (key.startsWith('ingrediente') && typeof value === 'number') {
                        return (
                          <div key={key} className="flex justify-between items-center">
                            <span className="text-gray-600">{getIngredientName(key)}</span>
                            <span className="font-medium">{value} ml</span>
                          </div>
                        );
                      }
                      return null;
                    })
                  )}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {Object.keys(historial).length === 0 && (
        <div className="text-center text-gray-500 mt-8">
          No hay registros en el historial
        </div>
      )}
    </div>
  );
};

export default History;