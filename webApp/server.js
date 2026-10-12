const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const os = require('os');
const dotenv = require('dotenv');
const { GoogleGenAI } = require('@google/genai');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Enable JSON body parsing with large payload limit for image uploads
app.use(express.json({ limit: '25mb' }));
app.use(express.urlencoded({ extended: true, limit: '25mb' }));
app.use(cors());

// Serve static frontend files
app.use(express.static(path.join(__dirname, 'public')));

// Available model configurations
const AVAILABLE_MODELS = [
  {
    id: 'gemini-3.8-flash',
    name: 'Gemini 3.8 Flash',
    tag: '기본 권장 (High Performance)',
    description: '최신 고지능 초고속 모델, 1M 토큰 컨텍스트 및 장기 추론 지원',
    isDefault: true
  },
  {
    id: 'gemini-2.5-flash',
    name: 'Gemini 2.5 Flash',
    tag: '안정형',
    description: '균형 잡힌 범용 빠른 멀티모달 모델',
    isDefault: false
  },
  {
    id: 'gemini-2.0-flash',
    name: 'Gemini 2.0 Flash',
    tag: '경량형',
    description: '낮은 지연시간과 효율적인 일상 대화 모델',
    isDefault: false
  }
];

// Network & Local IP endpoint for mobile PWA QR code installation
app.get('/api/network-info', (req, res) => {
  const interfaces = os.networkInterfaces();
  const addresses = [];
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        addresses.push({ name, address: iface.address });
      }
    }
  }

  // Find preferred LAN IP (e.g. 192.168.x.x, 10.x.x.x, 172.x.x.x)
  let primaryIp = '127.0.0.1';
  const lanCandidate = addresses.find(a => a.address.startsWith('192.168.') || a.address.startsWith('10.') || a.address.startsWith('172.'));
  if (lanCandidate) {
    primaryIp = lanCandidate.address;
  } else if (addresses.length > 0) {
    primaryIp = addresses[0].address;
  }

  res.json({
    port: PORT,
    localUrl: `http://localhost:${PORT}`,
    lanUrl: `http://${primaryIp}:${PORT}`,
    ip: primaryIp,
    addresses
  });
});

// System Status endpoint
app.get('/api/status', (req, res) => {
  res.json({
    status: 'online',
    defaultModel: 'gemini-3.8-flash',
    hasEnvKey: !!process.env.GEMINI_API_KEY,
    models: AVAILABLE_MODELS
  });
});

// Models list endpoint
app.get('/api/models', (req, res) => {
  res.json({
    models: AVAILABLE_MODELS,
    selected: 'gemini-3.8-flash'
  });
});

// Firebase Auth Configuration endpoint for iceu-songpa11
app.get('/api/auth/config', (req, res) => {
  try {
    const envPath = path.join(__dirname, '.env');
    if (fs.existsSync(envPath)) {
      const envConfig = dotenv.parse(fs.readFileSync(envPath));
      if (envConfig.FIREBASE_API_KEY) process.env.FIREBASE_API_KEY = envConfig.FIREBASE_API_KEY;
      if (envConfig.FIREBASE_APP_ID) process.env.FIREBASE_APP_ID = envConfig.FIREBASE_APP_ID;
      if (envConfig.GEMINI_API_KEY) process.env.GEMINI_API_KEY = envConfig.GEMINI_API_KEY;
      if (envConfig.FIREBASE_PROJECT_ID) process.env.FIREBASE_PROJECT_ID = envConfig.FIREBASE_PROJECT_ID;
      if (envConfig.FIREBASE_AUTH_DOMAIN) process.env.FIREBASE_AUTH_DOMAIN = envConfig.FIREBASE_AUTH_DOMAIN;
    }
  } catch (e) {
    console.warn('Dynamic .env parse notice:', e.message);
  }

  res.json({
    projectId: process.env.FIREBASE_PROJECT_ID || 'iceu-songpa11',
    authDomain: process.env.FIREBASE_AUTH_DOMAIN || 'iceu-songpa11.firebaseapp.com',
    apiKey: process.env.FIREBASE_API_KEY || '',
    appId: process.env.FIREBASE_APP_ID || '',
    account: process.env.FIREBASE_ACCOUNT || '',
    isConfigured: !!(process.env.FIREBASE_API_KEY && process.env.FIREBASE_API_KEY.trim() !== '')
  });
});

