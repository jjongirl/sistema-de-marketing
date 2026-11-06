/* ============================================================
   CADERNO PESSOAL (aba "Meu caderno" dentro do Meu Perfil)
   ------------------------------------------------------------
   Estilo Notion: pastas (com subpastas) e páginas. Cada página é
   uma lista de blocos: texto, título, lista, tarefa, destaque,
   divisor e imagem.

   Atalhos ao digitar no começo de um bloco:
     "# "  → título        "- "  → lista        "[] " → tarefa
     "> "  → destaque      "---" → divisor
   Enter cria um bloco novo · Shift+Enter quebra a linha
   Backspace no começo volta o bloco para texto / junta com o de cima
   Ctrl+V com imagem (ou arrastar um arquivo) adiciona a imagem

   Onde fica salvo:
     Firebase → teams/impresul/caderno      (pastas e páginas)
                teams/impresul/cadernoImgs  (imagens, uma por documento)
     Cada documento tem "dono" = e-mail de quem criou, e o sistema só
     mostra o caderno da própria pessoa. Sem Firebase, fica no navegador.
   Não passa pelo Registro de Alterações (é pessoal).
============================================================ */
/* global COL, fdb, CURRENT_USER, showToast, genId */
(function () {
  var S = {
    email: '', itens: {}, imgs: {}, carregado: false, aberto: null, vista: 'pagina',
    abertas: {}, busca: '', sujo: {}, timers: {}, unsub: [], root: null, salvando: 0, erro: ''
  };
  var EMOJIS = ['📄', '📝', '📌', '✅', '💡', '🎯', '📅', '📷', '🎬', '🎨', '🧠', '⭐', '🔥', '💬', '📊', '🛒', '✏️', '📚', '🗂️', '📁', '🚀', '❤️', '⚠️', '🔒'];
  var TIPOS_TXT = { p: 1, h: 1, l: 1, t: 1, q: 1 };
  var PH = { p: 'Escreva algo, ou use # - [] > no começo...', h: 'Título', l: 'Item da lista', t: 'Tarefa', q: 'Destaque' };
  var LS = 'impresulCaderno:';

  // ---------- utilidades ----------
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function norm(s) { return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim(); }
  function novoId() { return typeof genId === 'function' ? genId() : Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
  function fireOk() { try { return typeof fdb !== 'undefined' && !!fdb && typeof COL === 'function'; } catch (e) { return false; } }
  function aviso(m, t) { if (typeof showToast === 'function') showToast(m, t || 'success'); }
  function quando(ms) {
    if (!ms) return '';
    var min = Math.round((Date.now() - ms) / 60000);
    if (min < 1) return 'agora mesmo';
    if (min < 60) return 'há ' + min + ' min';
    var d = new Date(ms);
    if (d.toDateString() === new Date().toDateString()) return 'hoje às ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    return d.toLocaleDateString('pt-BR') + ' às ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  }
  function filhos(pai) {
    return Object.keys(S.itens).map(function (k) { return S.itens[k]; })
      .filter(function (i) { return (i.pai || null) === (pai || null); })
      .sort(function (a, b) {
        if (a.tipo !== b.tipo) return a.tipo === 'pasta' ? -1 : 1;
        return (a.ordem || 0) - (b.ordem || 0) || String(a.nome).localeCompare(String(b.nome));
      });
  }
  function caminho(id) {
    var out = [], it = S.itens[id], guarda = 0;
    while (it && it.pai && S.itens[it.pai] && guarda++ < 50) { it = S.itens[it.pai]; out.unshift(it); }
    return out;
  }
  function descendentes(id) {
    var out = [];
    filhos(id).forEach(function (f) { out.push(f.id); out = out.concat(descendentes(f.id)); });
    return out;
  }

  // ---------- armazenamento ----------
  function lsGravar() {
    if (!S.email) return;
    try {
      var dados = { itens: S.itens };
      if (!fireOk()) dados.imgs = S.imgs;  // sem Firebase as imagens também ficam no navegador
      localStorage.setItem(LS + S.email, JSON.stringify(dados));
    } catch (e) { /* cota cheia: segue só com o Firebase */ }
  }
  function lsLer() {
    try {
      var d = JSON.parse(localStorage.getItem(LS + S.email) || 'null');
      if (d && d.itens) S.itens = d.itens;
      if (d && d.imgs) S.imgs = d.imgs;
    } catch (e) {}
  }

  function conectar() {
    var u = (typeof CURRENT_USER !== 'undefined' && CURRENT_USER) || null;
    var email = u && u.email ? norm(u.email) : '';
    if (!email) return false;
    if (S.email === email) return true;
    S.unsub.forEach(function (f) { try { f(); } catch (e) {} });
    S.unsub = []; S.itens = {}; S.imgs = {}; S.carregado = false; S.aberto = null;
    S.email = email;
    lsLer();
    if (Object.keys(S.itens).length) S.carregado = true; // mostra o que já estava no navegador enquanto o Firebase responde
    if (!fireOk()) { S.carregado = true; boasVindas(); return true; }
    try {
      S.unsub.push(COL('caderno').where('dono', '==', email).onSnapshot(function (snap) {
        var novos = {};
        snap.docs.forEach(function (d) { var x = d.data(); if (x && x.id) novos[x.id] = x; });
        // o que ainda não foi enviado continua valendo a versão local
        Object.keys(S.sujo).forEach(function (id) { if (S.itens[id]) novos[id] = S.itens[id]; });
        var mudouAberto = S.aberto && JSON.stringify(novos[S.aberto]) !== JSON.stringify(S.itens[S.aberto]);
        S.itens = novos; S.carregado = true; S.erro = '';
        lsGravar();
        boasVindas();
        desenharArvore();
        if (!S.aberto || !S.itens[S.aberto]) escolherInicial();
        // só redesenha a página aberta se a mudança veio de outro lugar e ninguém está digitando nela
        if (mudouAberto && !S.sujo[S.aberto] && !editandoAgora()) desenharEditor();
        else if (!document.querySelector('.cd-editor .cd-blocos')) desenharEditor();
        pintarStatus();
      }, function (err) { S.erro = err.message; S.carregado = true; pintarStatus(); desenharTudo(); }));
      S.unsub.push(COL('cadernoImgs').where('dono', '==', email).onSnapshot(function (snap) {
        var antes = Object.keys(S.imgs).length;
        snap.docs.forEach(function (d) { var x = d.data(); if (x && x.id) S.imgs[x.id] = x.data; });
        if (Object.keys(S.imgs).length !== antes) {
          document.querySelectorAll('.cd-editor img[data-img]').forEach(function (im) {
            var src = S.imgs[im.dataset.img]; if (src && im.src !== src) im.src = src;
          });
          document.querySelectorAll('.cd-editor [data-img-espera]').forEach(function (ph) {
            var src = S.imgs[ph.dataset.imgEspera]; if (!src) return;
            var im = document.createElement('img'); im.dataset.img = ph.dataset.imgEspera; im.src = src; im.alt = '';
            ph.replaceWith(im);
          });
        }
      }, function (err) { console.warn('[caderno] imagens:', err.message); }));
    } catch (e) { S.erro = e.message; S.carregado = true; }
    return true;
  }

  function gravarAgora(id) {
    var it = S.itens[id];
    clearTimeout(S.timers[id]);
    if (!it) return;
    it.__updatedAt = Date.now();
    lsGravar();
    if (!fireOk()) { delete S.sujo[id]; pintarStatus(); return; }
    S.salvando++; pintarStatus();
    COL('caderno').doc(id).set(JSON.parse(JSON.stringify(it)))
      .then(function () { delete S.sujo[id]; S.erro = ''; })
      .catch(function (e) {
        S.erro = /exceeds|size|1 ?MB|bytes/i.test(e.message) ? 'Esta página passou do limite de tamanho. Divida em duas páginas.' : e.message;
        aviso('Caderno: não consegui salvar (' + S.erro + ')', 'error');
      })
      .then(function () { S.salvando--; pintarStatus(); });
  }
  function salvarDepois(id) {
    S.sujo[id] = true;
    clearTimeout(S.timers[id]);
    S.timers[id] = setTimeout(function () { gravarAgora(id); }, 700);
    pintarStatus();
  }
  function salvarPendentes() { Object.keys(S.sujo).forEach(gravarAgora); }
  window.addEventListener('beforeunload', salvarPendentes);
  document.addEventListener('visibilitychange', function () { if (document.hidden) salvarPendentes(); });

  function apagarDoBanco(ids) {
    ids.forEach(function (id) {
      var it = S.itens[id];
      (it && it.blocos || []).forEach(function (b) {
        if (b.t === 'img' && b.img) {
          delete S.imgs[b.img];
          if (fireOk()) COL('cadernoImgs').doc(b.img).delete().catch(function () {});
        }
      });
      delete S.itens[id]; delete S.sujo[id]; clearTimeout(S.timers[id]);
      if (fireOk()) COL('caderno').doc(id).delete().catch(function (e) { aviso('Não consegui excluir: ' + e.message, 'error'); });
    });
    lsGravar();
  }

  function criar(tipo, pai, extra) {
    var irmaos = filhos(pai);
    var it = Object.assign({
      id: novoId(), dono: S.email, tipo: tipo, pai: pai || null,
      nome: tipo === 'pasta' ? 'Nova pasta' : 'Sem título',
      icone: tipo === 'pasta' ? '📁' : '📄',
      ordem: (irmaos.length ? Math.max.apply(null, irmaos.map(function (i) { return i.ordem || 0; })) : 0) + 1,
      __createdAt: Date.now(), __updatedAt: Date.now()
    }, extra || {});
    if (tipo === 'pagina' && !it.blocos) it.blocos = [{ id: novoId(), t: 'p', v: '' }];
    S.itens[it.id] = it;
    if (pai) S.abertas[pai] = true;
    gravarAgora(it.id);
    return it;
  }

  function boasVindas() {
    if (!S.carregado || Object.keys(S.itens).length) return;
    var flag = 'impresulCadernoBoasVindas:' + S.email;
    try { if (localStorage.getItem(flag)) return; localStorage.setItem(flag, '1'); } catch (e) {}
    var pasta = criar('pasta', null, { nome: 'Minhas anotações', icone: '🗂️' });
    var b = function (t, v, ok) { return { id: novoId(), t: t, v: v, ok: !!ok }; };
    criar('pagina', pasta.id, {
      nome: 'Bem-vinda ao seu caderno', icone: '✨', blocos: [
        b('p', 'Este é o seu espaço para anotar o que precisar. Só você vê o seu caderno aqui no sistema.'),
        b('h', 'Atalhos para digitar'),
        b('l', '# e espaço → título'),
        b('l', '- e espaço → lista'),
        b('l', '[] e espaço → tarefa com caixinha'),
        b('l', '> e espaço → destaque'),
        b('l', '--- → linha divisória'),
        b('q', 'Cole uma imagem (Ctrl+V) ou arraste um arquivo para cá para colocar fotos na página.'),
        b('h', 'Organização'),
        b('l', 'Crie pastas e subpastas na coluna da esquerda.'),
        b('l', 'Arraste páginas e pastas para mudar de lugar.'),
        b('t', 'Experimente marcar esta tarefa'),
        b('t', 'Veja todas as suas tarefas em "Tarefas abertas"')
      ]
    });
  }

  function escolherInicial() {
    var paginas = Object.keys(S.itens).map(function (k) { return S.itens[k]; }).filter(function (i) { return i.tipo === 'pagina'; })
      .sort(function (a, b) { return (b.__updatedAt || 0) - (a.__updatedAt || 0); });
    S.aberto = paginas.length ? paginas[0].id : null;
    if (S.aberto) caminho(S.aberto).forEach(function (p) { S.abertas[p.id] = true; });
  }

  // ---------- imagens ----------
  function comprimir(arquivo, cb) {
    var leitor = new FileReader();
    leitor.onload = function () {
      var img = new Image();
      img.onload = function () {
        var max = 1400, w = img.width, h = img.height;
        if (w > max || h > max) { var r = Math.min(max / w, max / h); w = Math.round(w * r); h = Math.round(h * r); }
        var cv = document.createElement('canvas'); cv.width = w; cv.height = h;
        var cx = cv.getContext('2d'); cx.fillStyle = '#fff'; cx.fillRect(0, 0, w, h); cx.drawImage(img, 0, 0, w, h);
        var q = 0.82, url = cv.toDataURL('image/jpeg', q);
        while (url.length > 900000 && q > 0.35) { q -= 0.12; url = cv.toDataURL('image/jpeg', q); }
        if (url.length > 900000) { cv.width = Math.round(w * 0.6); cv.height = Math.round(h * 0.6); cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height); url = cv.toDataURL('image/jpeg', 0.7); }
        cb(url);
      };
      img.onerror = function () { aviso('Não consegui abrir essa imagem', 'error'); };
      img.src = leitor.result;
    };
    leitor.readAsDataURL(arquivo);
  }
  function guardarImagem(url) {
    var id = novoId();
    S.imgs[id] = url;
    if (fireOk()) {
      COL('cadernoImgs').doc(id).set({ id: id, dono: S.email, data: url, __createdAt: Date.now() })
        .catch(function (e) { aviso('Imagem não foi salva: ' + e.message, 'error'); });
    } else lsGravar();
    return id;
  }
  function inserirImagens(arquivos, depoisDe) {
    var pg = S.itens[S.aberto]; if (!pg) return;
    var lista = Array.prototype.filter.call(arquivos || [], function (f) { return /^image\//.test(f.type); });
    if (!lista.length) return;
    aviso('Adicionando ' + lista.length + ' imagem(ns)...', 'info');
    var pos = depoisDe ? pg.blocos.findIndex(function (b) { return b.id === depoisDe; }) + 1 : pg.blocos.length;
    var pendentes = lista.length, novos = new Array(lista.length);
    lista.forEach(function (f, i) {
      comprimir(f, function (url) {
        novos[i] = { id: novoId(), t: 'img', img: guardarImagem(url), v: '' };
        if (--pendentes === 0) {
          var fim = pg.blocos[pg.blocos.length - 1];
          pg.blocos.splice.apply(pg.blocos, [pos, 0].concat(novos.filter(Boolean)));
          // garante um bloco de texto depois da imagem para continuar escrevendo
          if (!fim || pos >= pg.blocos.length - novos.length) pg.blocos.push({ id: novoId(), t: 'p', v: '' });
          salvarDepois(pg.id); desenharBlocos();
        }
      });
    });
  }

  // ---------- cursor dentro do texto ----------
  function offsetCursor(el) {
    var s = window.getSelection(); if (!s.rangeCount) return 0;
    var r = s.getRangeAt(0); if (!el.contains(r.startContainer)) return 0;
    var pre = r.cloneRange(); pre.selectNodeContents(el); pre.setEnd(r.startContainer, r.startOffset);
    return pre.toString().length;
  }
  function selecaoVazia() { var s = window.getSelection(); return !s.rangeCount || s.getRangeAt(0).collapsed; }
  function porCursor(el, pos) {
    el.focus();
    var s = window.getSelection(), r = document.createRange(), resto = pos, achou = false;
    var w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, null);
    var n;
    while ((n = w.nextNode())) {
      if (resto <= n.length) { r.setStart(n, resto); achou = true; break; }
      resto -= n.length;
    }
    if (!achou) { r.selectNodeContents(el); r.collapse(false); }
    else r.collapse(true);
    s.removeAllRanges(); s.addRange(r);
  }
  function editavel(el) {
    try { el.contentEditable = 'plaintext-only'; } catch (e) { el.contentEditable = 'true'; }
    if (el.contentEditable !== 'plaintext-only') el.contentEditable = 'true';
  }
  function editandoAgora() { var a = document.activeElement; return !!(a && a.closest && a.closest('.cd-editor')); }
  function inserirTexto(t) {
    if (!document.execCommand('insertText', false, t)) {
      var s = window.getSelection(); if (!s.rangeCount) return;
      var r = s.getRangeAt(0); r.deleteContents(); var n = document.createTextNode(t); r.insertNode(n);
      r.setStartAfter(n); r.collapse(true); s.removeAllRanges(); s.addRange(r);
    }
  }

  // ---------- desenho ----------
  function desenharTudo() {
    if (!S.root) return;
    S.root.innerHTML =
      '<div class="cd">' +
        '<aside class="cd-lado">' +
          '<div class="cd-lado-topo">' +
            '<button class="btn btn-sm btn-primary" onclick="CD.novaPagina()"><i class="fa-solid fa-file-circle-plus"></i>Página</button>' +
            '<button class="btn btn-sm btn-secondary" onclick="CD.novaPasta()"><i class="fa-solid fa-folder-plus"></i>Pasta</button>' +
          '</div>' +
          '<div class="cd-busca"><i class="fa-solid fa-magnifying-glass"></i><input placeholder="Buscar no caderno" value="' + esc(S.busca) + '" oninput="CD.buscar(this.value)"></div>' +
          '<button class="cd-atalho" data-v="tarefas" onclick="CD.verTarefas()"><i class="fa-regular fa-square-check"></i>Tarefas abertas <em id="cdNTarefas"></em></button>' +
          '<div class="cd-arvore" id="cdArvore"></div>' +
          '<div class="cd-status" id="cdStatus"></div>' +
        '</aside>' +
        '<section class="cd-editor" id="cdEditor"></section>' +
      '</div>' +
      '<input type="file" id="cdArquivo" accept="image/*" multiple hidden>';
    S.root.querySelector('#cdArquivo').addEventListener('change', function (e) { inserirImagens(e.target.files, S._imgDepois); e.target.value = ''; });
    ligarArvore();
    desenharArvore(); desenharEditor(); pintarStatus();
  }

  function pintarStatus() {
    var el = document.getElementById('cdStatus'); if (!el) return;
    var n = document.getElementById('cdNTarefas');
    if (n) { var t = tarefasAbertas().length; n.textContent = t || ''; n.style.display = t ? '' : 'none'; }
    if (S.erro) { el.innerHTML = '<i class="fa-solid fa-triangle-exclamation"></i> ' + esc(S.erro); el.className = 'cd-status erro'; return; }
    var pend = Object.keys(S.sujo).length || S.salvando;
    el.className = 'cd-status';
    el.innerHTML = pend ? '<i class="fa-solid fa-rotate fa-spin"></i> Salvando...'
      : (fireOk() ? '<i class="fa-solid fa-cloud"></i> Salvo · visível só para você' : '<i class="fa-solid fa-floppy-disk"></i> Salvo neste navegador');
  }

  function linhaArvore(it, nivel) {
    var pasta = it.tipo === 'pasta', aberta = !!S.abertas[it.id], kids = pasta ? filhos(it.id) : [];
    var html = '<div class="cd-no' + (S.vista === 'pagina' && S.aberto === it.id ? ' on' : '') + (pasta ? ' pasta' : '') + '" draggable="true" data-id="' + it.id + '" style="--nivel:' + nivel + '">' +
      '<span class="cd-seta">' + (pasta ? '<i class="fa-solid fa-chevron-' + (aberta ? 'down' : 'right') + '"></i>' : '') + '</span>' +
      '<span class="cd-ico">' + esc(it.icone || (pasta ? '📁' : '📄')) + '</span>' +
      '<span class="cd-nome">' + esc(it.nome || 'Sem título') + '</span>' +
      (pasta && kids.length ? '<span class="cd-qtd">' + kids.length + '</span>' : '') +
      '<span class="cd-no-acoes">' +
        (pasta ? '<button title="Nova página aqui" data-acao="pagina"><i class="fa-solid fa-plus"></i></button>' +
                 '<button title="Nova subpasta" data-acao="pasta"><i class="fa-solid fa-folder-plus"></i></button>' : '') +
        '<button title="Renomear" data-acao="renomear"><i class="fa-solid fa-pen"></i></button>' +
        '<button title="Excluir" data-acao="excluir"><i class="fa-solid fa-trash"></i></button>' +
      '</span></div>';
    if (pasta && aberta) {
      html += kids.length ? kids.map(function (k) { return linhaArvore(k, nivel + 1); }).join('')
        : '<div class="cd-vazio-pasta" style="--nivel:' + (nivel + 1) + '">Pasta vazia</div>';
    }
    return html;
  }

  function desenharArvore() {
    var el = document.getElementById('cdArvore'); if (!el) return;
    var atalho = S.root && S.root.querySelector('.cd-atalho');
    if (atalho) atalho.classList.toggle('on', S.vista === 'tarefas');
    if (!S.carregado) { el.innerHTML = '<div class="cd-carregando"><i class="fa-solid fa-spinner fa-spin"></i> Carregando...</div>'; return; }
    if (S.busca) {
      var b = norm(S.busca);
      var achados = Object.keys(S.itens).map(function (k) { return S.itens[k]; }).filter(function (i) {
        return norm(i.nome).indexOf(b) !== -1 || (i.blocos || []).some(function (x) { return norm(x.v).indexOf(b) !== -1; });
      });
      el.innerHTML = achados.length ? achados.map(function (i) {
        var cam = caminho(i.id).map(function (p) { return p.nome; }).join(' › ');
        return '<div class="cd-no' + (S.aberto === i.id ? ' on' : '') + (i.tipo === 'pasta' ? ' pasta' : '') + '" data-id="' + i.id + '" style="--nivel:0">' +
          '<span class="cd-seta"></span><span class="cd-ico">' + esc(i.icone || '📄') + '</span>' +
          '<span class="cd-nome">' + esc(i.nome) + (cam ? '<small>' + esc(cam) + '</small>' : '') + '</span></div>';
      }).join('') : '<div class="cd-vazio-pasta" style="--nivel:0">Nada encontrado</div>';
      return;
    }
    var raiz = filhos(null);
    el.innerHTML = (raiz.length ? raiz.map(function (i) { return linhaArvore(i, 0); }).join('')
      : '<div class="cd-vazio-pasta" style="--nivel:0">Crie a sua primeira página ou pasta</div>') +
      '<div class="cd-raiz-alvo" data-raiz="1">Solte aqui para tirar da pasta</div>';
    pintarStatus();
  }

  function ligarArvore() {
    var el = document.getElementById('cdArvore'); if (!el) return;
    el.addEventListener('click', function (e) {
      var no = e.target.closest('.cd-no'); if (!no) return;
      var id = no.dataset.id, it = S.itens[id]; if (!it) return;
      var btn = e.target.closest('[data-acao]');
      if (btn) {
        e.stopPropagation();
        var a = btn.dataset.acao;
        if (a === 'pagina') return CD.novaPagina(id);
        if (a === 'pasta') return CD.novaPasta(id);
        if (a === 'renomear') return renomearNaArvore(id);
        if (a === 'excluir') return excluir(id);
        return;
      }
      if (it.tipo === 'pasta') {
        if (e.target.closest('.cd-seta') || !S.busca) { S.abertas[id] = !S.abertas[id]; desenharArvore(); }
        if (S.busca) { S.busca = ''; caminho(id).concat([it]).forEach(function (p) { S.abertas[p.id] = true; }); var inp = S.root.querySelector('.cd-busca input'); if (inp) inp.value = ''; desenharArvore(); }
        return;
      }
      abrir(id);
    });
    el.addEventListener('dblclick', function (e) {
      var no = e.target.closest('.cd-no'); if (no && !e.target.closest('[data-acao]')) renomearNaArvore(no.dataset.id);
    });
    // arrastar e soltar (mover páginas e pastas)
    el.addEventListener('dragstart', function (e) {
      var no = e.target.closest('.cd-no'); if (!no) return;
      S._arrastando = no.dataset.id; e.dataTransfer.effectAllowed = 'move';
      try { e.dataTransfer.setData('text/plain', no.dataset.id); } catch (x) {}
      setTimeout(function () { no.classList.add('arrastando'); el.classList.add('soltando'); }, 0);
    });
    el.addEventListener('dragend', function () {
      S._arrastando = null; el.classList.remove('soltando');
      el.querySelectorAll('.arrastando,.alvo').forEach(function (x) { x.classList.remove('arrastando', 'alvo'); });
    });
    el.addEventListener('dragover', function (e) {
      if (!S._arrastando) return;
      var alvo = e.target.closest('.cd-no.pasta,[data-raiz]');
      el.querySelectorAll('.alvo').forEach(function (x) { if (x !== alvo) x.classList.remove('alvo'); });
      if (!alvo) return;
      var destino = alvo.dataset.raiz ? null : alvo.dataset.id;
      if (destino && (destino === S._arrastando || descendentes(S._arrastando).indexOf(destino) !== -1)) return;
      e.preventDefault(); alvo.classList.add('alvo');
    });
    el.addEventListener('drop', function (e) {
      var alvo = e.target.closest('.cd-no.pasta,[data-raiz]'); var id = S._arrastando;
      if (!alvo || !id) return;
      e.preventDefault();
      var destino = alvo.dataset.raiz ? null : alvo.dataset.id;
      mover(id, destino);
    });
  }

  function mover(id, destino) {
    var it = S.itens[id]; if (!it) return;
    if (destino && (destino === id || descendentes(id).indexOf(destino) !== -1)) return;
    if ((it.pai || null) === (destino || null)) return;
    it.pai = destino || null;
    var irmaos = filhos(destino).filter(function (x) { return x.id !== id; });
    it.ordem = (irmaos.length ? Math.max.apply(null, irmaos.map(function (i) { return i.ordem || 0; })) : 0) + 1;
    if (destino) S.abertas[destino] = true;
    gravarAgora(id); desenharArvore();
    if (S.aberto === id) desenharCabecalho();
    aviso('Movido para ' + (destino ? '"' + S.itens[destino].nome + '"' : 'o início do caderno'));
  }

  function renomearNaArvore(id) {
    var no = document.querySelector('.cd-no[data-id="' + id + '"] .cd-nome'); var it = S.itens[id];
    if (!no || !it) return;
    var inp = document.createElement('input'); inp.className = 'cd-renomear'; inp.value = it.nome || '';
    no.replaceWith(inp); inp.focus(); inp.select();
    var feito = false;
    var fim = function (ok) {
      if (feito) return; feito = true;
      var v = inp.value.trim();
      if (ok && v && v !== it.nome) { it.nome = v; gravarAgora(id); if (S.aberto === id) desenharCabecalho(); }
      desenharArvore();
    };
    inp.addEventListener('keydown', function (e) { if (e.key === 'Enter') fim(true); if (e.key === 'Escape') fim(false); });
    inp.addEventListener('blur', function () { fim(true); });
  }

  function excluir(id) {
    var it = S.itens[id]; if (!it) return;
    var sub = descendentes(id);
    var msg = it.tipo === 'pasta'
      ? 'Excluir a pasta "' + it.nome + '"' + (sub.length ? ' e tudo o que está dentro (' + sub.length + ' itens)' : '') + '?'
      : 'Excluir a página "' + it.nome + '"?';
    if (!confirm(msg + '\n\nIsso não pode ser desfeito.')) return;
    var todos = [id].concat(sub);
    apagarDoBanco(todos);
    if (todos.indexOf(S.aberto) !== -1) escolherInicial();
    desenharArvore(); desenharEditor();
    aviso('Excluído');
  }

  function abrir(id) {
    salvarPendentes();
    S.vista = 'pagina'; S.aberto = id;
    caminho(id).forEach(function (p) { S.abertas[p.id] = true; });
    desenharArvore(); desenharEditor();
  }

  // ---------- editor ----------
  function tarefasAbertas() {
    var out = [];
    Object.keys(S.itens).forEach(function (k) {
      var p = S.itens[k];
      (p.blocos || []).forEach(function (b) { if (b.t === 't' && !b.ok && String(b.v || '').trim()) out.push({ pg: p, b: b }); });
    });
    return out.sort(function (a, b) { return (b.pg.__updatedAt || 0) - (a.pg.__updatedAt || 0); });
  }

  function desenharEditor() {
    var ed = document.getElementById('cdEditor'); if (!ed) return;
    if (!S.carregado) { ed.innerHTML = '<div class="cd-vazio"><i class="fa-solid fa-spinner fa-spin"></i></div>'; return; }
    if (S.vista === 'tarefas') return desenharTarefas(ed);
    var pg = S.itens[S.aberto];
    if (!pg || pg.tipo !== 'pagina') {
      ed.innerHTML = '<div class="cd-vazio"><i class="fa-regular fa-file-lines"></i><p>Escolha uma página na esquerda ou crie uma nova.</p>' +
        '<button class="btn btn-primary" onclick="CD.novaPagina()"><i class="fa-solid fa-plus"></i>Nova página</button></div>';
      return;
    }
    if (!Array.isArray(pg.blocos) || !pg.blocos.length) pg.blocos = [{ id: novoId(), t: 'p', v: '' }];
    ed.innerHTML =
      '<div class="cd-cab" id="cdCab"></div>' +
      '<div class="cd-blocos" id="cdBlocos"></div>' +
      '<div class="cd-barra">' +
        '<span>Adicionar:</span>' +
        '<button onclick="CD.add(\'p\')"><i class="fa-solid fa-paragraph"></i>Texto</button>' +
        '<button onclick="CD.add(\'h\')"><i class="fa-solid fa-heading"></i>Título</button>' +
        '<button onclick="CD.add(\'l\')"><i class="fa-solid fa-list-ul"></i>Lista</button>' +
        '<button onclick="CD.add(\'t\')"><i class="fa-regular fa-square-check"></i>Tarefa</button>' +
        '<button onclick="CD.add(\'q\')"><i class="fa-solid fa-lightbulb"></i>Destaque</button>' +
        '<button onclick="CD.add(\'img\')"><i class="fa-regular fa-image"></i>Imagem</button>' +
        '<button onclick="CD.add(\'hr\')"><i class="fa-solid fa-minus"></i>Divisor</button>' +
      '</div>';
    desenharCabecalho(); desenharBlocos(); ligarEditor(ed);
  }

  function desenharCabecalho() {
    var cab = document.getElementById('cdCab'); var pg = S.itens[S.aberto]; if (!cab || !pg) return;
    var cam = caminho(pg.id);
    var pastas = Object.keys(S.itens).map(function (k) { return S.itens[k]; }).filter(function (i) { return i.tipo === 'pasta'; })
      .map(function (p) { return { id: p.id, rot: caminho(p.id).concat([p]).map(function (x) { return x.nome; }).join(' › ') }; })
      .sort(function (a, b) { return a.rot.localeCompare(b.rot); });
    var ts = (pg.blocos || []).filter(function (b) { return b.t === 't'; }), ok = ts.filter(function (b) { return b.ok; }).length;
    cab.innerHTML =
      '<div class="cd-migalha"><i class="fa-solid fa-book"></i> Meu caderno' + cam.map(function (p) { return ' › ' + esc(p.nome); }).join('') + '</div>' +
      '<div class="cd-titulo-linha">' +
        '<button class="cd-emoji" title="Trocar ícone" onclick="CD.emojis(this)">' + esc(pg.icone || '📄') + '</button>' +
        '<h2 class="cd-pg-titulo" id="cdTitulo" data-ph="Sem título"></h2>' +
      '</div>' +
      '<div class="cd-pg-meta">' +
        '<span><i class="fa-regular fa-clock"></i> Editado ' + esc(quando(pg.__updatedAt)) + '</span>' +
        (ts.length ? '<span><i class="fa-regular fa-square-check"></i> ' + ok + '/' + ts.length + ' tarefas</span>' : '') +
        '<label class="cd-mover"><i class="fa-solid fa-folder-tree"></i> <select onchange="CD.moverPara(this.value)">' +
          '<option value="">Sem pasta (início)</option>' +
          pastas.map(function (p) { return '<option value="' + p.id + '"' + (pg.pai === p.id ? ' selected' : '') + '>' + esc(p.rot) + '</option>'; }).join('') +
        '</select></label>' +
        '<button class="cd-excluir-pg" onclick="CD.excluir(\'' + pg.id + '\')"><i class="fa-solid fa-trash"></i> Excluir página</button>' +
      '</div>';
    var t = document.getElementById('cdTitulo'); editavel(t); t.textContent = pg.nome === 'Sem título' ? '' : (pg.nome || '');
    t.addEventListener('input', function () {
      pg.nome = t.textContent.trim() || 'Sem título';
      var no = document.querySelector('.cd-no[data-id="' + pg.id + '"] .cd-nome'); if (no) no.textContent = pg.nome;
      salvarDepois(pg.id);
    });
    t.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { e.preventDefault(); var p = document.querySelector('#cdBlocos .cd-txt'); if (p) porCursor(p, 0); }
    });
  }

  function htmlBloco(b) {
    var alca = '<span class="cd-alca" draggable="true" title="Arraste para mudar a ordem"><i class="fa-solid fa-grip-vertical"></i></span>';
    var tirar = '<button class="cd-tirar" title="Apagar bloco" data-tirar="' + b.id + '"><i class="fa-solid fa-xmark"></i></button>';
    if (b.t === 'hr') return '<div class="cd-b cd-b-hr" data-id="' + b.id + '">' + alca + '<hr>' + tirar + '</div>';
    if (b.t === 'img') {
      var src = S.imgs[b.img] || '';
      return '<div class="cd-b cd-b-img" data-id="' + b.id + '">' + alca +
        '<figure>' + (src ? '<img data-img="' + esc(b.img) + '" src="' + src + '" alt="">' : '<div class="cd-img-carregando" data-img-espera="' + esc(b.img) + '"><i class="fa-regular fa-image"></i> carregando imagem...</div>') +
        '<figcaption class="cd-txt cd-legenda" data-ph="Legenda (opcional)"></figcaption></figure>' + tirar + '</div>';
    }
    return '<div class="cd-b cd-b-' + b.t + (b.t === 't' && b.ok ? ' feito' : '') + '" data-id="' + b.id + '">' + alca +
      (b.t === 't' ? '<input type="checkbox" class="cd-chk"' + (b.ok ? ' checked' : '') + '>' : '') +
      (b.t === 'q' ? '<span class="cd-q-ico">💡</span>' : '') +
      '<div class="cd-txt" data-ph="' + esc(PH[b.t] || '') + '"></div>' + tirar + '</div>';
  }

  function desenharBlocos(focarId, pos) {
    var box = document.getElementById('cdBlocos'); var pg = S.itens[S.aberto]; if (!box || !pg) return;
    box.innerHTML = pg.blocos.map(htmlBloco).join('');
    box.querySelectorAll('.cd-b').forEach(function (el) {
      var b = pg.blocos.find(function (x) { return x.id === el.dataset.id; });
      var tx = el.querySelector('.cd-txt');
      if (tx && b) { editavel(tx); tx.textContent = b.v || ''; }
    });
    if (focarId) {
      var alvo = box.querySelector('.cd-b[data-id="' + focarId + '"] .cd-txt');
      if (alvo) porCursor(alvo, pos == null ? (alvo.textContent || '').length : pos);
    }
    var cab = document.getElementById('cdCab');
    if (cab) { var ts = pg.blocos.filter(function (x) { return x.t === 't'; }); void ts; }
    pintarStatus();
  }

  function blocoDe(el) {
    var pg = S.itens[S.aberto]; var be = el && el.closest('.cd-b'); if (!pg || !be) return null;
    var i = pg.blocos.findIndex(function (x) { return x.id === be.dataset.id; });
    return i < 0 ? null : { pg: pg, i: i, b: pg.blocos[i], el: be };
  }

  function ligarEditor(ed) {
    var box = document.getElementById('cdBlocos');

    box.addEventListener('input', function (e) {
      var tx = e.target.closest('.cd-txt'); var r = blocoDe(tx); if (!r) return;
      var v = tx.textContent;
      // atalhos de digitação (só em texto comum)
      if (r.b.t === 'p') {
        var m = v.match(/^(#|-|\*|\[\s?\]|>)\s/);
        if (m) {
          r.b.t = { '#': 'h', '-': 'l', '*': 'l', '>': 'q' }[m[1]] || 't';
          r.b.v = v.slice(m[0].length); r.b.ok = false;
          salvarDepois(r.pg.id); desenharBlocos(r.b.id, 0); return;
        }
        if (v === '---') {
          r.b.t = 'hr'; r.b.v = '';
          var novo = { id: novoId(), t: 'p', v: '' };
          r.pg.blocos.splice(r.i + 1, 0, novo);
          salvarDepois(r.pg.id); desenharBlocos(novo.id, 0); return;
        }
      }
      r.b.v = v;
      salvarDepois(r.pg.id);
    });

    box.addEventListener('keydown', function (e) {
      var tx = e.target.closest('.cd-txt'); if (!tx || e.isComposing) return;
      var r = blocoDe(tx); if (!r) return;
      var legenda = tx.classList.contains('cd-legenda');
      if (e.key === 'Enter' && e.shiftKey && !legenda) { e.preventDefault(); inserirTexto('\n'); return; }
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        var pos = offsetCursor(tx), txt = tx.textContent;
        var antes = txt.slice(0, pos), depois = txt.slice(pos);
        if (legenda) { antes = txt; depois = ''; }
        // Enter numa lista / tarefa vazia: sai da lista
        if (!legenda && !txt.trim() && (r.b.t === 'l' || r.b.t === 't' || r.b.t === 'q')) { r.b.t = 'p'; r.b.v = ''; salvarDepois(r.pg.id); desenharBlocos(r.b.id, 0); return; }
        r.b.v = antes;
        var tipoNovo = (r.b.t === 'l' || r.b.t === 't') ? r.b.t : 'p';
        var nb = { id: novoId(), t: tipoNovo, v: depois, ok: false };
        r.pg.blocos.splice(r.i + 1, 0, nb);
        salvarDepois(r.pg.id); desenharBlocos(nb.id, 0);
        return;
      }
      if (e.key === 'Backspace' && !legenda && selecaoVazia() && offsetCursor(tx) === 0) {
        if (r.b.t !== 'p') { e.preventDefault(); r.b.t = 'p'; salvarDepois(r.pg.id); desenharBlocos(r.b.id, 0); return; }
        if (r.i === 0) return;
        e.preventDefault();
        var ant = r.pg.blocos[r.i - 1];
        if (TIPOS_TXT[ant.t]) {
          var tam = (ant.v || '').length;
          ant.v = (ant.v || '') + (r.b.v || '');
          r.pg.blocos.splice(r.i, 1);
          salvarDepois(r.pg.id); desenharBlocos(ant.id, tam);
        } else if (!r.b.v) {
          r.pg.blocos.splice(r.i, 1);
          salvarDepois(r.pg.id); desenharBlocos();
        }
        return;
      }
      if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
        var tam2 = tx.textContent.length, p2 = offsetCursor(tx);
        var todos = Array.prototype.slice.call(box.querySelectorAll('.cd-txt'));
        var k = todos.indexOf(tx);
        if (e.key === 'ArrowUp' && p2 === 0 && k > 0) { e.preventDefault(); porCursor(todos[k - 1], todos[k - 1].textContent.length); }
        if (e.key === 'ArrowDown' && p2 === tam2 && k < todos.length - 1) { e.preventDefault(); porCursor(todos[k + 1], 0); }
      }
    });

    box.addEventListener('change', function (e) {
      if (!e.target.classList.contains('cd-chk')) return;
      var r = blocoDe(e.target); if (!r) return;
      r.b.ok = e.target.checked; r.el.classList.toggle('feito', r.b.ok);
      salvarDepois(r.pg.id); desenharCabecalho(); pintarStatus();
    });

    box.addEventListener('click', function (e) {
      var t = e.target.closest('[data-tirar]'); if (!t) return;
      var r = blocoDe(t); if (!r) return;
      if (r.b.t === 'img' && r.b.img) { delete S.imgs[r.b.img]; if (fireOk()) COL('cadernoImgs').doc(r.b.img).delete().catch(function () {}); }
      r.pg.blocos.splice(r.i, 1);
      if (!r.pg.blocos.length) r.pg.blocos.push({ id: novoId(), t: 'p', v: '' });
      salvarDepois(r.pg.id); desenharBlocos(); desenharCabecalho();
    });

    // legenda das imagens usa o campo "v" do bloco de imagem
    box.addEventListener('focusout', function (e) {
      if (e.target.classList && e.target.classList.contains('cd-txt')) { var r = blocoDe(e.target); if (r) gravarAgora(r.pg.id); }
    });

    // colar: imagem vira bloco de imagem; texto entra sem formatação
    box.addEventListener('paste', function (e) {
      var tx = e.target.closest('.cd-txt'); if (!tx) return;
      var arquivos = Array.prototype.filter.call((e.clipboardData && e.clipboardData.files) || [], function (f) { return /^image\//.test(f.type); });
      if (arquivos.length) { e.preventDefault(); var r = blocoDe(tx); inserirImagens(arquivos, r && r.b.id); return; }
      var txt = e.clipboardData && e.clipboardData.getData('text/plain');
      if (txt != null) { e.preventDefault(); inserirTexto(txt); }
    });

    // arrastar arquivos de imagem para dentro da página
    ed.addEventListener('dragover', function (e) {
      if (e.dataTransfer && Array.prototype.some.call(e.dataTransfer.types || [], function (t) { return t === 'Files'; })) { e.preventDefault(); ed.classList.add('soltar-img'); }
    });
    ed.addEventListener('dragleave', function (e) { if (!ed.contains(e.relatedTarget)) ed.classList.remove('soltar-img'); });
    ed.addEventListener('drop', function (e) {
      ed.classList.remove('soltar-img');
      if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length) {
        e.preventDefault();
        var r = blocoDe(e.target); inserirImagens(e.dataTransfer.files, r && r.b.id);
      }
    });

    // reordenar blocos pela alça
    box.addEventListener('dragstart', function (e) {
      var a = e.target.closest('.cd-alca'); if (!a) return;
      var be = a.closest('.cd-b'); S._bloco = be.dataset.id;
      e.dataTransfer.effectAllowed = 'move'; try { e.dataTransfer.setData('text/plain', S._bloco); e.dataTransfer.setDragImage(be, 10, 10); } catch (x) {}
      setTimeout(function () { be.classList.add('arrastando'); }, 0);
    });
    box.addEventListener('dragover', function (e) {
      if (!S._bloco) return;
      var be = e.target.closest('.cd-b'); if (!be) return;
      e.preventDefault();
      var meio = be.getBoundingClientRect(); var cima = e.clientY < meio.top + meio.height / 2;
      box.querySelectorAll('.linha-cima,.linha-baixo').forEach(function (x) { x.classList.remove('linha-cima', 'linha-baixo'); });
      be.classList.add(cima ? 'linha-cima' : 'linha-baixo');
    });
    box.addEventListener('drop', function (e) {
      if (!S._bloco) return;
      var be = e.target.closest('.cd-b'); var pg = S.itens[S.aberto];
      if (be && pg) {
        e.preventDefault();
        var de = pg.blocos.findIndex(function (x) { return x.id === S._bloco; });
        var bl = pg.blocos.splice(de, 1)[0];
        var para = pg.blocos.findIndex(function (x) { return x.id === be.dataset.id; });
        if (para < 0) pg.blocos.push(bl); else pg.blocos.splice(be.classList.contains('linha-cima') ? para : para + 1, 0, bl);
        salvarDepois(pg.id);
      }
      S._bloco = null; desenharBlocos();
    });
    box.addEventListener('dragend', function () {
      S._bloco = null;
      box.querySelectorAll('.arrastando,.linha-cima,.linha-baixo').forEach(function (x) { x.classList.remove('arrastando', 'linha-cima', 'linha-baixo'); });
    });
  }

  function desenharTarefas(ed) {
    var lista = tarefasAbertas();
    var porPg = {};
    lista.forEach(function (x) { (porPg[x.pg.id] = porPg[x.pg.id] || { pg: x.pg, itens: [] }).itens.push(x.b); });
    ed.innerHTML =
      '<div class="cd-cab"><div class="cd-migalha"><i class="fa-solid fa-book"></i> Meu caderno</div>' +
      '<div class="cd-titulo-linha"><span class="cd-emoji">☑️</span><h2 class="cd-pg-titulo">Tarefas abertas</h2></div>' +
      '<div class="cd-pg-meta"><span>Todas as caixinhas ainda não marcadas, de todas as páginas.</span></div></div>' +
      (lista.length ? Object.keys(porPg).map(function (k) {
        var g = porPg[k], cam = caminho(g.pg.id).map(function (p) { return p.nome; }).concat([g.pg.nome]).join(' › ');
        return '<div class="cd-t-grupo"><button class="cd-t-pg" onclick="CD.abrir(\'' + g.pg.id + '\')">' + esc(g.pg.icone || '📄') + ' ' + esc(cam) + ' <i class="fa-solid fa-arrow-right"></i></button>' +
          g.itens.map(function (b) {
            return '<label class="cd-t-item"><input type="checkbox" onchange="CD.marcar(\'' + g.pg.id + '\',\'' + b.id + '\',this.checked)"><span>' + esc(b.v) + '</span></label>';
          }).join('') + '</div>';
      }).join('') : '<div class="cd-vazio"><i class="fa-regular fa-face-smile"></i><p>Nenhuma tarefa aberta no caderno. 🎉</p></div>');
  }

  // ---------- API ----------
  window.CD = {
    montar: function (root) {
      S.root = root; root.dataset.ok = '1';
      if (!conectar()) { root.innerHTML = '<div class="cd-vazio"><i class="fa-solid fa-lock"></i><p>Entre com o seu login para usar o caderno.</p></div>'; return; }
      if (S.carregado && (!S.aberto || !S.itens[S.aberto])) escolherInicial();
      desenharTudo();
    },
    atualizar: function () { if (S.root && document.body.contains(S.root) && !editandoAgora()) { desenharArvore(); pintarStatus(); } },
    novaPagina: function (pai) {
      var p = pai !== undefined ? pai : (S.itens[S.aberto] ? S.itens[S.aberto].pai : null);
      var it = criar('pagina', p || null);
      abrir(it.id);
      setTimeout(function () { var t = document.getElementById('cdTitulo'); if (t) t.focus(); }, 30);
    },
    novaPasta: function (pai) {
      var it = criar('pasta', pai || null);
      desenharArvore();
      setTimeout(function () { renomearNaArvore(it.id); }, 30);
    },
    abrir: abrir,
    excluir: excluir,
    verTarefas: function () { salvarPendentes(); S.vista = 'tarefas'; desenharArvore(); desenharEditor(); },
    marcar: function (pgId, bId, ok) {
      var pg = S.itens[pgId]; if (!pg) return;
      var b = (pg.blocos || []).find(function (x) { return x.id === bId; }); if (!b) return;
      b.ok = ok; gravarAgora(pgId);
      setTimeout(function () { if (S.vista === 'tarefas') desenharEditor(); pintarStatus(); }, 350);
    },
    buscar: function (t) { S.busca = t; desenharArvore(); },
    moverPara: function (pasta) { if (S.aberto) mover(S.aberto, pasta || null); },
    add: function (tipo) {
      var pg = S.itens[S.aberto]; if (!pg) return;
      var foco = document.activeElement && document.activeElement.closest && document.activeElement.closest('#cdBlocos .cd-b');
      var pos = foco ? pg.blocos.findIndex(function (x) { return x.id === foco.dataset.id; }) + 1 : pg.blocos.length;
      if (tipo === 'img') { S._imgDepois = foco ? foco.dataset.id : null; document.getElementById('cdArquivo').click(); return; }
      // se o último bloco é um texto vazio, reaproveita ele
      var ult = pg.blocos[pos - 1];
      if (ult && ult.t === 'p' && !ult.v && tipo !== 'hr') { ult.t = tipo; salvarDepois(pg.id); desenharBlocos(ult.id, 0); return; }
      var nb = { id: novoId(), t: tipo, v: '', ok: false };
      pg.blocos.splice(pos, 0, nb);
      if (tipo === 'hr') { var pp = { id: novoId(), t: 'p', v: '' }; pg.blocos.splice(pos + 1, 0, pp); nb = pp; }
      salvarDepois(pg.id); desenharBlocos(nb.id, 0);
    },
    emojis: function (btn) {
      var velho = document.querySelector('.cd-emojis'); if (velho) { velho.remove(); return; }
      var pop = document.createElement('div'); pop.className = 'cd-emojis';
      pop.innerHTML = EMOJIS.map(function (e) { return '<button>' + e + '</button>'; }).join('');
      btn.parentNode.appendChild(pop);
      pop.addEventListener('click', function (e) {
        var b = e.target.closest('button'); if (!b) return;
        var pg = S.itens[S.aberto]; if (pg) { pg.icone = b.textContent; btn.textContent = pg.icone; gravarAgora(pg.id); desenharArvore(); }
        pop.remove();
      });
      setTimeout(function () { document.addEventListener('mousedown', function f(ev) { if (!pop.contains(ev.target)) { pop.remove(); document.removeEventListener('mousedown', f); } }); }, 0);
    },
    _estado: S
  };
})();
