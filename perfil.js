/* ============================================================
   ABA "MEU PERFIL"
   ------------------------------------------------------------
   Mostra, para a pessoa logada:
   • Na minha pauta  → tudo em que ela é a responsável
     (tarefas, pautas, pendências, projetos, aprovações, outros setores)
   • O que eu fiz    → o que ela criou / editou / excluiu (Registro de
     Alterações) + pautas e cobranças que ela concluiu
   Só LÊ os dados que o sistema já tem (DB). Não grava nada.
   Clicar num item abre o mesmo editor que já existe em cada aba.
============================================================ */
/* global DB, CURRENT_USER, TEAM, navigate, editTask, editPauta, openProjectDetail, apAbrir, editCobranca */
(function () {
  var estado = { aba: 'pauta', tipo: 'todos', situacao: 'abertas', periodo: '30' };

  // ---------- utilidades ----------
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function norm(s) {
    return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
  }
  function hoje() {
    if (typeof today === 'function') return today(); // eslint-disable-line no-undef
    var d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }
  function data(d) {
    if (!d) return '';
    if (typeof fmtDate === 'function') { try { return fmtDate(d); } catch (e) {} } // eslint-disable-line no-undef
    var p = String(d).slice(0, 10).split('-'); return p.length === 3 ? p[2] + '/' + p[1] : d;
  }
  function quando(ms) {
    var d = new Date(ms), ag = new Date(), min = Math.round((ag - d) / 60000);
    if (isNaN(min)) return '';
    if (min < 1) return 'agora';
    if (min < 60) return 'há ' + min + ' min';
    if (d.toDateString() === ag.toDateString()) return 'hoje, ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    var ontem = new Date(ag); ontem.setDate(ag.getDate() - 1);
    if (d.toDateString() === ontem.toDateString()) return 'ontem, ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    return d.toLocaleDateString('pt-BR') + ', ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  }
  function lista(nome) { return (typeof DB !== 'undefined' && Array.isArray(DB[nome])) ? DB[nome] : []; }

  // ---------- quem sou eu ----------
  function eu() {
    var u = (typeof CURRENT_USER !== 'undefined' && CURRENT_USER) || {};
    var email = norm(u.email);
    var nomes = [];
    if (u.nome) { nomes.push(norm(u.nome)); nomes.push(norm(u.nome).split(/\s+/)[0]); }
    if (typeof TEAM !== 'undefined' && Array.isArray(TEAM)) {
      TEAM.forEach(function (t) { if (email && norm(t.email) === email) nomes.push(norm(t.name)); });
    }
    nomes = nomes.filter(function (n, i, a) { return n && a.indexOf(n) === i && n !== 'sistema' && n !== 'modo offline'; });
    return { nome: u.nome || '', email: email, emailOriginal: u.email || '', nomes: nomes, foto: u.foto || '' };
  }
  function eMeu(valor, me) {
    if (!valor) return false;
    var partes = Array.isArray(valor) ? valor : String(valor).split(/\s*(?:,|;|\/|&|\s+e\s+)\s*/);
    return partes.some(function (p) {
      var n = norm(p);
      if (!n) return false;
      return me.nomes.some(function (m) { return n === m || n.split(/\s+/)[0] === m || (me.email && n === me.email); });
    });
  }

  // ---------- "Na minha pauta" ----------
  var TIPOS = {
    tarefa:   { um: 'Tarefa', nome: 'Tarefas',        icone: 'fa-list-check' },
    pauta:    { um: 'Pauta', nome: 'Pautas',         icone: 'fa-rotate' },
    pendencia:{ um: 'Pendência', nome: 'Pendências',     icone: 'fa-clock' },
    projeto:  { um: 'Projeto', nome: 'Projetos',       icone: 'fa-folder-open' },
    aprovacao:{ um: 'Aprovação', nome: 'Aprovações',     icone: 'fa-check-double' },
    setor:    { um: 'Outros setores', nome: 'Outros setores', icone: 'fa-bell-concierge' },
    captacao: { um: 'Captação', nome: 'Captações', icone: 'fa-video' }
  };
  var ST_TAREFA = { pending: ['Pendente', 'laranja'], in_progress: ['Em progresso', 'azul'], review: ['Em revisão', 'roxo'], done: ['Concluída', 'verde'] };
  var ST_PROJ = { planning: ['Planejamento', 'azul'], in_progress: ['Em progresso', 'laranja'], review: ['Em revisão', 'roxo'], done: ['Concluído', 'verde'], paused: ['Pausado', 'cinza'] };
  var ST_AP = { pending: ['Aguardando', 'laranja'], approved: ['Aprovado', 'verde'], rejected: ['Reprovado', 'vermelho'], revision: ['Ajustes', 'amarelo'] };
  var ST_ROT = { pending: ['Pendente hoje', 'laranja'], in_progress: ['Em andamento', 'azul'], done: ['Feita hoje', 'verde'], overdue: ['Atrasada', 'vermelho'], not_done: ['Não realizada', 'cinza'] };
  var FREQ = { daily: 'Todo dia', weekly: 'Toda semana', monthly: 'Todo mês', biweekly: 'A cada 15 dias', once: 'Uma vez' };
  var PRIO = { urgent: ['Urgente', 'rosa'], high: ['Alta', 'vermelho'], medium: ['Média', 'laranja'], low: ['Baixa', 'verde'] };

  function minhaPauta(me) {
    var td = hoje(), itens = [];
    lista('tasks').forEach(function (t) {
      if (!eMeu(t.assignee, me)) return;
      var feito = t.status === 'done';
      var atrasado = !feito && t.date && t.date < td;
      itens.push({ tipo: 'tarefa', id: t.id, titulo: t.title, feito: feito, atrasado: atrasado,
        quando: t.date, extra: (t.time ? t.time : ''), st: ST_TAREFA[t.status] || [t.status || '—', 'cinza'], prio: PRIO[t.priority] });
    });
    // Pautas: o sistema guarda o status da última execução e não volta para "pendente"
    // sozinho. Então a pauta conta como concluída se estiver marcada como feita OU se a
    // tarefa ligada a ela (tarefa.pautaId) já estiver concluída.
    var tarefaDaPauta = {};
    lista('tasks').forEach(function (t) { if (t.pautaId) tarefaDaPauta[t.pautaId] = t; });
    var ST_PAUTA = { pending: ['Pendente', 'laranja'], in_progress: ['Em andamento', 'azul'], done: ['Feita', 'verde'], overdue: ['Atrasada', 'vermelho'], not_done: ['Não realizada', 'cinza'] };
    var pautasMinhas = {};
    lista('pautas').forEach(function (p) {
      if (!eMeu(p.assignee, me)) return;
      pautasMinhas[p.id] = true;
      var t = tarefaDaPauta[p.id];
      var feito = p.status === 'done' || p.status === 'not_done' || (t && t.status === 'done');
      var st = feito && p.status !== 'not_done' ? ST_PAUTA.done : (ST_PAUTA[p.status] || ['Rotina', 'azul']);
      itens.push({ tipo: 'pauta', id: p.id, titulo: p.name, feito: feito, atrasado: !feito && p.status === 'overdue',
        quando: '', extra: FREQ[p.frequency] || p.frequency || 'Rotina', st: st, prio: PRIO[p.priority] });
    });
    // a tarefa criada automaticamente para a pauta não aparece duas vezes
    for (var k = itens.length - 1; k >= 0; k--) {
      if (itens[k].tipo !== 'tarefa') continue;
      var tk = lista('tasks').find(function (t) { return t.id === itens[k].id; });
      if (tk && tk.pautaId && pautasMinhas[tk.pautaId]) itens.splice(k, 1);
    }
    lista('pending').forEach(function (p) {
      if (!eMeu(p.assignee, me)) return;
      itens.push({ tipo: 'pendencia', id: p.id, titulo: p.desc, feito: false, atrasado: false,
        quando: p.created, extra: '', st: ['Aberta', 'laranja'], prio: PRIO[p.priority] });
    });
    lista('projects').forEach(function (p) {
      if (!eMeu(p.assignee, me)) return;
      var feito = p.status === 'done';
      itens.push({ tipo: 'projeto', id: p.id, titulo: p.name, feito: feito, atrasado: !feito && p.deadline && p.deadline < td,
        quando: p.deadline, extra: (p.progress != null ? p.progress + '%' : ''), st: ST_PROJ[p.status] || [p.status || '—', 'cinza'] });
    });
    lista('approvals').forEach(function (a) {
      if (!eMeu(a.assignee, me)) return;
      var feito = a.status === 'approved' || a.status === 'rejected';
      itens.push({ tipo: 'aprovacao', id: a.id, titulo: a.title || a.name, feito: feito, atrasado: false,
        quando: a.date || '', extra: '', st: ST_AP[a.status] || ['Rascunho', 'cinza'] });
    });
    lista('captacoes').forEach(function (c) {
      var meu = typeof window.CP_envolve === 'function' ? window.CP_envolve(c, me.nomes) : eMeu(c.responsavel, me);
      if (!meu) return;
      var feito = c.status === 'gravado' || c.status === 'editado' || c.status === 'cancelada';
      var st = (window.CP && window.CP.ST && window.CP.ST[c.status]) || { nome: 'A confirmar', cor: 'laranja' };
      itens.push({ tipo: 'captacao', id: c.id, titulo: c.titulo, feito: feito, atrasado: !feito && c.data && c.data < td,
        quando: c.data, extra: [c.hora, c.local].filter(Boolean).join(' · '), st: [st.nome, st.cor] });
    });
    lista('cobrancas').forEach(function (c) {
      if (!eMeu(c.responsible, me)) return;
      var feito = c.status === 'done';
      itens.push({ tipo: 'setor', id: c.id, titulo: c.name, feito: feito, atrasado: c.status === 'overdue',
        quando: c.deadlineDate, extra: FREQ[c.frequency] || '', st: ST_ROT[c.status] || ['—', 'cinza'], prio: PRIO[c.priority] });
    });
    // atrasados primeiro, depois por data
    itens.sort(function (a, b) {
      if (a.atrasado !== b.atrasado) return a.atrasado ? -1 : 1;
      return String(a.quando || '9999').localeCompare(String(b.quando || '9999'));
    });
    return itens;
  }

  // ---------- "O que eu fiz" ----------
  var ACAO = { criou: ['fa-plus', 'verde', 'Criou'], editou: ['fa-pen', 'azul', 'Editou'], excluiu: ['fa-trash', 'vermelho', 'Excluiu'],
    concluiu: ['fa-check', 'verde', 'Concluiu'], enviou: ['fa-paper-plane', 'roxo', 'Enviou'] };

  function meuHistorico(me) {
    var ev = [];
    lista('audit').forEach(function (r) {
      var meu = (me.email && norm(r.email) === me.email) || (!r.email && eMeu(r.usuario, me));
      if (!meu) return;
      ev.push({ ms: r.__createdAt || Date.parse(r.quando), acao: r.acao, aba: r.aba, titulo: r.titulo, campos: r.campos || [] });
    });
    lista('pautaHistory').forEach(function (h) {
      if (h.status !== 'done' || !eMeu(h.assignee, me)) return;
      ev.push({ ms: h.__createdAt || Date.parse(h.date), acao: 'concluiu', aba: 'Pauta Operacional', titulo: h.name, campos: [], obs: h.obs });
    });
    lista('cobrancaHistory').forEach(function (h) {
      if (!eMeu(h.responsible, me)) return;
      var envio = h.type === 'email';
      ev.push({ ms: h.__createdAt || Date.parse(h.date), acao: envio ? 'enviou' : 'concluiu', aba: 'Outros Setores',
        titulo: h.name, campos: [], obs: envio ? ('e-mail para ' + (h.email || '')) : h.observations });
    });
    // tira duplicados (a mesma conclusão pode aparecer no registro e no histórico)
    ev.sort(function (a, b) { return (b.ms || 0) - (a.ms || 0); });
    return ev;
  }

  // ---------- abrir um item no editor que já existe ----------
  window.perfilAbrir = function (tipo, id) {
    try {
      if (tipo === 'tarefa' && typeof editTask === 'function') return editTask(id);
      if (tipo === 'pauta' && typeof editPauta === 'function') return editPauta(id);
      if (tipo === 'projeto' && typeof openProjectDetail === 'function') return openProjectDetail(id);
      if (tipo === 'setor' && typeof editCobranca === 'function') return editCobranca(id);
      if (tipo === 'aprovacao') { navigate('aprovacoes'); if (typeof apAbrir === 'function') setTimeout(function () { apAbrir(id); }, 300); return; }
      if (tipo === 'pendencia') return navigate('pendencias');
      if (tipo === 'captacao') { navigate('captacao'); if (window.CP) setTimeout(function () { window.CP.editar(id); }, 80); return; }
    } catch (e) { console.warn('[perfil] não consegui abrir', tipo, id, e); }
  };
  window.perfilFiltro = function (campo, valor) { estado[campo] = valor; window.renderPerfil(); };

  // ---------- foto de perfil ----------
  // A foto é reduzida para 256×256 (JPEG) e guardada:
  //  • no Firebase, em teams/impresul/perfis/{e-mail}  → aparece em qualquer computador
  //  • no navegador (localStorage)                     → aparece na hora, mesmo antes do Firebase responder
  var FOTO_LS = 'impresulFoto:';
  var fotoOriginal = null; // foto que veio do login (Google etc.), para "remover foto"
  var fotoBuscada = {};

  function chaveEmail(e) { return norm(e).replace(/[^a-z0-9]+/g, '_'); }
  function usuario() { return (typeof CURRENT_USER !== 'undefined' && CURRENT_USER) || null; }

  function aplicarFotoSalva() {
    var u = usuario(); if (!u || !u.email) return;
    if (fotoOriginal === null) fotoOriginal = u.foto || '';
    var salva = null;
    try { salva = localStorage.getItem(FOTO_LS + norm(u.email)); } catch (e) {}
    if (salva !== null) u.foto = salva || fotoOriginal;
  }

  function buscarFotoNoFirebase() {
    var u = usuario(); if (!u || !u.email || fotoBuscada[u.email]) return;
    fotoBuscada[u.email] = true;
    try {
      if (typeof fdb === 'undefined' || !fdb || typeof COL !== 'function') return; // eslint-disable-line no-undef
      COL('perfis').doc(chaveEmail(u.email)).get().then(function (d) { // eslint-disable-line no-undef
        if (!d.exists) return;
        var f = (d.data() || {}).foto;
        if (typeof f !== 'string') return;
        try { localStorage.setItem(FOTO_LS + norm(u.email), f); } catch (e) {}
        var nova = f || fotoOriginal || '';
        if (u.foto !== nova) { u.foto = nova; pintarDeNovo(); }
      }).catch(function (e) { console.warn('[perfil] foto:', e.message); });
    } catch (e) {}
  }

  function pintarDeNovo() {
    if (typeof window.__pfPintarOriginal === 'function') window.__pfPintarOriginal();
    if (typeof currentPage !== 'undefined' && currentPage === 'perfil') window.renderPerfil(); // eslint-disable-line no-undef
  }

  // o sistema chama authPintarUsuario() depois do login: antes de pintar, aplicamos a foto escolhida
  function ligarNoLogin() {
    if (typeof window.authPintarUsuario !== 'function' || window.__pfPintarOriginal) return;
    window.__pfPintarOriginal = window.authPintarUsuario;
    window.authPintarUsuario = function () {
      aplicarFotoSalva();
      window.__pfPintarOriginal.apply(this, arguments);
      buscarFotoNoFirebase();
    };
    if (usuario()) window.authPintarUsuario();
  }

  function salvarFoto(dataUrl) {
    var u = usuario(); if (!u || !u.email) { aviso('Entre com o seu login para trocar a foto.', 'error'); return; }
    if (fotoOriginal === null) fotoOriginal = u.foto || '';
    u.foto = dataUrl || fotoOriginal || '';
    try { localStorage.setItem(FOTO_LS + norm(u.email), dataUrl || ''); } catch (e) {}
    pintarDeNovo();
    try {
      if (typeof fdb !== 'undefined' && fdb && typeof COL === 'function') { // eslint-disable-line no-undef
        COL('perfis').doc(chaveEmail(u.email)).set({ email: norm(u.email), nome: u.nome || '', foto: dataUrl || '', __updatedAt: Date.now() }, { merge: true }) // eslint-disable-line no-undef
          .then(function () { aviso(dataUrl ? 'Foto atualizada!' : 'Foto removida'); })
          .catch(function (e) { aviso('A foto ficou só neste navegador (' + e.message + ')', 'error'); });
        return;
      }
    } catch (e) {}
    aviso(dataUrl ? 'Foto atualizada neste navegador' : 'Foto removida');
  }

  function aviso(msg, tipo) {
    if (typeof showToast === 'function') showToast(msg, tipo || 'success'); // eslint-disable-line no-undef
  }

  window.perfilEscolherFoto = function () {
    var inp = document.getElementById('pfFotoInput');
    if (inp) { inp.value = ''; inp.click(); }
  };
  window.perfilRemoverFoto = function () {
    if (confirm('Remover a sua foto de perfil?')) salvarFoto('');
  };
  window.perfilFotoEscolhida = function (inp) {
    var f = inp.files && inp.files[0];
    if (!f) return;
    if (!/^image\//.test(f.type)) { aviso('Escolha um arquivo de imagem (JPG, PNG, WEBP...)', 'error'); return; }
    var leitor = new FileReader();
    leitor.onload = function () {
      var img = new Image();
      img.onload = function () {
        var T = 256, lado = Math.min(img.width, img.height);
        var cv = document.createElement('canvas'); cv.width = T; cv.height = T;
        var cx = cv.getContext('2d');
        cx.fillStyle = '#fff'; cx.fillRect(0, 0, T, T);
        cx.drawImage(img, (img.width - lado) / 2, (img.height - lado) / 2, lado, lado, 0, 0, T, T);
        salvarFoto(cv.toDataURL('image/jpeg', 0.85));
      };
      img.onerror = function () { aviso('Não consegui abrir essa imagem', 'error'); };
      img.src = leitor.result;
    };
    leitor.readAsDataURL(f);
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', ligarNoLogin);
  else setTimeout(ligarNoLogin, 0);

  // ---------- desenho ----------
  function chip(campo, valor, rotulo, n) {
    return '<button class="pf-chip' + (estado[campo] === valor ? ' on' : '') + '" onclick="perfilFiltro(\'' + campo + '\',\'' + valor + '\')">' +
      rotulo + (n != null ? ' <em>' + n + '</em>' : '') + '</button>';
  }
  function selo(par) { return par ? '<span class="pf-selo pf-' + par[1] + '">' + esc(par[0]) + '</span>' : ''; }

  function htmlPauta(itens) {
    var porSit = itens.filter(function (i) {
      if (estado.situacao === 'abertas') return !i.feito;
      if (estado.situacao === 'concluidas') return i.feito;
      return true;
    });
    var cont = {}; porSit.forEach(function (i) { cont[i.tipo] = (cont[i.tipo] || 0) + 1; });
    var vis = porSit.filter(function (i) { return estado.tipo === 'todos' || i.tipo === estado.tipo; });

    var filtros = '<div class="pf-filtros"><div class="pf-chips">' + chip('tipo', 'todos', 'Tudo', porSit.length) +
      Object.keys(TIPOS).filter(function (k) { return cont[k]; }).map(function (k) { return chip('tipo', k, TIPOS[k].nome, cont[k]); }).join('') +
      '</div><div class="pf-seg">' + chip('situacao', 'abertas', 'Em aberto') + chip('situacao', 'concluidas', 'Concluídas') + chip('situacao', 'todas', 'Todas') + '</div></div>';

    if (!vis.length) {
      return filtros + '<div class="pf-vazio"><i class="fa-solid fa-mug-hot"></i><p>' +
        (estado.situacao === 'abertas' ? 'Nada em aberto na sua pauta. Bom trabalho!' : 'Nada por aqui ainda.') + '</p></div>';
    }
    return filtros + '<div class="pf-lista">' + vis.map(function (i) {
      var t = TIPOS[i.tipo];
      var meta = [t.um];
      if (i.quando) meta.push('<i class="fa-regular fa-calendar"></i> ' + esc(data(i.quando)));
      if (i.extra) meta.push(esc(i.extra));
      return '<button class="pf-item' + (i.feito ? ' feito' : '') + (i.atrasado ? ' atrasado' : '') + '" onclick="perfilAbrir(\'' + i.tipo + '\',\'' + esc(i.id) + '\')">' +
        '<span class="pf-ico"><i class="fa-solid ' + t.icone + '"></i></span>' +
        '<span class="pf-txt"><b>' + esc(i.titulo || '(sem título)') + '</b><small>' + meta.join(' · ') + '</small></span>' +
        '<span class="pf-selos">' + (i.atrasado ? '<span class="pf-selo pf-vermelho">Atrasado</span>' : '') + selo(i.prio) + selo(i.st) + '</span>' +
        '<i class="fa-solid fa-chevron-right pf-seta"></i></button>';
    }).join('') + '</div>';
  }

  function htmlFeito(ev) {
    var limite = estado.periodo === 'todos' ? 0 : Date.now() - Number(estado.periodo) * 86400000;
    var vis = ev.filter(function (e) { return !limite || (e.ms || 0) >= limite; });
    var filtros = '<div class="pf-filtros"><div class="pf-seg">' + chip('periodo', '7', '7 dias') + chip('periodo', '30', '30 dias') +
      chip('periodo', '90', '90 dias') + chip('periodo', 'todos', 'Tudo') + '</div></div>';
    if (!vis.length) return filtros + '<div class="pf-vazio"><i class="fa-solid fa-clock-rotate-left"></i><p>Nenhuma ação registrada nesse período.</p></div>';

    var html = '', diaAtual = '';
    vis.forEach(function (e) {
      var d = new Date(e.ms), dia = isNaN(d) ? 'Sem data' : d.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' });
      if (dia !== diaAtual) { html += '<div class="pf-dia">' + esc(dia) + '</div>'; diaAtual = dia; }
      var a = ACAO[e.acao] || ['fa-circle', 'cinza', e.acao];
      var det = e.acao === 'editou' && e.campos.length ? ' <span class="pf-campos">(' + esc(e.campos.slice(0, 4).join(', ')) + ')</span>' : '';
      html += '<div class="pf-ev"><span class="pf-ev-ico pf-' + a[1] + '"><i class="fa-solid ' + a[0] + '"></i></span>' +
        '<div class="pf-ev-txt"><div><b>' + a[2] + '</b> em ' + esc(e.aba || '') + ': “' + esc(e.titulo || '') + '”' + det + '</div>' +
        (e.obs ? '<small class="pf-obs">' + esc(e.obs) + '</small>' : '') + '</div>' +
        '<span class="pf-ev-hora">' + esc(quando(e.ms)) + '</span></div>';
    });
    return filtros + '<div class="pf-linha">' + html + '</div>';
  }

  window.renderPerfil = function () {
    var root = document.getElementById('perfilRoot');
    if (!root) return;
    // Com o caderno aberto, não redesenha a tela inteira (o sistema chama esta
    // função a cada mudança no Firebase e isso apagaria o que está sendo digitado)
    if (estado.aba === 'caderno') {
      var cd = document.getElementById('cadernoRoot');
      if (cd && cd.dataset.ok && root.contains(cd)) { if (window.CD) window.CD.atualizar(); return; }
    }
    var me = eu();
    var itens = minhaPauta(me), ev = meuHistorico(me);
    var abertas = itens.filter(function (i) { return !i.feito; }).length;
    var atrasadas = itens.filter(function (i) { return i.atrasado; }).length;
    var td = hoje();
    var concluidas = itens.filter(function (i) { return i.feito; }).length;
    var mes = ev.filter(function (e) { return (e.ms || 0) >= Date.now() - 30 * 86400000; }).length;
    var hojeN = lista('tasks').filter(function (t) { return eMeu(t.assignee, me) && t.date === td && t.status !== 'done'; }).length;

    var av = document.getElementById('userAvatarSidebar');
    var avatar = av ? av.innerHTML : esc((me.nome || '?').slice(0, 2).toUpperCase());
    var semNome = !me.nomes.length;

    root.innerHTML =
      '<div class="pf-topo">' +
        '<div class="pf-cartao">' +
          '<button class="pf-avatar" onclick="perfilEscolherFoto()" title="Trocar foto">' + avatar +
            '<span class="pf-avatar-cam"><i class="fa-solid fa-camera"></i></span></button>' +
          '<input type="file" id="pfFotoInput" accept="image/*" hidden onchange="perfilFotoEscolhida(this)">' +
          '<div class="pf-quem"><div class="pf-nome">' + esc(me.nome || 'Sem login') + '</div>' +
          '<div class="pf-email">' + esc(me.emailOriginal) + '</div>' +
          '<div class="pf-foto-acoes"><button onclick="perfilEscolherFoto()"><i class="fa-solid fa-camera"></i> Trocar foto</button>' +
          '<button onclick="window.AV && AV.preferencias()"><i class="fa-solid fa-bell"></i> Avisos</button>' +
          (me.foto ? '<button onclick="perfilRemoverFoto()">Remover</button>' : '') + '</div>' +
          '<div class="pf-tags">' + (me.nomes.length ? me.nomes.slice(0, 3).map(function (n) { return '<span>' + esc(n) + '</span>'; }).join('') : '') + '</div></div>' +
        '</div>' +
        '<div class="pf-numeros">' +
          '<div class="pf-num"><b>' + hojeN + '</b><span>Para hoje</span></div>' +
          '<div class="pf-num"><b>' + abertas + '</b><span>Em aberto</span></div>' +
          '<div class="pf-num' + (atrasadas ? ' alerta' : '') + '"><b>' + atrasadas + '</b><span>Atrasadas</span></div>' +
          '<div class="pf-num"><b>' + concluidas + '</b><span>Concluídas</span></div>' +
          '<div class="pf-num"><b>' + mes + '</b><span>Ações em 30 dias</span></div>' +
        '</div>' +
      '</div>' +
      (semNome ? '<div class="pf-aviso"><i class="fa-solid fa-circle-info"></i> Entre com o seu login para ver a sua pauta.</div>' : '') +
      '<div class="pf-abas">' +
        '<button class="pf-aba' + (estado.aba === 'pauta' ? ' on' : '') + '" onclick="perfilFiltro(\'aba\',\'pauta\')"><i class="fa-solid fa-inbox"></i> Na minha pauta <em>' + abertas + '</em></button>' +
        '<button class="pf-aba' + (estado.aba === 'feito' ? ' on' : '') + '" onclick="perfilFiltro(\'aba\',\'feito\')"><i class="fa-solid fa-clock-rotate-left"></i> O que eu fiz</button>' +
        '<button class="pf-aba' + (estado.aba === 'caderno' ? ' on' : '') + '" onclick="perfilFiltro(\'aba\',\'caderno\')"><i class="fa-solid fa-book"></i> Meu caderno</button>' +
      '</div>' +
      (estado.aba === 'caderno'
        ? '<div class="pf-corpo card cd-wrap"><div id="cadernoRoot"></div></div>' +
          '<p class="pf-rodape">O caderno é pessoal: só aparece no seu perfil. Ele salva sozinho enquanto você escreve.</p>'
        : '<div class="pf-corpo card">' + (estado.aba === 'pauta' ? htmlPauta(itens) : htmlFeito(ev)) + '</div>' +
          '<p class="pf-rodape">A pauta mostra o que está com o seu nome como responsável. "O que eu fiz" vem do Registro de Alterações e dos históricos de pautas e outros setores.</p>');
    if (estado.aba === 'caderno' && window.CD) window.CD.montar(document.getElementById('cadernoRoot'));
  };
})();
