/**
 * Firebase Authentication Module for Gemini 3.8 Flash Studio
 * Connected Project: iceu-songpa11 (Account: songpa11@iceu.kr)
 * Handles Sign-Up, Sign-In, Sign-Out, Password Reset, and UI Sync.
 */

(function () {
  'use strict';

  let authState = {
    user: null,
    isConfigured: false,
    config: null,
    activeTab: 'login' // 'login' | 'signup'
  };

  const elements = {
    authModal: document.getElementById('auth-modal'),
    closeAuthBtn: document.getElementById('close-auth-btn'),
    userAuthBtn: document.getElementById('user-auth-btn'),
    sidebarAuthBtn: document.getElementById('sidebar-auth-btn'),
    navUserAvatar: document.getElementById('nav-user-avatar'),
    navUserText: document.getElementById('nav-user-text'),
    sidebarUserAvatar: document.getElementById('sidebar-user-avatar'),
    sidebarUserName: document.getElementById('sidebar-user-name'),
    sidebarUserEmail: document.getElementById('sidebar-user-email'),
    tabLogin: document.getElementById('tab-login'),
    tabSignup: document.getElementById('tab-signup'),
    groupName: document.getElementById('group-name'),
    groupPasswordConfirm: document.getElementById('group-password-confirm'),
    authForm: document.getElementById('auth-form'),
    authName: document.getElementById('auth-name'),
    authEmail: document.getElementById('auth-email'),
    authPassword: document.getElementById('auth-password'),
    authPasswordConfirm: document.getElementById('auth-password-confirm'),
    authSubmitBtn: document.getElementById('auth-submit-btn'),
    authErrorMsg: document.getElementById('auth-error-msg'),
    authLoggedOutView: document.getElementById('auth-logged-out-view'),
    authLoggedInView: document.getElementById('auth-logged-in-view'),
    authLogoutBtn: document.getElementById('auth-logout-btn'),
    loggedAvatar: document.getElementById('logged-avatar'),
    loggedName: document.getElementById('logged-name'),
    loggedEmail: document.getElementById('logged-email'),
    loggedUid: document.getElementById('logged-uid'),
    configStatusDot: document.getElementById('config-status-dot'),
    configStatusText: document.getElementById('config-status-text'),
    toggleConfigSetup: document.getElementById('toggle-config-setup'),
    configSetupForm: document.getElementById('config-setup-form'),
    firebaseApiKeyInput: document.getElementById('firebase-api-key-input'),
    firebaseAppIdInput: document.getElementById('firebase-app-id-input'),
    saveFirebaseConfigBtn: document.getElementById('save-firebase-config-btn')
  };

  // ==========================================
  // Initialization
  // ==========================================
  async function initAuth() {
    bindAuthEvents();
    await fetchAndInitFirebase();
  }

  async function fetchAndInitFirebase() {
    try {
      const res = await fetch('/api/auth/config');
      if (res.ok) {
        authState.config = await res.json();
        setupFirebaseClient(authState.config);
      }
    } catch (e) {
      console.warn('Failed to fetch auth config:', e);
    }
  }

  function setupFirebaseClient(config) {
    if (!config) return;

    if (config.projectId) {
      const projEl = document.getElementById('pill-project-name');
      if (projEl) projEl.textContent = config.projectId;
    }
    if (config.account) {
      const accEl = document.getElementById('pill-account-text');
      if (accEl) accEl.textContent = `(${config.account})`;
    }

    if (config.isConfigured && config.apiKey && typeof firebase !== 'undefined') {
      try {
        if (!firebase.apps.length) {
          firebase.initializeApp({
            apiKey: config.apiKey,
            authDomain: config.authDomain || `${config.projectId}.firebaseapp.com`,
            projectId: config.projectId,
            appId: config.appId || undefined
          });
        }

        authState.isConfigured = true;
        updateConfigStatus(true, 'Firebase 연결됨 (iceu-songpa11)');

        // Listen for real Firebase Auth state changes
        firebase.auth().onAuthStateChanged((user) => {
          handleUserChange(user);
        });

        return;
      } catch (err) {
        console.error('Firebase initialize error:', err);
        updateConfigStatus(false, 'Firebase 키 오류: ' + err.message);
      }
    }

    // Unconfigured state guidance
    authState.isConfigured = false;
    updateConfigStatus(false, 'GCP 프로젝트 iceu-songpa11 연동 키 등록 필요');

    // Check if user was previously logged into local session
    const savedLocalUser = localStorage.getItem('gemini_local_auth_user');
    if (savedLocalUser) {
      try {
        handleUserChange(JSON.parse(savedLocalUser));
      } catch (e) {
        handleUserChange(null);
      }
    } else {
      handleUserChange(null);
    }
  }

  function updateConfigStatus(isOnline, text) {
    if (elements.configStatusDot) {
      elements.configStatusDot.className = 'config-status-dot ' + (isOnline ? 'online' : 'offline');
    }
    if (elements.configStatusText) {
      elements.configStatusText.textContent = text;
    }
  }

  // ==========================================
  // Firestore Synchronization (Dedicated schema: 'chatbot_users')
  // ==========================================
  const CHATBOT_USERS_COLLECTION = 'chatbot_users';

  async function syncUserToFirestore(user, extraData = {}) {
    if (!user || typeof firebase === 'undefined' || !firebase.firestore) return;
    try {
      const db = firebase.firestore();
      const userDocRef = db.collection(CHATBOT_USERS_COLLECTION).doc(user.uid);
      const dataToSave = {
        uid: user.uid,
        email: user.email || '',
        displayName: extraData.displayName || user.displayName || user.email?.split('@')[0] || '챗봇 사용자',
        app: 'Gemini 3.8 Flash Studio',
        role: 'member',
        provider: 'password',
        preferences: {
          model: 'gemini-3.8-flash',
          theme: document.documentElement.getAttribute('data-theme') || 'dark',
          temperature: 0.7,
          persona: 'default'
        },
        stats: {
          service: 'chatbot',
          lastActiveAt: firebase.firestore.FieldValue.serverTimestamp()
        },
        lastLoginAt: firebase.firestore.FieldValue.serverTimestamp(),
        ...extraData
      };
      if (extraData.isNew) {
        dataToSave.createdAt = firebase.firestore.FieldValue.serverTimestamp();
        delete dataToSave.isNew;
      }
      await userDocRef.set(dataToSave, { merge: true });
      console.log('User synced to Firestore chatbot_users collection successfully:', user.uid);
    } catch (err) {
      console.warn('Firestore user sync warning:', err);
    }
  }

  window.saveChatSessionToFirestore = async function (session) {
    if (!authState.user || typeof firebase === 'undefined' || !firebase.firestore) return;
    try {
      const db = firebase.firestore();
      const chatDocRef = db.collection(CHATBOT_USERS_COLLECTION).doc(authState.user.uid).collection('chats').doc(session.id);
      await chatDocRef.set({
        id: session.id,
        title: session.title || '새로운 대화',
        model: 'gemini-3.8-flash',
        app: 'Gemini 3.8 Flash Studio',
        createdAt: session.createdAt || new Date().toISOString(),
        updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
        messageCount: (session.messages || []).length,
        messages: (session.messages || []).map(m => ({
          id: m.id,
          role: m.role,
          content: m.content || '',
          timestamp: m.timestamp || new Date().toISOString(),
          latencyMs: m.latencyMs || 0
        }))
      }, { merge: true });
      console.log('Chat session saved to Firestore chatbot_users chats:', session.id);
    } catch (err) {
      console.warn('Firestore chat sync error:', err);
    }
  };

  window.deleteChatSessionFromFirestore = async function (sessionId) {
    if (!authState.user || typeof firebase === 'undefined' || !firebase.firestore) return;
    try {
      const db = firebase.firestore();
      await db.collection(CHATBOT_USERS_COLLECTION).doc(authState.user.uid).collection('chats').doc(sessionId).delete();
    } catch (err) {
      console.warn('Firestore chat delete error:', err);
    }
  };

  window.loadUserChatsFromFirestore = async function () {
    if (!authState.user || typeof firebase === 'undefined' || !firebase.firestore) return [];
    try {
      const db = firebase.firestore();
      const snapshot = await db.collection(CHATBOT_USERS_COLLECTION).doc(authState.user.uid).collection('chats').get();
      const chats = [];
      snapshot.forEach(doc => {
        chats.push(doc.data());
      });
      return chats;
    } catch (err) {
      console.warn('Firestore chats load warning:', err);
      return [];
    }
  };

  window.getFirebaseCurrentUser = function () {
    return authState.user;
  };

  // ==========================================
  // Auth Actions (Sign-up, Sign-in, Sign-out)
  // ==========================================
  async function handleFormSubmit() {
    clearError();
    const email = elements.authEmail.value.trim();
    const password = elements.authPassword.value.trim();
    const name = elements.authName.value.trim();
    const passwordConfirm = elements.authPasswordConfirm.value.trim();

    if (!email || !password) {
      showError('이메일과 비밀번호를 모두 입력해주세요.');
      return;
    }

    elements.authSubmitBtn.disabled = true;
    elements.authSubmitBtn.textContent = '처리 중...';

    try {
      if (authState.activeTab === 'signup') {
        // Validation
        if (password.length < 6) {
          throw new Error('비밀번호는 최소 6자 이상이어야 합니다.');
        }
        if (password !== passwordConfirm) {
          throw new Error('비밀번호 확인이 일치하지 않습니다.');
        }

        if (authState.isConfigured && typeof firebase !== 'undefined') {
          // Real Firebase Sign Up
          const userCredential = await firebase.auth().createUserWithEmailAndPassword(email, password);
          if (name && userCredential.user.updateProfile) {
            await userCredential.user.updateProfile({ displayName: name });
          }
          // Sync to Firestore 'users' collection
          await syncUserToFirestore(userCredential.user, {
            displayName: name || email.split('@')[0],
            isNew: true
          });

          showToast('회원가입 완료! Firestore에 사용자 정보가 저장되었습니다.');
          closeAuthModal();
        } else {
          // Local Demo User
          const mockUser = {
            uid: 'local_' + Date.now(),
            email,
            displayName: name || email.split('@')[0],
            isLocal: true
          };
          localStorage.setItem('gemini_local_auth_user', JSON.stringify(mockUser));
          handleUserChange(mockUser);
          showToast('회원가입이 완료되었습니다! (프로젝트: iceu-songpa11)');
          closeAuthModal();
        }
      } else {
        // Sign In
        if (authState.isConfigured && typeof firebase !== 'undefined') {
          const userCredential = await firebase.auth().signInWithEmailAndPassword(email, password);
          // Update lastLoginAt in Firestore
          await syncUserToFirestore(userCredential.user);
          showToast('성공적으로 로그인되었습니다.');
          closeAuthModal();
        } else {
          // Local Demo Sign In
          const mockUser = {
            uid: 'local_usr_' + btoa(email).slice(0, 8),
            email,
            displayName: email.split('@')[0],
            isLocal: true
          };
          localStorage.setItem('gemini_local_auth_user', JSON.stringify(mockUser));
          handleUserChange(mockUser);
          showToast('로그인되었습니다! (계정: ' + email + ')');
          closeAuthModal();
        }
      }

    } catch (err) {
      console.error('Auth action error:', err);
      let msg = '로그인에 실패했습니다. 다시 시도해주세요.';
      if (err.code === 'auth/email-already-in-use') {
        msg = '이미 등록된 이메일 주소입니다. 로그인해주세요.';
      } else if (err.code === 'auth/invalid-email') {
        msg = '올바른 형식의 이메일 주소를 입력해주세요.';
      } else if (err.code === 'auth/wrong-password' || err.code === 'auth/user-not-found' || err.code === 'auth/invalid-credential') {
        msg = '이메일 또는 비밀번호가 일치하지 않습니다.';
      } else if (err.code === 'auth/weak-password') {
        msg = '비밀번호 보안이 취약합니다. 6자 이상 입력해주세요.';
      } else if (err.code === 'auth/operation-not-allowed') {
        msg = 'Firebase 콘솔에서 이메일/비밀번호 로그인이 활성화되지 않았습니다.';
      } else if (err.message) {
        msg = err.message;
      }
      showError(msg);
    } finally {
      elements.authSubmitBtn.disabled = false;
      elements.authSubmitBtn.textContent = authState.activeTab === 'signup' ? '회원가입' : '로그인';
    }
  }

  async function handleLogout() {
    try {
      if (authState.isConfigured && typeof firebase !== 'undefined') {
        await firebase.auth().signOut();
      }
      localStorage.removeItem('gemini_local_auth_user');
      handleUserChange(null);
      showToast('로그아웃되었습니다.');
      closeAuthModal();
    } catch (err) {
      console.error('Logout error:', err);
      showToast('로그아웃 처리 중 오류가 발생했습니다.');
    }
  }

  // ==========================================
  // UI Sync & State Management
  // ==========================================
  function handleUserChange(user) {
    authState.user = user;

    if (user) {
      // Logged in UI updates
      const displayName = user.displayName || user.email?.split('@')[0] || '사용자';
      const initial = displayName.charAt(0).toUpperCase();

      if (elements.navUserAvatar) {
        elements.navUserAvatar.style.display = 'inline-block';
        elements.navUserAvatar.textContent = initial;
      }
      if (elements.navUserText) {
        elements.navUserText.textContent = displayName;
      }
      const loggedOutIcon = document.querySelector('.auth-icon-logged-out');
      if (loggedOutIcon) loggedOutIcon.style.display = 'none';

      if (elements.sidebarUserAvatar) elements.sidebarUserAvatar.textContent = initial;
      if (elements.sidebarUserName) elements.sidebarUserName.textContent = displayName;
      if (elements.sidebarUserEmail) elements.sidebarUserEmail.textContent = user.email || '계정 정보';
      if (elements.sidebarAuthBtn) elements.sidebarAuthBtn.textContent = '프로필';

      // Inside Modal
      elements.authLoggedOutView.style.display = 'none';
      elements.authLoggedInView.style.display = 'block';
      if (elements.loggedAvatar) elements.loggedAvatar.textContent = initial;
      if (elements.loggedName) elements.loggedName.textContent = displayName;
      if (elements.loggedEmail) elements.loggedEmail.textContent = user.email;
      if (elements.loggedUid) elements.loggedUid.textContent = user.uid;

    } else {
      // Logged out UI updates
      if (elements.navUserAvatar) elements.navUserAvatar.style.display = 'none';
      if (elements.navUserText) elements.navUserText.textContent = '로그인';
      const loggedOutIcon = document.querySelector('.auth-icon-logged-out');
      if (loggedOutIcon) loggedOutIcon.style.display = 'inline-block';

      if (elements.sidebarUserAvatar) elements.sidebarUserAvatar.textContent = '👤';
      if (elements.sidebarUserName) elements.sidebarUserName.textContent = '게스트 사용자';
      if (elements.sidebarUserEmail) elements.sidebarUserEmail.textContent = '로그인이 필요합니다';
      if (elements.sidebarAuthBtn) elements.sidebarAuthBtn.textContent = '로그인';

      // Inside Modal
      elements.authLoggedOutView.style.display = 'block';
      elements.authLoggedInView.style.display = 'none';
    }

    // Notify other components (app.js) of auth state change
    try {
      window.dispatchEvent(new CustomEvent('gemini-auth-changed', { detail: { user } }));
    } catch (e) {}
  }

  function setTab(tab) {
    authState.activeTab = tab;
    clearError();

    if (tab === 'signup') {
      elements.tabSignup.classList.add('active');
      elements.tabLogin.classList.remove('active');
      elements.groupName.style.display = 'block';
      elements.groupPasswordConfirm.style.display = 'block';
      elements.authSubmitBtn.textContent = '회원가입';
    } else {
      elements.tabLogin.classList.add('active');
      elements.tabSignup.classList.remove('active');
      elements.groupName.style.display = 'none';
      elements.groupPasswordConfirm.style.display = 'none';
      elements.authSubmitBtn.textContent = '로그인';
    }
  }

  function showError(msg) {
    if (elements.authErrorMsg) {
      elements.authErrorMsg.textContent = msg;
      elements.authErrorMsg.style.display = 'block';
    }

    // Visual feedback: Shake modal dialog to clearly signal incorrect credentials
    const dialog = elements.authModal.querySelector('.modal-dialog');
    if (dialog) {
      dialog.classList.remove('modal-shake');
      void dialog.offsetWidth; // Force reflow to restart CSS animation
      dialog.classList.add('modal-shake');
      setTimeout(() => dialog.classList.remove('modal-shake'), 450);
    }

    // Auto-focus and highlight password field for quick re-entry
    if (elements.authPassword) {
      elements.authPassword.focus();
      elements.authPassword.select();
    }
  }

  function clearError() {
    if (elements.authErrorMsg) {
      elements.authErrorMsg.textContent = '';
      elements.authErrorMsg.style.display = 'none';
    }
  }

  function openAuthModal() {
    clearError();
    elements.authModal.style.display = 'flex';
  }

  function closeAuthModal() {
    elements.authModal.style.display = 'none';
  }

  // Save Firebase Web API key directly to server .env
  async function saveFirebaseConfig() {
    const apiKey = elements.firebaseApiKeyInput.value.trim();
    const appId = elements.firebaseAppIdInput.value.trim();

    if (!apiKey) {
      alert('Firebase Web API Key를 입력해주세요.');
      return;
    }

    try {
      elements.saveFirebaseConfigBtn.disabled = true;
      elements.saveFirebaseConfigBtn.textContent = '저장 중...';

      const res = await fetch('/api/auth/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey, appId })
      });

      const data = await res.json();
      if (data.success) {
        showToast('Firebase 설정이 .env에 저장되었습니다!');
        elements.configSetupForm.style.display = 'none';
        await fetchAndInitFirebase();
      } else {
        alert('설정 저장 실패: ' + (data.error || '알 수 없는 오류'));
      }
    } catch (err) {
      alert('서버 통신 오류: ' + err.message);
    } finally {
      elements.saveFirebaseConfigBtn.disabled = false;
      elements.saveFirebaseConfigBtn.textContent = 'Firebase 설정 .env에 저장';
    }
  }

  // ==========================================
  // Event Bindings
  // ==========================================
  function bindAuthEvents() {
    elements.userAuthBtn.onclick = openAuthModal;
    elements.sidebarAuthBtn.onclick = openAuthModal;
    elements.closeAuthBtn.onclick = closeAuthModal;

    // Bulletproof Backdrop Protection:
    // Only close if BOTH mousedown and click originated directly on the dark backdrop overlay.
    // Prevents accidental closing when mouse dragging, selecting text, or when DOM shifts on error.
    let isBackdropMouseDown = false;
    elements.authModal.addEventListener('mousedown', (e) => {
      isBackdropMouseDown = (e.target === elements.authModal);
    });
    elements.authModal.addEventListener('click', (e) => {
      if (isBackdropMouseDown && e.target === elements.authModal) {
        closeAuthModal();
      }
      isBackdropMouseDown = false;
    });

    // Never bubble clicks or mousedown events from inside modal card to overlay
    const modalDialog = elements.authModal.querySelector('.modal-dialog');
    if (modalDialog) {
      modalDialog.addEventListener('click', (e) => {
        e.stopPropagation();
      });
      modalDialog.addEventListener('mousedown', (e) => {
        e.stopPropagation();
      });
    }

    elements.tabLogin.onclick = () => setTab('login');
    elements.tabSignup.onclick = () => setTab('signup');

    // Button click & Form submission handling
    elements.authSubmitBtn.onclick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      handleFormSubmit();
    };

    elements.authForm.onsubmit = (e) => {
      e.preventDefault();
      e.stopPropagation();
      handleFormSubmit();
      return false;
    };

    // Keyboard support: Enter key submission on all auth inputs
    [elements.authEmail, elements.authPassword, elements.authName, elements.authPasswordConfirm].forEach(input => {
      if (input) {
        input.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            e.stopPropagation();
            handleFormSubmit();
          }
        });
      }
    });

    elements.authLogoutBtn.onclick = handleLogout;

    // Toggle configuration box
    if (elements.toggleConfigSetup) {
      elements.toggleConfigSetup.onclick = () => {
        const isHidden = elements.configSetupForm.style.display === 'none';
        elements.configSetupForm.style.display = isHidden ? 'block' : 'none';
      };
    }

    if (elements.saveFirebaseConfigBtn) {
      elements.saveFirebaseConfigBtn.onclick = saveFirebaseConfig;
    }
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

  // Run on DOM ready
  document.addEventListener('DOMContentLoaded', initAuth);

})();
