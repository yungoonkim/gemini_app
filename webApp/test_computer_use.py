import time
import os
import sys

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')
if hasattr(sys.stderr, 'reconfigure'):
    sys.stderr.reconfigure(encoding='utf-8')

from playwright.sync_api import sync_playwright

print("=" * 65)
print("👀 [Visual Computer-Use Test] Gemini 3.8 Flash + Firestore (chatbot_users)")
print("Python Executable:", sys.executable)
print("=" * 65)

test_timestamp = int(time.time())
test_name = f"챗봇테스터_{test_timestamp % 1000}"
test_email = f"chatbot_{test_timestamp}@iceu.kr"
test_password = "password1234!"

screenshots_dir = os.path.join(os.path.dirname(__file__), "test_screenshots")
os.makedirs(screenshots_dir, exist_ok=True)

def setup_visual_cursor(page):
    page.evaluate("""() => {
        if (!document.getElementById('test-visual-cursor')) {
            const cursor = document.createElement('div');
            cursor.id = 'test-visual-cursor';
            cursor.style.cssText = 'position:fixed;width:22px;height:22px;border-radius:50%;background:rgba(239,68,68,0.9);border:2px solid #ffffff;box-shadow:0 0 16px rgba(239,68,68,0.9);pointer-events:none;z-index:999999;transition:all 0.3s cubic-bezier(0.2,0.8,0.2,1);transform:translate(-50%,-50%);left:50%;top:50%;';
            document.body.appendChild(cursor);
        }
    }""")

def move_cursor_and_click(page, selector, desc=""):
    print(f"  🖱️ [마우스 클릭] {desc} ({selector})")
    el = page.locator(selector)
    box = el.bounding_box()
    if box:
        cx = box["x"] + box["width"] / 2
        cy = box["y"] + box["height"] / 2
        
        # Move animated red cursor
        page.evaluate("""({x, y}) => {
            const cursor = document.getElementById('test-visual-cursor');
            if (cursor) {
                cursor.style.left = x + 'px';
                cursor.style.top = y + 'px';
            }
        }""", {"x": cx, "y": cy})
        time.sleep(0.35)
        
        # Ripple effect
        page.evaluate("""({x, y}) => {
            const ripple = document.createElement('div');
            ripple.style.cssText = 'position:fixed;left:' + x + 'px;top:' + y + 'px;width:12px;height:12px;border-radius:50%;border:3px solid #38bdf8;pointer-events:none;z-index:999998;transform:translate(-50%,-50%);animation:testRipple 0.5s ease-out forwards;';
            const style = document.createElement('style');
            style.textContent = '@keyframes testRipple { 0%{width:12px;height:12px;opacity:1;} 100%{width:60px;height:60px;opacity:0;} }';
            document.head.appendChild(style);
            document.body.appendChild(ripple);
            setTimeout(() => ripple.remove(), 600);
        }""", {"x": cx, "y": cy})
        
        page.mouse.move(cx, cy)
        time.sleep(0.25)
        page.mouse.click(cx, cy)
    else:
        el.click()
    time.sleep(0.4)

def type_text(page, selector, text, desc=""):
    print(f"  ⌨️ [키보드 입력] {desc}: '{text}'")
    el = page.locator(selector)
    box = el.bounding_box()
    if box:
        page.evaluate("""({x, y}) => {
            const cursor = document.getElementById('test-visual-cursor');
            if (cursor) {
                cursor.style.left = x + 'px';
                cursor.style.top = y + 'px';
            }
        }""", {"x": box["x"] + box["width"] / 2, "y": box["y"] + box["height"] / 2})
        time.sleep(0.2)
    el.click()
    page.keyboard.type(text, delay=45)
    time.sleep(0.3)

