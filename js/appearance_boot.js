// Apply the saved appearance before first paint (see js/appearance.js). A classic script that sits after the stylesheet links,
// so a Standard page never flashes the pixel styling.
(function () {
  try {
    var v = localStorage.getItem('loreos_appearance') === 'standard' ? 'standard' : 'pixel';
    document.documentElement.setAttribute('data-appearance', v);
    if (v === 'standard') {
      var links = document.querySelectorAll('link[data-pixel-css]');
      for (var i = 0; i < links.length; i++) links[i].media = 'not all';
    }
  } catch (e) { /* storage blocked: stay on pixel */ }
})();
