// @chimerai component=ChatWidget version=1.0
// ChimerAI Embeddable Chat Widget — Self-contained Web Component
// Usage:
//   <script src="https://your-app.com/widget/chat.js"></script>
//   <div id="chat"></div>
//   <script>ChimerAI.mount('#chat', { apiKey: 'sk_live_...', theme: 'dark' });</script>

(function() {
  'use strict';

  // ── Inline Styles (Shadow DOM isolated) ──────────────────────────
  const WIDGET_CSS = `
    :host {
      display: block;
      width: 100%;
      height: 100%;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      --chi-bg: #ffffff;
      --chi-bg-secondary: #f3f4f6;
      --chi-text: #111827;
      --chi-text-secondary: #6b7280;
      --chi-border: #e5e7eb;
      --chi-primary: #2563eb;
      --chi-primary-hover: #1d4ed8;
      --chi-user-bg: #2563eb;
      --chi-user-text: #ffffff;
      --chi-assistant-bg: #f3f4f6;
      --chi-assistant-text: #111827;
      --chi-error-bg: #fef2f2;
      --chi-error-text: #dc2626;
      --chi-radius: 12px;
    }

    :host([data-theme="dark"]) {
      --chi-bg: #1f2937;
      --chi-bg-secondary: #374151;
      --chi-text: #f9fafb;
      --chi-text-secondary: #9ca3af;
      --chi-border: #4b5563;
      --chi-primary: #3b82f6;
      --chi-primary-hover: #2563eb;
      --chi-user-bg: #3b82f6;
      --chi-user-text: #ffffff;
      --chi-assistant-bg: #374151;
      --chi-assistant-text: #f9fafb;
      --chi-error-bg: #451a1a;
      --chi-error-text: #fca5a5;
    }

    @media (prefers-color-scheme: dark) {
      :host([data-theme="auto"]) {
        --chi-bg: #1f2937;
        --chi-bg-secondary: #374151;
        --chi-text: #f9fafb;
        --chi-text-secondary: #9ca3af;
        --chi-border: #4b5563;
        --chi-primary: #3b82f6;
        --chi-primary-hover: #2563eb;
        --chi-user-bg: #3b82f6;
        --chi-user-text: #ffffff;
        --chi-assistant-bg: #374151;
        --chi-assistant-text: #f9fafb;
        --chi-error-bg: #451a1a;
        --chi-error-text: #fca5a5;
      }
    }

    .chi-container {
      display: flex;
      flex-direction: column;
      height: 100%;
      min-height: 400px;
      background: var(--chi-bg);
      border: 1px solid var(--chi-border);
      border-radius: var(--chi-radius);
      overflow: hidden;
    }

    .chi-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 12px 16px;
      background: var(--chi-bg-secondary);
      border-bottom: 1px solid var(--chi-border);
      flex-shrink: 0;
    }

    .chi-header-title {
      font-size: 14px;
      font-weight: 600;
      color: var(--chi-text);
      margin: 0;
    }

    .chi-header-actions {
      display: flex;
      gap: 8px;
    }

    .chi-btn-icon {
      background: none;
      border: none;
      color: var(--chi-text-secondary);
      cursor: pointer;
      padding: 4px;
      border-radius: 4px;
      font-size: 16px;
      line-height: 1;
    }

    .chi-btn-icon:hover {
      color: var(--chi-text);
      background: var(--chi-border);
    }

    .chi-messages {
      flex: 1;
      overflow-y: auto;
      padding: 16px;
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .chi-message {
      max-width: 85%;
      padding: 10px 14px;
      border-radius: var(--chi-radius);
      font-size: 14px;
      line-height: 1.5;
      word-wrap: break-word;
      white-space: pre-wrap;
    }

    .chi-message-user {
      align-self: flex-end;
      background: var(--chi-user-bg);
      color: var(--chi-user-text);
    }

    .chi-message-assistant {
      align-self: flex-start;
      background: var(--chi-assistant-bg);
      color: var(--chi-assistant-text);
    }

    .chi-message-error {
      align-self: center;
      background: var(--chi-error-bg);
      color: var(--chi-error-text);
      font-size: 13px;
      text-align: center;
    }

    .chi-typing {
      align-self: flex-start;
      padding: 10px 14px;
      background: var(--chi-assistant-bg);
      border-radius: var(--chi-radius);
      display: flex;
      gap: 4px;
      align-items: center;
    }

    .chi-typing-dot {
      width: 6px;
      height: 6px;
      background: var(--chi-text-secondary);
      border-radius: 50%;
      animation: chi-bounce 1.4s infinite ease-in-out both;
    }

    .chi-typing-dot:nth-child(1) { animation-delay: -0.32s; }
    .chi-typing-dot:nth-child(2) { animation-delay: -0.16s; }

    @keyframes chi-bounce {
      0%, 80%, 100% { transform: scale(0); }
      40% { transform: scale(1); }
    }

    .chi-input-area {
      display: flex;
      gap: 8px;
      padding: 12px 16px;
      border-top: 1px solid var(--chi-border);
      background: var(--chi-bg);
      flex-shrink: 0;
    }

    .chi-input {
      flex: 1;
      padding: 10px 14px;
      border: 1px solid var(--chi-border);
      border-radius: 8px;
      background: var(--chi-bg);
      color: var(--chi-text);
      font-size: 14px;
      font-family: inherit;
      resize: none;
      outline: none;
      max-height: 120px;
      min-height: 40px;
    }

    .chi-input:focus {
      border-color: var(--chi-primary);
      box-shadow: 0 0 0 2px rgba(37, 99, 235, 0.2);
    }

    .chi-input::placeholder {
      color: var(--chi-text-secondary);
    }

    .chi-send-btn {
      padding: 10px 16px;
      background: var(--chi-primary);
      color: #ffffff;
      border: none;
      border-radius: 8px;
      cursor: pointer;
      font-size: 14px;
      font-weight: 500;
      flex-shrink: 0;
      transition: background 0.15s;
    }

    .chi-send-btn:hover:not(:disabled) {
      background: var(--chi-primary-hover);
    }

    .chi-send-btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .chi-empty {
      flex: 1;
      display: flex;
      align-items: center;
      justify-content: center;
      color: var(--chi-text-secondary);
      font-size: 14px;
      padding: 32px;
      text-align: center;
    }

    .chi-powered {
      text-align: center;
      padding: 6px;
      font-size: 11px;
      color: var(--chi-text-secondary);
      border-top: 1px solid var(--chi-border);
    }

    .chi-powered a {
      color: var(--chi-primary);
      text-decoration: none;
    }
  `;

  // ── Web Component ────────────────────────────────────────────────
  class ChimerAIChatWidget extends HTMLElement {
    constructor() {
      super();
      this._shadow = this.attachShadow({ mode: 'open', delegatesFocus: true });
      this._messages = [];
      this._conversationId = null;
      this._abortController = null;
      this._isStreaming = false;
      this._config = {};
    }

    connectedCallback() {
      this._config = this._readConfig();
      this._render();
      this._attachEvents();

      // Notify ready callback
      if (typeof this._config.onReady === 'function') {
        this._config.onReady();
      }
    }

    disconnectedCallback() {
      this._abort();
    }

    // ── Config ───────────────────────────────────────────────────
    _readConfig() {
      const endpoint = this.getAttribute('data-endpoint') || this.getAttribute('data-api-endpoint') || '';
      return {
        apiKey: this.getAttribute('data-api-key') || this.getAttribute('data-apikey') || '',
        endpoint: endpoint.replace(/\/+$/, ''),  // strip trailing slash
        theme: this.getAttribute('data-theme') || 'auto',
        model: this.getAttribute('data-model') || '',
        title: this.getAttribute('data-title') || 'AI Chat',
        placeholder: this.getAttribute('data-placeholder') || 'Type a message...',
        // Callbacks set via mount()
        onReady: this._onReady || null,
        onError: this._onError || null,
        onMessageSent: this._onMessageSent || null,
        onResponseReceived: this._onResponseReceived || null,
      };
    }

    // ── Render ───────────────────────────────────────────────────
    _render() {
      this.setAttribute('data-theme', this._config.theme);

      this._shadow.innerHTML = `
        <style>${WIDGET_CSS}</style>
        <div class="chi-container">
          <div class="chi-header">
            <span class="chi-header-title">${this._escapeHtml(this._config.title)}</span>
            <div class="chi-header-actions">
              <button class="chi-btn-icon" id="chi-clear" title="Clear chat">🗑️</button>
            </div>
          </div>
          <div class="chi-messages" id="chi-messages">
            <div class="chi-empty">Start a conversation…</div>
          </div>
          <div class="chi-input-area">
            <textarea
              class="chi-input"
              id="chi-input"
              placeholder="${this._escapeHtml(this._config.placeholder)}"
              rows="1"
            ></textarea>
            <button class="chi-send-btn" id="chi-send">Send</button>
          </div>
          <div class="chi-powered">Powered by <a href="https://github.com/armbur19-collab/chimerai-kickstart" target="_blank" rel="noopener">ChimerAI</a></div>
        </div>
      `;
    }

    // ── Events ───────────────────────────────────────────────────
    _attachEvents() {
      const input = this._shadow.getElementById('chi-input');
      const sendBtn = this._shadow.getElementById('chi-send');
      const clearBtn = this._shadow.getElementById('chi-clear');

      sendBtn.addEventListener('click', () => this._handleSend());

      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          this._handleSend();
        }
      });

      // Auto-resize textarea
      input.addEventListener('input', () => {
        input.style.height = 'auto';
        input.style.height = Math.min(input.scrollHeight, 120) + 'px';
      });

      clearBtn.addEventListener('click', () => this.clearMessages());
    }

    // ── Send Message ─────────────────────────────────────────────
    async _handleSend() {
      const input = this._shadow.getElementById('chi-input');
      const content = input.value.trim();
      if (!content || this._isStreaming) return;

      input.value = '';
      input.style.height = 'auto';

      // Add user message
      this._addMessage('user', content);

      // Callback
      if (typeof this._config.onMessageSent === 'function') {
        this._config.onMessageSent({ role: 'user', content });
      }

      // Start streaming
      await this._streamResponse(content);
    }

    // ── SSE Streaming ────────────────────────────────────────────
    async _streamResponse(userMessage) {
      this._isStreaming = true;
      this._setInputEnabled(false);

      // Show typing indicator
      this._showTyping();

      this._abortController = new AbortController();

      const apiUrl = this._config.endpoint
        ? this._config.endpoint + '/api/v1/chat/stream'
        : '/api/v1/chat/stream';

      const body = {
        messages: this._messages.map(m => ({ role: m.role, content: m.content })),
        promptCategory: 'widget',
      };
      if (this._config.model) body.model = this._config.model;
      if (this._config.promptId) body.promptId = this._config.promptId;
      if (this._conversationId) body.conversationId = this._conversationId;

      const headers = {
        'Content-Type': 'application/json',
      };
      if (this._config.apiKey) {
        headers['x-api-key'] = this._config.apiKey;
      }

      try {
        const response = await fetch(apiUrl, {
          method: 'POST',
          headers,
          body: JSON.stringify(body),
          signal: this._abortController.signal,
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || 'Request failed (' + response.status + ')');
        }

        // Remove typing indicator, add empty assistant message
        this._hideTyping();
        const assistantIdx = this._addMessage('assistant', '');

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let assistantContent = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (!line.startsWith('data: ')) continue;
            const data = line.slice(6).trim();
            if (data === '[DONE]') continue;

            try {
              const parsed = JSON.parse(data);

              if (parsed.type === 'token' && parsed.content) {
                assistantContent += parsed.content;
                this._updateMessage(assistantIdx, assistantContent);
              } else if (parsed.type === 'done') {
                if (parsed.conversationId) {
                  this._conversationId = parsed.conversationId;
                }
              } else if (parsed.type === 'error') {
                this._showError(parsed.message || 'Stream error');
              }
            } catch { /* skip unparseable */ }
          }
        }

        // Callback
        if (typeof this._config.onResponseReceived === 'function') {
          this._config.onResponseReceived({ role: 'assistant', content: assistantContent });
        }

      } catch (err) {
        this._hideTyping();
        if (err.name !== 'AbortError') {
          this._showError(err.message || 'Connection failed');
          if (typeof this._config.onError === 'function') {
            this._config.onError(err);
          }
        }
      } finally {
        this._isStreaming = false;
        this._abortController = null;
        this._setInputEnabled(true);
      }
    }

    // ── DOM Helpers ──────────────────────────────────────────────
    _addMessage(role, content) {
      this._messages.push({ role, content });
      const container = this._shadow.getElementById('chi-messages');

      // Remove empty state
      const empty = container.querySelector('.chi-empty');
      if (empty) empty.remove();

      const div = document.createElement('div');
      div.className = 'chi-message chi-message-' + role;
      div.textContent = content;
      div.setAttribute('data-idx', String(this._messages.length - 1));
      container.appendChild(div);
      container.scrollTop = container.scrollHeight;

      return this._messages.length - 1;
    }

    _updateMessage(idx, content) {
      const container = this._shadow.getElementById('chi-messages');
      const el = container.querySelector('[data-idx="' + idx + '"]');
      if (el) {
        el.textContent = content;
        container.scrollTop = container.scrollHeight;
      }
      if (this._messages[idx]) {
        this._messages[idx].content = content;
      }
    }

    _showTyping() {
      const container = this._shadow.getElementById('chi-messages');
      const typing = document.createElement('div');
      typing.className = 'chi-typing';
      typing.id = 'chi-typing';
      typing.innerHTML = '<div class="chi-typing-dot"></div><div class="chi-typing-dot"></div><div class="chi-typing-dot"></div>';
      container.appendChild(typing);
      container.scrollTop = container.scrollHeight;
    }

    _hideTyping() {
      const typing = this._shadow.getElementById('chi-typing');
      if (typing) typing.remove();
    }

    _showError(message) {
      const container = this._shadow.getElementById('chi-messages');
      const div = document.createElement('div');
      div.className = 'chi-message chi-message-error';
      div.textContent = '⚠ ' + message;
      container.appendChild(div);
      container.scrollTop = container.scrollHeight;
    }

    _setInputEnabled(enabled) {
      const input = this._shadow.getElementById('chi-input');
      const sendBtn = this._shadow.getElementById('chi-send');
      if (input) input.disabled = !enabled;
      if (sendBtn) {
        sendBtn.disabled = !enabled;
        sendBtn.textContent = enabled ? 'Send' : '...';
      }
    }

    _escapeHtml(str) {
      const div = document.createElement('div');
      div.textContent = str;
      return div.innerHTML;
    }

    _abort() {
      if (this._abortController) {
        this._abortController.abort();
        this._abortController = null;
      }
    }

    // ── Public API (called from mount() return) ──────────────────
    sendMessage(content) {
      const input = this._shadow.getElementById('chi-input');
      if (input) {
        input.value = content;
        this._handleSend();
      }
    }

    clearMessages() {
      this._messages = [];
      this._conversationId = null;
      this._abort();
      const container = this._shadow.getElementById('chi-messages');
      if (container) {
        container.innerHTML = '<div class="chi-empty">Start a conversation…</div>';
      }
    }

    setModel(model) {
      this._config.model = model;
    }
  }

  // Register Custom Element
  if (!customElements.get('chimerai-chat')) {
    customElements.define('chimerai-chat', ChimerAIChatWidget);
  }

  // ── Auto-mount from data attributes ─────────────────────────────
  function autoMount() {
    document.querySelectorAll('[data-chimerai-chat]').forEach(function(el) {
      if (el._chimeraiMounted) return;
      el._chimeraiMounted = true;

      var widget = document.createElement('chimerai-chat');
      // Copy data-* attributes
      Array.from(el.attributes).forEach(function(attr) {
        if (attr.name.startsWith('data-') && attr.name !== 'data-chimerai-chat') {
          widget.setAttribute(attr.name, attr.value);
        }
      });
      el.appendChild(widget);
    });
  }

  // Auto-mount when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', autoMount);
  } else {
    autoMount();
  }

  // ── Global API ──────────────────────────────────────────────────
  window.ChimerAI = window.ChimerAI || {};

  window.ChimerAI.mount = function(selector, config) {
    config = config || {};
    var container = typeof selector === 'string'
      ? document.querySelector(selector)
      : selector;

    if (!container) {
      throw new Error('ChimerAI: Element not found: ' + selector);
    }

    var widget = document.createElement('chimerai-chat');

    // Set attributes from config
    if (config.apiKey) widget.setAttribute('data-api-key', config.apiKey);
    if (config.endpoint) widget.setAttribute('data-endpoint', config.endpoint);
    if (config.theme) widget.setAttribute('data-theme', config.theme);
    if (config.model) widget.setAttribute('data-model', config.model);
    if (config.title) widget.setAttribute('data-title', config.title);
    if (config.placeholder) widget.setAttribute('data-placeholder', config.placeholder);

    // Set callbacks before appending (connectedCallback reads them)
    if (config.onReady) widget._onReady = config.onReady;
    if (config.onError) widget._onError = config.onError;
    if (config.onMessageSent) widget._onMessageSent = config.onMessageSent;
    if (config.onResponseReceived) widget._onResponseReceived = config.onResponseReceived;

    // Apply size if given
    if (config.width) widget.style.width = config.width;
    if (config.height) widget.style.height = config.height;

    container.appendChild(widget);

    // Return control handle
    return {
      sendMessage: function(msg) { widget.sendMessage(msg); },
      clearMessages: function() { widget.clearMessages(); },
      setModel: function(model) { widget.setModel(model); },
      destroy: function() { widget._abort(); widget.remove(); },
    };
  };

  window.ChimerAI.version = '1.0.0';
})();
