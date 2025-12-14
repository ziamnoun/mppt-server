const { SerialPort } = require("serialport");
const { ReadlineParser } = require("@serialport/parser-readline");
const { WebSocketServer } = require("ws");
const fs = require("fs");
const path = require("path");


const CSV_PATH = "C:\\Users\\User\\OneDrive\\mppLiveData\\data.csv";


const COM_PORT = "COM3";
const BAUD_RATE = 115200;

let port;
let parser;
let clients = [];

const wss = new WebSocketServer({ port: 3001 });
console.log("✅ WebSocket running at ws://localhost:3001");


function initCSV() {
  if (!fs.existsSync(CSV_PATH)) {
    fs.writeFileSync(CSV_PATH, "timestamp,voltage,current,power\n");
    console.log("📄 CSV created:", CSV_PATH);
  } else {
    console.log("📄 CSV found:", CSV_PATH);
  }
}


function logToCSV(json) {
  const row = `${Date.now()},${json.v},${json.i},${json.p}\n`;
  fs.appendFile(CSV_PATH, row, (err) => {
    if (err) console.log("⚠ CSV Write Error:", err.message);
  });
}

function connectArduino() {
  console.log("🔌 Trying to connect Arduino...");

  port = new SerialPort({
    path: COM_PORT,
    baudRate: BAUD_RATE,
    autoOpen: false
  });

  port.open((err) => {
    if (err) {
      console.log(" Arduino not found, retrying in 2s...");
      setTimeout(connectArduino, 2000);
      return;
    }
    console.log("✅ Arduino Connected");
  });

  parser = port.pipe(new ReadlineParser({ delimiter: "\n" }));

  parser.on("data", (data) => {
    data = data.trim();
    if (!data.startsWith("{")) return;

    console.log("⬆ Arduino:", data);

    try {
      const json = JSON.parse(data);
      logToCSV(json); 
    } catch (e) {
      console.log("⚠ JSON Error:", e.message);
    }

    // Send to UI
    clients.forEach(ws => {
      if (ws.readyState === 1) ws.send(data);
    });
  });

  port.on("close", () => {
    console.log(" Arduino Disconnected. Reconnecting...");
    setTimeout(connectArduino, 2000);
  });

  port.on("error", (err) => {
    console.log("⚠ Serial Error:", err.message);
  });
}

initCSV();
connectArduino();

// WebSocket
wss.on("connection", (ws) => {
  console.log("🔗 UI Connected");
  clients.push(ws);

  ws.on("message", (msg) => {
    const command = msg.toString().trim();
    console.log("⬇ UI:", command);

    if (port && port.isOpen) {
      port.write(command + "\n");
    }
  });

  ws.on("close", () => {
    clients = clients.filter(c => c !== ws);
    console.log("❌ UI Disconnected");
  });
});
