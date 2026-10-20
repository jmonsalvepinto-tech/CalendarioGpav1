const JavaScriptObfuscator = require("javascript-obfuscator");
const fs = require("fs");
const path = require("path");

console.log("🔒 Iniciando empaquetado y cifrado hermético...");

const rutaConfig = path.join(__dirname, "js", "config.js");
const rutaScript = path.join(__dirname, "js", "script.js");
const rutaSalida = path.join(__dirname, "js", "app.min.js");

if (!fs.existsSync(rutaConfig) || !fs.existsSync(rutaScript)) {
  console.error("❌ Error: Faltan archivos de origen en la carpeta js/");
  process.exit(1);
}

// 1. Unir ambos archivos
const codigoConfig = fs.readFileSync(rutaConfig, "utf8");
const codigoScript = fs.readFileSync(rutaScript, "utf8");
const codigoCompleto = `${codigoConfig}\n;\n${codigoScript}`;

// 2. Ofuscar primero con configuración limpia y compacta
console.log("⚙️ 1/2 Ofuscando lógica...");
const opcionesOfuscador = {
  compact: true,
  controlFlowFlattening: false, // Dejarlo en false para que el tamaño sea ultra ligero y rápido
  deadCodeInjection: false,
  debugProtection: false,
  disableConsoleOutput: false,
  identifierNamesGenerator: "mangled",
  renameGlobals: false,
  selfDefending: false,
  stringArray: true,
  stringArrayEncoding: ["base64"],
  stringArrayThreshold: 1.0,
  transformObjectKeys: true
};

const codigoOfuscado = JavaScriptObfuscator.obfuscate(codigoCompleto, opcionesOfuscador).getObfuscatedCode();

// 3. Cifrar con clave criptográfica en un contenedor hermético
console.log("🔐 2/2 Cifrando en cápsula sellada...");
const CLAVE_SECRETA = "N0dEx_GPA_SecLock_2026_" + Math.random().toString(36).substring(2);

function cifrarEnvoltorio(texto, clave) {
  const bytes = Buffer.from(texto, "utf8");
  const bytesClave = Buffer.from(clave, "utf8");
  const salida = Buffer.alloc(bytes.length);
  for (let i = 0; i < bytes.length; i++) {
    salida[i] = bytes[i] ^ bytesClave[i % bytesClave.length];
  }
  return salida.toString("base64");
}

const payloadCifrado = cifrarEnvoltorio(codigoOfuscado, CLAVE_SECRETA);

// 4. Generar el script final: sólo una cadena cifrada y un micro-cargador en memoria
const codigoFinal = `/* NODEX SECURE ENCRYPTED MODULE */
var _0xNX_PAYLOAD="${payloadCifrado}";
(function(_d,_k){
  try{
    var _r=atob(_d),_u=new Uint8Array(_r.length);
    for(var _i=0;_i<_r.length;_i++){_u[_i]=_r.charCodeAt(_i)^_k.charCodeAt(_i%_k.length);}
    (0,eval)(new TextDecoder().decode(_u));
  }catch(_e){console.error("NX Engine Init Error",_e);}
})(_0xNX_PAYLOAD,"${CLAVE_SECRETA}");
`;

fs.writeFileSync(rutaSalida, codigoFinal, "utf8");

console.log(`✅ ¡Completado! js/app.min.js generado (${(fs.statSync(rutaSalida).size / 1024).toFixed(1)} KB)`);
console.log("🎉 Ahora en Sources solo se ve un bloque cifrado de una línea sin fórmulas ni funciones sueltas.");
