import time
import os
import sys
from playwright.sync_api import sync_playwright

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

print("=" * 65)
print("🧪 [테스트] 로그인 실패 시 모달 유지 및 오류 안내 검증")
print("=" * 65)

with sync_playwright() as p:
    browser = p.chromium.launch(channel="msedge", headless=True)
    page = browser.new_page(viewport={"width": 420, "height": 890})

    page.on("console", lambda msg: print(f"  [Browser Console] {msg.type}: {msg.text}"))

    print("\n1. 웹앱 접속...")
    page.goto("http://localhost:3000", wait_until="networkidle")
    time.sleep(1)

    print("\n2. 로그인 모달 열기...")
    page.click("#user-auth-btn")
    time.sleep(0.5)
    assert page.is_visible("#auth-modal"), "모달 열기 실패!"
    print("  ✓ 모달 표시 확인 (display: flex)")

    print("\n3. 잘못된 비밀번호 입력...")
    page.fill("#auth-email", "user1@gmail.com")
    page.fill("#auth-password", "wrong_password_9999")
    time.sleep(0.3)

    print("\n4. '로그인' 버튼 클릭...")
    page.click("#auth-submit-btn")

    # Wait for Firebase Auth response
    print("  -> Firebase Auth 인증 응답 대기 중...")
    time.sleep(2.5)

    # Check modal visibility
    is_modal_visible = page.is_visible("#auth-modal")
    modal_display = page.evaluate("() => document.getElementById('auth-modal').style.display")
    print(f"  ✓ 모달 유지 여부: is_visible={is_modal_visible}, style.display='{modal_display}'")
    assert is_modal_visible and modal_display == 'flex', "🚨 버그 발생: 모달이 닫혔습니다!"

    # Check error message
    error_msg = page.locator("#auth-error-msg").text_content().strip()
    is_error_visible = page.is_visible("#auth-error-msg")
    print(f"  ✓ 에러 메시지: '{error_msg}' (visible: {is_error_visible})")
    assert "이메일 또는 비밀번호가 일치하지 않습니다" in error_msg, f"오류 메시지 불일치: {error_msg}"

    # Check password input focus
    is_focused = page.evaluate("() => document.activeElement === document.getElementById('auth-password')")
    print(f"  ✓ 비밀번호 입력 필드 자동 포커스 상태: {is_focused}")

    # Capture screenshot of the error state
    screenshot_path = "test_screenshots/07_login_failure_modal_fixed.png"
    page.screenshot(path=screenshot_path)
    print(f"  ✓ 스크린샷 저장 완료: {screenshot_path}")

    print("\n5. 모달 내부 클릭 시 닫히지 않는지 방어 검증...")
    page.click("#auth-error-msg")
    time.sleep(0.3)
    page.click(".auth-project-pill")
    time.sleep(0.3)
    assert page.is_visible("#auth-modal"), "모달 내부 클릭 시 모달이 닫히면 안 됩니다!"
    print("  ✓ 모달 내부 요소 클릭 시 모달 유지 확인")

    print("\n6. 바깥 배경(오버레이) 의도적 클릭 시 정상 닫힘 검증...")
    # Click near top edge outside the modal dialog (e.g. at x=20, y=20)
    page.mouse.click(20, 20)
    time.sleep(0.5)
    modal_display_after_overlay_click = page.evaluate("() => document.getElementById('auth-modal').style.display")
    print(f"  ✓ 배경 오버레이 클릭 후 모달 상태: '{modal_display_after_overlay_click}'")
    assert modal_display_after_overlay_click == 'none', "배경 클릭 시에는 정상적으로 닫혀야 합니다!"

    browser.close()

print("\n" + "=" * 65)
print("🎉 [테스트 성공] 로그인 실패 시 모달 사라짐 버그가 완벽히 수정되었습니다!")
print("=" * 65)
