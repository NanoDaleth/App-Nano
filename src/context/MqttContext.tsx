import React, { createContext, useContext, useState, useEffect } from 'react';
import mqtt from 'mqtt';
import { ref, get, set, onValue, update } from 'firebase/database';
import { database } from '../firebase/config';
import Swal from 'sweetalert2';

const MQTT_CONFIG = {
  protocol: 'wss' as mqtt.MqttProtocol,
  host: '74e40c84c1c740edb14ae7099eb4d628.s1.eu.hivemq.cloud',
  port: 8884,
  clientId: 'WebApp_' + Math.random().toString(16).substr(2, 8),
  username: 'nano_v',
  password: 'Agosto_30_1998',
  rejectUnauthorized: false
};

interface MqttContextType {
  mqttClient: mqtt.MqttClient | null;
  mqttConnected: boolean;
  vasoPresente: boolean;
  machineStatus: 'idle' | 'busy';
  publishMessage: (topic: string, message: string) => void;
}

const MqttContext = createContext<MqttContextType | null>(null);

export const MqttProvider = ({ children }: { children: React.ReactNode }) => {
  const [mqttClient, setMqttClient] = useState<mqtt.MqttClient | null>(null);
  const [mqttConnected, setMqttConnected] = useState(false);
  const [vasoPresente, setVasoPresente] = useState(false);
  const [machineStatus, setMachineStatus] = useState<'idle' | 'busy'>('idle');

  const publishMessage = (topic: string, message: string) => {
    if (mqttClient && mqttConnected) {
      mqttClient.publish(topic, message);
    } else {
      console.error('MQTT client not connected');
    }
  };

  const actualizarEstadoVasoEnFirebase = (estado: boolean) => {
    const vasoStatusRef = ref(database, 'vasoStatus');
    set(vasoStatusRef, { 
      presente: estado, 
      ultimaActualizacion: new Date().toISOString() 
    });
  };

  useEffect(() => {
    const client = mqtt.connect(`${MQTT_CONFIG.protocol}://${MQTT_CONFIG.host}:${MQTT_CONFIG.port}/mqtt`, {
      clientId: MQTT_CONFIG.clientId,
      username: MQTT_CONFIG.username,
      password: MQTT_CONFIG.password,
      rejectUnauthorized: MQTT_CONFIG.rejectUnauthorized
    });

    client.on('connect', () => {
      setMqttConnected(true);
      client.subscribe('cocktail/pesoPedido');
      client.subscribe('cocktail/vaso');
      client.subscribe('cocktail/maquina');
    });

    client.on('error', (err) => {
      console.error('MQTT connection error:', err);
      setMqttConnected(false);
    });

    client.on('close', () => {
      setMqttConnected(false);
    });

    client.on('message', async (topic, message) => {
      if (topic === 'cocktail/pesoPedido') {
        try {
          const pesoPedido = JSON.parse(message.toString());
          
          if (pesoPedido.ingredientes) {
            // Get all ingredients data to access density values
            const ingredientsRef = ref(database, 'ingredientes');
            const ingredientsSnapshot = await get(ingredientsRef);
            const ingredientsData = ingredientsSnapshot.val();

            const ingredientesEnVolumen: { [key: string]: number } = {};

            // Convert weights to volumes using density
            for (const [key, weight] of Object.entries(pesoPedido.ingredientes)) {
              if (typeof weight === 'number') {
                const density = ingredientsData[key]?.density || 1;
                // Convert weight (g) to volume (ml) using density (g/ml)
                const volume = Number((weight / density).toFixed(2));
                ingredientesEnVolumen[key] = volume;

                // Update current volume in database
                const ingredientRef = ref(database, `ingredientes/${key}`);
                const ingredientSnapshot = await get(ingredientRef);
                const ingredientData = ingredientSnapshot.val();
                
                if (ingredientData && ingredientData.currentVolume) {
                  const nuevoVolumen = Math.max(0, ingredientData.currentVolume - volume);
                  await set(ingredientRef, {
                    ...ingredientData,
                    currentVolume: Number(nuevoVolumen.toFixed(2))
                  });
                }
              }
            }

            // Find and update the latest history entry
            const historialRef = ref(database, 'historial');
            const historialSnapshot = await get(historialRef);
            const historial = historialSnapshot.val();

            if (historial) {
              const entries = Object.entries(historial);
              const latestEntry = entries.reverse().find(([_, entry]: [string, any]) => 
                entry.estado === 'preparando'
              );

              if (latestEntry) {
                const [entryId, entry] = latestEntry;
                const historialItemRef = ref(database, `historial/${entryId}`);
                
                // Update the history entry with the volumes
                await update(historialItemRef, {
                  estado: 'completado',
                  completadoEn: new Date().toISOString(),
                  ingredientesConsumidos: ingredientesEnVolumen
                });
              }
            }

            setMachineStatus('idle');
            const maquinaStatusRef = ref(database, 'maquinaStatus');
            await set(maquinaStatusRef, { 
              ocupado: false, 
              ultimaActualizacion: new Date().toISOString() 
            });
            
            publishMessage('cocktail/maquina', JSON.stringify({ ocupado: false }));

            setVasoPresente(false);
            actualizarEstadoVasoEnFirebase(false);

            await Swal.fire({
              title: '¡Listo!',
              text: 'La bebida está preparada',
              icon: 'success',
              confirmButtonColor: '#3B82F6'
            });
          }
        } catch (error) {
          console.error('Error processing pesoPedido message:', error);
        }
      } else if (topic === 'cocktail/vaso') {
        try {
          const data = JSON.parse(message.toString());
          const nuevoEstadoVaso = 
            data.presente === true || 
            data.presente === 'true' || 
            data.estado === true || 
            data.estado === 'true' || 
            data.pedido === true ||
            data.pedido === 'true' ||
            data === true || 
            data === 'true';
          
          setVasoPresente(nuevoEstadoVaso);
          actualizarEstadoVasoEnFirebase(nuevoEstadoVaso);
        } catch (error) {
          console.error('Error parsing vaso message:', error);
          try {
            const rawMessage = message.toString();
            if (rawMessage === 'true' || rawMessage.includes('true')) {
              setVasoPresente(true);
              actualizarEstadoVasoEnFirebase(true);
            }
          } catch (secondError) {
            console.error('No se pudo procesar el mensaje como texto:', secondError);
          }
        }
      } else if (topic === 'cocktail/maquina') {
        try {
          const estado = JSON.parse(message.toString());
          if (estado.ocupado === true || estado.ocupado === 'true') {
            setMachineStatus('busy');
          } else {
            setMachineStatus('idle');
          }
        } catch (error) {
          console.error('Error parsing machine status message:', error);
        }
      }
    });

    setMqttClient(client);

    return () => {
      client.end();
    };
  }, []);

  useEffect(() => {
    const vasoStatusRef = ref(database, 'vasoStatus');
    const unsubscribeVasoStatus = onValue(vasoStatusRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        setVasoPresente(data.presente);
      }
    });

    const maquinaStatusRef = ref(database, 'maquinaStatus');
    const unsubscribeMaquinaStatus = onValue(maquinaStatusRef, (snapshot) => {
      const data = snapshot.val();
      if (data && data.ocupado) {
        setMachineStatus('busy');
      } else {
        setMachineStatus('idle');
      }
    });

    return () => {
      unsubscribeVasoStatus();
      unsubscribeMaquinaStatus();
    };
  }, []);

  return (
    <MqttContext.Provider 
      value={{ 
        mqttClient, 
        mqttConnected, 
        vasoPresente, 
        machineStatus, 
        publishMessage 
      }}
    >
      {children}
    </MqttContext.Provider>
  );
};

export const useMqtt = () => {
  const context = useContext(MqttContext);
  if (!context) {
    throw new Error('useMqtt must be used within a MqttProvider');
  }
  return context;
};