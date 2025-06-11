import React, { useState, useEffect } from 'react';
import { ref, onValue, remove, set, get, push } from 'firebase/database';
import { database } from '../firebase/config';
import { Play, Trash2, Edit2, Save, X, Scale } from 'lucide-react';
import Swal from 'sweetalert2';
import { useMqtt } from '../context/MqttContext';
import { useAuth } from '../context/AuthContext';

interface Recipe {
  nombre: string;
  vaso: 'Vaso Alto' | 'Vaso Old Fashioned';
  [key: string]: any;
}

interface Ingredient {
  name: string;
  initialVolume: number;
  currentVolume: number;
  density: number;
}

interface EditingVolumes {
  [key: string]: number;
}

const MAX_VOLUMES = {
  'Vaso Alto': 180,
  'Vaso Old Fashioned': 120
};

const Recipes = () => {
  const [recipes, setRecipes] = useState<{ [key: string]: Recipe }>({});
  const [editingRecipe, setEditingRecipe] = useState<string | null>(null);
  const [editingVolumes, setEditingVolumes] = useState<EditingVolumes>({});
  const [ingredients, setIngredients] = useState<{ [key: string]: Ingredient }>({});
  const [preparingRecipe, setPreparing] = useState(false);
  const [verificandoVaso, setVerificandoVaso] = useState(true);
  const [lowIngredients, setLowIngredients] = useState<{ [key: string]: boolean }>({});
  
  const { mqttClient, mqttConnected, vasoPresente, machineStatus, publishMessage } = useMqtt();
  const { role } = useAuth();
  const isAdmin = role === 'admin';

  useEffect(() => {
    const recipesRef = ref(database, 'recetas');
    const ingredientsRef = ref(database, 'ingredientes');

    const unsubscribeRecipes = onValue(recipesRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        setRecipes(data);
      }
    });

    const unsubscribeIngredients = onValue(ingredientsRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        setIngredients(data);
        
        const ingredientesBajos: { [key: string]: boolean } = {};
        Object.entries(data).forEach(([key, ingredient]: [string, any]) => {
          if (ingredient.currentVolume < 20) {
            ingredientesBajos[key] = true;
          }
        });
        setLowIngredients(ingredientesBajos);
      }
    });

    return () => {
      unsubscribeRecipes();
      unsubscribeIngredients();
    };
  }, []);

  useEffect(() => {
    if (machineStatus === 'idle') {
      setPreparing(false);
    }
  }, [machineStatus]);

  const handleCalibrate = async () => {
    if (!mqttConnected) {
      await Swal.fire({
        title: 'Error de conexión',
        text: 'No hay conexión con el dispositivo',
        icon: 'error',
        confirmButtonColor: '#3B82F6'
      });
      return;
    }

    if (machineStatus === 'busy') {
      await Swal.fire({
        title: 'Máquina ocupada',
        text: 'La máquina está siendo utilizada actualmente',
        icon: 'warning',
        confirmButtonColor: '#3B82F6'
      });
      return;
    }

    publishMessage('cocktail/calibrar', 'true');
    await Swal.fire({
      title: 'Calibración iniciada',
      text: 'Se ha iniciado el proceso de calibración de la balanza',
      icon: 'success',
      confirmButtonColor: '#3B82F6'
    });
  };

  const handleDelete = async (recipeName: string) => {
    const result = await Swal.fire({
      title: '¿Está seguro?',
      text: '¿Desea eliminar esta receta? Esta acción no se puede deshacer.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#EF4444',
      cancelButtonColor: '#6B7280',
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'Cancelar'
    });

    if (result.isConfirmed) {
      const recipeRef = ref(database, `recetas/${recipeName}`);
      await remove(recipeRef);
      await Swal.fire({
        title: '¡Eliminada!',
        text: 'La receta ha sido eliminada.',
        icon: 'success',
        confirmButtonColor: '#3B82F6'
      });
    }
  };

  const handleEdit = (recipe: Recipe) => {
    const volumes: EditingVolumes = {};
    Object.entries(recipe).forEach(([key, value]) => {
      if (key.startsWith('ingrediente') && typeof value === 'number') {
        volumes[key] = value;
      }
    });
    setEditingVolumes(volumes);
    setEditingRecipe(recipe.nombre);
  };

  const getTotalVolume = (volumes: EditingVolumes): number => {
    return Object.values(volumes).reduce((sum, volume) => sum + volume, 0);
  };

  const handleSave = async (recipeName: string) => {
    const recipe = recipes[recipeName];
    const totalVolume = getTotalVolume(editingVolumes);
    const maxVolume = MAX_VOLUMES[recipe.vaso];

    if (totalVolume > maxVolume) {
      await Swal.fire({
        title: 'Error de volumen',
        text: `El volumen total (${totalVolume}ml) excede la capacidad del ${recipe.vaso} (${maxVolume}ml)`,
        icon: 'error',
        confirmButtonColor: '#3B82F6'
      });
      return;
    }

    const recipeRef = ref(database, `recetas/${recipeName}`);
    const updatedRecipe = {
      ...recipes[recipeName],
      ...editingVolumes
    };
    await set(recipeRef, updatedRecipe);
    setEditingRecipe(null);
    setEditingVolumes({});
    await Swal.fire({
      title: '¡Guardado!',
      text: 'Los cambios han sido guardados exitosamente.',
      icon: 'success',
      confirmButtonColor: '#3B82F6'
    });
  };

  const handleCancel = () => {
    setEditingRecipe(null);
    setEditingVolumes({});
  };

  const handlePrepare = async (recipe: Recipe) => {
    // Verificar volumen de ingredientes
    const ingredientesInsuficientes = [];
    
    for (const [key, value] of Object.entries(recipe)) {
      if (key.startsWith('ingrediente') && typeof value === 'number') {
        const ingredientNumber = key.slice(-1);
        const ingredientDbKey = `ingrediente${ingredientNumber}`;
        const currentVolume = ingredients[ingredientDbKey]?.currentVolume || 0;
        const requiredVolume = value + 25; // Volumen requerido + 25ml de margen
        
        if (currentVolume < requiredVolume) {
          ingredientesInsuficientes.push({
            nombre: ingredients[ingredientDbKey]?.name || `Ingrediente ${ingredientNumber}`,
            actual: currentVolume,
            requerido: requiredVolume
          });
        }
      }
    }

    if (ingredientesInsuficientes.length > 0) {
      const mensajeIngredientes = ingredientesInsuficientes
        .map(ing => `${ing.nombre}: ${ing.actual}ml disponibles, se requieren ${ing.requerido}ml`)
        .join('\n');

      await Swal.fire({
        title: 'Volumen insuficiente',
        text: `No hay suficiente volumen en los siguientes ingredientes:\n${mensajeIngredientes}`,
        icon: 'error',
        confirmButtonColor: '#3B82F6'
      });
      return;
    }

    if (!mqttConnected) {
      await Swal.fire({
        title: 'Error de conexión',
        text: 'No hay conexión con el dispositivo. Por favor, verifica que el dispositivo esté encendido y conectado a la red.',
        icon: 'error',
        confirmButtonColor: '#3B82F6'
      });
      return;
    }

    if (machineStatus === 'busy') {
      await Swal.fire({
        title: 'Máquina ocupada',
        text: 'La máquina está siendo utilizada actualmente. Por favor, espere a que termine el pedido en curso.',
        icon: 'warning',
        confirmButtonColor: '#3B82F6'
      });
      return;
    }

    const maquinaStatusRef = ref(database, 'maquinaStatus');
    await set(maquinaStatusRef, { ocupado: true, ultimaActualizacion: new Date().toISOString() });
    
    publishMessage('cocktail/maquina', JSON.stringify({ ocupado: true }));
    
    const vasoStatusRef = ref(database, 'vasoStatus');
    await set(vasoStatusRef, { presente: false, ultimaActualizacion: new Date().toISOString() });
    
    setVerificandoVaso(true);
    
    // Convert volumes to weights using density
    const ingredientesEnPeso = Object.entries(recipe)
      .filter(([key, value]) => key.startsWith('ingrediente') && typeof value === 'number')
      .reduce((acc, [key, volume]) => {
        const ingredientNumber = key.slice(-1);
        const ingredientDbKey = `ingrediente${ingredientNumber}`;
        const density = ingredients[ingredientDbKey]?.density || 1; // Default density if not set
        const weight = volume * density; // Convert volume (ml) to weight (g)
        return {
          ...acc,
          [key]: weight
        };
      }, {});
    
    publishMessage('cocktail/deteccion', JSON.stringify({
      solicitar_vaso: true
    }));
    
    let timerInterval: NodeJS.Timeout;
    let countdown = 5;
    let vasoDetectado = false;

    const result = await Swal.fire({
      title: 'Coloque el vaso en su posición',
      html: 'Tiempo restante: <b>5</b> segundos',
      timer: 5000,
      timerProgressBar: true,
      allowOutsideClick: false,
      allowEscapeKey: false,
      allowEnterKey: false,
      didOpen: () => {
        Swal.showLoading(null);
        const timer = Swal.getPopup()?.querySelector('b');
        
        get(vasoStatusRef).then((snapshot) => {
          const data = snapshot.val();
          if (data && data.presente) {
            vasoDetectado = true;
            Swal.close();
          }
        });
        
        const unsubscribeVaso = onValue(vasoStatusRef, (snapshot) => {
          const data = snapshot.val();
          if (data && data.presente) {
            vasoDetectado = true;
            Swal.close();
          }
        });
        
        timerInterval = setInterval(() => {
          if (timer) {
            countdown--;
            timer.textContent = countdown.toString();
          }
        }, 1000);
        
        // @ts-ignore
        Swal.vasoListener = unsubscribeVaso;
      },
      willClose: () => {
        clearInterval(timerInterval);
        // @ts-ignore
        if (Swal.vasoListener) {
          // @ts-ignore
          Swal.vasoListener();
        }
      }
    });

    if (result.dismiss === Swal.DismissReason.timer || vasoDetectado) {
      const vasoSnapshot = await get(vasoStatusRef);
      const vasoData = vasoSnapshot.val();
      const estadoVasoActual = vasoData && vasoData.presente;
      
      if (!estadoVasoActual) {
        setVerificandoVaso(false);
        await set(maquinaStatusRef, { ocupado: false, ultimaActualizacion: new Date().toISOString() });
        publishMessage('cocktail/maquina', JSON.stringify({ ocupado: false }));
        
        await Swal.fire({
          title: 'Error',
          text: 'El vaso no está en posición',
          icon: 'error',
          confirmButtonColor: '#3B82F6'
        });
        return;
      }
      
      const pedidoCompleto = {
        nombre: recipe.nombre,
        vaso: recipe.vaso,
        usuario: 'WebApp_Client',
        ingredientes: ingredientesEnPeso // Send weights instead of volumes
      };
      
      publishMessage('cocktail/pedido', JSON.stringify(pedidoCompleto));
      
      setPreparing(true);
      
      const historialRef = ref(database, 'historial');
      const timestamp = new Date().toISOString();
      await push(historialRef, {
        nombre: recipe.nombre,
        vaso: recipe.vaso,
        fecha: timestamp,
        estado: 'preparando',
        usuario: 'WebApp_Client',
        ingredientes: recipe // Store original volumes in history
      });
      
      await Swal.fire({
        title: 'Preparando bebida',
        text: `Preparando ${recipe.nombre}...`,
        icon: 'info',
        confirmButtonColor: '#3B82F6'
      });
    } else {
      setVerificandoVaso(false);
      await set(maquinaStatusRef, { ocupado: false, ultimaActualizacion: new Date().toISOString() });
      publishMessage('cocktail/maquina', JSON.stringify({ ocupado: false }));
    }
  };

  const handleVolumeChange = (key: string, value: number) => {
    setEditingVolumes(prev => ({
      ...prev,
      [key]: value
    }));
  };

  const getIngredientName = (ingredientKey: string) => {
    const ingredientNumber = ingredientKey.slice(-1);
    const dbKey = `ingrediente${ingredientNumber}`;
    return ingredients[dbKey]?.name || `Ingrediente ${ingredientNumber}`;
  };

  const hasLowIngredients = (recipe: Recipe): boolean => {
    for (const [key, value] of Object.entries(recipe)) {
      if (key.startsWith('ingrediente') && typeof value === 'number') {
        const ingredientNumber = key.slice(-1);
        const ingredientDbKey = `ingrediente${ingredientNumber}`;
        if (lowIngredients[ingredientDbKey]) {
          return true;
        }
      }
    }
    return false;
  };

  return (
    <div className="p-8">
      <h2 className="text-2xl font-bold text-gray-800 mb-6">Recetas Disponibles</h2>
      <div className="flex justify-between items-center mb-4">
        <div className="flex items-center gap-4">
          <div className="flex items-center">
            <div className={`w-3 h-3 rounded-full mr-2 ${mqttConnected ? 'bg-green-500' : 'bg-red-500'}`}></div>
            <span className="text-sm font-medium">
              {mqttConnected ? 'Conectado al servidor' : 'Sin conexión al servidor'}
            </span>
          </div>
          {isAdmin && (
            <button
              onClick={handleCalibrate}
              disabled={!mqttConnected || machineStatus === 'busy'}
              className={`flex items-center gap-2 px-4 py-2 rounded-md text-white ${
                !mqttConnected || machineStatus === 'busy'
                  ? 'bg-gray-400 cursor-not-allowed'
                  : 'bg-blue-500 hover:bg-blue-600'
              }`}
            >
              <Scale size={20} />
              Calibrar Balanza
            </button>
          )}
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {Object.entries(recipes).map(([recipeName, recipe]) => {
          const totalVolume = editingRecipe === recipe.nombre ? getTotalVolume(editingVolumes) : 0;
          const maxVolume = MAX_VOLUMES[recipe.vaso];
          const isEditing = editingRecipe === recipe.nombre;
          const isLow = hasLowIngredients(recipe);
          
          return (
            <div key={recipeName} className={`bg-white rounded-lg shadow-md p-6 ${isLow ? 'opacity-70' : ''}`}>
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="text-xl font-semibold text-gray-800">{recipe.nombre}</h3>
                  <p className="text-gray-600">{recipe.vaso}</p>
                  {isEditing && (
                    <p className={`text-sm mt-1 ${totalVolume > maxVolume ? 'text-red-600' : 'text-gray-600'}`}>
                      Volumen total: {totalVolume}ml / {maxVolume}ml
                    </p>
                  )}
                  {isLow && (
                    <p className="text-xs text-red-600 mt-1">
                      ⚠️ Nivel bajo de ingredientes
                    </p>
                  )}
                </div>
                {isAdmin && !isEditing && (
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleEdit(recipe)}
                      className="p-2 text-blue-500 hover:bg-blue-50 rounded-full"
                    >
                      <Edit2 size={20} />
                    </button>
                    <button
                      onClick={() => handleDelete(recipe.nombre)}
                      className="p-2 text-red-500 hover:bg-red-50 rounded-full"
                    >
                      <Trash2 size={20} />
                    </button>
                  </div>
                )}
                {isAdmin && isEditing && (
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleSave(recipe.nombre)}
                      className="p-2 text-green-500 hover:bg-green-50 rounded-full"
                    >
                      <Save size={20} />
                    </button>
                    <button
                      onClick={handleCancel}
                      className="p-2 text-gray-500 hover:bg-gray-50 rounded-full"
                    >
                      <X size={20} />
                    </button>
                  </div>
                )}
              </div>

              <div className="space-y-3">
                {Object.entries(recipe).map(([key, value]) => {
                  if (key.startsWith('ingrediente') && typeof value === 'number') {
                    const ingredientName = getIngredientName(key);
                    const ingredientNumber = key.slice(-1);
                    const ingredientDbKey = `ingrediente${ingredientNumber}`;
                    const isIngredientLow = lowIngredients[ingredientDbKey];
                    return (
                      <div key={key} className="flex flex-col">
                        <div className="flex justify-between items-center">
                          <span className={`${isIngredientLow ? 'text-red-600' : 'text-gray-600'}`}>
                            {ingredientName} {isIngredientLow && '⚠️'}
                          </span>
                          <span className="font-medium">
                            {isEditing ? editingVolumes[key] : value} ml
                          </span>
                        </div>
                        {isAdmin && isEditing && (
                          <input
                            type="range"
                            min="15"
                            max="120"
                            value={editingVolumes[key]}
                            onChange={(e) => handleVolumeChange(key, Number(e.target.value))}
                            className="w-full mt-1"
                          />
                        )}
                      </div>
                    );
                  }
                  return null;
                })}
              </div>

              <button
                onClick={() => handlePrepare(recipe)}
                disabled={isEditing || preparingRecipe || !mqttConnected || isLow}
                className={`mt-4 w-full px-4 py-2 rounded-md flex items-center justify-center gap-2 ${
                  isEditing || preparingRecipe || !mqttConnected || isLow
                    ? 'bg-gray-400 cursor-not-allowed'
                    : 'bg-green-500 hover:bg-green-600'
                } text-white`}
              >
                <Play size={20} />
                {preparingRecipe 
                  ? 'Preparando...' 
                  : isLow 
                    ? 'Ingredientes insuficientes' 
                    : mqttConnected 
                      ? 'Preparar' 
                      : 'Sin conexión'}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default Recipes;