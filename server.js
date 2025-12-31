
const WebSocket = require("ws");
const fs = require("fs");
const path = require("path");
const { SerialPort } = require("serialport");
const { ReadlineParser } = require("@serialport/parser-readline");

// ------------------ CSV SETUP ------------------
const csvFile = path.join(__dirname, "mppt_data.csv");

if (!fs.existsSync(csvFile)) {
  const headers = [
    "Time",
    "Mode",
    "MainV",
    "MPPTV",
    "TargetV",
    "Error",
    "Current",
    "Power",
    "PWM",
  ].join(",") + "\n";
  fs.writeFileSync(csvFile, headers);
}

// ------------------ SERIAL SETUP ------------------
const port = new SerialPort({
  path: "COM5",
  baudRate: 9600,
});

const parser = port.pipe(new ReadlineParser({ delimiter: "\n" }));

// ------------------ WEBSOCKET SETUP ------------------
const wss = new WebSocket.Server({ port: 8080 }, () => {
  console.log("WebSocket Server started on port 8080");
});

wss.on("connection", (ws) => {
  console.log("Frontend connected");

  ws.on("message", (msg) => {
    console.log("Received from frontend:", msg.toString());
    port.write(msg.toString());
  });

  parser.on("data", (data) => {
    const line = data.trim();
    if (!line) return; // skip empty lines

    try {
      const json = parseArduinoData(line);
      if (!json) return;

      // Add timestamp in ISO format
      const timestamp = new Date().toISOString();
      json.time = timestamp;

      // Send to frontend
      ws.send(JSON.stringify(json));

      // Append to CSV safely
      const row = [
        timestamp,
        json.mode,
        json.mainV,
        json.mpptV,
        json.targetV,
        json.error,
        json.current,
        json.power,
        json.pwm,
      ].join(",") + "\n";

      fs.appendFile(csvFile, row, (err) => {
        if (err) console.error("Failed to write CSV:", err);
      });

    } catch (err) {
      console.error("Failed to parse Arduino data:", err);
    }
  });
}); // <-- Closing bracket for wss.on("connection")

// ------------------ PARSE ARDUINO DATA ------------------
function parseArduinoData(line) {
  const obj = {};
  const parts = line.trim().split("|");

  parts.forEach((part) => {
    const [key, val] = part.split(":").map((s) => s.trim());
    switch (key) {
      case "Mode":
        obj.mode = val;
        break;
      case "MainV":
        obj.mainV = parseFloat(val);
        break;
      case "MPPT":
        obj.mpptV = parseFloat(val);
        break;
      case "TargetV":
        obj.targetV = parseFloat(val);
        break;
      case "Error%":
        obj.error = parseFloat(val);
        break;
      case "I":
        obj.current = parseFloat(val);
        break;
      case "P":
        obj.power = parseFloat(val);
        break;
      case "PWM":
        obj.pwm = parseInt(val);
        break;
    }
  });

  return obj;
}


// // backend/server.js
// const WebSocket = require("ws");


// // Import SerialPort properly
// const { SerialPort } = require("serialport");
// const { ReadlineParser } = require("@serialport/parser-readline");

// // Setup serial port
// const port = new SerialPort({
//   path: "COM5",    // Arduino COM port
//   baudRate: 9600,
// });

// // Setup parser
// const parser = port.pipe(new ReadlineParser({ delimiter: "\n" }));
// // ================== WEBSOCKET SETUP ==================
// const wss = new WebSocket.Server({ port: 8080 }, () => {
//   console.log("WebSocket Server started on port 8080");
// });

// wss.on("connection", (ws) => {
//   console.log("Frontend connected");

//   // When frontend sends a manual value (1-5 or 'a'/'m')
//   ws.on("message", (msg) => {
//     console.log("Received from frontend:", msg.toString());

//     // Forward to Arduino
//     port.write(msg.toString());
//   });

//   // When Arduino sends data, forward to all connected clients
//   parser.on("data", (data) => {
//     // e.g. data: "Mode: m | MainV: 12.34 V | MPPT: 4.01 V | TargetV: 4 | Error%: 2.25 | I: 150 mA | P: 0.60 W | PWM: 150"
//     // Convert to JSON for frontend
//     try {
//       const json = parseArduinoData(data);
//       if (json) ws.send(JSON.stringify(json));
//     } catch (err) {
//       console.error("Failed to parse Arduino data:", err);
//     }
//   });
// });

// // ================== PARSE ARDUINO DATA ==================
// function parseArduinoData(line) {
//   // Split by | and parse each value
//   const obj = {};
//   const parts = line.trim().split("|");

//   parts.forEach((part) => {
//     const [key, val] = part.split(":").map((s) => s.trim());
//     switch (key) {
//       case "Mode":
//         obj.mode = val;
//         break;
//       case "MainV":
//         obj.mainV = parseFloat(val);
//         break;
//       case "MPPT":
//         obj.mpptV = parseFloat(val);
//         break;
//       case "TargetV":
//         obj.targetV = parseFloat(val);
//         break;
//       case "Error%":
//         obj.error = parseFloat(val);
//         break;
//       case "I":
//         obj.current = parseFloat(val);
//         break;
//       case "P":
//         obj.power = parseFloat(val);
//         break;
//       case "PWM":
//         obj.pwm = parseInt(val);
//         break;
//       default:
//         break;
//     }
//   });

//   return obj;
// }

