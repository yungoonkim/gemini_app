# 📱 Gemini Studio - Android Studio 프로젝트 (2026.2.1)

Google Gemini 3.8 Flash 초고속 AI 챗봇의 안드로이드 네이티브 앱 프로젝트입니다.
Android Studio 2026.2.1 (및 최신 Android Studio)에서 바로 빌드하고 실행할 수 있도록 구성되어 있습니다.

---

## 🚀 프로젝트 주요 특징

1. **최신 Android 15 & Material 3 지원**
   - `compileSdk: 35`, `targetSdk: 35`, `minSdk: 26` (Android 8.0 Oreo 이상, 전 세계 안드로이드 기기 95% 이상 지원)
   - 최신 Gradle 8.9 & Android Gradle Plugin 8.7.0 적용
2. **풀스크린 다크 앰비언트 UI**
   - 앱 배경 `#0B0F19`, 상태바/내비게이션바 일체형 엣지-투-엣지(Edge-to-Edge) 테마
3. **멀티모달 이미지 첨부 완벽 지원**
   - `WebChromeClient.onShowFileChooser` 연동으로 갤러리 및 카메라 사진 촬영 후 AI에게 전송 가능
4. **음성 인식 (STT) 마이크 권한 통합**
   - 브라우저 Web Audio API 및 Android 마이크 권한 연동
5. **구글 실시간 웹 검색 (Grounding) 지원**
   - 실시간 날씨, 뉴스 등 검색 결과 및 탭 출처 링크 자동 외부 브라우저 연동
6. **오프라인 감지 및 재시도 화면**
   - 네트워크 두절 시 깔끔한 안내 카드 및 원클릭 '다시 시도' 버튼 제공

---

## 🛠️ 빠른 시작 안내

자세한 초보자용 가이드는 프로젝트 루트의 **`android_guide.html`** 파일을 더블클릭하여 확인해주세요!

1. **Android Studio 실행**
2. **Open 클릭** → `c:\Users\USER\AI-NativeAgent\Project\gemini_app\androidApp` 폴더 선택
3. 우측 상단 **▶ (Run App)** 녹색 재생 버튼 클릭
4. 에뮬레이터 또는 연결된 실제 스마트폰에서 Gemini Studio가 즉시 실행됩니다!
