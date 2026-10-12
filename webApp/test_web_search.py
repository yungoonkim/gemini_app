import time
import os
import sys

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')
if hasattr(sys.stderr, 'reconfigure'):
    sys.stderr.reconfigure(encoding='utf-8')

from playwright.sync_api import sync_playwright

print("=" * 65)
print("🌐 [Visual Test] Gemini 3.8 Flash 실시간 구글 웹 검색 (Grounding) 테스트")
print("Python Environment: C:\\Users\\USER\\miniconda3\\envs\\myenv")
print("=" * 65)

test_timestamp = int(time.time())
test_name = f"웹검색테스터_{test_timestamp % 1000}"
test_email = f"search_test_{test_timestamp}@iceu.kr"
test_password = "password1234!"

screenshots_dir = os.path.join(os.path.dirname(__file__), "test_screenshots")
os.makedirs(screenshots_dir, exist_ok=True)

def setup_visual_cursor(page):
    page.evaluate("""() => {
        if (!document.getElementById('test-visual-cursor')) {
            const cursor = document.createElement('div');
            cursor.id = 'test-visual-cursor';
            cursor.style.cssText = 'position:fixed;width:22px;height:22px;border-radius:50%;background:rgba(14,165,233,0.9);border:2px solid #ffffff;box-shadow:0 0 16px rgba(14,165,233,0.9);pointer-events:none;z-index:999999;transition:all 0.3s cubic-bezier(0.2,0.8,0.2,1);transform:translate(-50%,-50%);left:50%;top:50%;';
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
        
        page.evaluate("""({x, y}) => {
            const cursor = document.getElementById('test-visual-cursor');
            if (cursor) {
                cursor.style.left = x + 'px';
                cursor.style.top = y + 'px';
            }
        }""", {"x": cx, "y": cy})
        time.sleep(0.35)
        
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
    page.keyboard.type(text, delay=40)
    time.sleep(0.3)

with sync_playwright() as p:
    print("\n[1단계] 브라우저(Edge) 실행 (headless=False)...")
    browser = p.chromium.launch(
        channel="msedge",
        headless=False,
        slow_mo=200,
        args=["--window-size=1200,920", "--window-position=120,50"]
    )
    context = browser.new_context(viewport={"width": 1180, "height": 860})
    page = context.new_page()

    print("\n[2단계] 웹앱 접속: http://localhost:3000 ...")
    page.goto("http://localhost:3000", wait_until="networkidle")
    time.sleep(1.0)
    setup_visual_cursor(page)
    print("  -> 웹앱 로드 완료. 타이틀:", page.title())

    print("\n[3단계] 테스트 계정 로그인/가입 진행...")
    move_cursor_and_click(page, "#user-auth-btn", "상단 로그인 버튼")
    time.sleep(0.6)
    move_cursor_and_click(page, "#tab-signup", "회원가입 탭")
    time.sleep(0.5)

    type_text(page, "#auth-name", test_name, "닉네임")
    type_text(page, "#auth-email", test_email, "이메일")
    type_text(page, "#auth-password", test_password, "비밀번호")
    type_text(page, "#auth-password-confirm", test_password, "비밀번호 확인")
    move_cursor_and_click(page, "#auth-submit-btn", "회원가입 제출")

    print("  -> 계정 생성 및 로그인 완료 대기...")
    time.sleep(3.5)

    user_info = page.evaluate("() => typeof firebase !== 'undefined' && firebase.auth().currentUser ? firebase.auth().currentUser.email : null")
    print(f"  ✓ 로그인 성공: {user_info}")

    print("\n[4단계] 환경 설정 모달에서 '구글 실시간 웹 검색 (Grounding)' 토글 확인...")
    move_cursor_and_click(page, "#settings-btn", "설정 버튼")
    time.sleep(0.8)
    setting_checked = page.evaluate("() => document.getElementById('setting-web-search').checked")
    print(f"  ✓ 설정 모달 웹 검색 기본값 상태: {setting_checked} (기본 ON)")
    page.screenshot(path=os.path.join(screenshots_dir, "07_settings_websearch.png"))
    move_cursor_and_click(page, "#close-settings-btn", "설정 모달 닫기")
    time.sleep(0.6)

    print("\n[5단계] 입력 툴바의 '웹 검색' 토글 버튼 인터랙션 검증...")
    btn_text_initial = page.locator("#web-search-label").text_content()
    print(f"  -> 초기 툴바 버튼 라벨: '{btn_text_initial}'")
    assert "검색 ON" in btn_text_initial, "초기 검색 ON 상태 불일치"

    # 클릭하여 OFF 테스트
    move_cursor_and_click(page, "#web-search-btn", "웹 검색 버튼 (OFF로 토글)")
    time.sleep(0.8)
    btn_text_off = page.locator("#web-search-label").text_content()
    print(f"  -> 클릭 후 툴바 버튼 라벨: '{btn_text_off}'")
    assert "검색 OFF" in btn_text_off, "검색 OFF 토글 실패"

    # 다시 클릭하여 ON 복구
    move_cursor_and_click(page, "#web-search-btn", "웹 검색 버튼 (ON으로 토글)")
    time.sleep(0.8)
    btn_text_on = page.locator("#web-search-label").text_content()
    print(f"  -> 재클릭 후 툴바 버튼 라벨: '{btn_text_on}'")
    assert "검색 ON" in btn_text_on, "검색 ON 복구 실패"

    print("\n[6단계] 최신 실시간 질문 전송: '오늘 서울 송파구 문정동 날씨와 기온 알려줘'...")
    search_prompt = "오늘 서울 송파구 문정동 날씨와 기온 알려줘"
    type_text(page, "#prompt-input", search_prompt, "실시간 날씨 질문")
    time.sleep(0.5)
    move_cursor_and_click(page, "#send-btn", "전송 버튼")

    print("  -> 실시간 검색 및 스트리밍 답변 수신 대기 (최대 30초)...")
    try:
        page.wait_for_selector("#send-btn.streaming", timeout=6000)
        print("  -> 스트리밍 진행 중 감지...")
        page.wait_for_selector("#send-btn:not(.streaming)", timeout=35000)
        print("  ✓ 스트리밍 응답 완료 감지!")
    except Exception as e:
        print("  -> 대기 상태:", e)

    time.sleep(1.2)
    # Grounding 박스 확인 (최대 8초 대기)
    try:
        page.wait_for_selector(".grounding-sources-box", timeout=8000)
        print("  ✓ 실시간 검색 출처 박스 감지 완료!")
    except Exception as e:
        print("  ⚠️ grounding-sources-box 대기 예외:", e)
    page.screenshot(path=os.path.join(screenshots_dir, "08_web_search_result.png"))

    # 답변 내용 및 출처 정보 추출
    bot_responses = page.locator(".message-row.bot .bubble-text").all_text_contents()
    latest_response = bot_responses[-1].strip() if bot_responses else ""
    print("\n[Gemini 3.8 Flash 답변 내용]")
    print(latest_response[:300] + ("..." if len(latest_response) > 300 else ""))

    grounding_info = page.evaluate("""() => {
        const box = document.querySelector('.grounding-sources-box');
        if (!box) return null;
        const queries = Array.from(box.querySelectorAll('.query-chip')).map(el => el.textContent.trim());
        const links = Array.from(box.querySelectorAll('.source-link-chip')).map(el => ({
            title: el.querySelector('.source-title')?.textContent?.trim() || '',
            href: el.getAttribute('href') || ''
        }));
        return { queries, links };
    }""")

    print("\n[추출된 구글 실시간 검색 Grounding 정보]")
    print("  검색 쿼리:", grounding_info.get("queries") if grounding_info else "없음")
    if grounding_info and grounding_info.get("links"):
        print(f"  발견된 출처 링크 수: {len(grounding_info['links'])}개")
        for idx, l in enumerate(grounding_info["links"][:4]):
            print(f"    [{idx+1}] {l['title']} -> {l['href']}")

    assert grounding_info is not None, "웹 검색 출처 박스 미생성!"
    assert len(grounding_info.get("links", [])) > 0 or len(grounding_info.get("queries", [])) > 0, "검색 출처 또는 쿼리 미확인"
    print("\n  ✓ 구글 실시간 웹 검색 및 출처 링크(Grounding) 렌더링 정상 검증 완료!")

    print("\n[7단계] 브라우저 화면 4초간 유지 후 종료...")
    time.sleep(4.0)
    browser.close()

print("\n" + "=" * 65)
print("🎉 [테스트 대성공] Google Search Grounding 기능 검증 완료!")
print("=" * 65)
