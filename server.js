// server.js - Servidor WebSocket para GPS Speed Tracker
const WebSocket = require('ws');
const express = require('express');
const cors = require('cors');

const app = express();
const PORT = 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Crear servidor HTTP
const server = app.listen(PORT, () => {
  console.log(`🚀 Servidor HTTP corriendo en http://localhost:${PORT}`);
});

// Crear servidor WebSocket
const wss = new WebSocket.Server({ server });

// Almacenar usuarios conectados
const users = new Map();

// Función para broadcast a todos los clientes
function broadcast(data) {
  const message = JSON.stringify(data);
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  });
}

// Función para enviar lista actualizada de usuarios
function sendUsersList() {
  const usersList = Array.from(users.values());
  broadcast({
    type: 'users',
    users: usersList
  });
}

// Limpiar usuarios inactivos (más de 10 segundos sin actualizar)
setInterval(() => {
  const now = Date.now();
  let hasChanges = false;
  
  users.forEach((user, userId) => {
    if (now - user.timestamp > 10000) {
      users.delete(userId);
      hasChanges = true;
      console.log(`❌ Usuario inactivo eliminado: ${userId}`);
    }
  });
  
  if (hasChanges) {
    sendUsersList();
  }
}, 5000);

// Manejar conexiones WebSocket
wss.on('connection', (ws, req) => {
  console.log('✅ Nueva conexión WebSocket desde:', req.socket.remoteAddress);
  
  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);
      
      switch (data.type) {
        case 'register':
          console.log(`📝 Usuario registrado: ${data.userName || data.userId}`);
          ws.userId = data.userId;
          ws.userName = data.userName || 'Usuario';
          sendUsersList();
          break;
          
        case 'speed':
          // Actualizar datos del usuario
          users.set(data.userId, {
            userId: data.userId,
            userName: data.userName || 'Usuario',
            speed: data.speed,
            lat: data.lat,
            lon: data.lon,
            timestamp: data.timestamp
          });
          
          console.log(`📊 Velocidad actualizada - ${data.userName || data.userId}: ${data.speed} km/h`);
          
          // Enviar lista actualizada a todos
          sendUsersList();
          break;
          
        default:
          console.log('⚠️ Tipo de mensaje desconocido:', data.type);
      }
    } catch (error) {
      console.error('❌ Error procesando mensaje:', error);
    }
  });
  
  ws.on('close', () => {
    if (ws.userId) {
      console.log(`👋 Usuario desconectado: ${ws.userId}`);
      users.delete(ws.userId);
      sendUsersList();
    }
  });
  
  ws.on('error', (error) => {
    console.error('❌ Error en WebSocket:', error);
  });
});

// Endpoint de salud
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    connectedUsers: users.size,
    timestamp: Date.now()
  });
});

// Endpoint para obtener usuarios (REST)
app.get('/users', (req, res) => {
  res.json({
    users: Array.from(users.values()),
    count: users.size
  });
});

console.log(`🌐 Servidor WebSocket corriendo en ws://localhost:${PORT}`);
console.log(`📡 Los clientes deben conectarse a: ws://localhost:${PORT}`);
console.log(`\n💡 Endpoints disponibles:`);
console.log(`   - GET /health - Estado del servidor`);
console.log(`   - GET /users - Lista de usuarios conectados`);
console.log(`\n⚙️  Para usar desde otro dispositivo, reemplaza 'localhost' con la IP de este equipo\n`);
