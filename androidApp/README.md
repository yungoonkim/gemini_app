# 📱 Gemini Studio - Android Native Hybrid App (2026.2.1)

Google Gemini 3.8 Flash 초고속 AI 모델과 완벽하게 연동되는 **Android 네이티브 하이브리드 앱** 프로젝트입니다.  
**Android Studio 2026.2.1** (및 Ladybug, Meerkat 등 최신 버전)에서 추가 설정 없이 바로 열어서 빌드하고 테스트할 수 있도록 설계되었습니다.

---

## 🛠️ 기술 스택 및 빌드 사양

| 항목 | 사양 / 버전 | 설명 |
| :--- | :--- | :--- |
| **타깃 OS** | Android 15 (VanillaIceCream) | `compileSdk: 35`, `targetSdk: 35` |
| **최소 지원 사양** | Android 8.0 Oreo | `minSdk: 26` (전 세계 안드로이드 기기 95% 이상 호환) |
| **개발 언어** | Kotlin | `2.0.20` (Java 17 호환) |
| **빌드 도구** | Gradle 8.9 & AGP 8.7.0 | Kotlin DSL (`build.gradle.kts`) |
| **디자인 시스템** | Material 3 & Dark Ambient | 엣지-투-엣지 테마 (`#0B0F19`) |
| **아키텍처** | Native Wrapped WebView | AndroidX WebKit, SwipeRefresh, FileProvider |

---

## 🌟 주요 기능 및 네이티브 연동

1. **초고속 스트리밍 대화 & 실시간 구글 웹 검색 (Grounding)**
   - 100만 토큰 컨텍스트의 Gemini 3.8 Flash 모델과 SSE 실시간 스트리밍 답변을 지원합니다.
   - 구글 검색 도구 연동으로 최신 날씨, 뉴스 등 검증된 실시간 출처 링크를 제공하며, 외부 출처 클릭 시 안드로이드 기본 브라우저로 안전하게 연결됩니다.

2. **멀티모달 이미지 분석 (갤러리 및 카메라 지원)**
   - `WebChromeClient.onShowFileChooser` 및 `ActivityResultLauncher` 기반으로 구현되었습니다.
   - 웹뷰 내 이미지 첨부 버튼 클릭 시 안드로이드 시스템 갤러리 또는 카메라가 즉시 실행되어 사진을 첨부할 수 있습니다.
   - `FileProvider`를 적용하여 Android 11+ 보안 샌드박스 정책을 완벽 준수합니다.

3. **한국어 음성 대화 (STT 마이크 연동)**
   - 웹 표준 Web Audio API와 안드로이드 네이티브 마이크(`RECORD_AUDIO`) 런타임 권한을 연동하여 음성 인식 질문을 지원합니다.

4. **엣지-투-엣지 다크 앰비언트 UI & 스와이프 새로고침**
   - 상단 상태바(Status Bar) 및 하단 내비게이션바를 웹앱의 배경색(`#0B0F19`)과 일체화하여 노치/다이내믹 아일랜드 영역까지 유려하게 표시됩니다.
   - `SwipeRefreshLayout`을 적용하여 화면을 아래로 당겨 새로고침할 수 있습니다.

5. **오프라인 감지 및 원클릭 재시도 UX**
   - 네트워크 두절 시 즉시 오프라인 안내 카드 화면이 전환되며, 통신 복구 후 `[다시 시도]` 버튼을 누르면 직전 상태로 복구됩니다.

6. **서버 연결 대상 간편 전환**
   - **기본값 (프로덕션)**: Google Cloud Run 실시간 서버 (`https://gemini-studio-976675812314.asia-northeast3.run.app`)
   - **로컬 개발 (에뮬레이터)**: 로컬 컴퓨터의 Node.js 서버 (`http://10.0.2.2:3000`)

---

## 📁 디렉터리 구조

