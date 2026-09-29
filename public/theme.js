(function () {
  var t = 'dark';
  try { t = localStorage.getItem('theme') || (matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark'); } catch (e) {}
  document.documentElement.dataset.theme = t;
  addEventListener('DOMContentLoaded', function () {
    var b = document.getElementById('theme'), root = document.documentElement;
    function label() { b.textContent = root.dataset.theme === 'dark' ? 'Light mode' : 'Dark mode'; }
    label();
    b.onclick = function () {
      var n = root.dataset.theme === 'dark' ? 'light' : 'dark';
      root.dataset.theme = n; try { localStorage.setItem('theme', n); } catch (e) {} label();
    };
  });
})();
