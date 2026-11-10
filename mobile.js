/* ============================================================
   AJUSTES PARA CELULAR + APP INSTALÁVEL (PWA)
   - menu lateral fecha ao escolher uma aba ou tocar fora
   - botão de lupa abre a busca do topo
   - registra o service worker (sw.js)
============================================================ */
(function () {
  var MOBILE = window.matchMedia('(max-width:768px)');

  function sidebar() { return document.getElementById('sidebar'); }
  function setMenu(aberto) {
    var sb = sidebar(); if (!sb) return;
    sb.classList.toggle('mobile-open', aberto);
    document.body.classList.toggle('menu-aberto', aberto);
  }

  document.addEventListener('DOMContentLoaded', function () {
    // substitui o toggle original (definido mais abaixo no index.html)
    // para também controlar o véu escuro
    window.toggleSidebar = function () {
      var sb = sidebar(); if (!sb) return;
      setMenu(!sb.classList.contains('mobile-open'));
    };

    // véu atrás do menu
    var veu = document.createElement('div');
    veu.className = 'mob-veu';
    veu.addEventListener('click', function () { setMenu(false); });
    document.body.appendChild(veu);

    // fecha o menu ao escolher qualquer item
    var sb = sidebar();
    if (sb) sb.addEventListener('click', function (e) {
      if (MOBILE.matches && e.target.closest('.nav-item')) setMenu(false);
    });

    // botão de lupa no topo (só aparece no celular)
    var topbar = document.querySelector('.topbar');
    var acoes = topbar && topbar.querySelector('.topbar-actions');
    var busca = topbar && topbar.querySelector(':scope > .search-bar');
    if (acoes && busca) {
      var btn = document.createElement('button');
      btn.className = 'icon-btn mob-busca-btn';
      btn.type = 'button';
      btn.title = 'Pesquisar';
      btn.innerHTML = '<i class="fa-solid fa-magnifying-glass"></i>';
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        topbar.classList.add('busca-aberta');
        var inp = busca.querySelector('input'); if (inp) inp.focus();
      });
      acoes.insertBefore(btn, acoes.firstChild);
      var inp = busca.querySelector('input');
      if (inp) inp.addEventListener('blur', function () {
        setTimeout(function () { topbar.classList.remove('busca-aberta'); }, 150);
      });
    }
  });

  // ao girar/alargar a tela, garante que o menu não fique preso aberto
  MOBILE.addEventListener && MOBILE.addEventListener('change', function (e) { if (!e.matches) setMenu(false); });

  // service worker (app instalável)
  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('sw.js').catch(function () {});
    });
  }
})();
