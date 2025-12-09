// Embeddable Chat Widget Script
// Usage: <script src="https://chatbot-domain/widget.js" data-customer-id="demo" data-theme="dark" async></script>

(function () {
  'use strict';

  function getScriptData() {
    const scripts = document.querySelectorAll('script[src*="/widget.js"]');
    const script = Array.from(scripts).pop();
    if (!script) return null;
    const src = script.src;
    const url = new URL(src, window.location.href);
    const apiBase = url.origin;
    const customerId = script.dataset.customerId || '';
    const theme = script.dataset.theme || 'dark'; // Default to dark for xAI aesthetic
    return { apiBase, customerId, theme };
  }

  const data = getScriptData();
  if (!data) return;

  const { apiBase, customerId, theme } = data;

  // Create chat bubble
  let bubble = document.getElementById('x-chat-bubble');
  if (!bubble) {
    bubble = document.createElement('div');
    bubble.id = 'x-chat-bubble';
    bubble.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>';
    bubble.style.cssText = `
      position: fixed;
      bottom: 24px;
      right: 24px;
      width: 56px;
      height: 56px;
      background: #000;
      border-radius: 50%;
      box-shadow: 0 4px 24px rgba(0, 0, 0, 0.4);
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
      cursor: pointer;
      z-index: 9999;
      transition: all 0.2s ease;
      border: 1px solid #333;
    `;
    bubble.onmouseenter = () => {
      bubble.style.transform = 'scale(1.05)';
      bubble.style.background = '#1a1a1a';
    };
    bubble.onmouseleave = () => {
      bubble.style.transform = 'scale(1)';
      bubble.style.background = '#000';
    };
    document.body.appendChild(bubble);
  }

  // Create widget container
  let widgetDiv = document.getElementById('x-support-widget');
  if (!widgetDiv) {
    widgetDiv = document.createElement('div');
    widgetDiv.id = 'x-support-widget';
    widgetDiv.style.cssText = `
      position: fixed;
      bottom: 24px;
      right: 24px;
      width: 400px;
      height: 600px;
      border-radius: 16px;
      overflow: hidden;
      z-index: 10000;
      box-shadow: 0 8px 40px rgba(0, 0, 0, 0.5);
      border: 1px solid #333;
      display: none;
      background: #000;
    `;
    document.body.appendChild(widgetDiv);
  }

  let isVisible = false;
  let iframeMounted = false;

  bubble.onclick = toggleWidget;

  // Close on outside click
  document.addEventListener('click', (e) => {
    if (isVisible && widgetDiv && !widgetDiv.contains(e.target) && !bubble.contains(e.target)) {
      hideWidget();
    }
  });

  function toggleWidget() {
    isVisible = !isVisible;
    if (isVisible) {
      showWidget();
    } else {
      hideWidget();
    }
  }

  function showWidget() {
    isVisible = true;
    widgetDiv.style.display = 'block';
    bubble.style.display = 'none'; // Hide bubble when widget is open

    if (!iframeMounted) {
      mountIframe();
    }
  }

  function hideWidget() {
    isVisible = false;
    widgetDiv.style.display = 'none';
    bubble.style.display = 'flex'; // Show bubble when widget is closed
  }

  function mountIframe() {
    const iframeUrl = `${apiBase}/chat?customerId=${encodeURIComponent(customerId)}&theme=${theme}&embed=true`;

    widgetDiv.innerHTML = `
      <iframe 
        src="${iframeUrl}" 
        style="width: 100%; height: 100%; border: none; background: #000;"
        allow="clipboard-write"
      ></iframe>
    `;

    iframeMounted = true;

    // Listen for close message from iframe
    window.addEventListener('message', (event) => {
      if (event.origin !== apiBase) return;
      if (event.data === 'close-widget') {
        hideWidget();
      }
    });
  }

})();
