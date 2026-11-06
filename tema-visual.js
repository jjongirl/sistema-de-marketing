/* ============================================================
   TEMA VISUAL — painel "Aparência"
   ------------------------------------------------------------
   Só aparência: guarda a escolha neste navegador (localStorage)
   e não toca em tarefas, pautas, login nem no Firebase.
   Para o modo claro/escuro usa a função toggleTheme() que já
   existe no sistema.
============================================================ */
(function () {
  var CHAVE = 'impresulVisual';
  var root = document.documentElement;

  // mini = [menu, fundo, card destaque 1, card destaque 2] para a miniatura do painel
  // ref = usa o layout da referência (saudação gigante, menu colorido, cards em destaque)
  var ESTILOS = {
    institucional: { nome: 'Azul institucional', desc: 'A referência do vídeo', ref: true, menu: 'dark', mini: ['linear-gradient(#22339a,#141f63)', '#ECEAE3', 'linear-gradient(160deg,#2a3ca6,#121c5c)', 'linear-gradient(160deg,#fff,#c3d3f5)'] },
    cmyk:          { nome: 'Impresul CMYK',      desc: 'Cores da marca',        ref: true, menu: 'dark', mini: ['#132957', '#EEF1F6', 'linear-gradient(150deg,#21315F,#0B1A3D)', 'linear-gradient(90deg,#009FE3 33%,#E6007E 33% 66%,#FFED00 66%)'] },
    floresta:      { nome: 'Verde floresta',     desc: 'Calmo e natural',       ref: true, menu: 'dark', mini: ['linear-gradient(#26633F,#133722)', '#ECEEE6', 'linear-gradient(160deg,#2C7049,#123320)', 'linear-gradient(160deg,#fff,#cfe4bf)'] },
    vinho:         { nome: 'Vinho elegante',     desc: 'Sofisticado, com serifa', ref: true, menu: 'dark', mini: ['linear-gradient(#8C2747,#4A0F22)', '#F2ECE8', 'linear-gradient(160deg,#962A4C,#4A0F22)', 'linear-gradient(160deg,#fff,#efc8d1)'] },
    aurora:        { nome: 'Aurora',             desc: 'Vidro e degradê',       ref: true, menu: 'dark', mini: ['#2A2257', 'linear-gradient(135deg,#E3D9FF,#FFDDEB,#D3F1FF)', 'linear-gradient(140deg,#6D4AFF,#E8569A)', 'rgba(255,255,255,.75)'] },
    grafite:       { nome: 'Noite grafite',      desc: 'Escuro + verde-limão',  ref: true, menu: 'dark', mini: ['#0D0E11', '#16171C', '#C8F53A', '#2A2C33'] },
    bento:         { nome: 'Bento suave',        desc: 'Pastéis e cantos redondos', ref: true, menu: 'dark', mini: ['#231F1C', '#F3EEE8', '#DCD2FF', '#CDEBD8'] },
    papel:         { nome: 'Papel minimalista',  desc: 'Limpo e editorial',     ref: false, menu: null, mini: ['#FAFAF8', '#FAFAF8', '#FFFFFF', '#E2531C'] },
    original:      { nome: 'Original',           desc: 'Visual de antes',       ref: false, menu: null, mini: ['#161B22', '#0D1117', '#161B22', '#009FE3'] }
  };

  // Layouts = estrutura da tela (onde fica o menu). Combinam com qualquer paleta.
  var ESTRUTURAS = {
    lateral:   { nome: 'Menu lateral',  desc: 'Barra fixa à esquerda' },
    flutuante: { nome: 'Menu flutuante', desc: 'Barra solta, com respiro' },
    compacto:  { nome: 'Só ícones',     desc: 'Abre ao passar o mouse' },
    topo:      { nome: 'Menu no topo',  desc: 'Tela inteira p/ conteúdo' }
  };

  var CAMPOS = [
    { id: 'accent', nome: 'Cor de destaque', dica: 'Botões, links, item ativo' },
    { id: 'fundo',  nome: 'Fundo',           dica: 'Atrás de tudo' },
    { id: 'cards',  nome: 'Cards',           dica: 'Caixas de conteúdo' },
    { id: 'menu',   nome: 'Menu lateral',    dica: 'Barra da esquerda' },
    { id: 'texto',  nome: 'Texto',           dica: 'Cor principal das letras' }
  ];

  var PROPS_CUSTOM = ['--accent-blue', '--text-accent', '--on-accent', '--bg-base', '--bg-surface', '--bg-elevated',
    '--bg-card', '--sb-bg', '--sb-solid', '--sb-active-fg', '--text-primary', '--text-secondary', '--text-muted',
    '--radius-md', '--radius-lg', '--radius-xl'];

  function ler() {
    try { var s = JSON.parse(localStorage.getItem(CHAVE)); if (s && typeof s === 'object') return s; } catch (e) {}
    return {};
  }
  var estado = ler();
  var primeiraVez = !estado.estilo;
  // estilo padrão: o da referência (Azul institucional)
  estado.estilo = ESTILOS[estado.estilo] ? estado.estilo : 'institucional';
  estado.custom = estado.custom || { dark: {}, light: {} };
  estado.custom.dark = estado.custom.dark || {};
  estado.custom.light = estado.custom.light || {};

  function salvar() { try { localStorage.setItem(CHAVE, JSON.stringify(estado)); } catch (e) {} }
  function modo() { return root.getAttribute('data-theme') === 'light' ? 'light' : 'dark'; }

  function lum(hex) {
    var h = hex.replace('#', '');
    if (h.length === 3) h = h.split('').map(function (c) { return c + c; }).join('');
    var rgb = [0, 2, 4].map(function (i) {
      var c = parseInt(h.substr(i, 2), 16) / 255;
      return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2];
  }

  function aplicar() {
    var m = modo();
    var est = ESTILOS[estado.estilo];
    var c = estado.custom[m];

    if (estado.estilo === 'original') root.removeAttribute('data-estilo');
    else root.setAttribute('data-estilo', estado.estilo);
    if (est.ref) root.setAttribute('data-layout', 'ref'); else root.removeAttribute('data-layout');

    PROPS_CUSTOM.forEach(function (p) { root.style.removeProperty(p); });

    if (c.accent) {
      root.style.setProperty('--accent-blue', c.accent);
      root.style.setProperty('--text-accent', c.accent);
      root.style.setProperty('--on-accent', lum(c.accent) > 0.45 ? '#111111' : '#ffffff');
    }
    if (c.fundo) {
      root.style.setProperty('--bg-base', c.fundo);
      root.style.setProperty('--bg-surface', 'color-mix(in srgb, ' + c.fundo + ' 65%, ' + (c.cards || 'var(--bg-card)') + ')');
      root.style.setProperty('--bg-elevated', 'color-mix(in srgb, ' + c.fundo + ' 50%, ' + (c.cards || 'var(--bg-card)') + ')');
    }
    if (c.cards) root.style.setProperty('--bg-card', c.cards);
    if (c.texto) {
      root.style.setProperty('--text-primary', c.texto);
      root.style.setProperty('--text-secondary', 'color-mix(in srgb, ' + c.texto + ' 70%, transparent)');
      root.style.setProperty('--text-muted', 'color-mix(in srgb, ' + c.texto + ' 45%, transparent)');
    }

    // menu lateral: cor + contraste automático do texto
    var sb = null;
    if (c.menu) {
      root.style.setProperty('--sb-bg', c.menu);
      root.style.setProperty('--sb-solid', c.menu);
      sb = lum(c.menu) < 0.35 ? 'dark' : 'light';
      root.style.setProperty('--sb-active-fg', sb === 'dark' ? '#ffffff' : 'var(--accent-blue)');
    } else if (est.menu) {
      sb = typeof est.menu === 'string' ? est.menu : est.menu[m];
    }
    if (sb) root.setAttribute('data-sb', sb); else root.removeAttribute('data-sb');

    root.removeAttribute('data-retos');
    if (estado.cantos !== undefined && estado.cantos !== null && estado.cantos !== '') {
      var r = Number(estado.cantos);
      root.style.setProperty('--radius-md', Math.round(r * 0.6) + 'px');
      root.style.setProperty('--radius-lg', r + 'px');
      root.style.setProperty('--radius-xl', Math.round(r * 1.3) + 'px');
      if (r === 0) root.setAttribute('data-retos', '');
    }

    // layout (estrutura da tela) — independente da paleta
    if (!ESTRUTURAS[estado.estrutura]) estado.estrutura = 'lateral';
    if (estado.estrutura === 'lateral') root.removeAttribute('data-estrutura');
    else root.setAttribute('data-estrutura', estado.estrutura);
    if (typeof ajustarSaudacao === 'function') ajustarSaudacao();
  }

  // aplica já (antes da página desenhar) e de novo se o modo claro/escuro mudar
  aplicar();
  new MutationObserver(function () {
    aplicar(); sincronizarPainel();
    // Na primeira vez, a referência é clara: se o sistema abrir no escuro, troca uma vez para o claro.
    // Depois disso, o botão de lua volta a mandar normalmente.
    if (primeiraVez) {
      primeiraVez = false; salvar();
      if (modo() === 'dark' && typeof window.toggleTheme === 'function') setTimeout(window.toggleTheme, 0);
    }
  }).observe(root, { attributes: true, attributeFilter: ['data-theme'] });

  // ---------------- saudação "Boa tarde, Fulana." ----------------
  // Só muda o texto exibido; usa o nome que o sistema já mostra no menu.
  function ajustarSaudacao() {
    var g = document.getElementById('dashGreeting');
    if (!g) return;
    // se o texto atual não é o que nós escrevemos, foi o sistema que acabou de escrever: guarda como original
    if (g.textContent !== g.getAttribute('data-formatado')) g.setAttribute('data-original', g.textContent);
    var bruto = g.getAttribute('data-original');
    if (!ESTILOS[estado.estilo].ref) {
      if (g.textContent !== bruto) { g.removeAttribute('data-formatado'); g.textContent = bruto; }
      return;
    }
    var base = bruto.replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/gu, '').trim().replace(/[.!]+$/, '');
    var nomeEl = document.getElementById('userNameSidebar');
    var nome = nomeEl ? nomeEl.textContent.trim() : '';
    var primeiro = nome && !/^grupo impresul$/i.test(nome) ? nome.split(/\s+/)[0] : '';
    var novo = base + (primeiro ? ', ' + primeiro : '') + '.';
    if (g.textContent !== novo) { g.setAttribute('data-formatado', novo); g.textContent = novo; }
  }
  function vigiarSaudacao() {
    var g = document.getElementById('dashGreeting');
    var n = document.getElementById('userNameSidebar');
    var obs = new MutationObserver(function () { ajustarSaudacao(); });
    if (g) obs.observe(g, { childList: true, characterData: true, subtree: true });
    if (n) obs.observe(n, { childList: true, characterData: true, subtree: true });
    ajustarSaudacao();
  }

  // ---------------- painel ----------------
  var painel;

  function corAtual(id) {
    var c = estado.custom[modo()][id];
    if (c) return c;
    var cs = getComputedStyle(root);
    var mapa = { accent: '--accent-blue', fundo: '--bg-base', cards: '--bg-card', texto: '--text-primary' };
    var v = '';
    if (id === 'menu') {
      var sbEl = document.querySelector('.sidebar');
      v = sbEl ? getComputedStyle(sbEl).backgroundColor : '';
      if (!v || v === 'rgba(0, 0, 0, 0)') {
        var bg = sbEl ? getComputedStyle(sbEl).backgroundImage : '';
        var mt = bg && bg.match(/rgba?\([^)]+\)/);
        v = mt ? mt[0] : cs.getPropertyValue('--bg-surface');
      }
    } else v = cs.getPropertyValue(mapa[id]);
    return paraHex(v.trim());
  }
  function paraHex(v) {
    if (/^#[0-9a-f]{6}$/i.test(v)) return v;
    if (/^#[0-9a-f]{3}$/i.test(v)) return '#' + v.slice(1).split('').map(function (x) { return x + x; }).join('');
    var m = v.match(/(\d+)[,\s]+(\d+)[,\s]+(\d+)/);
    if (m) return '#' + [m[1], m[2], m[3]].map(function (n) { return ('0' + Number(n).toString(16)).slice(-2); }).join('');
    return '#888888';
  }

  function montarPainel() {
    painel = document.createElement('div');
    painel.className = 'tv-painel';
    painel.id = 'tvPainel';

    var estilosHtml = Object.keys(ESTILOS).map(function (k) {
      var e = ESTILOS[k];
      var mi = e.mini;
      return '<button class="tv-estilo" data-estilo="' + k + '">' +
        '<div class="tv-mini"><div class="m" style="background:' + mi[0] + '"></div>' +
        '<div class="f" style="background:' + mi[1] + '"><div class="c1" style="background:' + mi[2] + '"></div>' +
        '<div class="c2" style="background:' + mi[3] + '"></div></div></div>' +
        '<div class="tv-txt"><b>' + e.nome + '</b><span>' + e.desc + '</span></div></button>';
    }).join('');

    var coresHtml = CAMPOS.map(function (f) {
      return '<div class="tv-cor"><label>' + f.nome + '<small>' + f.dica + '</small></label>' +
        '<button class="tv-limpar" data-limpar="' + f.id + '" title="Voltar ao padrão do estilo">✕</button>' +
        '<input type="color" data-cor="' + f.id + '"></div>';
    }).join('');

    painel.innerHTML =
      '<h4>Aparência <button data-fechar title="Fechar">✕</button></h4>' +
      '<div class="tv-sub">Muda só o visual. Fica salvo neste navegador.</div>' +
      '<div class="tv-sec">Layout</div><div class="tv-estruturas">' + Object.keys(ESTRUTURAS).map(function (k) {
        return '<button class="tv-estrutura" data-estrutura="' + k + '"><div class="tv-lay tv-lay-' + k + '"><i class="m"></i><i class="a"></i><i class="b"></i><i class="c"></i></div>' +
          '<b>' + ESTRUTURAS[k].nome + '</b><span>' + ESTRUTURAS[k].desc + '</span></button>';
      }).join('') + '</div>' +
      '<div class="tv-sec">Cores</div><div class="tv-estilos">' + estilosHtml + '</div>' +
      '<div class="tv-sec">Modo</div><div class="tv-modo"><button data-modo="light">☀ Claro</button><button data-modo="dark">☾ Escuro</button></div>' +
      '<div class="tv-sec">Personalizar cores <span style="text-transform:none;letter-spacing:0;font-weight:500" id="tvModoNome"></span></div>' + coresHtml +
      '<div class="tv-range"><label>Cantos arredondados <small id="tvCantosVal" style="color:#999;font-weight:500"></small></label><input type="range" min="0" max="32" step="1" id="tvCantos"></div>' +
      '<div class="tv-acoes"><button data-reset-cores>Limpar minhas cores</button><button data-reset-tudo>Voltar ao original</button></div>' +
      '<div class="tv-nota">Dica: as cores personalizadas valem para o modo (claro ou escuro) que estiver ativo.</div>';

    document.body.appendChild(painel);

    painel.addEventListener('click', function (ev) {
      var t = ev.target.closest('button');
      if (!t) return;
      if (t.hasAttribute('data-fechar')) return fechar();
      if (t.dataset.estrutura) { estado.estrutura = t.dataset.estrutura; salvar(); aplicar(); redesenhar(); sincronizarPainel(); }
      if (t.dataset.estilo) { estado.estilo = t.dataset.estilo; salvar(); aplicar(); redesenhar(); sincronizarPainel(); }
      if (t.dataset.modo && t.dataset.modo !== modo() && typeof window.toggleTheme === 'function') window.toggleTheme();
      if (t.dataset.limpar) { delete estado.custom[modo()][t.dataset.limpar]; salvar(); aplicar(); redesenhar(); sincronizarPainel(); }
      if (t.hasAttribute('data-reset-cores')) { estado.custom[modo()] = {}; salvar(); aplicar(); redesenhar(); sincronizarPainel(); }
      if (t.hasAttribute('data-reset-tudo')) {
        estado = { estilo: 'original', custom: { dark: {}, light: {} } };
        salvar(); aplicar(); redesenhar(); sincronizarPainel();
      }
    });
    painel.addEventListener('input', function (ev) {
      var t = ev.target;
      if (t.dataset.cor) { estado.custom[modo()][t.dataset.cor] = t.value; salvar(); aplicar(); marcarLimpar(); }
      if (t.id === 'tvCantos') {
        estado.cantos = t.value; salvar(); aplicar();
        painel.querySelector('#tvCantosVal').textContent = t.value === '0' ? '· retos' : '· ' + t.value + 'px';
      }
    });
    painel.addEventListener('change', function (ev) { if (ev.target.dataset.cor) redesenhar(); });

    document.addEventListener('mousedown', function (ev) {
      if (painel.classList.contains('aberto') && !painel.contains(ev.target) && !ev.target.closest('.tv-btn')) fechar();
    });
    document.addEventListener('keydown', function (ev) { if (ev.key === 'Escape') fechar(); });
  }

  function marcarLimpar() {
    if (!painel) return;
    var c = estado.custom[modo()];
    painel.querySelectorAll('[data-limpar]').forEach(function (b) { b.hidden = !c[b.dataset.limpar]; });
  }

  function sincronizarPainel() {
    if (!painel) return;
    painel.querySelectorAll('.tv-estilo').forEach(function (b) { b.classList.toggle('on', b.dataset.estilo === estado.estilo); });
    painel.querySelectorAll('[data-modo]').forEach(function (b) { b.classList.toggle('on', b.dataset.modo === modo()); });
    painel.querySelector('#tvModoNome').textContent = '· modo ' + (modo() === 'light' ? 'claro' : 'escuro');
    // espera o navegador aplicar o CSS antes de ler as cores atuais
    requestAnimationFrame(function () {
      painel.querySelectorAll('[data-cor]').forEach(function (inp) { inp.value = corAtual(inp.dataset.cor); });
      var temCantos = estado.cantos !== undefined && estado.cantos !== null && estado.cantos !== '';
      var r = temCantos ? Number(estado.cantos) : (parseInt(getComputedStyle(root).getPropertyValue('--radius-lg'), 10) || 14);
      painel.querySelector('#tvCantos').value = r;
      painel.querySelector('#tvCantosVal').textContent = temCantos ? (r === 0 ? '· retos' : '· ' + r + 'px') : '';
      painel.querySelectorAll('.tv-estrutura').forEach(function (b) { b.classList.toggle('on', b.dataset.estrutura === estado.estrutura); });
      marcarLimpar();
    });
  }

  function abrir() { painel.classList.add('aberto'); sincronizarPainel(); }
  function fechar() { if (painel) painel.classList.remove('aberto'); }

  // gráficos do painel inicial são redesenhados para pegar as novas cores
  function redesenhar() {
    try {
      /* global currentPage, renderDashCharts */
      // redesenha a aba aberta (qualquer uma) para os gráficos pegarem as cores novas
      if (typeof currentPage !== 'undefined' && typeof renderPage === 'function') setTimeout(function () { renderPage(currentPage); }, 60);
    } catch (e) {}
  }

  function montarBotao() {
    var alvo = document.querySelector('.sidebar-bottom .theme-toggle');
    if (!alvo) return;
    var b = document.createElement('button');
    b.className = 'tv-btn';
    b.title = 'Aparência: estilos e cores';
    b.innerHTML = '<i class="fa-solid fa-palette"></i>';
    b.addEventListener('click', function () { painel.classList.contains('aberto') ? fechar() : abrir(); });
    alvo.parentNode.insertBefore(b, alvo);
  }

  window.abrirAparencia = function () { abrir(); };

  // ---------------- vale para TODAS as abas ----------------
  // O CSS original do sistema tem cantos com tamanho fixo (ex.: 8px) e o azul
  // antigo (#009FE3) escrito direto em vários lugares. Aqui lemos esse CSS uma
  // vez e criamos uma cópia que usa as variáveis do tema, assim o layout,
  // os cantos e a cor de destaque escolhidos valem em todas as abas.
  // No visual Original o resultado é idêntico ao de antes.
  var AZUL_RGBA = /rgba\(\s*0\s*,\s*159\s*,\s*227\s*,\s*([\d.]+)\s*\)/gi;
  var AZUL_HEX = /#009fe3\b/gi;
  var PROPS_RAIO = ['border-radius', 'border-top-left-radius', 'border-top-right-radius', 'border-bottom-left-radius', 'border-bottom-right-radius'];

  function converterRaio(v) {
    if (!/\d+px/.test(v) || /var\(|%/.test(v)) return null;
    return v.replace(/(\d+(?:\.\d+)?)px/g, function (_, n) {
      n = Number(n);
      if (n === 0) return '0px';
      if (n >= 50) return 'var(--pill)';
      return 'calc(var(--radius-lg) * ' + (n / 14).toFixed(3) + ')';
    });
  }
  function converterCor(v) {
    if (!AZUL_RGBA.test(v) && !AZUL_HEX.test(v)) { AZUL_RGBA.lastIndex = 0; AZUL_HEX.lastIndex = 0; return null; }
    AZUL_RGBA.lastIndex = 0; AZUL_HEX.lastIndex = 0;
    return v.replace(AZUL_RGBA, function (_, a) { return 'color-mix(in srgb, var(--accent-blue) ' + Math.round(Number(a) * 100) + '%, transparent)'; })
            .replace(AZUL_HEX, 'var(--accent-blue)');
  }
  function prefixar(sel) {
    return sel.split(',').map(function (s) { return 'html ' + s.trim(); }).join(', ');
  }
  function converterRegras(regras) {
    var out = '';
    for (var i = 0; i < regras.length; i++) {
      var r = regras[i];
      if (r.cssRules && r.media) { // @media
        var dentro = converterRegras(r.cssRules);
        if (dentro) out += '@media ' + r.media.mediaText + '{' + dentro + '}';
        continue;
      }
      if (!r.selectorText || !r.style) continue;
      if (/:root|^\s*html|\[data-theme/.test(r.selectorText)) continue;
      // selos de empresa (Click = ciano da marca) não são "cor de destaque": ficam como estão
      var ehMarca = /\.click\b|click\b/i.test(r.selectorText);
      var decl = '';
      for (var j = 0; j < r.style.length; j++) {
        var p = r.style[j], v = r.style.getPropertyValue(p), nv = null;
        if (PROPS_RAIO.indexOf(p) !== -1) nv = converterRaio(v);
        else if (!ehMarca && /^(background|color|border|box-shadow|outline|fill|stroke|text-decoration)/.test(p)) nv = converterCor(v);
        if (nv && nv !== v) decl += p + ':' + nv + ';';
      }
      if (decl) out += prefixar(r.selectorText) + '{' + decl + '}';
    }
    return out;
  }
  function converterCssDoSistema() {
    if (document.getElementById('tvConvertido')) return;
    var link = document.querySelector('link[href*="tema-visual.css"]');
    var css = '';
    document.querySelectorAll('style').forEach(function (st) {
      if (st.id === 'tvConvertido' || !st.sheet) return;
      try { css += converterRegras(st.sheet.cssRules); } catch (e) {}
    });
    var el = document.createElement('style');
    el.id = 'tvConvertido';
    el.textContent = css;
    // entra ANTES do tema-visual.css, para as regras do tema continuarem mandando
    if (link && link.parentNode) link.parentNode.insertBefore(el, link);
    else document.head.appendChild(el);
  }

  // Gráficos: troca o azul antigo pela cor de destaque do tema
  function corDestaque(alfa) {
    var hex = paraHex(getComputedStyle(root).getPropertyValue('--accent-blue').trim());
    if (alfa === undefined) return hex;
    var n = parseInt(hex.slice(1), 16);
    return 'rgba(' + (n >> 16 & 255) + ',' + (n >> 8 & 255) + ',' + (n & 255) + ',' + alfa + ')';
  }
  function trocarCorGrafico(c) {
    if (Array.isArray(c)) return c.map(trocarCorGrafico);
    if (typeof c !== 'string') return c;
    if (/^#009fe3$/i.test(c)) return corDestaque();
    var m = c.match(/^rgba\(\s*0\s*,\s*159\s*,\s*227\s*,\s*([\d.]+)\s*\)$/i);
    if (m) return corDestaque(m[1]);
    return c;
  }
  function registrarGraficos() {
    if (!window.Chart || !Chart.register || registrarGraficos.ok) return;
    registrarGraficos.ok = true;
    Chart.register({
      id: 'tvCores',
      beforeUpdate: function (chart) {
        (chart.data.datasets || []).forEach(function (ds) {
          if (!ds.__tvOriginal) ds.__tvOriginal = { bg: ds.backgroundColor, bd: ds.borderColor, pt: ds.pointBackgroundColor };
          ds.backgroundColor = trocarCorGrafico(ds.__tvOriginal.bg);
          ds.borderColor = trocarCorGrafico(ds.__tvOriginal.bd);
          if (ds.__tvOriginal.pt !== undefined) ds.pointBackgroundColor = trocarCorGrafico(ds.__tvOriginal.pt);
        });
      }
    });
  }
  registrarGraficos();

  function iniciar() { converterCssDoSistema(); registrarGraficos(); montarPainel(); montarBotao(); sincronizarPainel(); vigiarSaudacao(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar);
  else iniciar();
})();
