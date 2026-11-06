/* ============================================================
   ABA "BIBLIOTECA DA MARCA"
   ------------------------------------------------------------
   Um lugar único para logos, cores, fontes, modelos, fotos,
   vídeos, documentos e links das duas marcas.

   Cada item pode ter:
     • um LINK (Google Drive, Canva, YouTube, site...) — o jeito
       recomendado para arquivos grandes. Drive e YouTube ganham
       miniatura automática.
     • um ARQUIVO PEQUENO enviado direto (até ~700 KB: logos, ícones,
       PDFs curtos). Ele fica num documento separado ("bibArquivos")
       e só é baixado quando alguém clica em Baixar.
     • uma MINIATURA leve (gerada sozinha a partir da imagem enviada).
   Cores (com código hex) e fontes formam o "Guia da marca".

   Dados: coleção "biblioteca" (em tempo real, pelo firebaseCreate,
   aparece no Registro de Alterações). Tudo dentro de window.BB.
============================================================ */
/* global DB, genId, firebaseCreate, firebaseDelete, openModal, closeModal, showToast, COL, fdb, AUDIT_CAMPOS */
(function () {
  var TIPOS = {
    logo:      { nome: 'Logos',       um: 'Logo',       ico: 'fa-certificate' },
    cor:       { nome: 'Cores',       um: 'Paleta',     ico: 'fa-palette' },
    fonte:     { nome: 'Fontes',      um: 'Fonte',      ico: 'fa-font' },
    modelo:    { nome: 'Modelos',     um: 'Modelo',     ico: 'fa-object-group' },
    foto:      { nome: 'Fotos',       um: 'Foto',       ico: 'fa-image' },
    video:     { nome: 'Vídeos',      um: 'Vídeo',      ico: 'fa-film' },
    documento: { nome: 'Documentos',  um: 'Documento',  ico: 'fa-file-lines' },
    link:      { nome: 'Links úteis', um: 'Link',       ico: 'fa-link' }
  };
  var EMP = { click: 'Click Impresso', impresul: 'Impresul', geral: 'Geral' };
  var LIMITE = 700 * 1024;  // arquivo enviado direto
  var ui = { tipo: 'todos', empresa: 'todas', tag: '', busca: '', ordem: 'recentes', arquivoNovo: null, thumbNova: null };

  if (typeof AUDIT_CAMPOS === 'object' && AUDIT_CAMPOS) {
    try { Object.assign(AUDIT_CAMPOS, { titulo: 'título', arquivoNome: 'arquivo', thumb: 'miniatura', cores: 'cores', fonteNome: 'fonte', fixado: 'fixado', campanha: 'campanha' }); } catch (e) {}
  }

  // ---------- utilidades ----------
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function norm(s) { return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim(); }
  function lista() { return (typeof DB !== 'undefined' && Array.isArray(DB.biblioteca)) ? DB.biblioteca : []; }
  function item(id) { return lista().find(function (x) { return x.id === id; }); }
  function fireOk() { try { return typeof fdb !== 'undefined' && !!fdb && typeof COL === 'function'; } catch (e) { return false; } }
  function depois(fn) { setTimeout(fn, fireOk() ? 400 : 30); }
  function tamanho(b) { return b > 1048576 ? (b / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(b / 1024)) + ' KB'; }
  function urlSegura(u) { u = String(u || '').trim(); if (!u) return ''; if (!/^https?:\/\//i.test(u)) u = 'https://' + u; return /^https?:\/\/[^\s<>"']+$/i.test(u) ? u : ''; }

  function driveId(u) {
    var m = String(u || '').match(/drive\.google\.com\/(?:file\/d\/|open\?id=|uc\?(?:export=\w+&)?id=)([\w-]{15,})/) ||
            String(u || '').match(/docs\.google\.com\/(?:document|presentation|spreadsheets)\/d\/([\w-]{15,})/);
    return m ? m[1] : '';
  }
  function youtubeId(u) { var m = String(u || '').match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|shorts\/|embed\/))([\w-]{11})/); return m ? m[1] : ''; }
  function origemLink(u) {
    if (!u) return '';
    if (/drive\.google|docs\.google/.test(u)) return 'Google Drive';
    if (/canva\.com/.test(u)) return 'Canva';
    if (/youtu/.test(u)) return 'YouTube';
    if (/figma\.com/.test(u)) return 'Figma';
    if (/fonts\.google/.test(u)) return 'Google Fonts';
    try { return new URL(u).hostname.replace(/^www\./, ''); } catch (e) { return 'link'; }
  }
  function miniaturaDoLink(u) {
    var d = driveId(u); if (d) return 'https://drive.google.com/thumbnail?id=' + d + '&sz=w600';
    var y = youtubeId(u); if (y) return 'https://img.youtube.com/vi/' + y + '/hqdefault.jpg';
    return '';
  }
  function capa(it) { return it.thumb || miniaturaDoLink(it.link) || ''; }
  function parseCores(txt) {
    return String(txt || '').split('\n').map(function (l) {
      var m = l.match(/#?([0-9a-f]{6}|[0-9a-f]{3})\b/i); if (!m) return null;
      var hex = m[1].length === 3 ? m[1].split('').map(function (c) { return c + c; }).join('') : m[1];
      var nome = l.replace(m[0], '').replace(/[-–:|]/g, ' ').trim();
      return { hex: '#' + hex.toUpperCase(), nome: nome };
    }).filter(Boolean);
  }
  function lum(hex) { var n = parseInt(hex.slice(1), 16); var f = function (c) { c /= 255; return c <= .03928 ? c / 12.92 : Math.pow((c + .055) / 1.055, 2.4); }; return .2126 * f(n >> 16 & 255) + .7152 * f(n >> 8 & 255) + .0722 * f(n & 255); }
  function copiar(txt, msg) {
    var ok = function () { showToast(msg || 'Copiado!', 'success'); };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(txt).then(ok, function () { prompt('Copie:', txt); });
    else prompt('Copie:', txt);
  }

  function miniatura(arquivo, cb) {
    var r = new FileReader();
    r.onload = function () {
      var img = new Image();
      img.onload = function () {
        var max = 520, w = img.width, h = img.height, k = Math.min(1, max / Math.max(w, h));
        var cv = document.createElement('canvas'); cv.width = Math.round(w * k); cv.height = Math.round(h * k);
        var cx = cv.getContext('2d');
        // fundo xadrez claro para logos com transparência ficarem visíveis
        cx.fillStyle = '#ffffff'; cx.fillRect(0, 0, cv.width, cv.height);
        cx.drawImage(img, 0, 0, cv.width, cv.height);
        var png = /png|svg|gif|webp/.test(arquivo.type);
        var url = png ? cv.toDataURL('image/png') : cv.toDataURL('image/jpeg', 0.8);
        if (url.length > 120000) url = cv.toDataURL('image/jpeg', 0.75);
        cb(url, r.result);
      };
      img.onerror = function () { cb('', r.result); };
      img.src = r.result;
    };
    r.readAsDataURL(arquivo);
  }

  // ---------- montagem ----------
  function montar() {
    var pg = document.getElementById('page-biblioteca');
    if (!pg || pg.dataset.montado) return;
    pg.dataset.montado = '1';
    pg.innerHTML =
      '<div class="section-header"><div>' +
        '<div class="section-title">Biblioteca da marca</div>' +
        '<div class="section-subtitle">Logos, cores, fontes, modelos e arquivos aprovados das marcas — tudo num lugar</div>' +
      '</div><div class="bb-topo-acoes">' +
        '<button class="btn btn-primary" onclick="BB.novo()"><i class="fa-solid fa-plus"></i>Adicionar</button>' +
      '</div></div>' +
      '<div class="bb">' +
        '<aside class="bb-lado card">' +
          '<div class="bb-sub">Tipo</div><div id="bbTipos"></div>' +
          '<div class="bb-sub">Marca</div><div id="bbEmpresas"></div>' +
          '<div class="bb-sub" id="bbTagsTit">Etiquetas</div><div class="bb-tags" id="bbTags"></div>' +
        '</aside>' +
        '<section class="bb-conteudo">' +
          '<div class="bb-barra"><div class="search-bar"><i class="fa-solid fa-magnifying-glass"></i><input type="text" placeholder="Buscar por nome, etiqueta, descrição..." oninput="BB.buscar(this.value)"></div>' +
            '<select class="form-control" onchange="BB.ordem(this.value)" style="width:auto"><option value="recentes">Mais recentes</option><option value="nome">Nome (A–Z)</option><option value="tipo">Tipo</option></select></div>' +
          '<div id="bbGuia"></div>' +
          '<div id="bbGrade"></div>' +
        '</section>' +
      '</div>';
    pg.querySelector('#bbTags').addEventListener('click', function (e) { var b = e.target.closest('[data-tag]'); if (b) BB.tag(b.dataset.tag); });
    montarModais();
  }

  function montarModais() {
    if (document.getElementById('bibModal')) return;
    var m = document.createElement('div');
    m.className = 'modal-overlay'; m.id = 'bibModal';
    m.innerHTML =
      '<div class="modal modal-lg">' +
        '<div class="modal-header"><div class="modal-title" id="bbModalTitulo">Adicionar à biblioteca</div><button class="modal-close" onclick="closeModal(\'bibModal\')"><i class="fa-solid fa-xmark"></i></button></div>' +
        '<input type="hidden" id="bb_id">' +
        '<div class="form-group"><label class="form-label">Tipo</label><div class="bb-tipos-escolha" id="bb_tipos">' +
          Object.keys(TIPOS).map(function (k) { return '<button type="button" data-tipo="' + k + '"><i class="fa-solid ' + TIPOS[k].ico + '"></i>' + TIPOS[k].um + '</button>'; }).join('') + '</div></div>' +
        '<div class="bb-f2"><div class="form-group"><label class="form-label">Nome *</label><input class="form-control" id="bb_titulo" placeholder="ex: Logo Click — versão horizontal"></div>' +
          '<div class="form-group"><label class="form-label">Marca</label><select class="form-control" id="bb_empresa"><option value="click">Click Impresso</option><option value="impresul">Impresul</option><option value="geral">Geral (as duas)</option></select></div></div>' +

        '<div class="bb-sec" data-para="cor"><div class="form-group"><label class="form-label">Cores <span class="bb-opc">(uma por linha: nome e código hex)</span></label>' +
          '<textarea class="form-control bb-mono" id="bb_cores" rows="5" placeholder="Azul principal #132957&#10;Ciano #009FE3&#10;Magenta #E6007E&#10;Amarelo #FFED00"></textarea>' +
          '<div class="bb-cores-previa" id="bb_coresPrevia"></div></div></div>' +

        '<div class="bb-sec" data-para="fonte"><div class="bb-f2"><div class="form-group"><label class="form-label">Nome da fonte</label><input class="form-control" id="bb_fonteNome" placeholder="ex: Montserrat"></div>' +
          '<div class="form-group"><label class="form-label">Onde usar</label><input class="form-control" id="bb_fonteUso" placeholder="ex: títulos e chamadas"></div></div></div>' +

        '<div class="form-group"><label class="form-label">Link <span class="bb-opc">(Drive, Canva, YouTube, site...)</span></label>' +
          '<input class="form-control" id="bb_link" placeholder="https://drive.google.com/..." oninput="BB.previaLink()">' +
          '<div class="bb-dica" id="bb_linkDica">Dica: no Drive, use "Compartilhar → Qualquer pessoa da organização com o link" para a equipe conseguir abrir.</div></div>' +

        '<div class="bb-sec" data-nao="cor fonte link"><div class="form-group"><label class="form-label">Ou envie o arquivo <span class="bb-opc">(até 700 KB — para maiores, use o link do Drive)</span></label>' +
          '<label class="bb-drop" id="bb_drop"><input type="file" id="bb_file" hidden onchange="BB.arquivo(this.files[0])">' +
            '<div id="bb_dropTxt"><i class="fa-solid fa-cloud-arrow-up"></i><span>Clique ou arraste um arquivo aqui</span></div></label></div></div>' +

        '<div class="bb-f2"><div class="form-group"><label class="form-label">Etiquetas <span class="bb-opc">(separe por vírgula)</span></label><input class="form-control" id="bb_tags" placeholder="ex: horizontal, fundo escuro, 2026" list="bbTagsLista"></div>' +
          '<div class="form-group"><label class="form-label">Campanha <span class="bb-opc">(opcional)</span></label><select class="form-control" id="bb_campanha"></select></div></div>' +
        '<datalist id="bbTagsLista"></datalist>' +
        '<div class="form-group"><label class="form-label">Descrição / como usar</label><textarea class="form-control" id="bb_desc" rows="2" placeholder="ex: usar só em fundo branco; não distorcer"></textarea></div>' +
        '<label class="bb-fixar"><input type="checkbox" id="bb_fixado"> Fixar no topo (itens oficiais / mais usados)</label>' +
        '<div class="modal-footer"><button class="btn btn-ghost bb-excluir" id="bbBtnExcluir" onclick="BB.excluir()"><i class="fa-solid fa-trash"></i>Excluir</button>' +
          '<button class="btn btn-secondary" onclick="closeModal(\'bibModal\')">Cancelar</button>' +
          '<button class="btn btn-primary" id="bbBtnSalvar" onclick="BB.salvar()"><i class="fa-solid fa-check"></i>Salvar</button></div>' +
      '</div>';
    document.body.appendChild(m);

    m.querySelector('#bb_tipos').addEventListener('click', function (e) { var b = e.target.closest('[data-tipo]'); if (b) escolherTipo(b.dataset.tipo); });
    m.querySelector('#bb_cores').addEventListener('input', previaCores);
    var drop = m.querySelector('#bb_drop');
    ['dragover', 'dragenter'].forEach(function (ev) { drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.add('sobre'); }); });
    ['dragleave', 'drop'].forEach(function (ev) { drop.addEventListener(ev, function () { drop.classList.remove('sobre'); }); });
    drop.addEventListener('drop', function (e) { e.preventDefault(); if (e.dataTransfer.files[0]) BB.arquivo(e.dataTransfer.files[0]); });

    var v = document.createElement('div');
    v.className = 'modal-overlay'; v.id = 'bibVerModal';
    v.innerHTML = '<div class="modal modal-lg bb-ver" id="bbVer"></div>';
    document.body.appendChild(v);
  }

  function escolherTipo(t) {
    document.querySelectorAll('#bb_tipos [data-tipo]').forEach(function (b) { b.classList.toggle('on', b.dataset.tipo === t); });
    document.querySelectorAll('#bibModal .bb-sec').forEach(function (s) {
      var para = s.dataset.para, nao = s.dataset.nao;
      s.style.display = (para && para.split(' ').indexOf(t) === -1) || (nao && nao.split(' ').indexOf(t) !== -1) ? 'none' : '';
    });
    document.getElementById('bibModal').dataset.tipo = t;
  }
  function previaCores() {
    var cs = parseCores(document.getElementById('bb_cores').value);
    document.getElementById('bb_coresPrevia').innerHTML = cs.map(function (c) { return '<span style="background:' + c.hex + '" title="' + esc(c.nome) + '"></span>'; }).join('');
  }

  // ---------- desenho ----------
  function filtrados() {
    var b = norm(ui.busca);
    var arr = lista().filter(function (it) {
      if (ui.tipo !== 'todos' && it.tipo !== ui.tipo) return false;
      if (ui.empresa !== 'todas' && it.empresa !== ui.empresa && it.empresa !== 'geral') return false;
      if (ui.tag && (it.tags || []).map(norm).indexOf(norm(ui.tag)) === -1) return false;
      if (b && norm([it.titulo, it.descricao, (it.tags || []).join(' '), it.fonteNome, it.arquivoNome, (it.cores || []).map(function (c) { return c.nome + ' ' + c.hex; }).join(' ')].join(' ')).indexOf(b) === -1) return false;
      return true;
    });
    arr.sort(function (a, b2) {
      if (!!a.fixado !== !!b2.fixado) return a.fixado ? -1 : 1;
      if (ui.ordem === 'nome') return String(a.titulo).localeCompare(String(b2.titulo));
      if (ui.ordem === 'tipo') return String(a.tipo).localeCompare(String(b2.tipo)) || String(a.titulo).localeCompare(String(b2.titulo));
      return (b2.__createdAt || 0) - (a.__createdAt || 0);
    });
    return arr;
  }

  function cartao(it) {
    var t = TIPOS[it.tipo] || TIPOS.link, img = capa(it);
    var miolo;
    if (it.tipo === 'cor' && (it.cores || []).length) {
      miolo = '<div class="bb-paleta">' + it.cores.map(function (c) { return '<span style="background:' + c.hex + '"></span>'; }).join('') + '</div>';
    } else if (it.tipo === 'fonte') {
      miolo = '<div class="bb-fonte-amostra" style="font-family:\'' + esc(it.fonteNome || it.titulo) + '\',var(--font-main)">Aa<small>' + esc(it.fonteNome || it.titulo) + '</small></div>';
    } else if (img) {
      miolo = '<img src="' + esc(img) + '" alt="" loading="lazy" onerror="this.replaceWith(Object.assign(document.createElement(\'i\'),{className:\'fa-solid ' + t.ico + ' bb-ico-grande\'}))">';
    } else miolo = '<i class="fa-solid ' + t.ico + ' bb-ico-grande"></i>';
    return '<div class="bb-card' + (it.fixado ? ' fixado' : '') + '" onclick="BB.ver(\'' + it.id + '\')">' +
      '<div class="bb-capa tipo-' + it.tipo + '">' + miolo +
        (it.fixado ? '<span class="bb-pino" title="Fixado"><i class="fa-solid fa-thumbtack"></i></span>' : '') +
        '<span class="bb-tipo-selo"><i class="fa-solid ' + t.ico + '"></i>' + t.um + '</span></div>' +
      '<div class="bb-info"><b>' + esc(it.titulo) + '</b>' +
        '<small>' + esc(EMP[it.empresa] || '') + (it.arquivoNome ? ' · ' + esc(it.arquivoNome) : (it.link ? ' · ' + esc(origemLink(it.link)) : '')) + '</small>' +
        ((it.tags || []).length ? '<div class="bb-tags-mini">' + it.tags.slice(0, 3).map(function (g) { return '<span>' + esc(g) + '</span>'; }).join('') + '</div>' : '') +
      '</div>' +
      '<div class="bb-acoes-rap" onclick="event.stopPropagation()">' +
        (it.arquivoId ? '<button title="Baixar" onclick="BB.baixar(\'' + it.id + '\')"><i class="fa-solid fa-download"></i></button>' : '') +
        (it.link ? '<a title="Abrir link" href="' + esc(it.link) + '" target="_blank" rel="noopener"><i class="fa-solid fa-arrow-up-right-from-square"></i></a>' : '') +
        (it.link ? '<button title="Copiar link" onclick="BB.copiarLink(\'' + it.id + '\')"><i class="fa-regular fa-copy"></i></button>' : '') +
      '</div></div>';
  }

  function guia() {
    // Guia da marca: paletas e fontes da marca escolhida, no topo
    if (ui.tipo !== 'todos' || ui.busca || ui.tag) return '';
    var emps = ui.empresa === 'todas' ? ['click', 'impresul', 'geral'] : [ui.empresa, 'geral'];
    var paletas = lista().filter(function (i) { return i.tipo === 'cor' && emps.indexOf(i.empresa) !== -1 && (i.cores || []).length; });
    var fontes = lista().filter(function (i) { return i.tipo === 'fonte' && emps.indexOf(i.empresa) !== -1; });
    if (!paletas.length && !fontes.length) {
      return '<div class="card bb-guia vazio"><i class="fa-solid fa-swatchbook"></i><div><b>Monte o guia da marca</b><span>Cadastre as cores (com o código) e as fontes da Click e da Impresul. Elas aparecem aqui em destaque, prontas para copiar.</span></div>' +
        '<button class="btn btn-sm btn-secondary" onclick="BB.novo(\'cor\')"><i class="fa-solid fa-palette"></i>Cadastrar cores</button>' +
        '<button class="btn btn-sm btn-secondary" onclick="BB.novo(\'fonte\')"><i class="fa-solid fa-font"></i>Cadastrar fontes</button></div>';
    }
    return '<div class="card bb-guia"><div class="card-header"><div class="card-title"><i class="fa-solid fa-swatchbook"></i>Guia da marca</div><span class="bb-dica">Clique numa cor para copiar o código</span></div>' +
      paletas.map(function (p) {
        return '<div class="bb-g-linha"><div class="bb-g-rot">' + esc(p.titulo) + '<small>' + esc(EMP[p.empresa]) + '</small></div><div class="bb-g-cores">' +
          p.cores.map(function (c) {
            var claro = lum(c.hex) > 0.45;
            return '<button class="bb-g-cor" style="background:' + c.hex + ';color:' + (claro ? '#111' : '#fff') + '" onclick="BB.copiarCor(\'' + c.hex + '\')" title="Copiar ' + c.hex + '">' +
              '<b>' + esc(c.nome || '') + '</b><span>' + c.hex + '</span></button>';
          }).join('') + '</div></div>';
      }).join('') +
      (fontes.length ? '<div class="bb-g-linha"><div class="bb-g-rot">Fontes</div><div class="bb-g-fontes">' + fontes.map(function (f) {
        return '<button class="bb-g-fonte" onclick="BB.ver(\'' + f.id + '\')"><span style="font-family:\'' + esc(f.fonteNome || f.titulo) + '\',var(--font-main)">' + esc(f.fonteNome || f.titulo) + '</span><small>' + esc(f.fonteUso || EMP[f.empresa]) + '</small></button>';
      }).join('') + '</div></div>' : '') +
    '</div>';
  }

  function render() {
    montar();
    if (!document.getElementById('bbGrade')) return;
    var todos = lista();
    var cont = { todos: todos.length };
    todos.forEach(function (i) { cont[i.tipo] = (cont[i.tipo] || 0) + 1; });
    document.getElementById('bbTipos').innerHTML = [['todos', 'Tudo', 'fa-border-all']].concat(Object.keys(TIPOS).map(function (k) { return [k, TIPOS[k].nome, TIPOS[k].ico]; })).map(function (t) {
      return '<button class="bb-f' + (ui.tipo === t[0] ? ' on' : '') + '" onclick="BB.tipo(\'' + t[0] + '\')"><i class="fa-solid ' + t[2] + '"></i>' + t[1] + '<em>' + (cont[t[0]] || 0) + '</em></button>';
    }).join('');
    document.getElementById('bbEmpresas').innerHTML = [['todas', 'Todas'], ['click', 'Click Impresso'], ['impresul', 'Impresul']].map(function (e) {
      return '<button class="bb-f' + (ui.empresa === e[0] ? ' on' : '') + '" onclick="BB.empresa(\'' + e[0] + '\')">' + e[1] + '</button>';
    }).join('');
    var tags = {};
    todos.forEach(function (i) { (i.tags || []).forEach(function (g) { var k = g.trim(); if (k) tags[k] = (tags[k] || 0) + 1; }); });
    var tl = Object.keys(tags).sort(function (a, b) { return tags[b] - tags[a]; }).slice(0, 30);
    document.getElementById('bbTagsTit').style.display = tl.length ? '' : 'none';
    document.getElementById('bbTags').innerHTML = tl.map(function (g) {
      return '<button class="' + (norm(ui.tag) === norm(g) ? 'on' : '') + '" data-tag="' + esc(g) + '">' + esc(g) + '</button>';
    }).join('');
    var dl = document.getElementById('bbTagsLista'); if (dl) dl.innerHTML = Object.keys(tags).map(function (g) { return '<option value="' + esc(g) + '">'; }).join('');

    document.getElementById('bbGuia').innerHTML = guia();
    var arr = filtrados();
    document.getElementById('bbGrade').innerHTML = arr.length
      ? '<div class="bb-grade">' + arr.map(cartao).join('') + '</div>'
      : '<div class="bb-vazio"><i class="fa-solid fa-photo-film"></i><p>' + (todos.length ? 'Nada encontrado com esses filtros.' : 'A biblioteca ainda está vazia. Comece pelos logos e pelas cores.') + '</p>' +
        '<button class="btn btn-primary" onclick="BB.novo()"><i class="fa-solid fa-plus"></i>Adicionar</button></div>';
  }

  // ---------- ver ----------
  function ver(id) {
    montar();
    var it = item(id); if (!it) return;
    var t = TIPOS[it.tipo] || TIPOS.link, img = capa(it);
    var prev = '';
    if (it.tipo === 'cor') {
      prev = '<div class="bb-ver-cores">' + (it.cores || []).map(function (c) {
        var claro = lum(c.hex) > 0.45;
        return '<button class="bb-g-cor grande" style="background:' + c.hex + ';color:' + (claro ? '#111' : '#fff') + '" onclick="BB.copiarCor(\'' + c.hex + '\')"><b>' + esc(c.nome) + '</b><span>' + c.hex + '</span><small>clique para copiar</small></button>';
      }).join('') + '</div>';
    } else if (it.tipo === 'fonte') {
      prev = '<div class="bb-ver-fonte" style="font-family:\'' + esc(it.fonteNome || it.titulo) + '\',var(--font-main)"><div class="g">Aa Bb Cc</div><div>A rápida raposa marrom pula sobre o cão preguiçoso — 0123456789</div></div>' +
        '<p class="bb-dica">Se a amostra aparece com outra letra, a fonte não está instalada neste computador.' + (it.link ? ' Baixe pelo link abaixo.' : '') + '</p>';
    } else if (youtubeId(it.link)) {
      prev = '<div class="bb-ver-video"><iframe src="https://www.youtube.com/embed/' + youtubeId(it.link) + '" allowfullscreen></iframe></div>';
    } else if (img) prev = '<div class="bb-ver-img tipo-' + it.tipo + '"><img src="' + esc(img) + '" alt=""></div>';
    else prev = '<div class="bb-ver-img vazio"><i class="fa-solid ' + t.ico + '"></i></div>';

    var camp = it.campanha && ((DB.projects || []).find(function (p) { return p.id === it.campanha; }) || {}).name;
    document.getElementById('bbVer').innerHTML =
      '<div class="modal-header"><div class="modal-title"><i class="fa-solid ' + t.ico + '"></i> ' + esc(it.titulo) + '</div><button class="modal-close" onclick="closeModal(\'bibVerModal\')"><i class="fa-solid fa-xmark"></i></button></div>' +
      prev +
      '<div class="bb-ver-info">' +
        '<div><span>Tipo</span><b>' + t.um + '</b></div><div><span>Marca</span><b>' + esc(EMP[it.empresa] || '—') + '</b></div>' +
        (it.arquivoNome ? '<div><span>Arquivo</span><b>' + esc(it.arquivoNome) + (it.tamanho ? ' (' + tamanho(it.tamanho) + ')' : '') + '</b></div>' : '') +
        (it.link ? '<div><span>Onde está</span><b>' + esc(origemLink(it.link)) + '</b></div>' : '') +
        (it.fonteUso ? '<div><span>Onde usar</span><b>' + esc(it.fonteUso) + '</b></div>' : '') +
        (camp ? '<div><span>Campanha</span><b>' + esc(camp) + '</b></div>' : '') +
        '<div><span>Adicionado por</span><b>' + esc(it.__createdBy || '—') + '</b></div>' +
      '</div>' +
      (it.descricao ? '<div class="bb-ver-desc">' + esc(it.descricao) + '</div>' : '') +
      ((it.tags || []).length ? '<div class="bb-tags-mini grande">' + it.tags.map(function (g) { return '<span>' + esc(g) + '</span>'; }).join('') + '</div>' : '') +
      '<div class="modal-footer">' +
        '<button class="btn btn-ghost" onclick="closeModal(\'bibVerModal\');BB.editar(\'' + it.id + '\')"><i class="fa-solid fa-pen"></i>Editar</button>' +
        (it.link ? '<button class="btn btn-secondary" onclick="BB.copiarLink(\'' + it.id + '\')"><i class="fa-regular fa-copy"></i>Copiar link</button><a class="btn btn-secondary" href="' + esc(it.link) + '" target="_blank" rel="noopener"><i class="fa-solid fa-arrow-up-right-from-square"></i>Abrir</a>' : '') +
        (it.arquivoId ? '<button class="btn btn-primary" onclick="BB.baixar(\'' + it.id + '\')"><i class="fa-solid fa-download"></i>Baixar</button>' : '') +
      '</div>';
    openModal('bibVerModal');
  }

  // ---------- cadastro ----------
  function preencher(it) {
    var s = function (k, v) { var e = document.getElementById('bb_' + k); if (e) e.value = v == null ? '' : v; };
    s('id', it.id); s('titulo', it.titulo); s('empresa', it.empresa || 'click'); s('link', it.link); s('tags', (it.tags || []).join(', '));
    s('desc', it.descricao); s('fonteNome', it.fonteNome); s('fonteUso', it.fonteUso);
    s('cores', (it.cores || []).map(function (c) { return (c.nome ? c.nome + ' ' : '') + c.hex; }).join('\n'));
    document.getElementById('bb_fixado').checked = !!it.fixado;
    var camps = (typeof DB !== 'undefined' && DB.projects) || [];
    document.getElementById('bb_campanha').innerHTML = '<option value="">Nenhuma</option>' + camps.map(function (p) { return '<option value="' + esc(p.id) + '">' + esc(p.name) + '</option>'; }).join('');
    document.getElementById('bb_campanha').value = it.campanha || '';
    ui.arquivoNovo = null; ui.thumbNova = null;
    document.getElementById('bb_file').value = '';
    pintarDrop(it.arquivoNome ? { nome: it.arquivoNome, tamanho: it.tamanho, thumb: it.thumb, atual: true } : null);
    escolherTipo(it.tipo || 'logo');
    previaCores(); BB.previaLink();
  }
  function pintarDrop(info) {
    var el = document.getElementById('bb_dropTxt');
    if (!info) { el.innerHTML = '<i class="fa-solid fa-cloud-arrow-up"></i><span>Clique ou arraste um arquivo aqui</span>'; return; }
    el.innerHTML = (info.thumb ? '<img src="' + esc(info.thumb) + '" alt="">' : '<i class="fa-solid fa-file"></i>') +
      '<span><b>' + esc(info.nome) + '</b> ' + (info.tamanho ? tamanho(info.tamanho) : '') + (info.atual ? ' · arquivo atual (escolha outro para trocar)' : '') +
      (info.aviso ? '<br><em class="bb-aviso">' + info.aviso + '</em>' : '') + '</span>';
  }

  function novo(tipo) {
    montar();
    var cat = (typeof DB !== 'undefined' && DB.settings && DB.settings.category !== 'all') ? DB.settings.category : 'click';
    preencher({ id: '', tipo: tipo || (TIPOS[ui.tipo] ? ui.tipo : 'logo'), empresa: ui.empresa !== 'todas' ? ui.empresa : cat });
    document.getElementById('bbModalTitulo').textContent = 'Adicionar à biblioteca';
    document.getElementById('bbBtnExcluir').style.display = 'none';
    openModal('bibModal');
    setTimeout(function () { document.getElementById('bb_titulo').focus(); }, 60);
  }
  function editar(id) {
    montar();
    var it = item(id); if (!it) return;
    preencher(it);
    document.getElementById('bbModalTitulo').textContent = 'Editar item';
    document.getElementById('bbBtnExcluir').style.display = '';
    openModal('bibModal');
  }

  function salvar() {
    var g = function (k) { var e = document.getElementById('bb_' + k); return e ? e.value.trim() : ''; };
    var tipo = document.getElementById('bibModal').dataset.tipo || 'logo';
    var titulo = g('titulo');
    if (!titulo && tipo === 'fonte') titulo = g('fonteNome');
    if (!titulo && ui.arquivoNovo) titulo = ui.arquivoNovo.nome.replace(/\.[^.]+$/, '');
    if (!titulo) { showToast('Dê um nome para o item', 'error'); return; }
    var link = g('link') ? urlSegura(g('link')) : '';
    if (g('link') && !link) { showToast('Esse link não parece válido', 'error'); return; }
    var cores = tipo === 'cor' ? parseCores(g('cores')) : [];
    if (tipo === 'cor' && !cores.length) { showToast('Coloque pelo menos uma cor com o código (ex.: #132957)', 'error'); return; }
    var id = g('id') || genId();
    var antigo = item(id) || {};
    if (!link && !ui.arquivoNovo && !antigo.arquivoId && ['cor', 'fonte'].indexOf(tipo) === -1) {
      if (!confirm('Este item não tem link nem arquivo. Salvar assim mesmo?')) return;
    }
    var novo = Object.assign({}, antigo, {
      id: id, tipo: tipo, titulo: titulo, empresa: g('empresa'), link: link, descricao: g('desc'),
      tags: g('tags').split(',').map(function (s) { return s.trim(); }).filter(Boolean),
      campanha: g('campanha'), fixado: document.getElementById('bb_fixado').checked,
      cores: cores, fonteNome: tipo === 'fonte' ? g('fonteNome') : '', fonteUso: tipo === 'fonte' ? g('fonteUso') : ''
    });
    var btn = document.getElementById('bbBtnSalvar');
    var concluir = function () {
      firebaseCreate('biblioteca', novo);
      closeModal('bibModal');
      showToast(antigo.id ? 'Item atualizado' : 'Adicionado à biblioteca', 'success');
      btn.disabled = false;
      depois(render);
    };
    if (ui.arquivoNovo) {
      var a = ui.arquivoNovo;
      novo.thumb = ui.thumbNova || '';
      novo.arquivoNome = a.nome; novo.arquivoTipo = a.tipo; novo.tamanho = a.tamanho;
      if (a.data) {
        var arqId = antigo.arquivoId || genId();
        novo.arquivoId = arqId;
        btn.disabled = true;
        guardarArquivo(arqId, a).then(concluir, function (e) {
          btn.disabled = false;
          showToast('Não consegui enviar o arquivo (' + (e && e.message || e) + '). Use o link do Drive.', 'error');
        });
        return;
      }
      // arquivo grande: fica só a miniatura, o original precisa de link
      delete novo.arquivoId;
    }
    concluir();
  }

  function guardarArquivo(id, a) {
    var doc = { id: id, nome: a.nome, tipo: a.tipo, data: a.data, __createdAt: Date.now() };
    if (fireOk()) return COL('bibArquivos').doc(id).set(doc);
    try { localStorage.setItem('impresulBib:' + id, JSON.stringify(doc)); } catch (e) { return Promise.reject(new Error('sem espaço no navegador')); }
    return Promise.resolve();
  }
  function lerArquivo(id) {
    if (fireOk()) return COL('bibArquivos').doc(id).get().then(function (d) { return d.exists ? d.data() : null; });
    try { return Promise.resolve(JSON.parse(localStorage.getItem('impresulBib:' + id) || 'null')); } catch (e) { return Promise.resolve(null); }
  }

  function excluir() {
    var id = document.getElementById('bb_id').value; var it = item(id);
    if (!it || !confirm('Excluir "' + it.titulo + '" da biblioteca?')) return;
    if (it.arquivoId) {
      if (fireOk()) COL('bibArquivos').doc(it.arquivoId).delete().catch(function () {});
      else try { localStorage.removeItem('impresulBib:' + it.arquivoId); } catch (e) {}
    }
    firebaseDelete('biblioteca', id);
    closeModal('bibModal');
    showToast('Excluído da biblioteca', 'info');
    depois(render);
  }

  // ---------- API ----------
  window.BB = {
    render: render, novo: novo, editar: editar, salvar: salvar, excluir: excluir, ver: ver,
    tipo: function (t) { ui.tipo = t; render(); },
    empresa: function (e) { ui.empresa = e; render(); },
    tag: function (g) { ui.tag = norm(ui.tag) === norm(g) ? '' : g; render(); },
    buscar: function (t) { ui.busca = t; clearTimeout(ui._t); ui._t = setTimeout(render, 150); },
    ordem: function (o) { ui.ordem = o; render(); },
    copiarCor: function (hex) { copiar(hex, 'Cor ' + hex + ' copiada'); },
    copiarLink: function (id) { var it = item(id); if (it && it.link) copiar(it.link, 'Link copiado'); },
    previaLink: function () {
      var u = (document.getElementById('bb_link') || {}).value || '';
      var dica = document.getElementById('bb_linkDica'); if (!dica) return;
      var th = miniaturaDoLink(urlSegura(u));
      dica.innerHTML = th ? '<img class="bb-link-thumb" src="' + esc(th) + '" alt="" onerror="this.remove()"> Miniatura automática do ' + esc(origemLink(u)) + '.'
        : (u ? 'Link do ' + esc(origemLink(urlSegura(u))) + '.' : 'Dica: no Drive, use "Compartilhar → Qualquer pessoa da organização com o link" para a equipe conseguir abrir.');
    },
    arquivo: function (f) {
      if (!f) return;
      var info = { nome: f.name, tipo: f.type || 'application/octet-stream', tamanho: f.size };
      var terminar = function (thumb, dataUrl) {
        ui.thumbNova = thumb || null;
        if (f.size <= LIMITE) { info.data = dataUrl; ui.arquivoNovo = info; pintarDrop({ nome: f.name, tamanho: f.size, thumb: thumb }); }
        else {
          ui.arquivoNovo = info; // sem "data": só nome + miniatura
          pintarDrop({ nome: f.name, tamanho: f.size, thumb: thumb, aviso: 'Arquivo grande demais para enviar direto (máx. 700 KB). Vou guardar só a miniatura — cole o link do Drive com o original.' });
        }
        var t = document.getElementById('bb_titulo'); if (t && !t.value) t.value = f.name.replace(/\.[^.]+$/, '');
      };
      if (/^image\//.test(f.type)) miniatura(f, terminar);
      else {
        var r = new FileReader();
        r.onload = function () { terminar('', r.result); };
        if (f.size <= LIMITE) r.readAsDataURL(f); else terminar('', '');
      }
    },
    baixar: function (id) {
      var it = item(id); if (!it || !it.arquivoId) return;
      showToast('Preparando o download...', 'info');
      lerArquivo(it.arquivoId).then(function (d) {
        if (!d || !d.data) { showToast('Arquivo não encontrado', 'error'); return; }
        var a = document.createElement('a'); a.href = d.data; a.download = d.nome || it.arquivoNome || 'arquivo';
        document.body.appendChild(a); a.click(); a.remove();
      }, function (e) { showToast('Não consegui baixar: ' + e.message, 'error'); });
    },
    _parseCores: parseCores, _driveId: driveId
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', montar);
  else montar();
})();