with sync_playwright() as p:
    print("\n[1단계] 브라우저(Edge) 화면을 사용자 디스플레이에 띄웁니다 (headless=False)...")
    browser = p.chromium.launch(
        channel="msedge",
        headless=False,  # 사용자 화면에 실제 브라우저 창 표시!
        slow_mo=250,     # 사람이 눈으로 따라갈 수 있는 자연스러운 속도
        args=[
            "--window-size=1200,920",
            "--window-position=120,50"
        ]
    )
    context = browser.new_context(viewport={"width": 1180, "height": 860})
    page = context.new_page()
    page.on("console", lambda msg: print(f"  [Browser Console] {msg.type}: {msg.text}"))

    print("\n[2단계] 웹앱 접속: http://localhost:3000 ...")
    page.goto("http://localhost:3000", wait_until="networkidle")
    time.sleep(1.0)
    setup_visual_cursor(page)
    page.screenshot(path=os.path.join(screenshots_dir, "01_home.png"))
    print("  -> 웹앱 로드 완료. 타이틀:", page.title())

    # Firebase SDK 및 신규 스키마 확인
    sdk_status = page.evaluate("""() => {
        return {
            firebaseLoaded: typeof firebase !== 'undefined',
            authLoaded: typeof firebase !== 'undefined' && typeof firebase.auth === 'function',
            firestoreLoaded: typeof firebase !== 'undefined' && typeof firebase.firestore === 'function'
        };
    }""")
    print("  -> Firebase 클라이언트 SDK 상태:", sdk_status)

    print("\n[3단계] 마우스로 상단 우측 '로그인' 버튼 클릭...")
    move_cursor_and_click(page, "#user-auth-btn", "상단 로그인 버튼")
    time.sleep(0.8)

    print("\n[4단계] 마우스로 모달 상단 '회원가입' 탭 클릭...")
    move_cursor_and_click(page, "#tab-signup", "회원가입 탭")
    time.sleep(0.6)

    print("\n[5단계] 키보드로 신규 챗봇 사용자 정보 타이핑 입력...")
    type_text(page, "#auth-name", test_name, "닉네임")
    type_text(page, "#auth-email", test_email, "이메일")
    type_text(page, "#auth-password", test_password, "비밀번호")
    type_text(page, "#auth-password-confirm", test_password, "비밀번호 확인")
    page.screenshot(path=os.path.join(screenshots_dir, "03_signup_filled.png"))

    print("\n[6단계] 마우스로 '회원가입' 제출 버튼 클릭...")
    move_cursor_and_click(page, "#auth-submit-btn", "회원가입 제출 버튼")

    print("  -> Firebase Auth 가입 및 Firestore 'chatbot_users' 스키마 동기화 대기 중...")
    time.sleep(3.5)
    page.screenshot(path=os.path.join(screenshots_dir, "04_signup_success.png"))

    # 사용자 상태 확인
    user_info = page.evaluate("""() => {
        const u = typeof firebase !== 'undefined' ? firebase.auth().currentUser : null;
        return u ? { uid: u.uid, email: u.email, displayName: u.displayName } : null;
    }""")
    print("  -> 가입된 Firebase 사용자 정보:", user_info)
    assert user_info is not None, "회원가입 실패!"
    print(f"  ✓ Firebase Auth 계정 생성 확인! UID: {user_info['uid']}")

    print("\n[7단계] Cloud Firestore 신규 스키마 'chatbot_users' 문서 검증...")
    firestore_check = page.evaluate("""async (uid) => {
        try {
            const db = firebase.firestore();
            const doc = await db.collection('chatbot_users').doc(uid).get();
            if (doc.exists) {
                return { exists: true, data: doc.data() };
            }
            return { exists: false, error: 'chatbot_users 문서 미존재' };
        } catch (e) {
            return { exists: false, error: e.message };
        }
    }""", user_info['uid'])
    print("  -> Firestore 'chatbot_users' 문서 검증 결과:", firestore_check)
    assert firestore_check.get("exists"), f"신규 스키마 chatbot_users 생성 실패: {firestore_check.get('error')}"
    print("  ✓ Cloud Firestore 신규 전용 컬렉션 'chatbot_users' 저장 완료!")
    print("    - 앱 구분:", firestore_check["data"].get("app"))
    print("    - 이메일:", firestore_check["data"].get("email"))
    print("    - 닉네임:", firestore_check["data"].get("displayName"))
    print("    - 설정(preferences):", firestore_check["data"].get("preferences"))

    print("\n[8단계] 키보드로 Gemini 3.8 Flash에게 질문 타이핑 후 마우스로 전송...")
    test_prompt = "안녕하세요 Gemini! 챗봇 전용 chatbot_users 스키마 연동 테스트 중입니다. 반갑게 한 줄로 답해주세요!"
    type_text(page, "#prompt-input", test_prompt, "Gemini 질문")
    time.sleep(0.4)
    move_cursor_and_click(page, "#send-btn", "전송 버튼")

    print("  -> Gemini 3.8 Flash 실시간 SSE 스트리밍 응답 수신 대기...")
    time.sleep(5.0)
    page.screenshot(path=os.path.join(screenshots_dir, "05_chat_response.png"))

    bot_responses = page.locator(".message-row.bot .bubble-text").all_text_contents()
    latest_response = bot_responses[-1].strip() if bot_responses else ""
    print("  -> Gemini 3.8 Flash 답변:", latest_response)
    assert len(latest_response) > 0, "Gemini 답변 미수신!"
    print("  ✓ Gemini 실시간 답변 화면 렌더링 확인!")

    print("\n[9단계] Firestore 'chatbot_users/{uid}/chats' 대화 동기화 검증...")
    time.sleep(1.0)
    chats_check = page.evaluate("""async (uid) => {
        try {
            const db = firebase.firestore();
            const snapshot = await db.collection('chatbot_users').doc(uid).collection('chats').get();
            const chats = [];
            snapshot.forEach(doc => chats.push({ id: doc.id, data: doc.data() }));
            return { success: true, count: chats.length, chats: chats };
        } catch (e) {
            return { success: false, error: e.message };
        }
    }""", user_info['uid'])
    print("  -> Firestore 'chatbot_users' chats 동기화 결과:", chats_check)
    assert chats_check.get("success") and chats_check.get("count", 0) > 0, "채팅 동기화 실패!"
    print(f"  ✓ 신규 챗봇 chats 하위 컬렉션 동기화 확인! (대화 개수: {chats_check['count']})")
    saved_chat = chats_check["chats"][0]["data"]
    print(f"    - 대화 제목: {saved_chat.get('title')}")
    print(f"    - 저장된 메시지 수: {len(saved_chat.get('messages', []))}")

    print("\n[10단계] 마우스로 프로필 모달 열고 '로그아웃' 버튼 클릭...")
    move_cursor_and_click(page, "#user-auth-btn", "프로필 버튼")
    time.sleep(0.8)
    move_cursor_and_click(page, "#auth-logout-btn", "로그아웃 버튼")
    time.sleep(1.5)
    page.screenshot(path=os.path.join(screenshots_dir, "06_logged_out.png"))

    is_logged_out = page.evaluate("() => firebase.auth().currentUser === null")
    assert is_logged_out, "로그아웃 실패!"
    print("  ✓ 로그아웃 정상 완료 및 게스트 모드 전환 확인!")

    print("\n[완료] 사용자가 브라우저 결과를 육안으로 확인할 수 있도록 4초간 화면을 유지합니다...")
    time.sleep(4.0)

    browser.close()

print("\n" + "=" * 65)
print("🎉 [테스트 성공] 전용 스키마 'chatbot_users' 및 실시간 시각적 Computer-Use 테스트 완료!")
print("=" * 65)