```text
androidApp/
├── build.gradle.kts                # 프로젝트 최상위 빌드 스크립트 (AGP 8.7.0, Kotlin 2.0.20)
├── settings.gradle.kts             # Gradle 플러그인 및 모듈 의존성 설정
├── gradle.properties               # JVM 힙 메모리(2GB) 및 AndroidX 옵션
├── gradlew.bat                     # Windows CLI 빌드 스크립트
├── gradle/wrapper/                 # Gradle 8.9 래퍼 설정
│   └── gradle-wrapper.properties
└── app/                            # 메인 애플리케이션 모듈
    ├── build.gradle.kts            # 앱 모듈 사양 (SDK 35, ViewBinding, AndroidX)
    ├── proguard-rules.pro          # 릴리즈 코드 난독화 규칙
    └── src/main/
        ├── AndroidManifest.xml     # 인터넷, 마이크, 카메라 권한 및 FileProvider 명세
        ├── java/kr/iceu/songpa11/geministudio/
        │   └── MainActivity.kt     # 멀티모달 파일 선택, 마이크 권한, 웹뷰 생명주기 제어
        └── res/
            ├── layout/activity_main.xml     # 웹뷰, 프로그레스바, 오프라인 카드 레이아웃
            ├── values/                      # strings.xml, colors.xml, themes.xml
            ├── drawable/                    # 반응형 앱 아이콘 및 배경 리소스
            ├── mipmap-anydpi-v26/           # 안드로이드 어댑티브 런처 아이콘
            └── xml/
                ├── network_security_config.xml # 전역 HTTPS 강제 및 로컬 에뮬레이터 예외 명세
                └── file_paths.xml              # 카메라 임시 파일 저장 경로
```

---

## 🚀 빠른 시작 가이드 (초보자용 4단계)

> 💡 **비주얼 가이드**: 스크린샷과 클릭 위치가 포함된 상세 안내는 루트 폴더의 **[`android_guide.html`](../android_guide.html)** 파일을 브라우저로 열람해주세요.

### 1. Android Studio에서 프로젝트 열기
1. **Android Studio** 실행
2. 시작 화면에서 **`Open`** 클릭 (⚠️ `New Project`를 누르지 마세요!)
3. 프로젝트 경로 선택:
   ```text
   c:\Users\USER\AI-NativeAgent\Project\gemini_app\androidApp
   ```
4. `Trust Project` 안내가 뜨면 확인을 누릅니다.

### 2. 첫 Gradle Sync 대기
- 첫 로딩 시 Gradle 8.9 및 Android SDK 도구가 자동으로 다운로드됩니다.
- 우측 하단 프로그레스 바가 사라지고 **`BUILD SUCCESSFUL`** 문구가 뜰 때까지 1~2분 대기합니다.

### 3. 테스트 기기 선택
- **가상 스마트폰 (에뮬레이터)**: 우측 사이드바 `Device Manager` → `+` → `Pixel 8` 선택 후 실행
- **실제 스마트폰 (갤럭시 등)**: 폰 설정 → 휴대전화 정보 → 소프트웨어 정보 → **빌드번호 7번 연타**(개발자 모드) → **USB 디버깅 켜기** → PC와 USB 케이블 연결

### 4. 실행 버튼 클릭
- 상단 툴바에서 **초록색 ▶ (Run 'app')** 버튼 클릭 (단축키: `Shift + F10`)
- 스마트폰 화면에 Gemini Studio가 즉시 설치 및 실행됩니다!

---

## 📦 독립 실행형 APK 파일 추출 (스마트폰 직접 설치용)

안드로이드 스튜디오가 없는 기기나 친구들에게 앱을 공유하고 싶을 때 설치 파일(`.apk`)을 생성하는 방법입니다:

1. 상단 메뉴바에서 **`Build`** 클릭
2. **`Build Bundle(s) / APK(s)`** → **`Build APK(s)`** 선택
3. 빌드 완료 후 우측 하단 팝업창에서 파란색 **`locate`** 링크 클릭
4. 열리는 폴더(`app/build/outputs/apk/debug/`)에서 **`app-debug.apk`** 파일을 카카오톡이나 클라우드로 스마트폰에 전송하여 설치합니다.

---

## 🔒 보안 및 네트워크 정책

- **안전한 HTTPS 기본 적용**: `network_security_config.xml`에 의해 모든 프로덕션 트래픽은 강력한 TLS/HTTPS로 암호화됩니다.
- **개발용 에뮬레이터 예외**: 컴퓨터 내부 개발(`http://10.0.2.2:3000`) 및 `localhost` 환경에 대해서만 안전하게 루프백 cleartext 트래픽이 허용되어 있습니다.
- **권한 최소화**: 마이크 및 카메라 권한은 사용자가 관련 기능을 직접 탭할 때만 시스템 런타임 다이얼로그를 통해 동의를 요청합니다.
