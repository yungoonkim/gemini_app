/**
 * Gemini 3.8 Flash Studio - Frontend Application Engine
 * Real-time SSE streaming, multimodal image analysis, speech synthesis & recognition,
 * local chat session management, and rich markdown rendering.
 */

(function () {
  'use strict';

  // ==========================================
  // App State & Storage Keys
  // ==========================================
  const STORAGE_SESSIONS = 'gemini_sessions_v2';
  const STORAGE_SETTINGS = 'gemini_settings_v2';

  const defaultSettings = {
    apiKey: '',
    model: 'gemini-3.8-flash',
    temperature: 0.7,
    systemPersona: 'default',
    customSystemPrompt: '',
    theme: 'dark',
    webSearch: true
  };

  const personaPresets = {
    default: '당신은 친절하고 명쾌하며 깊이 있는 지식을 갖춘 Google Gemini 3.8 Flash 인공지능 어시스턴트입니다. 사용자의 질문에 정확하고 가독성 좋은 한국어로 답변하세요.',
    coding: '당신은 세계 최고 수준의 시니어 풀스택 소프트웨어 엔지니어입니다. 클린 코드, 아키텍처 모범 사례, 성능 최적화, 최신 기술 스택을 바탕으로 명확한 코드와 기술적 설명을 제공하세요.',
    writer: '당신은 매력적이고 논리적인 테크니컬 라이터 및 카피라이터입니다. 독자의 흥미를 끌고 핵심 메시지를 명확히 전달하는 유려한 문장으로 작성하세요.',
    translator: '당신은 전문 통번역가 및 언어 교정가입니다. 단순 직역을 넘어 한국어와 원어의 문화적 맥락과 뉘앙스를 자연스럽고 세련되게 살려 번역 및 교정하세요.'
  };

  let state = {
    sessions: [],
    currentSessionId: null,
    settings: { ...defaultSettings },
    attachedImages: [],
    isStreaming: false,
    currentSpeechUtterance: null,
    speechRecognition: null,
    isRecordingVoice: false,
    abortController: null
  };

  // ==========================================
  // DOM Elements
  // ==========================================
  const elements = {
    appContainer: document.getElementById('app-container'),
    sidebar: document.getElementById('sidebar'),
    sidebarOverlay: document.getElementById('sidebar-overlay'),
    menuBtn: document.getElementById('menu-btn'),
    closeSidebarBtn: document.getElementById('close-sidebar-btn'),
    newChatBtn: document.getElementById('new-chat-btn'),
    chatList: document.getElementById('chat-list'),
    clearChatBtn: document.getElementById('clear-chat-btn'),
    themeToggleBtn: document.getElementById('theme-toggle-btn'),
    settingsBtn: document.getElementById('settings-btn'),
    settingsModal: document.getElementById('settings-modal'),
    closeSettingsBtn: document.getElementById('close-settings-btn'),
    saveSettingsBtn: document.getElementById('save-settings-btn'),
    resetSettingsBtn: document.getElementById('reset-settings-btn'),
    apiKeyStatusHint: document.getElementById('api-key-status-hint'),
    modelSelect: document.getElementById('model-select'),
    tempSlider: document.getElementById('temp-slider'),
    tempVal: document.getElementById('temp-val'),
    systemPersonaSelect: document.getElementById('system-persona-select'),
    customSystemPrompt: document.getElementById('custom-system-prompt'),
    messagesContainer: document.getElementById('messages-container'),
    welcomeHero: document.getElementById('welcome-hero'),
    messageStream: document.getElementById('message-stream'),
    chatForm: document.getElementById('chat-form'),
    promptInput: document.getElementById('prompt-input'),
    sendBtn: document.getElementById('send-btn'),
    attachBtn: document.getElementById('attach-btn'),
    fileInput: document.getElementById('file-input'),
    voiceBtn: document.getElementById('voice-btn'),
    webSearchBtn: document.getElementById('web-search-btn'),
    webSearchLabel: document.getElementById('web-search-label'),
    settingWebSearch: document.getElementById('setting-web-search'),
    attachmentPreviewBar: document.getElementById('attachment-preview-bar'),
    previewScroll: document.getElementById('preview-scroll'),
    charCount: document.getElementById('char-count'),
    toastContainer: document.getElementById('toast-container'),
    suggestionsGrid: document.getElementById('suggestions-grid'),
    inputSection: document.getElementById('input-section'),
    chatLockedOverlay: document.getElementById('chat-locked-overlay'),
    lockedLoginBtn: document.getElementById('locked-login-btn'),
    welcomeLoginNotice: document.getElementById('welcome-login-notice'),
    heroLoginBtn: document.getElementById('hero-login-btn'),
    userAuthBtn: document.getElementById('user-auth-btn')
  };

  // ==========================================
  // Markdown & Syntax Highlighting Config
  // ==========================================
  function setupMarkdownRenderer() {
    if (typeof marked !== 'undefined') {
      const renderer = new marked.Renderer();

      // Custom code block renderer with copy button & language header
      renderer.code = function ({ text, lang }) {
        const language = (lang || 'plaintext').toLowerCase();
        let highlighted = text;
        if (typeof hljs !== 'undefined') {
          try {
            if (hljs.getLanguage(language)) {
              highlighted = hljs.highlight(text, { language }).value;
            } else {
              highlighted = hljs.highlightAuto(text).value;
            }
          } catch (e) {
            highlighted = escapeHtml(text);
          }
        } else {
          highlighted = escapeHtml(text);
        }

        const rawCodeEscaped = encodeURIComponent(text);

        return `
          <div class="code-block-wrapper">
            <div class="code-block-header">
              <span class="code-lang-tag">${language}</span>
              <button class="copy-code-btn" data-code="${rawCodeEscaped}" onclick="window.copyCodeSnippet(this)">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                <span>복사</span>
              </button>
            </div>
            <pre><code class="hljs language-${language}">${highlighted}</code></pre>
          </div>
        `;
      };

      marked.setOptions({
        renderer,
        breaks: true,
        gfm: true
      });
    }
  }

  // Global helper for code snippet copy
  window.copyCodeSnippet = function (btnElement) {
    const rawCode = decodeURIComponent(btnElement.getAttribute('data-code') || '');
    navigator.clipboard.writeText(rawCode).then(() => {
      btnElement.classList.add('copied');
      const span = btnElement.querySelector('span');
      if (span) span.textContent = '완료!';
      showToast('코드가 클립보드에 복사되었습니다.');
      setTimeout(() => {
        btnElement.classList.remove('copied');
        if (span) span.textContent = '복사';
      }, 2000);
    });
  };

  // Helper for message text copy
  window.copyMessageText = function (btnElement) {
    const row = btnElement.closest('.message-row');
    if (!row) return;
    const text = row.getAttribute('data-raw-content') || '';
    navigator.clipboard.writeText(text).then(() => {
      showToast('대화 내용이 복사되었습니다.');
    });
  };

  // Helper for Text-to-Speech
  window.speakMessageText = function (btnElement) {
    if (!('speechSynthesis' in window)) {
      showToast('이 브라우저는 음성 읽기(TTS)를 지원하지 않습니다.');
      return;
    }

    if (window.speechSynthesis.speaking) {
      window.speechSynthesis.cancel();
      document.querySelectorAll('.action-chip-btn.speaking').forEach(el => el.classList.remove('speaking'));
      if (btnElement.getAttribute('data-is-speaking') === 'true') {
        btnElement.removeAttribute('data-is-speaking');
        return;
      }
    }

    const row = btnElement.closest('.message-row');
    if (!row) return;
    const text = row.getAttribute('data-raw-content') || '';
    if (!text.trim()) return;

    // Clean markdown symbols for cleaner speech
    const cleanText = text
      .replace(/```[\s\S]*?```/g, '코드 블록 생략.')
      .replace(/`([^`]+)`/g, '$1')
      .replace(/[*#_~]/g, '');

    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.lang = 'ko-KR';
    utterance.rate = 1.05;

    btnElement.classList.add('speaking');
    btnElement.setAttribute('data-is-speaking', 'true');

    utterance.onend = () => {
      btnElement.classList.remove('speaking');
      btnElement.removeAttribute('data-is-speaking');
    };
    utterance.onerror = () => {
      btnElement.classList.remove('speaking');
      btnElement.removeAttribute('data-is-speaking');
    };

    window.speechSynthesis.speak(utterance);
  };

  // ==========================================
  // Auth State & Chat Feature Locking
  // ==========================================
  function updateChatAuthState(user) {
    const isLoggedIn = !!user;

    if (isLoggedIn) {
      // Unlocked State (Logged in)
      if (elements.inputSection) elements.inputSection.classList.remove('chat-locked');
      if (elements.chatLockedOverlay) elements.chatLockedOverlay.classList.remove('active');
      if (elements.welcomeLoginNotice) elements.welcomeLoginNotice.style.display = 'none';

      if (elements.promptInput) {
        elements.promptInput.disabled = false;
        elements.promptInput.placeholder = 'Gemini 3.8 Flash에게 질문하거나 지시하세요... (Shift+Enter: 줄바꿈, Enter: 전송)';
      }
      if (elements.sendBtn) elements.sendBtn.disabled = false;
      if (elements.attachBtn) elements.attachBtn.disabled = false;
      if (elements.voiceBtn) elements.voiceBtn.disabled = false;

    } else {
      // Locked State (Guest / Logged out)
      if (elements.inputSection) elements.inputSection.classList.add('chat-locked');
      if (elements.chatLockedOverlay) elements.chatLockedOverlay.classList.add('active');
      if (elements.welcomeLoginNotice) elements.welcomeLoginNotice.style.display = 'flex';

      if (elements.promptInput) {
        elements.promptInput.disabled = true;
        elements.promptInput.placeholder = '🔒 대화를 시작하려면 로그인이 필요합니다 (클릭하여 로그인)';
      }
      if (elements.sendBtn) elements.sendBtn.disabled = true;
      if (elements.attachBtn) elements.attachBtn.disabled = true;
      if (elements.voiceBtn) elements.voiceBtn.disabled = true;
    }
  }

  function promptLogin(msg = '대화를 시작하려면 먼저 로그인이 필요합니다.') {
    showToast(msg);
    if (elements.userAuthBtn) {
      elements.userAuthBtn.click();
    }
  }

  // ==========================================
  // Initialization
  // ==========================================
  async function init() {
    loadSettings();
    applyTheme(state.settings.theme);
    setupMarkdownRenderer();
    setupSpeechRecognition();
    bindEvents();

    // Default chat to locked until Firebase confirms user
    updateChatAuthState(typeof window.getFirebaseCurrentUser === 'function' ? window.getFirebaseCurrentUser() : null);

    loadSessions();
    if (state.sessions.length === 0) {
      createNewSession();
    } else {
      switchSession(state.sessions[0].id);
    }

    // Check system status from backend
    await checkSystemStatus();
  }

  async function checkSystemStatus() {
    try {
      const res = await fetch('/api/status');
      if (res.ok) {
        const data = await res.json();
        if (data.hasEnvKey) {
          elements.apiKeyStatusHint.innerHTML = '✓ 시스템 환경 변수(<code>GEMINI_API_KEY</code>)가 연결되어 즉시 사용 가능합니다.';
        } else {
          elements.apiKeyStatusHint.innerHTML = '⚠️ 서버 환경 변수에 <code>GEMINI_API_KEY</code>가 설정되어 있지 않습니다.';
        }
      }
    } catch (e) {
      console.warn('Backend status check failed:', e);
    }
  }

  // ==========================================
  // Settings Logic
  // ==========================================
  function updateWebSearchBtnUI(enabled) {
    if (!elements.webSearchBtn) return;
    if (enabled) {
      elements.webSearchBtn.classList.add('active');
      if (elements.webSearchLabel) elements.webSearchLabel.textContent = '검색 ON';
      elements.webSearchBtn.title = '구글 실시간 웹 검색 켜짐 (클릭하여 끄기)';
    } else {
      elements.webSearchBtn.classList.remove('active');
      if (elements.webSearchLabel) elements.webSearchLabel.textContent = '검색 OFF';
      elements.webSearchBtn.title = '구글 실시간 웹 검색 꺼짐 (클릭하여 켜기)';
    }
    if (elements.settingWebSearch) {
      elements.settingWebSearch.checked = !!enabled;
    }
  }

  function loadSettings() {
    try {
      const saved = localStorage.getItem(STORAGE_SETTINGS);
      if (saved) {
        state.settings = { ...defaultSettings, ...JSON.parse(saved) };
      }
    } catch (e) {
      state.settings = { ...defaultSettings };
    }
    if (state.settings.webSearch === undefined) {
      state.settings.webSearch = true;
    }
    updateWebSearchBtnUI(state.settings.webSearch !== false);
    syncSettingsToModal();
  }

  function saveSettings() {
    state.settings.model = elements.modelSelect.value;
    state.settings.temperature = parseFloat(elements.tempSlider.value);
    state.settings.systemPersona = elements.systemPersonaSelect.value;
    state.settings.customSystemPrompt = elements.customSystemPrompt.value.trim();
    if (elements.settingWebSearch) {
      state.settings.webSearch = elements.settingWebSearch.checked;
      updateWebSearchBtnUI(state.settings.webSearch);
    }

    localStorage.setItem(STORAGE_SETTINGS, JSON.stringify(state.settings));
    closeSettingsModal();
    showToast('설정이 성공적으로 저장되었습니다.');
  }

  function syncSettingsToModal() {
    elements.modelSelect.value = state.settings.model || 'gemini-3.8-flash';
    elements.tempSlider.value = state.settings.temperature ?? 0.7;
    elements.tempVal.textContent = state.settings.temperature ?? 0.7;
    elements.systemPersonaSelect.value = state.settings.systemPersona || 'default';
    elements.customSystemPrompt.value = state.settings.customSystemPrompt || '';
    if (elements.settingWebSearch) {
      elements.settingWebSearch.checked = state.settings.webSearch !== false;
    }

    if (state.settings.systemPersona === 'custom') {
      elements.customSystemPrompt.style.display = 'block';
    } else {
      elements.customSystemPrompt.style.display = 'none';
    }
  }

  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    state.settings.theme = theme;
    localStorage.setItem(STORAGE_SETTINGS, JSON.stringify(state.settings));
  }

  function toggleTheme() {
    const nextTheme = state.settings.theme === 'dark' ? 'light' : 'dark';
    applyTheme(nextTheme);
    showToast(`${nextTheme === 'dark' ? '다크' : '라이트'} 모드로 전환되었습니다.`);
  }

  // ==========================================
  // Session / Chat Management
  // ==========================================
  function loadSessions() {
    try {
      const saved = localStorage.getItem(STORAGE_SESSIONS);
      if (saved) {
        state.sessions = JSON.parse(saved);
      }
    } catch (e) {
      state.sessions = [];
    }
  }

  function saveSessions(sessionToSync) {
    try {
      localStorage.setItem(STORAGE_SESSIONS, JSON.stringify(state.sessions));
    } catch (e) {
      console.error('Failed to save sessions:', e);
    }

    // Sync to Firestore if authenticated
    try {
      if (sessionToSync && typeof window.saveChatSessionToFirestore === 'function') {
        window.saveChatSessionToFirestore(sessionToSync);
      } else if (state.currentSessionId && typeof window.saveChatSessionToFirestore === 'function') {
        const current = getCurrentSession();
        if (current && current.messages.length > 0) {
          window.saveChatSessionToFirestore(current);
        }
      }
    } catch (fsErr) {
      console.warn('Firestore session sync notice:', fsErr);
    }
  }

  function createNewSession() {
    if (state.isStreaming) stopStreaming();

    const newSession = {
      id: 'chat_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
      title: '새로운 대화',
      createdAt: new Date().toISOString(),
      messages: []
    };

    state.sessions.unshift(newSession);
    saveSessions();
    renderChatList();
    switchSession(newSession.id);

    // Close mobile sidebar if open
    closeSidebar();
  }

  function switchSession(sessionId) {
    if (state.isStreaming) stopStreaming();

    state.currentSessionId = sessionId;
    renderChatList();
    renderActiveMessages();

    // Focus input
    elements.promptInput.focus();
  }

  function deleteSession(sessionId, e) {
    if (e) e.stopPropagation();

    state.sessions = state.sessions.filter(s => s.id !== sessionId);
    saveSessions();

    // Delete from Firestore
    try {
      if (typeof window.deleteChatSessionFromFirestore === 'function') {
        window.deleteChatSessionFromFirestore(sessionId);
      }
    } catch (fsErr) {
      console.warn('Firestore delete notice:', fsErr);
    }

    if (state.sessions.length === 0) {
      createNewSession();
    } else if (state.currentSessionId === sessionId) {
      switchSession(state.sessions[0].id);
    } else {
      renderChatList();
    }
    showToast('대화가 삭제되었습니다.');
  }

  function getCurrentSession() {
    return state.sessions.find(s => s.id === state.currentSessionId);
  }

  function renderChatList() {
    elements.chatList.innerHTML = '';
    state.sessions.forEach(session => {
      const item = document.createElement('div');
      item.className = 'chat-item' + (session.id === state.currentSessionId ? ' active' : '');
      item.onclick = () => switchSession(session.id);

      const titleWrap = document.createElement('div');
      titleWrap.className = 'chat-item-title-wrap';

      const icon = document.createElement('span');
      icon.innerHTML = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>`;

      const titleSpan = document.createElement('span');
      titleSpan.className = 'chat-item-title';
      titleSpan.textContent = session.title || '새로운 대화';

      titleWrap.appendChild(icon);
      titleWrap.appendChild(titleSpan);

      const delBtn = document.createElement('button');
      delBtn.className = 'chat-item-del-btn';
      delBtn.title = '대화 삭제';
      delBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"/></svg>`;
      delBtn.onclick = (e) => deleteSession(session.id, e);

      item.appendChild(titleWrap);
      item.appendChild(delBtn);
      elements.chatList.appendChild(item);
    });
  }

  function renderActiveMessages() {
    const session = getCurrentSession();
    if (!session || session.messages.length === 0) {
      elements.welcomeHero.style.display = 'flex';
      elements.messageStream.innerHTML = '';
      return;
    }

    elements.welcomeHero.style.display = 'none';
    elements.messageStream.innerHTML = '';

    session.messages.forEach(msg => {
      appendMessageToDOM(msg, false);
    });

    scrollToBottom();
  }

  // ==========================================
  // DOM Message Rendering
  // ==========================================
  function createGroundingElement(metadata) {
    if (!metadata) return null;
    const queries = metadata.webSearchQueries || [];
    const chunks = metadata.groundingChunks || [];

    if (queries.length === 0 && chunks.length === 0) return null;

    const container = document.createElement('div');
    container.className = 'grounding-sources-box';

    let html = `
      <div class="grounding-header">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10"/>
          <line x1="2" y1="12" x2="22" y2="12"/>
          <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
        </svg>
        <span>구글 실시간 웹 검색 결과 (출처 ${chunks.length}개)</span>
      </div>
    `;

    if (queries.length > 0) {
      html += `<div class="grounding-queries">`;
      queries.forEach(q => {
        html += `<span class="query-chip">🔍 ${escapeHtml(q)}</span>`;
      });
      html += `</div>`;
    }

    if (chunks.length > 0) {
      html += `<div class="grounding-links">`;
      chunks.forEach((chunk, i) => {
        const web = chunk.web || {};
        const uri = web.uri || '#';
        const title = web.title || uri;
        html += `
          <a href="${escapeHtml(uri)}" target="_blank" rel="noopener noreferrer" class="source-link-chip" title="${escapeHtml(title)}">
            <span class="source-num">${i + 1}</span>
            <span class="source-title">${escapeHtml(title)}</span>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
          </a>
        `;
      });
      html += `</div>`;
    }

    container.innerHTML = html;
    return container;
  }

  function appendMessageToDOM(msg, shouldScroll = true) {
    elements.welcomeHero.style.display = 'none';

    const row = document.createElement('div');
    row.className = `message-row ${msg.role === 'user' ? 'user' : 'bot'}`;
    row.setAttribute('data-msg-id', msg.id || '');
    row.setAttribute('data-raw-content', msg.content || '');

    // Avatar
    const avatar = document.createElement('div');
    avatar.className = 'message-avatar';
    if (msg.role === 'user') {
      avatar.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`;
    } else {
      avatar.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z"/></svg>`;
    }

    // Content wrap
    const contentWrap = document.createElement('div');
    contentWrap.className = 'message-content-wrap';

    // Header info (for bot)
    if (msg.role !== 'user') {
      const headerInfo = document.createElement('div');
      headerInfo.className = 'message-header-info';
      headerInfo.innerHTML = `
        <span class="bot-tag">Gemini 3.8 Flash</span>
        ${msg.latencyMs ? `<span class="latency-badge">⚡ ${(msg.latencyMs / 1000).toFixed(2)}s</span>` : ''}
      `;
      contentWrap.appendChild(headerInfo);
    }

    // Bubble
    const bubble = document.createElement('div');
    bubble.className = 'message-bubble';

    // Image attachments if present
    if (msg.images && msg.images.length > 0) {
      const imgContainer = document.createElement('div');
      imgContainer.className = 'attached-images-preview';
      msg.images.forEach(img => {
        const imgEl = document.createElement('img');
        imgEl.className = 'attached-img-thumb';
        imgEl.src = img.data.startsWith('data:') ? img.data : `data:${img.mimeType || 'image/jpeg'};base64,${img.data}`;
        imgEl.alt = '첨부 이미지';
        imgEl.onclick = () => window.open(imgEl.src, '_blank');
        imgContainer.appendChild(imgEl);
      });
      bubble.appendChild(imgContainer);
    }

    // Text Content
    const textHolder = document.createElement('div');
    textHolder.className = 'bubble-text';

    if (msg.role === 'user') {
      textHolder.textContent = msg.content;
    } else {
      if (typeof marked !== 'undefined') {
        textHolder.innerHTML = marked.parse(msg.content || '');
      } else {
        textHolder.textContent = msg.content;
      }
    }
    bubble.appendChild(textHolder);
    contentWrap.appendChild(bubble);

    // Grounding Sources Box (if message already has groundingMetadata)
    if (msg.role !== 'user' && msg.groundingMetadata) {
      const groundingEl = createGroundingElement(msg.groundingMetadata);
      if (groundingEl) {
        contentWrap.appendChild(groundingEl);
      }
    }

    // Actions toolbar
    if (msg.role !== 'user') {
      const actions = document.createElement('div');
      actions.className = 'message-actions';
      actions.innerHTML = `
        <button class="action-chip-btn" onclick="window.copyMessageText(this)" title="답변 전체 복사">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
          <span>복사</span>
        </button>
        <button class="action-chip-btn" onclick="window.speakMessageText(this)" title="음성으로 듣기">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>
          <span>읽기</span>
        </button>
      `;
      contentWrap.appendChild(actions);
    }

    row.appendChild(avatar);
    row.appendChild(contentWrap);

    elements.messageStream.appendChild(row);

    if (shouldScroll) {
      scrollToBottom();
    }

    return { row, bubble, textHolder, contentWrap, avatar };
  }

  function scrollToBottom() {
    elements.messagesContainer.scrollTop = elements.messagesContainer.scrollHeight;
  }

  // ==========================================
  // Sending Message & Streaming
  // ==========================================
  async function sendMessage() {
    const currentUser = typeof window.getFirebaseCurrentUser === 'function' ? window.getFirebaseCurrentUser() : null;
    if (!currentUser) {
      promptLogin('로그인 후 Gemini 3.8 Flash와 대화를 시작할 수 있습니다.');
      return;
    }

    const text = elements.promptInput.value.trim();
    const images = [...state.attachedImages];

    if (!text && images.length === 0) return;
    if (state.isStreaming) {
      stopStreaming();
      return;
    }

    const session = getCurrentSession();
    if (!session) return;

    // Reset input
    elements.promptInput.value = '';
    elements.promptInput.style.height = 'auto';
    clearAttachments();
    updateCharCount();

    // Auto rename session title from first prompt
    if (session.messages.length === 0) {
      const autoTitle = text.slice(0, 24) + (text.length > 24 ? '...' : '');
      session.title = autoTitle || '이미지 분석 대화';
      renderChatList();
    }

    // Add User Message
    const userMsg = {
      id: 'msg_' + Date.now(),
      role: 'user',
      content: text,
      images: images.length > 0 ? images : undefined,
      timestamp: new Date().toISOString()
    };
    session.messages.push(userMsg);
    saveSessions();
    appendMessageToDOM(userMsg);

    // Prepare Bot message placeholder
    const botMsgId = 'msg_' + (Date.now() + 1);
    const botMsgObj = {
      id: botMsgId,
      role: 'model',
      content: '',
      timestamp: new Date().toISOString(),
      latencyMs: 0
    };

    // Render streaming placeholder
    const domRef = appendMessageToDOM(botMsgObj);
    domRef.avatar.classList.add('pulsing');

    // Thinking state
    domRef.textHolder.innerHTML = `
      <div class="thinking-box">
        <div class="thinking-dots">
          <div class="thinking-dot"></div>
          <div class="thinking-dot"></div>
          <div class="thinking-dot"></div>
        </div>
        <span>Gemini 3.8 Flash가 응답을 생성하고 있습니다...</span>
      </div>
    `;

    setStreamingState(true);
    state.abortController = new AbortController();

    // Prepare system instruction
    let systemInstruction = '';
    if (state.settings.systemPersona === 'custom') {
      systemInstruction = state.settings.customSystemPrompt || '';
    } else if (personaPresets[state.settings.systemPersona]) {
      systemInstruction = personaPresets[state.settings.systemPersona];
    }

    // Build payload messages for API
    const apiMessages = session.messages.map(m => ({
      role: m.role,
      content: m.content,
      images: m.images
    }));

    const startTime = Date.now();
    let accumulatedText = '';
    let hasReceivedFirstChunk = false;

    try {
      const headers = { 'Content-Type': 'application/json' };

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          messages: apiMessages,
          model: state.settings.model || 'gemini-3.8-flash',
          systemInstruction,
          temperature: state.settings.temperature ?? 0.7,
          webSearch: state.settings.webSearch !== false
        }),
        signal: state.abortController.signal
      });

      if (!response.ok) {
        throw new Error(`서버 응답 오류 (HTTP ${response.status})`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let buffer = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop(); // keep last incomplete line in buffer

        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed.startsWith('data:')) {
            const dataStr = trimmed.replace(/^data:\s*/, '');
            if (!dataStr) continue;

            try {
              const payload = JSON.parse(dataStr);

              if (payload.error) {
                domRef.textHolder.innerHTML = `<span style="color: var(--accent-rose); font-weight: 500;">⚠️ ${escapeHtml(payload.error)}</span>`;
                setStreamingState(false);
                domRef.avatar.classList.remove('pulsing');
                return;
              }

              if (payload.text) {
                if (!hasReceivedFirstChunk) {
                  hasReceivedFirstChunk = true;
                  domRef.textHolder.innerHTML = '';
                }
                accumulatedText += payload.text;
                domRef.row.setAttribute('data-raw-content', accumulatedText);

                // Render markdown with active glowing cursor
                if (typeof marked !== 'undefined') {
                  domRef.textHolder.innerHTML = marked.parse(accumulatedText) + '<span class="streaming-cursor"></span>';
                } else {
                  domRef.textHolder.textContent = accumulatedText;
                }

                scrollToBottom();
              }

              if (payload.done) {
                const totalLatency = payload.stats?.latencyMs || (Date.now() - startTime);
                botMsgObj.latencyMs = totalLatency;

                // Update latency badge
                const headerInfo = domRef.contentWrap.querySelector('.message-header-info');
                if (headerInfo) {
                  headerInfo.innerHTML = `
                    <span class="bot-tag">Gemini 3.8 Flash</span>
                    <span class="latency-badge">⚡ ${(totalLatency / 1000).toFixed(2)}s</span>
                  `;
                }

                // Render grounding metadata (sources and queries)
                if (payload.groundingMetadata) {
                  botMsgObj.groundingMetadata = payload.groundingMetadata;
                  const groundingEl = createGroundingElement(payload.groundingMetadata);
                  if (groundingEl) {
                    const existingActions = domRef.contentWrap.querySelector('.message-actions');
                    if (existingActions) {
                      domRef.contentWrap.insertBefore(groundingEl, existingActions);
                    } else {
                      domRef.contentWrap.appendChild(groundingEl);
                    }
                  }
                }
              }
            } catch (err) {
              console.warn('SSE JSON parse error:', err, dataStr);
            }
          }
        }
      }

      // Finish streaming cleanly
      if (typeof marked !== 'undefined') {
        domRef.textHolder.innerHTML = marked.parse(accumulatedText);
      } else {
        domRef.textHolder.textContent = accumulatedText;
      }

      botMsgObj.content = accumulatedText;
      session.messages.push(botMsgObj);
      saveSessions();

    } catch (err) {
      if (err.name === 'AbortError') {
        if (accumulatedText) {
          if (typeof marked !== 'undefined') {
            domRef.textHolder.innerHTML = marked.parse(accumulatedText);
          }
          botMsgObj.content = accumulatedText;
          session.messages.push(botMsgObj);
          saveSessions();
        } else {
          domRef.textHolder.innerHTML = '<span style="color: var(--text-muted); font-style: italic;">생성이 중단되었습니다.</span>';
        }
        showToast('응답 생성이 중단되었습니다.');
      } else {
        console.error('Chat error:', err);
        domRef.textHolder.innerHTML = `<span style="color: var(--accent-rose); font-weight: 500;">⚠️ 통신 오류: ${escapeHtml(err.message)}</span>`;
        showToast('통신 중 오류가 발생했습니다.');
      }
    } finally {
      setStreamingState(false);
      domRef.avatar.classList.remove('pulsing');
      scrollToBottom();
    }
  }

  function stopStreaming() {
    if (state.abortController) {
      state.abortController.abort();
      state.abortController = null;
    }
    setStreamingState(false);
  }

  function setStreamingState(isStreaming) {
    state.isStreaming = isStreaming;
    if (isStreaming) {
      elements.sendBtn.classList.add('streaming');
      elements.sendBtn.title = '생성 중단';
    } else {
      elements.sendBtn.classList.remove('streaming');
      elements.sendBtn.title = '메시지 전송';
    }
  }

  // ==========================================
  // Image Attachments (Multimodal)
  // ==========================================
  function handleFileSelect(e) {
    const files = Array.from(e.target.files || []);
    addImagesFromFiles(files);
    e.target.value = ''; // reset so same file can be selected again
  }

  function addImagesFromFiles(files) {
    files.forEach(file => {
      if (!file.type.startsWith('image/')) {
        showToast('이미지 파일(PNG, JPG, WebP)만 첨부할 수 있습니다.');
        return;
      }
      if (file.size > 10 * 1024 * 1024) {
        showToast('파일 크기는 10MB 이하이어야 합니다.');
        return;
      }

      const reader = new FileReader();
      reader.onload = (e) => {
        const base64Data = e.target.result;
        state.attachedImages.push({
          name: file.name,
          mimeType: file.type,
          data: base64Data
        });
        renderAttachmentPreviews();
      };
      reader.readAsDataURL(file);
    });
  }

  function renderAttachmentPreviews() {
    if (state.attachedImages.length === 0) {
      elements.attachmentPreviewBar.style.display = 'none';
      elements.previewScroll.innerHTML = '';
      return;
    }

    elements.attachmentPreviewBar.style.display = 'block';
    elements.previewScroll.innerHTML = '';

    state.attachedImages.forEach((img, idx) => {
      const item = document.createElement('div');
      item.className = 'preview-item';

      const imgEl = document.createElement('img');
      imgEl.src = img.data;

      const removeBtn = document.createElement('button');
      removeBtn.className = 'preview-remove-btn';
      removeBtn.innerHTML = '✕';
      removeBtn.onclick = () => {
        state.attachedImages.splice(idx, 1);
        renderAttachmentPreviews();
      };

      item.appendChild(imgEl);
      item.appendChild(removeBtn);
      elements.previewScroll.appendChild(item);
    });
  }

  function clearAttachments() {
    state.attachedImages = [];
    renderAttachmentPreviews();
  }

  // ==========================================
  // Speech Recognition (STT)
  // ==========================================
  function setupSpeechRecognition() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      state.speechRecognition = new SpeechRecognition();
      state.speechRecognition.continuous = false;
      state.speechRecognition.interimResults = true;
      state.speechRecognition.lang = 'ko-KR';

      state.speechRecognition.onresult = (event) => {
        let transcript = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          transcript += event.results[i][0].transcript;
        }
        elements.promptInput.value = transcript;
        updateCharCount();
      };

      state.speechRecognition.onerror = (event) => {
        console.warn('Speech error:', event.error);
        stopVoiceRecognition();
      };

      state.speechRecognition.onend = () => {
        stopVoiceRecognition();
      };
    } else {
      elements.voiceBtn.style.display = 'none';
    }
  }

  function toggleVoiceRecognition() {
    if (!state.speechRecognition) return;

    if (state.isRecordingVoice) {
      state.speechRecognition.stop();
      stopVoiceRecognition();
    } else {
      try {
        state.speechRecognition.start();
        state.isRecordingVoice = true;
        elements.voiceBtn.classList.add('recording');
        elements.voiceBtn.title = '음성 인식 중지';
        showToast('음성을 듣고 있습니다. 말씀하세요...');
      } catch (err) {
        console.error(err);
      }
    }
  }

  function stopVoiceRecognition() {
    state.isRecordingVoice = false;
    elements.voiceBtn.classList.remove('recording');
    elements.voiceBtn.title = '음성 인식 (STT)';
  }

  // ==========================================
  // Event Bindings
  // ==========================================
  function bindEvents() {
    // Sidebar toggles
    elements.menuBtn.onclick = openSidebar;
    elements.closeSidebarBtn.onclick = closeSidebar;
    elements.sidebarOverlay.onclick = closeSidebar;

    // Chat Actions
    elements.newChatBtn.onclick = createNewSession;
    elements.clearChatBtn.onclick = () => {
      const session = getCurrentSession();
      if (session) {
        session.messages = [];
        saveSessions();
        renderActiveMessages();
        showToast('현재 대화가 비워졌습니다.');
      }
    };

    // Theme Toggle
    elements.themeToggleBtn.onclick = toggleTheme;

    // Settings Modal
    elements.settingsBtn.onclick = openSettingsModal;
    elements.closeSettingsBtn.onclick = closeSettingsModal;
    elements.saveSettingsBtn.onclick = saveSettings;
    elements.resetSettingsBtn.onclick = () => {
      state.settings = { ...defaultSettings };
      syncSettingsToModal();
      showToast('설정이 기본값으로 재설정되었습니다.');
    };

    elements.settingsModal.onclick = (e) => {
      if (e.target === elements.settingsModal) closeSettingsModal();
    };

    elements.tempSlider.oninput = (e) => {
      elements.tempVal.textContent = e.target.value;
    };

    elements.systemPersonaSelect.onchange = (e) => {
      if (e.target.value === 'custom') {
        elements.customSystemPrompt.style.display = 'block';
        elements.customSystemPrompt.focus();
      } else {
        elements.customSystemPrompt.style.display = 'none';
      }
    };

    // Starter Suggestions Click
    elements.suggestionsGrid.addEventListener('click', (e) => {
      const card = e.target.closest('.suggestion-card');
      if (card) {
        const currentUser = typeof window.getFirebaseCurrentUser === 'function' ? window.getFirebaseCurrentUser() : null;
        if (!currentUser) {
          promptLogin('추천 대화를 시작하려면 먼저 로그인이 필요합니다.');
          return;
        }
        const prompt = card.getAttribute('data-prompt');
        if (prompt) {
          elements.promptInput.value = prompt;
          sendMessage();
        }
      }
    });

    // Form submit & Textarea keys
    elements.chatForm.onsubmit = (e) => {
      e.preventDefault();
      sendMessage();
    };

    elements.promptInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
      }
    });

    elements.promptInput.addEventListener('click', () => {
      const currentUser = typeof window.getFirebaseCurrentUser === 'function' ? window.getFirebaseCurrentUser() : null;
      if (!currentUser) {
        promptLogin();
      }
    });

    // Lock Overlay & Notice Login Clicks
    if (elements.lockedLoginBtn) {
      elements.lockedLoginBtn.onclick = () => promptLogin();
    }
    if (elements.heroLoginBtn) {
      elements.heroLoginBtn.onclick = () => promptLogin();
    }
    if (elements.chatLockedOverlay) {
      elements.chatLockedOverlay.onclick = (e) => {
        if (e.target !== elements.lockedLoginBtn) {
          promptLogin();
        }
      };
    }

    elements.promptInput.addEventListener('input', () => {
      autoResizeTextarea();
      updateCharCount();
    });

    // File Attachments
    elements.attachBtn.onclick = () => {
      const currentUser = typeof window.getFirebaseCurrentUser === 'function' ? window.getFirebaseCurrentUser() : null;
      if (!currentUser) {
        promptLogin('이미지를 첨부하려면 먼저 로그인이 필요합니다.');
        return;
      }
      elements.fileInput.click();
    };
    elements.fileInput.onchange = handleFileSelect;

    // Paste Image from Clipboard
    window.addEventListener('paste', (e) => {
      const currentUser = typeof window.getFirebaseCurrentUser === 'function' ? window.getFirebaseCurrentUser() : null;
      if (!currentUser) return;

      const items = (e.clipboardData || e.originalEvent.clipboardData).items;
      const imageFiles = [];
      for (const item of items) {
        if (item.kind === 'file' && item.type.startsWith('image/')) {
          imageFiles.push(item.getAsFile());
        }
      }
      if (imageFiles.length > 0) {
        addImagesFromFiles(imageFiles);
      }
    });

    // Drag & Drop Image
    window.addEventListener('dragover', (e) => e.preventDefault());
    window.addEventListener('drop', (e) => {
      e.preventDefault();
      const currentUser = typeof window.getFirebaseCurrentUser === 'function' ? window.getFirebaseCurrentUser() : null;
      if (!currentUser) return;

      if (e.dataTransfer && e.dataTransfer.files) {
        const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/'));
        if (files.length > 0) {
          addImagesFromFiles(files);
        }
      }
    });

    // Voice
    elements.voiceBtn.onclick = () => {
      const currentUser = typeof window.getFirebaseCurrentUser === 'function' ? window.getFirebaseCurrentUser() : null;
      if (!currentUser) {
        promptLogin('음성 인식을 이용하려면 먼저 로그인이 필요합니다.');
        return;
      }
      toggleVoiceRecognition();
    };

    // Google Web Search Grounding Toggle
    if (elements.webSearchBtn) {
      elements.webSearchBtn.onclick = () => {
        state.settings.webSearch = !(state.settings.webSearch !== false);
        localStorage.setItem(STORAGE_SETTINGS, JSON.stringify(state.settings));
        updateWebSearchBtnUI(state.settings.webSearch);
        showToast(state.settings.webSearch ? '🔍 실시간 구글 웹 검색이 켜졌습니다.' : '구글 웹 검색이 꺼졌습니다.');
      };
    }

    // Listen for auth state change to update lock and sync Firestore chats
    window.addEventListener('gemini-auth-changed', async (e) => {
      const user = e.detail?.user;
      updateChatAuthState(user);

      if (user && typeof window.loadUserChatsFromFirestore === 'function') {
        try {
          const cloudChats = await window.loadUserChatsFromFirestore();
          if (cloudChats && cloudChats.length > 0) {
            const sessionMap = new Map();
            // Put local sessions in map
            state.sessions.forEach(s => sessionMap.set(s.id, s));
            // Merge cloud sessions
            cloudChats.forEach(c => {
              sessionMap.set(c.id, c);
            });
            state.sessions = Array.from(sessionMap.values());
            state.sessions.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
            localStorage.setItem(STORAGE_SESSIONS, JSON.stringify(state.sessions));
            renderChatList();
            if (state.sessions.length > 0) {
              switchSession(state.sessions[0].id);
            }
            showToast(`Firestore 대화 기록(${cloudChats.length}개)이 동기화되었습니다.`);
          }
        } catch (syncErr) {
          console.warn('Firestore chats sync error:', syncErr);
        }
      }
    });
  }

  function autoResizeTextarea() {
    const el = elements.promptInput;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 180) + 'px';
  }

  function updateCharCount() {
    elements.charCount.textContent = `${elements.promptInput.value.length}자`;
  }

  function openSidebar() {
    elements.sidebar.classList.add('open');
    elements.sidebarOverlay.classList.add('active');
  }

  function closeSidebar() {
    elements.sidebar.classList.remove('open');
    elements.sidebarOverlay.classList.remove('active');
  }

  function openSettingsModal() {
    syncSettingsToModal();
    elements.settingsModal.style.display = 'flex';
  }

  function closeSettingsModal() {
    elements.settingsModal.style.display = 'none';
  }

  // ==========================================
  // Utilities
  // ==========================================
  function showToast(message) {
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;
    elements.toastContainer.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(10px)';
      toast.style.transition = 'all 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 2800);
  }

  function escapeHtml(str) {
    if (!str) return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function updatePhoneClock() {
    const timeEl = document.getElementById('phone-time');
    if (timeEl) {
      const now = new Date();
      const hours = String(now.getHours()).padStart(2, '0');
      const minutes = String(now.getMinutes()).padStart(2, '0');
      timeEl.textContent = `${hours}:${minutes}`;
    }
  }

  // Start app
  document.addEventListener('DOMContentLoaded', () => {
    init();
    updatePhoneClock();
    setInterval(updatePhoneClock, 1000);
  });
})();