// Firebase Auth Setup endpoint to save credentials to .env (Disabled in production for security)
app.post('/api/auth/setup', (req, res) => {
  if (process.env.NODE_ENV === 'production') {
    return res.status(403).json({
      success: false,
      error: '프로덕션(Cloud Run) 환경에서는 보안상 원격 환경변수 직접 저장이 허용되지 않습니다. Cloud Run 콘솔 환경변수를 이용해주세요.'
    });
  }

  const { apiKey, appId } = req.body;
  try {
    const envPath = path.join(__dirname, '.env');
    let envContent = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf8') : '';

    if (apiKey) {
      if (envContent.includes('FIREBASE_API_KEY=')) {
        envContent = envContent.replace(/FIREBASE_API_KEY=.*/, `FIREBASE_API_KEY=${apiKey.trim()}`);
      } else {
        envContent += `\nFIREBASE_API_KEY=${apiKey.trim()}`;
      }
      process.env.FIREBASE_API_KEY = apiKey.trim();
    }
    if (appId) {
      if (envContent.includes('FIREBASE_APP_ID=')) {
        envContent = envContent.replace(/FIREBASE_APP_ID=.*/, `FIREBASE_APP_ID=${appId.trim()}`);
      } else {
        envContent += `\nFIREBASE_APP_ID=${appId.trim()}`;
      }
      process.env.FIREBASE_APP_ID = appId.trim();
    }

    fs.writeFileSync(envPath, envContent.trim() + '\n', 'utf8');
    res.json({
      success: true,
      message: 'Firebase 설정이 .env에 안전하게 저장되었습니다.',
      config: {
        projectId: process.env.FIREBASE_PROJECT_ID,
        authDomain: process.env.FIREBASE_AUTH_DOMAIN,
        isConfigured: true
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Streaming Chat endpoint using SSE
app.post('/api/chat', async (req, res) => {
  const {
    messages,
    model = 'gemini-3.8-flash',
    systemInstruction,
    temperature,
    webSearch = true
  } = req.body;

  // Set up SSE headers
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // Disable Nginx buffering if proxied
  if (res.flushHeaders) {
    res.flushHeaders();
  }

  // Gemini API Key: strictly loaded from environment variable
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    res.write(`data: ${JSON.stringify({
      error: '서버 환경 변수에 GEMINI_API_KEY가 설정되어 있지 않습니다. 프로젝트 루트의 .env 파일 또는 시스템 환경 변수를 확인해주세요.',
      done: true
    })}\n\n`);
    return res.end();
  }

  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    res.write(`data: ${JSON.stringify({
      error: '대화 메시지 내용이 비어 있습니다.',
      done: true
    })}\n\n`);
    return res.end();
  }

  try {
    const ai = new GoogleGenAI({ apiKey });

    // Transform messages into Gemini SDK format
    const contents = messages.map(msg => {
      const parts = [];

      // Multimodal image attachments
      if (msg.images && Array.isArray(msg.images)) {
        for (const img of msg.images) {
          if (img && img.data) {
            // Clean base64 data header if present
            const cleanBase64 = img.data.replace(/^data:[^;]+;base64,/, '');
            parts.push({
              inlineData: {
                mimeType: img.mimeType || 'image/jpeg',
                data: cleanBase64
              }
            });
          }
        }
      }

      // Text content
      if (msg.content && typeof msg.content === 'string') {
        parts.push({ text: msg.content });
      }

      const role = (msg.role === 'assistant' || msg.role === 'model') ? 'model' : 'user';

      return {
        role,
        parts: parts.length > 0 ? parts : [{ text: ' ' }]
      };
    });

    const config = {};
    if (systemInstruction && typeof systemInstruction === 'string' && systemInstruction.trim()) {
      config.systemInstruction = systemInstruction.trim();
    }
    if (typeof temperature === 'number' && !isNaN(temperature)) {
      config.temperature = Math.max(0, Math.min(2, temperature));
    }

    // Google Search Grounding Tool
    if (webSearch) {
      config.tools = [{ googleSearch: {} }];
    }

    const startTime = Date.now();
    let latestGroundingMetadata = null;

    // Call generateContentStream with selected model (default: gemini-3.8-flash)
    const stream = await ai.models.generateContentStream({
      model: model || 'gemini-3.8-flash',
      contents,
      config: Object.keys(config).length > 0 ? config : undefined
    });

    for await (const chunk of stream) {
      // Capture grounding metadata if provided
      if (chunk.candidates?.[0]?.groundingMetadata) {
        latestGroundingMetadata = chunk.candidates[0].groundingMetadata;
      }
      if (chunk.text) {
        res.write(`data: ${JSON.stringify({ text: chunk.text })}\n\n`);
      }
    }

    const latencyMs = Date.now() - startTime;
    res.write(`data: ${JSON.stringify({
      done: true,
      stats: { latencyMs, model },
      groundingMetadata: latestGroundingMetadata
    })}\n\n`);
    res.end();

  } catch (err) {
    console.error('Gemini API Error:', err);
    let errorMessage = err.message || '요청 처리 중 오류가 발생했습니다.';

    if (errorMessage.includes('API_KEY_INVALID') || errorMessage.includes('API key not valid')) {
      errorMessage = '입력된 Gemini API 키가 유효하지 않습니다. 올바른 키를 입력해주세요.';
    } else if (errorMessage.includes('RESOURCE_EXHAUSTED')) {
      errorMessage = '요청 한도(Rate Limit)를 초과했습니다. 잠시 후 다시 시도해주세요.';
    }

    res.write(`data: ${JSON.stringify({ error: errorMessage, done: true })}\n\n`);
    res.end();
  }
});

// Fallback to index.html for SPA routes
app.use((req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`===============================================`);
  console.log(` Gemini 3.8 Flash Chat Web Server Started!`);
  console.log(` URL: http://localhost:${PORT}`);
  console.log(` Model: gemini-3.8-flash`);
  console.log(` API Key Loaded: ${!!process.env.GEMINI_API_KEY ? 'YES (from environment)' : 'NO (awaiting user key)'}`);
  console.log(`===============================================`);
});
