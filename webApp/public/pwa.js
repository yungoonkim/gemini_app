/**
 * Progressive Web App (PWA) & Mobile QR Code Installer Module
 * Handles Service Worker registration, PWA installation prompts,
 * LAN IP detection, and interactive QR Code generation.
 */

(function () {
  'use strict';

  let deferredInstallPrompt = null;
  let currentInstallUrl = '';
  let qrCodeInstance = null;

  const elements = {
    pwaModal: document.getElementById('pwa-modal'),
    closePwaBtn: document.getElementById('close-pwa-btn'),
    pwaQrBtn: document.getElementById('pwa-qr-btn'),
    sidebarPwaBtn: document.getElementById('sidebar-pwa-qr-btn'),
    qrContainer: document.getElementById('pwa-qrcode-container'),
    lanUrlText: document.getElementById('pwa-lan-url-text'),
    copyUrlBtn: document.getElementById('pwa-copy-url-btn'),
    customUrlInput: document.getElementById('pwa-custom-url-input'),
    applyCustomUrlBtn: document.getElementById('pwa-apply-url-btn'),
    toggleCustomUrlBtn: document.getElementById('pwa-toggle-custom-url'),
    customUrlBox: document.getElementById('pwa-custom-url-box'),
    directInstallBtn: document.getElementById('pwa-direct-install-btn'),
    tabAndroid: document.getElementById('pwa-tab-android'),
    tabIos: document.getElementById('pwa-tab-ios'),
    guideAndroid: document.getElementById('pwa-guide-android'),
    guideIos: document.getElementById('pwa-guide-ios')
  };

  // 1. Service Worker Registration
  function initServiceWorker() {
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js')
          .then((reg) => {
            console.log('[PWA] ServiceWorker registered with scope:', reg.scope);
          })
          .catch((err) => {
            console.warn('[PWA] ServiceWorker registration failed:', err);
          });
      });
    }
  }

  // 2. Capture PWA Install Prompt
  function initInstallPrompt() {
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      deferredInstallPrompt = e;
      console.log('[PWA] beforeinstallprompt event captured');

      if (elements.directInstallBtn) {
        elements.directInstallBtn.style.display = 'flex';
      }
    });

    window.addEventListener('appinstalled', () => {
      deferredInstallPrompt = null;
      if (elements.directInstallBtn) {
        elements.directInstallBtn.style.display = 'none';
      }
      showToast('🎉 Gemini Studio 앱이 성공적으로 설치되었습니다!');
    });

    if (elements.directInstallBtn) {
      elements.directInstallBtn.addEventListener('click', async () => {
        if (!deferredInstallPrompt) {
          alert('현재 브라우저 환경에서는 직접 설치를 지원하지 않거나 이미 설치되어 있습니다. 스마트폰 카메라로 QR 코드를 스캔하여 접속해주세요.');
          return;
        }
        deferredInstallPrompt.prompt();
        const { outcome } = await deferredInstallPrompt.userChoice;
        console.log('[PWA] User response to install prompt:', outcome);
        deferredInstallPrompt = null;
        elements.directInstallBtn.style.display = 'none';
      });
    }
  }

  const KNOWN_LAN_IP = '192.168.14.221';

  // 3. Network Detection & QR Code Rendering
  async function loadNetworkInfo() {
    try {
      const res = await fetch('/api/network-info');
      const contentType = res.headers.get('content-type') || '';
      if (res.ok && contentType.includes('application/json')) {
        const data = await res.json();
        currentInstallUrl = data.lanUrl || `http://${KNOWN_LAN_IP}:${window.location.port || '3000'}`;
      } else {
        // If accessed locally, use LAN IP so smartphone on Wi-Fi can connect directly
        currentInstallUrl = `http://${KNOWN_LAN_IP}:${window.location.port || '3000'}`;
      }
    } catch (e) {
      currentInstallUrl = `http://${KNOWN_LAN_IP}:${window.location.port || '3000'}`;
    }

    // If user is currently browsing via a non-localhost host (custom domain, ngrok, or IP), use current origin
    if (window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
      currentInstallUrl = window.location.origin;
    }

    updateQrCodeDisplay(currentInstallUrl);
  }

  function updateQrCodeDisplay(url) {
    currentInstallUrl = url;
    if (elements.lanUrlText) {
      elements.lanUrlText.textContent = url;
    }
    if (elements.customUrlInput) {
      elements.customUrlInput.value = url;
    }

    if (elements.qrContainer && typeof QRCode !== 'undefined') {
      elements.qrContainer.innerHTML = '';
      qrCodeInstance = new QRCode(elements.qrContainer, {
        text: url,
        width: 180,
        height: 180,
        colorDark: "#030712",
        colorLight: "#ffffff",
        correctLevel: QRCode.CorrectLevel.M
      });
    }
  }

  // 4. Modal Open & Close Management
  function openPwaModal() {
    if (!elements.pwaModal) return;
    elements.pwaModal.style.display = 'flex';
    if (!qrCodeInstance || elements.qrContainer?.children.length === 0) {
      loadNetworkInfo();
    }
  }

  function closePwaModal() {
    if (elements.pwaModal) {
      elements.pwaModal.style.display = 'none';
    }
  }

  // 5. Guide Tab Switching
  function setGuideTab(os) {
    if (os === 'android') {
      elements.tabAndroid?.classList.add('active');
      elements.tabIos?.classList.remove('active');
      if (elements.guideAndroid) elements.guideAndroid.style.display = 'block';
      if (elements.guideIos) elements.guideIos.style.display = 'none';
    } else {
      elements.tabIos?.classList.add('active');
      elements.tabAndroid?.classList.remove('active');
      if (elements.guideAndroid) elements.guideAndroid.style.display = 'none';
      if (elements.guideIos) elements.guideIos.style.display = 'block';
    }
  }

  // 6. Event Listeners
  function bindPwaEvents() {
    if (elements.pwaQrBtn) elements.pwaQrBtn.onclick = openPwaModal;
    if (elements.sidebarPwaBtn) elements.sidebarPwaBtn.onclick = openPwaModal;
    if (elements.closePwaBtn) elements.closePwaBtn.onclick = closePwaModal;

    // Backdrop click defense (same as auth modal)
    let isBackdropDown = false;
    if (elements.pwaModal) {
      elements.pwaModal.addEventListener('mousedown', (e) => {
        isBackdropDown = (e.target === elements.pwaModal);
      });
      elements.pwaModal.addEventListener('click', (e) => {
        if (isBackdropDown && e.target === elements.pwaModal) {
          closePwaModal();
        }
        isBackdropDown = false;
      });

      const dialog = elements.pwaModal.querySelector('.modal-dialog');
      if (dialog) {
        dialog.addEventListener('click', (e) => e.stopPropagation());
        dialog.addEventListener('mousedown', (e) => e.stopPropagation());
      }
    }

    // Copy URL
    if (elements.copyUrlBtn) {
      elements.copyUrlBtn.onclick = async () => {
        try {
          await navigator.clipboard.writeText(currentInstallUrl);
          showToast('📋 설치 URL이 복사되었습니다: ' + currentInstallUrl);
        } catch (err) {
          const temp = document.createElement('input');
          temp.value = currentInstallUrl;
          document.body.appendChild(temp);
          temp.select();
          document.execCommand('copy');
          temp.remove();
          showToast('📋 설치 URL이 복사되었습니다: ' + currentInstallUrl);
        }
      };
    }

    // Toggle Custom URL box
    if (elements.toggleCustomUrlBtn && elements.customUrlBox) {
      elements.toggleCustomUrlBtn.onclick = () => {
        const isHidden = elements.customUrlBox.style.display === 'none';
        elements.customUrlBox.style.display = isHidden ? 'block' : 'none';
      };
    }

    // Apply Custom URL
    if (elements.applyCustomUrlBtn && elements.customUrlInput) {
      elements.applyCustomUrlBtn.onclick = () => {
        const customUrl = elements.customUrlInput.value.trim();
        if (customUrl) {
          updateQrCodeDisplay(customUrl);
          showToast('QR 코드가 새 주소로 갱신되었습니다!');
        }
      };
    }

    // Tabs
    if (elements.tabAndroid) elements.tabAndroid.onclick = () => setGuideTab('android');
    if (elements.tabIos) elements.tabIos.onclick = () => setGuideTab('ios');
  }

  function showToast(message) {
    const container = document.getElementById('toast-container');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;
    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(10px)';
      toast.style.transition = 'all 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 2800);
  }

  // Initialization
  document.addEventListener('DOMContentLoaded', () => {
    initServiceWorker();
    initInstallPrompt();
    bindPwaEvents();
    loadNetworkInfo();
  });

  window.openPwaModal = openPwaModal;
})();
