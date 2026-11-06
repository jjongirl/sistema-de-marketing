/* ============================================================
   ABA "CAPTAÇÃO" — agenda de gravações (vídeo / foto)
   ------------------------------------------------------------
   Dados na coleção "captacoes" (Firebase, em tempo real), salvos
   pelo mesmo caminho do resto do sistema (firebaseCreate), então
   aparecem no Registro de Alterações e no "Meu Perfil".
   Tudo fica dentro de window.CP.
============================================================ */
/* global DB, TEAM, today, fmtDate, genId, firebaseCreate, firebaseDelete, openModal, closeModal, showToast,
          filterByCategory, catBadge, navigate, currentPage, AUDIT_CAMPOS */
(function () {
  var ST = {
    a_confirmar: { nome: 'A confirmar', cor: 'laranja', ico: 'fa-hourglass-half' },
    confirmada:  { nome: 'Confirmada',  cor: 'azul',    ico: 'fa-calendar-check' },
    gravado:     { nome: 'Gravado',     cor: 'verde',   ico: 'fa-circle-check' },
    editado:     { nome: 'Editado',     cor: 'roxo',    ico: 'fa-film' },
    cancelada:   { nome: 'Cancelada',   cor: 'cinza',   ico: 'fa-ban' }
  };
  var TIPOS = ['Reels', 'Vídeo institucional', 'Depoimento', 'Bastidores', 'Produto', 'Fotos', 'Evento', 'Entrevista', 'Outro'];
  var EQUIP_PADRAO = 'Câmera / celular carregado\nCartão de memória livre\nMicrofone\nLuz / ring light\nTripé\nRoteiro impresso';
  var MES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
  var MES3 = ['JAN', 'FEV', 'MAR', 'ABR', 'MAI', 'JUN', 'JUL', 'AGO', 'SET', 'OUT', 'NOV', 'DEZ'];
  var DIA = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];

  var ui = { vista: 'agenda', filtro: 'ativas', busca: '', mes: null, verPassadas: false };

  if (typeof AUDIT_CAMPOS === 'object' && AUDIT_CAMPOS) {
    try { Object.assign(AUDIT_CAMPOS, { local: 'local', hora: 'horário', horaFim: 'horário de término', participantes: 'participantes', tipo: 'tipo', roteiro: 'roteiro', equipamentos: 'equipamentos', linkArquivos: 'link dos arquivos' }); } catch (e) {}
  }

  // ---------- utilidades ----------
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function norm(s) { return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim(); }
  function hoje() { return typeof today === 'function' ? today() : new Date().toISOString().slice(0, 10); }
  function lista() { return (typeof DB !== 'undefined' && Array.isArray(DB.captacoes)) ? DB.captacoes : []; }
  function porCategoria(arr) { return typeof filterByCategory === 'function' ? filterByCategory(arr) : arr; }
  function addDias(iso, n) { var d = new Date(iso + 'T12:00:00'); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); }
  function dt(iso) { return new Date(iso + 'T12:00:00'); }
  function eu() {
    var u = (typeof CURRENT_USER !== 'undefined' && CURRENT_USER) || {}; // eslint-disable-line no-undef
    var nomes = [];
    if (u.nome) { nomes.push(norm(u.nome)); nomes.push(norm(u.nome).split(/\s+/)[0]); }
    if (typeof TEAM !== 'undefined') TEAM.forEach(function (t) { if (u.email && norm(t.email) === norm(u.email)) nomes.push(norm(t.name)); });
    return nomes.filter(Boolean);
  }
  function envolve(c, nomes) {
    var txt = [c.responsavel, c.participantes].join(',');
    return txt.split(/\s*(?:,|;|\/|&|\s+e\s+)\s*/).some(function (p) {
      var n = norm(p); return n && nomes.some(function (m) { return n === m || n.split(/\s+/)[0] === m; });
    });
  }
  function ativa(c) { return c.status === 'a_confirmar' || c.status === 'confirmada' || !c.status; }
  window.CP_envolve = envolve; // usado pelo Meu Perfil

  // ---------- montagem da página (uma vez) ----------
  function montar() {
    var pg = document.getElementById('page-captacao');
    if (!pg || pg.dataset.montado) return;
    pg.dataset.montado = '1';
    pg.innerHTML =
      '<div class="section-header"><div>' +
        '<div class="section-title">Captação</div>' +
        '<div class="section-subtitle">Agenda de gravações de vídeo e fotos da equipe</div>' +
      '</div><div class="cp-topo-acoes">' +
        '<div class="cp-vistas"><button data-v="agenda" onclick="CP.vista(\'agenda\')"><i class="fa-solid fa-list"></i>Agenda</button>' +
        '<button data-v="mes" onclick="CP.vista(\'mes\')"><i class="fa-solid fa-calendar-days"></i>Calendário</button></div>' +
        '<button class="btn btn-primary" onclick="CP.nova()"><i class="fa-solid fa-plus"></i>Nova captação</button>' +
      '</div></div>' +
      '<div class="stat-grid" id="cpStats"></div>' +
      '<div class="cp-filtros">' +
        '<div class="search-bar" style="width:240px"><i class="fa-solid fa-magnifying-glass"></i><input type="text" placeholder="Buscar captação, local, pessoa..." oninput="CP.buscar(this.value)"></div>' +
        '<div class="cp-chips" id="cpChips"></div>' +
      '</div>' +
      '<div id="cpConteudo"></div>';
    montarModal();
  }

  function montarModal() {
    if (document.getElementById('captacaoModal')) return;
    var equipe = (typeof TEAM !== 'undefined' ? TEAM : []).map(function (t) { return '<option value="' + esc(t.name) + '">'; }).join('');
    var m = document.createElement('div');
    m.className = 'modal-overlay';
    m.id = 'captacaoModal';
    m.innerHTML =
      '<div class="modal modal-lg">' +
        '<div class="modal-header"><div class="modal-title" id="cpModalTitulo">Nova captação</div>' +
          '<button class="modal-close" onclick="closeModal(\'captacaoModal\')"><i class="fa-solid fa-xmark"></i></button></div>' +
        '<input type="hidden" id="cp_id">' +
        '<div class="form-group"><label class="form-label">O que vai ser gravado *</label>' +
          '<input class="form-control" id="cp_titulo" placeholder="ex: Reels bastidores da impressão de banners"></div>' +
        '<div class="form-row-3 cp-form-3">' +
          '<div class="form-group"><label class="form-label">Data *</label><input type="date" class="form-control" id="cp_data"></div>' +
          '<div class="form-group"><label class="form-label">Início</label><input type="time" class="form-control" id="cp_hora"></div>' +
          '<div class="form-group"><label class="form-label">Término</label><input type="time" class="form-control" id="cp_horaFim"></div>' +
        '</div>' +
        '<div class="form-row cp-form-2">' +
          '<div class="form-group"><label class="form-label">Tipo</label><select class="form-control" id="cp_tipo">' +
            TIPOS.map(function (t) { return '<option>' + t + '</option>'; }).join('') + '</select></div>' +
          '<div class="form-group"><label class="form-label">Empresa</label><select class="form-control" id="cp_category">' +
            '<option value="click">Click Impresso</option><option value="impresul">Impresul</option><option value="geral">Geral</option></select></div>' +
        '</div>' +
        '<div class="form-group"><label class="form-label">Local</label>' +
          '<input class="form-control" id="cp_local" placeholder="ex: Fábrica — setor de acabamento / Estúdio / Cliente X"></div>' +
        '<div class="form-row cp-form-2">' +
          '<div class="form-group"><label class="form-label">Quem grava (responsável)</label>' +
            '<input class="form-control" id="cp_responsavel" list="cpEquipe" placeholder="Nome"></div>' +
          '<div class="form-group"><label class="form-label">Quem aparece / participa</label>' +
            '<input class="form-control" id="cp_participantes" list="cpEquipe" placeholder="ex: Laura, Victor, cliente"></div>' +
        '</div>' +
        '<datalist id="cpEquipe">' + equipe + '</datalist>' +
        '<div class="form-row cp-form-2">' +
          '<div class="form-group"><label class="form-label">Status</label><select class="form-control" id="cp_status">' +
            Object.keys(ST).map(function (k) { return '<option value="' + k + '">' + ST[k].nome + '</option>'; }).join('') + '</select></div>' +
          '<div class="form-group"><label class="form-label">Link dos arquivos <span class="cp-opc">(Drive, depois de gravar)</span></label>' +
            '<input class="form-control" id="cp_link" placeholder="https://drive.google.com/..."></div>' +
        '</div>' +
        '<div class="form-group"><label class="form-label">Campanha <span class="cp-opc">(opcional)</span></label>' +
          '<select class="form-control" id="cp_campanha"><option value="">Nenhuma campanha</option></select></div>' +
        '<div class="form-group"><label class="form-label">Roteiro / briefing</label>' +
          '<textarea class="form-control" id="cp_roteiro" rows="4" placeholder="Cenas, falas, referências, o que não pode faltar..."></textarea></div>' +
        '<div class="form-group"><label class="form-label">Checklist de equipamentos <span class="cp-opc">(um por linha)</span></label>' +
          '<textarea class="form-control" id="cp_equip" rows="4"></textarea></div>' +
        '<div class="form-group"><label class="form-label">Observações</label>' +
          '<textarea class="form-control" id="cp_obs" rows="2" placeholder="Autorização de imagem, figurino, estacionamento..."></textarea></div>' +
        '<div class="modal-footer">' +
          '<button class="btn btn-ghost cp-excluir" id="cpBtnExcluir" onclick="CP.excluir()"><i class="fa-solid fa-trash"></i>Excluir</button>' +
          '<button class="btn btn-secondary" onclick="closeModal(\'captacaoModal\')">Cancelar</button>' +
          '<button class="btn btn-primary" onclick="CP.salvar()"><i class="fa-solid fa-check"></i>Salvar</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(m);
  }

  // ---------- desenho ----------
  function selo(st) { var s = ST[st] || ST.a_confirmar; return '<span class="pf-selo pf-' + s.cor + '"><i class="fa-solid ' + s.ico + '"></i> ' + s.nome + '</span>'; }
  function horario(c) { return c.hora ? (c.hora + (c.horaFim ? '–' + c.horaFim : '')) : 'Horário a definir'; }

  function filtrar() {
    var nomes = eu(), b = norm(ui.busca);
    return porCategoria(lista()).filter(function (c) {
      if (ui.filtro === 'ativas' && !ativa(c)) return false;
      if (ui.filtro === 'minhas' && !envolve(c, nomes)) return false;
      if (ST[ui.filtro] && c.status !== ui.filtro) return false;
      if (b && norm([c.titulo, c.local, c.responsavel, c.participantes, c.tipo, c.roteiro].join(' ')).indexOf(b) === -1) return false;
      return true;
    });
  }

  function cartao(c) {
    var d = dt(c.data || hoje());
    var eq = String(c.equipamentos || '').split('\n').map(function (s) { return s.trim(); }).filter(Boolean);
    var feitos = (c.equipOk || []).filter(Boolean).length;
    var acoes = '';
    if (ativa(c)) acoes += '<button class="btn btn-xs btn-secondary" onclick="event.stopPropagation();CP.status(\'' + c.id + '\',\'gravado\')"><i class="fa-solid fa-check"></i>Marcar gravado</button>';
    if (c.status === 'a_confirmar') acoes += '<button class="btn btn-xs btn-ghost" onclick="event.stopPropagation();CP.status(\'' + c.id + '\',\'confirmada\')"><i class="fa-solid fa-calendar-check"></i>Confirmar</button>';
    if (c.status === 'gravado' && !c.tarefaEdicao) acoes += '<button class="btn btn-xs btn-primary" onclick="event.stopPropagation();CP.tarefaEdicao(\'' + c.id + '\')"><i class="fa-solid fa-scissors"></i>Criar tarefa de edição</button>';
    if (c.tarefaEdicao) acoes += '<span class="cp-ok"><i class="fa-solid fa-scissors"></i> Edição na fila</span>';
    if (c.linkArquivos) acoes += '<a class="btn btn-xs btn-ghost" href="' + esc(c.linkArquivos) + '" target="_blank" rel="noopener" onclick="event.stopPropagation()"><i class="fa-solid fa-folder-open"></i>Arquivos</a>';

    return '<div class="cp-card st-' + (c.status || 'a_confirmar') + '" onclick="CP.editar(\'' + c.id + '\')">' +
      '<div class="cp-data"><b>' + d.getDate() + '</b><span>' + MES3[d.getMonth()] + '</span><small>' + DIA[d.getDay()].slice(0, 3) + '</small></div>' +
      '<div class="cp-info">' +
        '<div class="cp-linha1"><span class="cp-hora"><i class="fa-regular fa-clock"></i> ' + esc(horario(c)) + '</span>' +
          '<span class="cp-tipo">' + esc(c.tipo || 'Captação') + '</span>' + (typeof catBadge === 'function' ? catBadge(c.category) : '') + '</div>' +
        '<div class="cp-titulo">' + esc(c.titulo || '(sem título)') + '</div>' +
        '<div class="cp-meta">' +
          (c.local ? '<span><i class="fa-solid fa-location-dot"></i> ' + esc(c.local) + '</span>' : '') +
          (c.responsavel ? '<span><i class="fa-solid fa-video"></i> ' + esc(c.responsavel) + '</span>' : '') +
          (c.participantes ? '<span><i class="fa-solid fa-user-group"></i> ' + esc(c.participantes) + '</span>' : '') +
          (nomeCampanha(c.campanha) ? '<span><i class="fa-solid fa-bullhorn"></i> ' + esc(nomeCampanha(c.campanha)) + '</span>' : '') +
          (eq.length ? '<span><i class="fa-solid fa-toolbox"></i> ' + feitos + '/' + eq.length + ' equipamentos</span>' : '') +
        '</div>' +
        (eq.length && ativa(c) && c.data && c.data <= addDias(hoje(), 2)
          ? '<div class="cp-equip">' + eq.map(function (e, i) {
              var ok = !!(c.equipOk || [])[i];
              return '<button class="cp-eq' + (ok ? ' ok' : '') + '" onclick="event.stopPropagation();CP.equip(\'' + c.id + '\',' + i + ')">' +
                '<i class="fa-' + (ok ? 'solid fa-square-check' : 'regular fa-square') + '"></i> ' + esc(e) + '</button>';
            }).join('') + '</div>' : '') +
        (acoes ? '<div class="cp-acoes">' + acoes + '</div>' : '') +
      '</div>' +
      '<div class="cp-status">' + selo(c.status) + '</div>' +
    '</div>';
  }

  function vistaAgenda(itens) {
    var td = hoje(), em7 = addDias(td, 7);
    var g = { hoje: [], semana: [], depois: [], semData: [], passadas: [] };
    itens.forEach(function (c) {
      if (!c.data) g.semData.push(c);
      else if (c.data === td) g.hoje.push(c);
      else if (c.data > td && c.data <= em7) g.semana.push(c);
      else if (c.data > em7) g.depois.push(c);
      else g.passadas.push(c);
    });
    var ord = function (a, b) { return (a.data + (a.hora || '99')).localeCompare(b.data + (b.hora || '99')); };
    Object.keys(g).forEach(function (k) { g[k].sort(ord); });
    g.passadas.reverse();

    function grupo(titulo, arr, extra) {
      if (!arr.length) return '';
      return '<div class="cp-grupo"><div class="cp-grupo-tit">' + titulo + ' <em>' + arr.length + '</em>' + (extra || '') + '</div>' + arr.map(cartao).join('') + '</div>';
    }
    var html = grupo('Hoje', g.hoje) + grupo('Próximos 7 dias', g.semana) + grupo('Mais adiante', g.depois) + grupo('Sem data', g.semData);
    if (g.passadas.length) {
      var lim = ui.verPassadas ? g.passadas : g.passadas.slice(0, 5);
      html += grupo('Já passaram', lim, g.passadas.length > 5
        ? ' <button class="cp-mais" onclick="CP.passadas()">' + (ui.verPassadas ? 'mostrar menos' : 'ver todas') + '</button>' : '');
    }
    if (!html) {
      html = '<div class="cp-vazio"><i class="fa-solid fa-video"></i><p>Nenhuma captação por aqui.</p>' +
        '<button class="btn btn-primary" onclick="CP.nova()"><i class="fa-solid fa-plus"></i>Agendar a primeira</button></div>';
    }
    return html;
  }

  function vistaMes(itens) {
    var td = hoje();
    if (!ui.mes) ui.mes = td.slice(0, 7);
    var a = Number(ui.mes.slice(0, 4)), m = Number(ui.mes.slice(5, 7)) - 1;
    var ini = new Date(a, m, 1), dias = new Date(a, m + 1, 0).getDate(), pad = ini.getDay();
    var porDia = {};
    itens.forEach(function (c) { if (c.data && c.data.slice(0, 7) === ui.mes) (porDia[c.data] = porDia[c.data] || []).push(c); });
    var cel = '';
    ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].forEach(function (d) { cel += '<div class="cp-dn">' + d + '</div>'; });
    for (var i = 0; i < pad; i++) cel += '<div class="cp-dia vazio"></div>';
    for (var d = 1; d <= dias; d++) {
      var iso = a + '-' + String(m + 1).padStart(2, '0') + '-' + String(d).padStart(2, '0');
      var ev = (porDia[iso] || []).sort(function (x, y) { return (x.hora || '99').localeCompare(y.hora || '99'); });
      cel += '<div class="cp-dia' + (iso === td ? ' hoje' : '') + '" onclick="CP.nova(\'' + iso + '\')"><span class="cp-dnum">' + d + '</span>' +
        ev.slice(0, 3).map(function (c) {
          return '<button class="cp-ev st-' + (c.status || 'a_confirmar') + '" onclick="event.stopPropagation();CP.editar(\'' + c.id + '\')" title="' + esc(c.titulo) + '">' +
            (c.hora ? '<b>' + esc(c.hora) + '</b> ' : '') + esc(c.titulo || '') + '</button>';
        }).join('') + (ev.length > 3 ? '<span class="cp-ev-mais">+' + (ev.length - 3) + '</span>' : '') + '</div>';
    }
    return '<div class="card cp-mes">' +
      '<div class="cp-mes-topo"><button class="btn btn-sm btn-ghost" onclick="CP.mesMover(-1)"><i class="fa-solid fa-chevron-left"></i></button>' +
      '<h3>' + MES[m] + ' ' + a + '</h3>' +
      '<button class="btn btn-sm btn-ghost" onclick="CP.mesMover(1)"><i class="fa-solid fa-chevron-right"></i></button>' +
      '<button class="btn btn-sm btn-secondary" onclick="CP.mesHoje()">Hoje</button>' +
      '<span class="cp-legenda">' + Object.keys(ST).map(function (k) { return '<i class="cp-bola st-' + k + '"></i>' + ST[k].nome; }).join('') + '</span></div>' +
      '<div class="cp-grade">' + cel + '</div>' +
      '<p class="cp-dica">Clique num dia para agendar uma captação nele.</p></div>';
  }

  function render() {
    montar();
    var pg = document.getElementById('page-captacao');
    if (!pg) return;
    var td = hoje(), em7 = addDias(td, 7), nomes = eu();
    var todas = porCategoria(lista());
    var nHoje = todas.filter(function (c) { return c.data === td && c.status !== 'cancelada'; }).length;
    var nSemana = todas.filter(function (c) { return c.data >= td && c.data <= em7 && ativa(c); }).length;
    var nConf = todas.filter(function (c) { return c.status === 'a_confirmar'; }).length;
    var nGrav = todas.filter(function (c) { return (c.status === 'gravado' || c.status === 'editado') && (c.data || '').slice(0, 7) === td.slice(0, 7); }).length;
    var nEdit = todas.filter(function (c) { return c.status === 'gravado'; }).length;

    document.getElementById('cpStats').innerHTML =
      '<div class="stat-card blue"><div class="stat-label"><i class="fa-solid fa-video"></i>Hoje</div><div class="stat-value">' + nHoje + '</div><div class="stat-sub">captações marcadas</div></div>' +
      '<div class="stat-card green"><div class="stat-label"><i class="fa-solid fa-calendar-week"></i>Próximos 7 dias</div><div class="stat-value">' + nSemana + '</div><div class="stat-sub">a gravar</div></div>' +
      '<div class="stat-card orange"><div class="stat-label"><i class="fa-solid fa-hourglass-half"></i>A confirmar</div><div class="stat-value">' + nConf + '</div><div class="stat-sub">precisam de retorno</div></div>' +
      '<div class="stat-card magenta"><div class="stat-label"><i class="fa-solid fa-scissors"></i>Esperando edição</div><div class="stat-value">' + nEdit + '</div><div class="stat-sub">gravadas, sem editar</div></div>' +
      '<div class="stat-card yellow"><div class="stat-label"><i class="fa-solid fa-circle-check"></i>Gravadas no mês</div><div class="stat-value">' + nGrav + '</div><div class="stat-sub">' + MES[Number(td.slice(5, 7)) - 1] + '</div></div>';

    var chips = [['ativas', 'Próximas'], ['minhas', 'Minhas'], ['todas', 'Todas']].concat(Object.keys(ST).map(function (k) { return [k, ST[k].nome]; }));
    document.getElementById('cpChips').innerHTML = chips.map(function (c) {
      return '<button class="filter-chip' + (ui.filtro === c[0] ? ' active' : '') + '" onclick="CP.filtro(\'' + c[0] + '\')">' + c[1] + '</button>';
    }).join('');
    pg.querySelectorAll('.cp-vistas button').forEach(function (b) { b.classList.toggle('on', b.dataset.v === ui.vista); });

    var itens = filtrar();
    document.getElementById('cpConteudo').innerHTML = ui.vista === 'mes' ? vistaMes(itens) : vistaAgenda(itens);
    pintarSelo();
    void nomes;
  }

  // ---------- edição ----------
  function preencher(c) {
    var v = function (id, val) { var e = document.getElementById('cp_' + id); if (e) e.value = val == null ? '' : val; };
    v('id', c.id); v('titulo', c.titulo); v('data', c.data); v('hora', c.hora); v('horaFim', c.horaFim);
    v('tipo', c.tipo || 'Reels'); v('category', c.category || 'click'); v('local', c.local);
    v('responsavel', c.responsavel); v('participantes', c.participantes); v('status', c.status || 'a_confirmar');
    v('link', c.linkArquivos); v('roteiro', c.roteiro); v('equip', c.equipamentos); v('obs', c.obs);
    var sel = document.getElementById('cp_campanha');
    if (sel) {
      var camps = ((typeof DB !== 'undefined' && DB.projects) || []).filter(function (p) { return p.status !== 'done' || p.id === c.campanha; });
      sel.innerHTML = '<option value="">Nenhuma campanha</option>' + camps.map(function (p) { return '<option value="' + esc(p.id) + '">' + esc(p.name) + '</option>'; }).join('');
      sel.value = c.campanha || '';
    }
  }
  function nomeCampanha(id) {
    var p = id && ((typeof DB !== 'undefined' && DB.projects) || []).find(function (x) { return x.id === id; });
    return p ? p.name : '';
  }

  function nova(data) {
    montar();
    var u = (typeof CURRENT_USER !== 'undefined' && CURRENT_USER) || {}; // eslint-disable-line no-undef
    var meuNome = '';
    if (typeof TEAM !== 'undefined') TEAM.forEach(function (t) { if (u.email && norm(t.email) === norm(u.email)) meuNome = t.name; });
    var cat = (typeof DB !== 'undefined' && DB.settings && DB.settings.category !== 'all') ? DB.settings.category : 'click';
    preencher({ id: '', data: data || hoje(), status: 'a_confirmar', category: cat, responsavel: meuNome || (u.nome || '').split(' ')[0], equipamentos: EQUIP_PADRAO, tipo: 'Reels' });
    document.getElementById('cpModalTitulo').textContent = 'Nova captação';
    document.getElementById('cpBtnExcluir').style.display = 'none';
    openModal('captacaoModal');
    setTimeout(function () { document.getElementById('cp_titulo').focus(); }, 60);
  }

  function editar(id) {
    montar();
    var c = lista().find(function (x) { return x.id === id; });
    if (!c) return;
    preencher(c);
    document.getElementById('cpModalTitulo').textContent = 'Editar captação';
    document.getElementById('cpBtnExcluir').style.display = '';
    openModal('captacaoModal');
  }

  function salvar() {
    var g = function (id) { var e = document.getElementById('cp_' + id); return e ? e.value.trim() : ''; };
    var titulo = g('titulo'), data = g('data');
    if (!titulo) { showToast('Diga o que vai ser gravado', 'error'); return; }
    if (!data) { showToast('Escolha a data da captação', 'error'); return; }
    var id = g('id') || genId();
    var antigo = lista().find(function (x) { return x.id === id; }) || {};
    var equip = g('equip');
    var item = Object.assign({}, antigo, {
      id: id, titulo: titulo, data: data, hora: g('hora'), horaFim: g('horaFim'), tipo: g('tipo'), category: g('category'),
      local: g('local'), responsavel: g('responsavel'), participantes: g('participantes'), status: g('status') || 'a_confirmar',
      linkArquivos: g('link'), roteiro: g('roteiro'), equipamentos: equip, obs: g('obs'), campanha: g('campanha')
    });
    // se a lista de equipamentos mudou, mantém o "ok" só de quem continua igual
    if (antigo.equipamentos !== equip) {
      var linhas = function (t) { return String(t || '').split('\n').map(function (s) { return s.trim(); }).filter(Boolean); };
      var velhos = linhas(antigo.equipamentos), oks = antigo.equipOk || [];
      item.equipOk = linhas(equip).map(function (l) { var i = velhos.indexOf(l); return i >= 0 ? !!oks[i] : false; });
    }
    firebaseCreate('captacoes', item);
    if (typeof fdb === 'undefined' || !fdb) setTimeout(render, 30); // eslint-disable-line no-undef
    closeModal('captacaoModal');
    showToast(antigo.id ? 'Captação atualizada!' : 'Captação agendada!', 'success');
  }

  function excluir() {
    var id = document.getElementById('cp_id').value;
    if (!id || !confirm('Excluir esta captação?')) return;
    firebaseDelete('captacoes', id);
    closeModal('captacaoModal');
    setTimeout(render, 30);
    showToast('Captação excluída', 'success');
  }

  function mudarStatus(id, st) {
    var c = lista().find(function (x) { return x.id === id; });
    if (!c) return;
    firebaseCreate('captacoes', Object.assign({}, c, { status: st }));
    if (typeof fdb === 'undefined' || !fdb) setTimeout(render, 30); // eslint-disable-line no-undef
    showToast('Captação marcada como "' + ST[st].nome + '"', 'success');
  }

  function tarefaEdicao(id) {
    var c = lista().find(function (x) { return x.id === id; });
    if (!c) return;
    var prazo = addDias(hoje(), 2);
    var t = {
      id: genId(), title: 'Editar: ' + c.titulo,
      desc: 'Gravação de ' + fmtDate(c.data) + (c.local ? ' em ' + c.local : '') + '.' + (c.linkArquivos ? '\nArquivos: ' + c.linkArquivos : '') + (c.roteiro ? '\n\nRoteiro:\n' + c.roteiro : ''),
      date: prazo, time: '', priority: 'medium', status: 'pending', category: c.category || 'click',
      assignee: c.responsavel || '', color: '#E6007E', tags: ['edição', 'captação'], project: '', recurrence: '', addCal: true
    };
    firebaseCreate('tasks', t);
    firebaseCreate('captacoes', Object.assign({}, c, { tarefaEdicao: t.id }));
    if (typeof fdb === 'undefined' || !fdb) setTimeout(render, 30); // eslint-disable-line no-undef
    showToast('Tarefa de edição criada para ' + fmtDate(prazo), 'success');
  }

  // ---------- selo no menu ----------
  function pintarSelo() {
    var b = document.getElementById('badge-captacao');
    if (!b) return;
    var td = hoje();
    var n = porCategoria(lista()).filter(function (c) { return c.data === td && ativa(c); }).length;
    b.textContent = n || '';
    b.style.display = n ? '' : 'none';
    b.title = n ? n + ' captação(ões) hoje' : '';
  }
  function ligarSelo() {
    if (typeof window.updateBadges !== 'function' || window.__cpBadges) return;
    window.__cpBadges = window.updateBadges;
    window.updateBadges = function () { var r = window.__cpBadges.apply(this, arguments); try { pintarSelo(); } catch (e) {} return r; };
  }

  window.CP = {
    render: render, nova: nova, editar: editar, salvar: salvar, excluir: excluir,
    status: mudarStatus, tarefaEdicao: tarefaEdicao,
    equip: function (id, i) {
      var c = lista().find(function (x) { return x.id === id; }); if (!c) return;
      var n = String(c.equipamentos || '').split('\n').map(function (s) { return s.trim(); }).filter(Boolean).length;
      var oks = (c.equipOk || []).slice(0, n); while (oks.length < n) oks.push(false);
      oks[i] = !oks[i];
      firebaseCreate('captacoes', Object.assign({}, c, { equipOk: oks }));
      if (typeof fdb === 'undefined' || !fdb) setTimeout(render, 30); // eslint-disable-line no-undef
    },
    vista: function (v) { ui.vista = v; render(); },
    filtro: function (f) { ui.filtro = f; render(); },
    buscar: function (t) { ui.busca = t; clearTimeout(ui._t); ui._t = setTimeout(render, 150); },
    passadas: function () { ui.verPassadas = !ui.verPassadas; render(); },
    mesMover: function (n) { var a = Number(ui.mes.slice(0, 4)), m = Number(ui.mes.slice(5, 7)) - 1 + n; var d = new Date(a, m, 1); ui.mes = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'); render(); },
    mesHoje: function () { ui.mes = hoje().slice(0, 7); render(); },
    ST: ST
  };

  function iniciar() { montar(); ligarSelo(); pintarSelo(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar);
  else iniciar();
})();
