# 🌟 Gemini Studio (Web & Android)

Google Gemini 3.8 Flash 초고속 AI 모델 기반의 풀스택 대화형 서비스 프로젝트입니다.
웹 애플리케이션(`webApp`)과 Android Studio 2026.2.1 네이티브 하이브리드 앱(`androidApp`)으로 구성되어 있습니다.

---

## 📁 프로젝트 구조

```text
gemini_app/
├── 📂 webApp/                 # Node.js/Express 기반 웹 챗봇 서비스 (Docker & Cloud Run 배포 가능)
│   ├── .env.example           # 환경변수 템플릿 (보안: 실제 .env는 git에 올라가지 않습니다)
│   ├── server.js              # SSE 스트리밍 & Google Search Grounding 백엔드
│   ├── public/                # PWA 및 프론트엔드 정적 파일
│   └── Dockerfile             # Google Cloud Run 배포용 컨테이너 명세
│
├── 📂 androidApp/             # 📱 Android Studio 2026.2.1 네이티브 앱 프로젝트
│   ├── app/                   # Kotlin & WebView 하이브리드 앱 모듈
│   ├── build.gradle.kts       # Gradle 8.9 & Android 15 (SDK 35)
│   └── AndroidManifest.xml    # 카메라, 마이크, 네트워크 권한 설정
│
├── 📄 android_guide.html      # 📖 안드로이드 스튜디오 왕초보 빌드/테스트 비주얼 가이드
├── 📄 work_log.html           # 📋 상세 개발 내역 및 작업 이력서
└── 📄 .gitignore              # 🛡️ API 키 및 개인 환경 파일 유출 방지 설정
```

---

## 🔒 보안 및 환경변수 설정 가이드

본 프로젝트는 보안을 위해 실제 API 키가 포함된 `.env` 파일을 Git 추적에서 제외하고 있습니다.

1. **환경변수 템플릿 복사**
   ```bash
   cp webApp/.env.example webApp/.env
   ```
2. **`webApp/.env` 파일 수정**
   ```env
   # Google Gemini API Key (필수)
   GEMINI_API_KEY=YOUR_GEMINI_API_KEY_HERE

   # Firebase Auth 연동 (선택)
   FIREBASE_PROJECT_ID=your-project-id
   FIREBASE_API_KEY=your-api-key
   FIREBASE_APP_ID=your-app-id
   ```

---

## 🚀 빠른 실행

### 1. 웹 서버 실행 (`webApp`)
```bash
cd webApp
npm install
npm start
# 웹 브라우저에서 http://localhost:3000 접속
```

### 2. 안드로이드 앱 실행 (`androidApp`)
- [Android Studio 가이드 열기](android_guide.html) 파일을 브라우저에서 열람하여 따라 하시면 바로 스마트폰에서 실행할 수 있습니다.
