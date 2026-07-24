// @chimerai component=WidgetLoader version=1.0
// Async loader for ChimerAI Chat Widget
// Usage: <script src="https://your-app.com/widget/loader.js" data-api-key="sk_live_..."></script>
(function() {
  var script = document.currentScript;
  var src = script.src.replace('loader.js', 'chat.js');
  var s = document.createElement('script');
  s.src = src;
  s.onload = function() {
    // Auto-mount if data attributes are on the loader script
    var apiKey = script.getAttribute('data-api-key');
    if (apiKey) {
      var container = document.createElement('div');
      container.style.position = 'fixed';
      container.style.bottom = '20px';
      container.style.right = '20px';
      container.style.width = '380px';
      container.style.height = '520px';
      container.style.zIndex = '99999';
      document.body.appendChild(container);
      window.ChimerAI.mount(container, {
        apiKey: apiKey,
        theme: script.getAttribute('data-theme') || 'auto',
        model: script.getAttribute('data-model') || '',
        title: script.getAttribute('data-title') || 'AI Chat',
        endpoint: script.getAttribute('data-endpoint') || '',
      });
    }
  };
  document.head.appendChild(s);
})();
