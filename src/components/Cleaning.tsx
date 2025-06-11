import React, { useState, useEffect } from 'react';
import { ref, onValue, set, get } from 'firebase/database';
import { database } from '../firebase/config';
import { Trash2 } from 'lucide-react';
import { useMqtt } from '../context/MqttContext';
import Swal from 'sweetalert2';

interface Ingredient {
  name: string;
  initialVolume: number;
  currentVolume: number;
}

const Cleaning = () => {
  const [ingredients, setIngredients] = useState<{ [key: string]: Ingredient }>({});
  const [selectedIngredients, setSelectedIngredients] = useState<Set<string>>(new Set());
  const { mqttClient, mqttConnected, publishMessage } = useMqtt();
  const [cleaning, setCleaning] = useState(false);

  useEffect(() => {
    const ingredientsRef = ref(database, 'ingredientes');
    const unsubscribe = onValue(ingredientsRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        setIngredients(data);
      }
    });

    const cleaningCompletionHandler = (topic: string, message: string) => {
      if (topic === 'cocktail/limpiarFin') {
        try {
          const data = JSON.parse(message);
          if (data === true || data.estado === true) {
            setCleaning(false);
            const maquinaStatusRef = ref(database, 'maquinaStatus');
            set(maquinaStatusRef, { 
              ocupado: false, 
              ultimaActualizacion: new Date().toISOString() 
            });
            publishMessage('cocktail/maquina', JSON.stringify({ ocupado: false }));
            Swal.fire({
              title: '¡Completado!',
              text: 'El proceso de limpieza ha finalizado',
              icon: 'success',
              confirmButtonColor: '#3B82F6'
            });
          }
        } catch (error) {
          console.error('Error parsing cleaning completion message:', error);
        }
      }
    };

    if (mqttClient) {
      mqttClient.subscribe('cocktail/limpiarFin');
      mqttClient.on('message', cleaningCompletionHandler);
    }

    return () => {
      unsubscribe();
      if (mqttClient) {
        mqttClient.unsubscribe('cocktail/limpiarFin');
        mqttClient.removeListener('message', cleaningCompletionHandler);
      }
    };
  }, [mqttClient, publishMessage]);

  const startCleaningProcess = async (ingredientesToClean: string[]) => {
    if (!mqttConnected) {
      await Swal.fire({
        title: 'Error de conexión',
        text: 'No hay conexión con el dispositivo',
        icon: 'error',
        confirmButtonColor: '#3B82F6'
      });
      return false;
    }

    const maquinaStatusRef = ref(database, 'maquinaStatus');
    const maquinaSnapshot = await get(maquinaStatusRef);
    const maquinaStatus = maquinaSnapshot.val();

    if (maquinaStatus && maquinaStatus.ocupado) {
      await Swal.fire({
        title: 'Máquina ocupada',
        text: 'La máquina está siendo utilizada actualmente. Por favor, espere a que termine el proceso en curso.',
        icon: 'warning',
        confirmButtonColor: '#3B82F6'
      });
      return false;
    }

    await set(maquinaStatusRef, { 
      ocupado: true, 
      ultimaActualizacion: new Date().toISOString() 
    });
    
    publishMessage('cocktail/maquina', JSON.stringify({ ocupado: true }));
    
    const vasoStatusRef = ref(database, 'vasoStatus');
    await set(vasoStatusRef, { 
      presente: false, 
      ultimaActualizacion: new Date().toISOString() 
    });
    
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
        await set(maquinaStatusRef, { ocupado: false, ultimaActualizacion: new Date().toISOString() });
        publishMessage('cocktail/maquina', JSON.stringify({ ocupado: false }));
        
        await Swal.fire({
          title: 'Error',
          text: 'El vaso no está en posición',
          icon: 'error',
          confirmButtonColor: '#3B82F6'
        });
        return false;
      }

      publishMessage('cocktail/limpieza', JSON.stringify({
        ingredientes: ingredientesToClean.join(',')
      }));
      
      setCleaning(true);
      return true;
    }

    await set(maquinaStatusRef, { ocupado: false, ultimaActualizacion: new Date().toISOString() });
    publishMessage('cocktail/maquina', JSON.stringify({ ocupado: false }));
    return false;
  };

  const handleCleanSelected = async () => {
    if (selectedIngredients.size === 0) {
      await Swal.fire({
        title: 'Selección vacía',
        text: 'Por favor, seleccione al menos un ingrediente para limpiar',
        icon: 'warning',
        confirmButtonColor: '#3B82F6'
      });
      return;
    }

    const result = await Swal.fire({
      title: '¿Está seguro?',
      text: 'Se iniciará el proceso de limpieza para los ingredientes seleccionados',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#3B82F6',
      cancelButtonColor: '#6B7280',
      confirmButtonText: 'Sí, limpiar',
      cancelButtonText: 'Cancelar'
    });

    if (result.isConfirmed) {
      const ingredientesToClean = Array.from(selectedIngredients).map(key => `ingrediente${key.slice(-1)}`);
      const success = await startCleaningProcess(ingredientesToClean);
      
      if (success) {
        await Swal.fire({
          title: 'Limpieza en proceso',
          text: 'Se está realizando la limpieza de los ingredientes seleccionados',
          icon: 'info',
          confirmButtonColor: '#3B82F6'
        });
      }
    }
  };

  const handleToggleIngredient = (ingredientKey: string) => {
    setSelectedIngredients(prev => {
      const newSet = new Set(prev);
      if (newSet.has(ingredientKey)) {
        newSet.delete(ingredientKey);
      } else {
        newSet.add(ingredientKey);
      }
      return newSet;
    });
  };

  return (
    <div className="p-4 md:p-8">
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-gray-800">Limpieza de Ingredientes</h2>
          <div className="flex items-center">
            <div className={`w-3 h-3 rounded-full mr-2 ${mqttConnected ? 'bg-green-500' : 'bg-red-500'}`}></div>
            <span className="text-sm font-medium">
              {mqttConnected ? 'Conectado al servidor' : 'Sin conexión al servidor'}
            </span>
          </div>
        </div>

        <div className="space-y-4 mb-6">
          {Object.entries(ingredients).map(([key, ingredient]) => (
            <div 
              key={key}
              className="flex items-center p-4 border rounded-lg hover:bg-gray-50 transition-colors"
            >
              <input
                type="checkbox"
                checked={selectedIngredients.has(key)}
                onChange={() => handleToggleIngredient(key)}
                className="h-5 w-5 text-blue-500 rounded border-gray-300 focus:ring-blue-500"
                disabled={cleaning}
              />
              <span className="ml-3 font-medium">
                Ingrediente {key.slice(-1)}: {ingredient.name || 'Sin nombre'}
              </span>
            </div>
          ))}
        </div>

        <div className="flex gap-4">
          <button
            onClick={handleCleanSelected}
            disabled={cleaning || !mqttConnected}
            className={`w-full px-4 py-2 rounded-md flex items-center justify-center gap-2 text-white
              ${cleaning || !mqttConnected ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-500 hover:bg-blue-600'}`}
          >
            <Trash2 size={20} />
            {cleaning ? 'Limpiando...' : 'Limpiar Seleccionados'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default Cleaning;