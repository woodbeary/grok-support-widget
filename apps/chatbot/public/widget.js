// Embeddable Chat Widget Script
// Usage: <script src="https://chatbot-domain/widget.js" data-customer-id="demo" data-theme="dark" async></script>
// Assumes /widget-bundle.iife.js and .css are built and served from same origin

(function() {
  'use strict';

  function getScriptData() {
    const scripts = document.querySelectorAll('script[src*="/widget.js"]');
    const script = Array.from(scripts).pop(); // Last one
    if (!script) return null;
    const src = script.src;
    const url = new URL(src, window.location.href);
    const apiBase = url.origin;
    const customerId = script.dataset.customerId || '';
    const theme = (script.dataset.theme || 'light') as 'light' | 'dark';
    return { apiBase, customerId, theme, script };
  }

  const data = getScriptData();
  if (!data) return;

  const { apiBase, customerId, theme, script } = data;

  // Create bubble
  let bubble = document.getElementById('x-chat-bubble');
  if (!bubble) {
    bubble = document.createElement('div');
    bubble.id = 'x-chat-bubble';
    bubble.innerHTML = '💬';
    bubble.className = 'fixed bottom-4 right-4 w-12 h-12 bg-blue-500 hover:bg-blue-600 rounded-full shadow-lg flex items-center justify-center text-white cursor-pointer z-50 transition-transform duration-200';
    bubble.style.transform = 'scale(1)';
    document.body.appendChild(bubble);
  }

  // Create widget container
  let widgetDiv = document.getElementById('x-support-widget');
  if (!widgetDiv) {
    widgetDiv = document.createElement('div');
    widgetDiv.id = 'x-support-widget';
    widgetDiv.className = 'fixed bottom-20 right-4 w-96 h-[500px] hidden border border-gray-200 shadow-xl rounded-lg overflow-hidden z-40 bg-white transition-all duration-300';
    // Add close button
    const closeBtn = document.createElement('button');
    closeBtn.innerHTML = '×';
    closeBtn.className = 'absolute top-2 right-2 text-gray-500 hover:text-gray-700 text-2xl font-bold';
    closeBtn.onclick = hideWidget;
    widgetDiv.appendChild(closeBtn);
    document.body.appendChild(widgetDiv);
  }

  let isVisible = false;
  let mounted = false;
  let root = null;

  bubble.onclick = toggleWidget;
  widgetDiv.onclick = (e) => e.stopPropagation();
  document.addEventListener('click', (e) => {
    if (!widgetDiv.contains(e.target) && !bubble.contains(e.target)) hideWidget();
  });

  function toggleWidget() {
    isVisible = !isVisible;
    if (isVisible) {
      widgetDiv.classList.remove('hidden');
      bubble.classList.add('rotate-180'); // Optional animation
      if (!mounted) mountDirectWidget();
    } else {
      hideWidget();
    }
  }

  function hideWidget() {
    isVisible = false;
    widgetDiv.classList.add('hidden');
    bubble.classList.remove('rotate-180');
    if (root) {
      root.unmount();
      root = null;
      mounted = false;
    }
  }

  async function mountDirectWidget() {
    try {
      // Load CSS if not loaded
      const cssUrl = `${apiBase}/widget-bundle.iife.css`;
      if (!document.querySelector(`link[href="${cssUrl}"]`)) {
        await loadCss(cssUrl);
      }

      // Load React & ReactDOM if not present (use version matching project, but for compat use 18)
      if (typeof React === 'undefined') {
        await Promise.all([
          loadScript('https://unpkg.com/react@18/umd/react.production.min.js'),
          loadScript('https://unpkg.com/react-dom@18/umd/react-dom.production.min.js')
        ]);
      }

      // Load bundle
      const bundleUrl = `${apiBase}/widget-bundle.iife.js`;
      if (typeof window.ChatWidgetLib === 'undefined') {
        await loadScript(bundleUrl);
      }

      // Clear and render
      widgetDiv.innerHTML = '';
      const WidgetRoot = window.ChatWidgetLib.default || window.ChatWidgetLib;
      root = ReactDOM.createRoot(widgetDiv);
      root.render(React.createElement(WidgetRoot, { customerId, api: `${apiBase}/api/chat`, theme }));
      mounted = true;
    } catch (error) {
      console.error('Direct mount failed:', error);
      fallbackToIframe();
    }
  }

  function fallbackToIframe() {
    const iframeUrl = `${apiBase}/chat?customerId=${encodeURIComponent(customerId)}&theme=${theme}`;
    widgetDiv.innerHTML = `
      <iframe 
        src="${iframeUrl}" 
        class="w-full h-full" 
        frameborder="0" 
        sandbox="allow-scripts allow-same-origin allow-popups"
        style="border: none; background: white;"
      ></iframe>
    `;
    // For resizing, load iframe-resizer parent
    loadScript('https://cdn.jsdelivr.net/npm/iframe-resizer@4.3.2/js/iframeResizer.min.js')
      .then(() => {
        setTimeout(() => {
          if (window.iFrameResize) {
            window.iFrameResize({ log: false, checkOrigin: false }, '#x-support-widget iframe');
          }
        }, 1000);
      });
    // Note: iframe page needs contentWindow script for resizer
  }

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      if (document.querySelector(`script[src="${src}"]`)) {
        resolve(null);
        return;
      }
      const s = document.createElement('script');
      s.src = src;
      s.async = true;
      s.onload = () => resolve(null);
      s.onerror = reject;
      document.head.appendChild(s);
    });
  }

  function loadCss(href) {
    return new Promise((resolve, reject) => {
      if (document.querySelector(`link[href="${href}"]`)) {
        resolve(null);
        return;
      }
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = href;
      link.onload = resolve;
      link.onerror = reject;
      document.head.appendChild(link);
    });
  }

})();
