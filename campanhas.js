/* ============================================================
   ABA "CAMPANHAS" (no lugar de Projetos)
   ------------------------------------------------------------
   Usa os MESMOS dados de antes (coleção "projects"), então tudo
   que já estava ligado a um projeto continua ligado:
     tarefas (t.project) · aprovações (a.project)
   e agora também: captações (c.campanha) · verba (v.projeto)

   Campos novos da campanha: inicio, objetivo, canais, verbaPrevista,
   metas, resultado, cor. Os antigos continuam: name, client, category,
   assignee, deadline (= fim), status, progress, desc (= briefing),
   checklist, checklistState, demands.

   Substitui as funções renderProjects / openProjectDetail /
   editProject / deleteProject do sistema (mesmos nomes), então o
   resto do código que chama essas funções continua funcionando.
   Tudo dentro de window.CA.
============================================================ */
/* global DB, TEAM, genId, firebaseCreate, firebaseDelete, openModal, closeModal, showToast, filterByCategory,
          catBadge, priorityBadge, fmtDate, navigate, currentPage, apAbrir, apNovo, editTask, AUDIT_CAMPOS */
(function () {
  var ST = {
    planning:    { nome: 'Planejamento', cor: 'azul',    ico: 'fa-compass-drafting' },
    in_progress: { nome: 'No ar',        cor: 'verde',   ico: 'fa-tower-broadcast' },
    review:      { nome: 'Em revisão',   cor: 'roxo',    ico: 'fa-magnifying-glass-chart' },
    paused:      { nome: 'Pausada',      cor: 'cinza',   ico: 'fa-pause' },
    done:        { nome: 'Encerrada',    cor: 'laranja', ico: 'fa-flag-checkered' }
  };
  var CANAIS = ['Instagram', 'Facebook', 'TikTok', 'LinkedIn', 'Google / site', 'WhatsApp', 'E-mail', 'Loja física', 'Impressos', 'Evento', 'Outdoor / mídia externa'];
  var CORES = ['#1C2C86', '#009FE3', '#E6007E', '#7E22CE', '#15803D', '#C2410C', '#A16207', '#0F766E', '#B91C1C', '#334155'];
  var MES3 = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

  var ui = { vista: 'cards', filtro: 'ativas', busca: '', aberta: null, aba: 'geral', ano: null };

  if (typeof AUDIT_CAMPOS === 'object' && AUDIT_CAMPOS) {
    try { Object.assign(AUDIT_CAMPOS, { inicio: 'início', objetivo: 'objetivo', canais: 'canais', verbaPrevista: 'verba prevista', metas: 'metas', resultado: 'resultado', cor: 'cor', client: 'cliente / público', checklistState: 'checklist', demands: 'demandas' }); } catch (e) {}
  }

  // ---------- utilidades ----------
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function norm(s) { return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim(); }
  function hoje() { var d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
  function brl(v) { return (Number(v) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }); }
  function dBr(iso) { return iso && typeof fmtDate === 'function' ? fmtDate(iso) : (iso || ''); }
  function dCurta(iso) { if (!iso) return ''; var p = iso.split('-'); return p[2] + ' ' + MES3[+p[1] - 1]; }
  function lerValor(t) { var s = String(t || '').replace(/[^\d,.-]/g, ''); if (s.indexOf(',') !== -1) s = s.replace(/\./g, '').replace(',', '.'); var n = parseFloat(s); return isNaN(n) ? 0 : Math.round(n * 100) / 100; }
  function arr(n) { return (typeof DB !== 'undefined' && Array.isArray(DB[n])) ? DB[n] : []; }
  function porCat(a) { return typeof filterByCategory === 'function' ? filterByCategory(a) : a; }
  function semFirebase() { return typeof fdb === 'undefined' || !fdb; } // eslint-disable-line no-undef
  function depois(fn) { setTimeout(fn, semFirebase() ? 30 : 400); }
  function camp(id) { return arr('projects').find(function (p) { return p.id === id; }); }
  function diasEntre(a, b) { return Math.round((new Date(b + 'T12:00:00') - new Date(a + 'T12:00:00')) / 86400000); }
  function ativa(p) { return p.status !== 'done'; }
  function selo(st) { var s = ST[st] || ST.planning; return '<span class="pf-selo pf-' + s.cor + '"><i class="fa-solid ' + s.ico + '"></i> ' + s.nome + '</span>'; }

  // tudo o que está ligado a uma campanha
  function ligados(id) {
    var tarefas = arr('tasks').filter(function (t) { return t.project === id; });
    var aprov = arr('approvals').filter(function (a) { return a.project === id; });
    var capt = arr('captacoes').filter(function (c) { return c.campanha === id; });
    var verba = arr('verba').filter(function (v) { return v.projeto === id; });
    var gasto = Math.round(verba.reduce(function (s, v) { return s + (Number(v.valor) || 0); }, 0) * 100) / 100;
    return {
      tarefas: tarefas, aprov: aprov, capt: capt, verba: verba, gasto: gasto,
      tAbertas: tarefas.filter(function (t) { return t.status !== 'done'; }).length,
      aPend: aprov.filter(function (a) { return a.status === 'pending' || a.status === 'revision' || !a.status; }).length,
      cProx: capt.filter(function (c) { return (c.status === 'a_confirmar' || c.status === 'confirmada') && c.data >= hoje(); }).length
    };
  }

  // ---------- montagem ----------
  function garantirModalAntigo() {
    // o código antigo ainda fecha / usa estes elementos em alguns lugares
    if (!document.getElementById('projectDetailModal')) {
      var m = document.createElement('div'); m.id = 'projectDetailModal'; m.className = 'modal-overlay';
      m.innerHTML = '<div class="modal"><div id="projDetailTitle"></div><div id="projDetailContent"></div></div>';
      document.body.appendChild(m);
    }
  }

  function montar() {
    var pg = document.getElementById('page-projetos');
    if (!pg || pg.dataset.ca) return;
    var velho = document.getElementById('projectDetailModal');
    if (velho && pg.contains(velho)) document.body.appendChild(velho); // tira de dentro antes de trocar a página
    pg.dataset.ca = '1';
    pg.innerHTML = '<div id="caLista"></div><div id="caDetalhe"></div>';
    garantirModalAntigo();
    montarModal();
  }

  function montarModal() {
    if (document.getElementById('campanhaModal')) return;
    var equipe = (typeof TEAM !== 'undefined' ? TEAM : []).map(function (t) { return '<option value="' + esc(t.name) + '">'; }).join('');
    var m = document.createElement('div');
    m.className = 'modal-overlay'; m.id = 'campanhaModal';
    m.innerHTML =
      '<div class="modal modal-lg">' +
        '<div class="modal-header"><div class="modal-title" id="caModalTitulo">Nova campanha</div><button class="modal-close" onclick="closeModal(\'campanhaModal\')"><i class="fa-solid fa-xmark"></i></button></div>' +
        '<input type="hidden" id="ca_id">' +
        '<div class="ca-f2"><div class="form-group" style="grid-column:1/-1"><label class="form-label">Nome da campanha *</label><input class="form-control" id="ca_name" placeholder="ex: Black Friday 2026"></div></div>' +
        '<div class="ca-f3">' +
          '<div class="form-group"><label class="form-label">Empresa</label><select class="form-control" id="ca_category"><option value="click">Click Impresso</option><option value="impresul">Impresul</option><option value="geral">Geral</option></select></div>' +
          '<div class="form-group"><label class="form-label">Início</label><input type="date" class="form-control" id="ca_inicio"></div>' +
          '<div class="form-group"><label class="form-label">Fim</label><input type="date" class="form-control" id="ca_fim"></div>' +
        '</div>' +
        '<div class="ca-f3">' +
          '<div class="form-group"><label class="form-label">Responsável</label><input class="form-control" id="ca_assignee" list="caEquipe"></div>' +
          '<div class="form-group"><label class="form-label">Status</label><select class="form-control" id="ca_status">' + Object.keys(ST).map(function (k) { return '<option value="' + k + '">' + ST[k].nome + '</option>'; }).join('') + '</select></div>' +
          '<div class="form-group"><label class="form-label">Verba prevista (R$)</label><input class="form-control" id="ca_verba" inputmode="decimal" placeholder="0,00"></div>' +
        '</div>' +
        '<datalist id="caEquipe">' + equipe + '</datalist>' +
        '<div class="form-group"><label class="form-label">Público / cliente</label><input class="form-control" id="ca_client" placeholder="ex: pequenos empreendedores, gráficas parceiras..."></div>' +
        '<div class="form-group"><label class="form-label">Objetivo</label><input class="form-control" id="ca_objetivo" placeholder="ex: vender 300 kits de cartão de visita"></div>' +
        '<div class="form-group"><label class="form-label">Canais</label><div class="ca-canais" id="ca_canais">' +
          CANAIS.map(function (c) { return '<button type="button" class="filter-chip" data-canal="' + esc(c) + '">' + esc(c) + '</button>'; }).join('') + '</div></div>' +
        '<div class="ca-f2">' +
          '<div class="form-group"><label class="form-label">Metas <span class="ca-opc">(uma por linha)</span></label><textarea class="form-control" id="ca_metas" rows="3" placeholder="200 leads no WhatsApp&#10;R$ 30 mil em vendas"></textarea></div>' +
          '<div class="form-group"><label class="form-label">Checklist <span class="ca-opc">(um item por linha)</span></label><textarea class="form-control" id="ca_checklist" rows="3" placeholder="Definir oferta&#10;Criar artes&#10;Subir anúncios"></textarea></div>' +
        '</div>' +
        '<div class="form-group"><label class="form-label">Briefing / descrição</label><textarea class="form-control" id="ca_desc" rows="3"></textarea></div>' +
        '<div class="form-group"><label class="form-label">Resultado <span class="ca-opc">(preencha ao encerrar)</span></label><textarea class="form-control" id="ca_resultado" rows="2" placeholder="O que funcionou, números finais, aprendizados..."></textarea></div>' +
        '<div class="form-group"><label class="form-label">Cor</label><div class="ca-cores" id="ca_cores">' +
          CORES.map(function (c) { return '<button type="button" data-cor="' + c + '" style="background:' + c + '"></button>'; }).join('') + '</div></div>' +
        '<div class="modal-footer"><button class="btn btn-secondary" onclick="closeModal(\'campanhaModal\')">Cancelar</button>' +
          '<button class="btn btn-primary" onclick="CA.salvar()"><i class="fa-solid fa-check"></i>Salvar campanha</button></div>' +
      '</div>';
    document.body.appendChild(m);
    m.querySelector('#ca_canais').addEventListener('click', function (e) { var b = e.target.closest('[data-canal]'); if (b) b.classList.toggle('active'); });
    m.querySelector('#ca_cores').addEventListener('click', function (e) {
      var b = e.target.closest('[data-cor]'); if (!b) return;
      m.querySelectorAll('#ca_cores button').forEach(function (x) { x.classList.toggle('on', x === b); });
    });
  }

  // ---------- lista ----------
  function filtradas() {
    var b = norm(ui.busca);
    return porCat(arr('projects')).filter(function (p) {
      if (ui.filtro === 'ativas' && !ativa(p)) return false;
      if (ST[ui.filtro] && p.status !== ui.filtro) return false;
      if (b && norm([p.name, p.client, p.objetivo, p.assignee, (p.canais || []).join(' ')].join(' ')).indexOf(b) === -1) return false;
      return true;
    }).sort(function (a, b) {
      var oa = { in_progress: 0, review: 1, planning: 2, paused: 3, done: 4 };
      return (oa[a.status] || 0) - (oa[b.status] || 0) || String(a.inicio || a.deadline || '9').localeCompare(String(b.inicio || b.deadline || '9'));
    });
  }

  function barraTempo(p) {
    var td = hoje();
    if (!p.inicio || !p.deadline) return '';
    var total = Math.max(1, diasEntre(p.inicio, p.deadline)), feito = Math.min(total, Math.max(0, diasEntre(p.inicio, td)));
    var pct = Math.round(feito / total * 100);
    var txt = td < p.inicio ? 'começa em ' + diasEntre(td, p.inicio) + ' dia(s)' : td > p.deadline ? 'terminou' : 'faltam ' + diasEntre(td, p.deadline) + ' dia(s)';
    return '<div class="ca-tempo"><div class="ca-tempo-barra"><i style="width:' + pct + '%"></i></div><span>' + txt + '</span></div>';
  }

  function cartao(p) {
    var l = ligados(p.id), prev = Number(p.verbaPrevista) || 0;
    var atrasada = p.deadline && p.deadline < hoje() && p.status !== 'done';
    return '<div class="ca-card" style="--ca-cor:' + esc(p.cor || '#1C2C86') + '" onclick="CA.abrir(\'' + p.id + '\')">' +
      '<div class="ca-card-topo"><div class="ca-card-nome">' + esc(p.name) + '</div>' + selo(p.status) + '</div>' +
      (p.objetivo ? '<div class="ca-card-obj"><i class="fa-solid fa-bullseye"></i> ' + esc(p.objetivo) + '</div>' : (p.client ? '<div class="ca-card-obj"><i class="fa-solid fa-users"></i> ' + esc(p.client) + '</div>' : '')) +
      '<div class="ca-card-datas"><i class="fa-regular fa-calendar"></i> ' + (p.inicio ? dBr(p.inicio) + ' → ' : '') + (p.deadline ? dBr(p.deadline) : 'sem data de fim') +
        (atrasada ? ' <span class="pf-selo pf-vermelho">Passou do fim</span>' : '') + '</div>' +
      barraTempo(p) +
      '<div class="ca-nums">' +
        '<span title="Tarefas abertas"><i class="fa-solid fa-list-check"></i>' + l.tAbertas + '/' + l.tarefas.length + '</span>' +
        '<span title="Peças aguardando aprovação"><i class="fa-solid fa-check-double"></i>' + l.aPend + '</span>' +
        '<span title="Captações"><i class="fa-solid fa-video"></i>' + l.capt.length + '</span>' +
        '<span title="Gasto / previsto"><i class="fa-solid fa-wallet"></i>' + brl(l.gasto) + (prev ? ' <em>/ ' + brl(prev) + '</em>' : '') + '</span>' +
      '</div>' +
      (prev ? '<div class="ca-verba"><i style="width:' + Math.min(100, Math.round(l.gasto / prev * 100)) + '%" class="' + (l.gasto > prev ? 'estourou' : '') + '"></i></div>' : '') +
      '<div class="ca-card-pe">' + (typeof catBadge === 'function' ? catBadge(p.category) : '') +
        (p.canais || []).slice(0, 3).map(function (c) { return '<span class="ca-canal">' + esc(c) + '</span>'; }).join('') +
        ((p.canais || []).length > 3 ? '<span class="ca-canal">+' + (p.canais.length - 3) + '</span>' : '') +
        (p.assignee ? '<span class="ca-resp"><i class="fa-solid fa-user"></i> ' + esc(p.assignee) + '</span>' : '') + '</div>' +
    '</div>';
  }

  function vistaAno(lista) {
    if (!ui.ano) ui.ano = hoje().slice(0, 4);
    var ini = ui.ano + '-01-01', fim = ui.ano + '-12-31', totalDias = diasEntre(ini, fim) + 1;
    var td = hoje();
    var noAno = lista.filter(function (p) { var a = p.inicio || p.deadline, b = p.deadline || p.inicio; return a && b && a <= fim && b >= ini; });
    var hojePos = td.slice(0, 4) === ui.ano ? (diasEntre(ini, td) / totalDias * 100) : -1;
    return '<div class="card ca-ano">' +
      '<div class="ca-ano-topo"><button class="btn btn-sm btn-ghost" onclick="CA.ano(-1)"><i class="fa-solid fa-chevron-left"></i></button><h3>' + ui.ano + '</h3>' +
      '<button class="btn btn-sm btn-ghost" onclick="CA.ano(1)"><i class="fa-solid fa-chevron-right"></i></button></div>' +
      '<div class="ca-gantt">' +
        '<div class="ca-g-meses"><div></div><div class="ca-g-grade">' + MES3.map(function (m) { return '<span>' + m + '</span>'; }).join('') + '</div></div>' +
        (noAno.length ? noAno.map(function (p) {
          var a = (p.inicio || p.deadline) < ini ? ini : (p.inicio || p.deadline), b = (p.deadline || p.inicio) > fim ? fim : (p.deadline || p.inicio);
          var left = diasEntre(ini, a) / totalDias * 100, w = Math.max(1.2, (diasEntre(a, b) + 1) / totalDias * 100);
          return '<div class="ca-g-linha"><div class="ca-g-nome" onclick="CA.abrir(\'' + p.id + '\')">' + esc(p.name) + '</div><div class="ca-g-grade">' +
            (hojePos >= 0 ? '<i class="ca-g-hoje" style="left:' + hojePos + '%"></i>' : '') +
            '<button class="ca-g-barra st-' + p.status + '" style="left:' + left + '%;width:' + w + '%;--ca-cor:' + esc(p.cor || '#1C2C86') + '" onclick="CA.abrir(\'' + p.id + '\')" title="' + esc(p.name) + ' · ' + dBr(p.inicio) + ' → ' + dBr(p.deadline) + '">' + esc(p.name) + '</button></div></div>';
        }).join('') : '<p class="ca-vazio-txt">Nenhuma campanha com datas em ' + ui.ano + '. Preencha início e fim nas campanhas para aparecerem aqui.</p>') +
      '</div></div>';
  }

  function renderLista() {
    var el = document.getElementById('caLista'); if (!el) return;
    var todas = porCat(arr('projects'));
    var noAr = todas.filter(function (p) { return p.status === 'in_progress'; });
    var plan = todas.filter(function (p) { return p.status === 'planning'; }).length;
    var prev = 0, gasto = 0;
    todas.filter(ativa).forEach(function (p) { prev += Number(p.verbaPrevista) || 0; gasto += ligados(p.id).gasto; });
    var ano = hoje().slice(0, 4);
    var encerradas = todas.filter(function (p) { return p.status === 'done' && String(p.deadline || '').slice(0, 4) === ano; }).length;
    var lista = filtradas();
    var chips = [['ativas', 'Em andamento'], ['todas', 'Todas']].concat(Object.keys(ST).map(function (k) { return [k, ST[k].nome]; }));

    el.innerHTML =
      '<div class="section-header"><div><div class="section-title">Campanhas</div>' +
        '<div class="section-subtitle">Tudo de cada ação num lugar: tarefas, peças, captações e verba</div></div>' +
      '<div class="ca-topo-acoes"><div class="ca-vistas">' +
        [['cards', 'fa-table-cells-large', 'Cards'], ['lista', 'fa-list', 'Lista'], ['ano', 'fa-chart-gantt', 'Linha do tempo']].map(function (v) {
          return '<button class="' + (ui.vista === v[0] ? 'on' : '') + '" onclick="CA.vista(\'' + v[0] + '\')"><i class="fa-solid ' + v[1] + '"></i>' + v[2] + '</button>';
        }).join('') + '</div>' +
      '<button class="btn btn-primary" onclick="CA.nova()"><i class="fa-solid fa-plus"></i>Nova campanha</button></div></div>' +
      '<div class="stat-grid">' +
        '<div class="stat-card green"><div class="stat-label"><i class="fa-solid fa-tower-broadcast"></i>No ar</div><div class="stat-value">' + noAr.length + '</div><div class="stat-sub">campanhas rodando</div></div>' +
        '<div class="stat-card blue"><div class="stat-label"><i class="fa-solid fa-compass-drafting"></i>Em planejamento</div><div class="stat-value">' + plan + '</div><div class="stat-sub">a lançar</div></div>' +
        '<div class="stat-card orange"><div class="stat-label"><i class="fa-solid fa-wallet"></i>Verba das ativas</div><div class="stat-value ca-menor">' + brl(gasto) + '</div><div class="stat-sub">' + (prev ? 'de ' + brl(prev) + ' previstos' : 'sem verba prevista') + '</div></div>' +
        '<div class="stat-card magenta"><div class="stat-label"><i class="fa-solid fa-flag-checkered"></i>Encerradas em ' + ano + '</div><div class="stat-value">' + encerradas + '</div><div class="stat-sub">campanhas</div></div>' +
      '</div>' +
      '<div class="ca-filtros"><div class="search-bar" style="width:240px"><i class="fa-solid fa-magnifying-glass"></i><input type="text" placeholder="Buscar campanha, objetivo, canal..." value="' + esc(ui.busca) + '" oninput="CA.buscar(this.value)"></div>' +
        '<div class="ca-chips">' + chips.map(function (c) { return '<button class="filter-chip' + (ui.filtro === c[0] ? ' active' : '') + '" onclick="CA.filtro(\'' + c[0] + '\')">' + c[1] + '</button>'; }).join('') + '</div></div>' +
      (ui.vista === 'ano' ? vistaAno(lista)
        : !lista.length ? '<div class="ca-vazio"><i class="fa-solid fa-bullhorn"></i><p>Nenhuma campanha por aqui.</p><button class="btn btn-primary" onclick="CA.nova()"><i class="fa-solid fa-plus"></i>Criar campanha</button></div>'
        : ui.vista === 'lista' ? '<div class="card ca-tab-wrap"><table class="ca-tabela"><thead><tr><th>Campanha</th><th>Status</th><th>Período</th><th>Responsável</th><th class="dir">Tarefas</th><th class="dir">Verba</th></tr></thead><tbody>' +
            lista.map(function (p) {
              var l = ligados(p.id);
              return '<tr onclick="CA.abrir(\'' + p.id + '\')"><td><i class="ca-bola" style="background:' + esc(p.cor || '#1C2C86') + '"></i><b>' + esc(p.name) + '</b>' + (p.objetivo ? '<small>' + esc(p.objetivo) + '</small>' : '') + '</td>' +
                '<td>' + selo(p.status) + '</td><td>' + (p.inicio ? dCurta(p.inicio) + ' → ' : '') + (p.deadline ? dCurta(p.deadline) : '—') + '</td>' +
                '<td>' + esc(p.assignee || '—') + '</td><td class="dir">' + (l.tarefas.length - l.tAbertas) + '/' + l.tarefas.length + '</td>' +
                '<td class="dir">' + brl(l.gasto) + (Number(p.verbaPrevista) ? '<small>de ' + brl(p.verbaPrevista) + '</small>' : '') + '</td></tr>';
            }).join('') + '</tbody></table></div>'
        : '<div class="ca-grade">' + lista.map(cartao).join('') + '</div>');
  }

  // ---------- tela da campanha ----------
  var STT = { pending: ['Pendente', 'laranja'], in_progress: ['Em progresso', 'azul'], review: ['Em revisão', 'roxo'], done: ['Concluída', 'verde'] };
  var STA = { pending: ['Aguardando', 'laranja'], approved: ['Aprovado', 'verde'], rejected: ['Reprovado', 'vermelho'], revision: ['Ajustes', 'amarelo'] };

  function renderDetalhe() {
    var el = document.getElementById('caDetalhe'); var p = camp(ui.aberta);
    if (!el) return;
    if (!p) { ui.aberta = null; el.innerHTML = ''; return; }
    var l = ligados(p.id), prev = Number(p.verbaPrevista) || 0, td = hoje();
    var cl = p.checklist || [], cs = p.checklistState || [];
    var abas = [['geral', 'Visão geral', ''], ['tarefas', 'Tarefas', l.tarefas.length], ['aprov', 'Aprovações', l.aprov.length], ['capt', 'Captações', l.capt.length], ['verba', 'Verba', l.verba.length], ['tempo', 'Linha do tempo', '']];

    var corpo = '';
    if (ui.aba === 'geral') {
      corpo =
        '<div class="ca-geral">' +
          '<div class="card"><div class="card-header"><div class="card-title"><i class="fa-solid fa-circle-info"></i>Sobre a campanha</div></div>' +
            '<dl class="ca-dl">' +
              '<dt>Objetivo</dt><dd>' + esc(p.objetivo || '—') + '</dd>' +
              '<dt>Público / cliente</dt><dd>' + esc(p.client || '—') + '</dd>' +
              '<dt>Período</dt><dd>' + (p.inicio ? dBr(p.inicio) : '—') + ' → ' + (p.deadline ? dBr(p.deadline) : '—') + '</dd>' +
              '<dt>Responsável</dt><dd>' + esc(p.assignee || '—') + '</dd>' +
              '<dt>Empresa</dt><dd>' + (typeof catBadge === 'function' ? catBadge(p.category) : '') + '</dd>' +
              '<dt>Canais</dt><dd>' + ((p.canais || []).length ? p.canais.map(function (c) { return '<span class="ca-canal">' + esc(c) + '</span>'; }).join(' ') : '—') + '</dd>' +
            '</dl>' + barraTempo(p) +
            (p.desc ? '<div class="ca-texto"><div class="ca-sub">Briefing</div>' + esc(p.desc) + '</div>' : '') +
          '</div>' +
          '<div class="card"><div class="card-header"><div class="card-title"><i class="fa-solid fa-bullseye"></i>Metas e resultado</div></div>' +
            ((p.metas || '').trim() ? '<ul class="ca-metas">' + String(p.metas).split('\n').filter(function (x) { return x.trim(); }).map(function (m) { return '<li>' + esc(m) + '</li>'; }).join('') + '</ul>' : '<p class="ca-vazio-txt">Sem metas definidas.</p>') +
            '<div class="ca-sub" style="margin-top:14px">Resultado</div>' +
            (p.resultado ? '<div class="ca-texto">' + esc(p.resultado) + '</div>' : '<p class="ca-vazio-txt">Preencha ao encerrar a campanha (botão Editar).</p>') +
          '</div>' +
          '<div class="card"><div class="card-header"><div class="card-title"><i class="fa-solid fa-square-check"></i>Checklist</div><span class="ca-pct">' + (p.progress || 0) + '%</span></div>' +
            '<div class="progress-bar" style="margin-bottom:12px"><div class="progress-fill progress-blue" style="width:' + (p.progress || 0) + '%"></div></div>' +
            (cl.length ? cl.map(function (it, i) {
              return '<label class="ca-check' + (cs[i] ? ' ok' : '') + '"><input type="checkbox"' + (cs[i] ? ' checked' : '') + ' onchange="CA.check(' + i + ')"><span>' + esc(it) + '</span></label>';
            }).join('') : '<p class="ca-vazio-txt">Nenhum item ainda.</p>') +
            '<div class="ca-add"><input class="form-control" id="caNovoCheck" placeholder="Novo item do checklist..." onkeydown="if(event.key===\'Enter\')CA.addCheck()"><button class="btn btn-sm btn-primary" onclick="CA.addCheck()"><i class="fa-solid fa-plus"></i></button></div>' +
          '</div>' +
          '<div class="card"><div class="card-header"><div class="card-title"><i class="fa-solid fa-inbox"></i>Demandas internas</div></div>' +
            ((p.demands || []).length ? p.demands.map(function (d, i) {
              return '<div class="ca-check' + (d.done ? ' ok' : '') + '"><input type="checkbox"' + (d.done ? ' checked' : '') + ' onchange="CA.demanda(' + i + ')"><span>' + esc(d.text) + '</span>' +
                '<button class="btn btn-xs btn-ghost" title="Virar tarefa" onclick="CA.demandaTarefa(' + i + ')"><i class="fa-solid fa-list-check"></i></button></div>';
            }).join('') : '<p class="ca-vazio-txt">Ideias e pedidos soltos desta campanha.</p>') +
            '<div class="ca-add"><input class="form-control" id="caNovaDemanda" placeholder="Nova demanda..." onkeydown="if(event.key===\'Enter\')CA.addDemanda()"><button class="btn btn-sm btn-primary" onclick="CA.addDemanda()"><i class="fa-solid fa-plus"></i></button></div>' +
          '</div>' +
        '</div>';
    } else if (ui.aba === 'tarefas') {
      corpo = '<div class="card"><div class="card-header"><div class="card-title"><i class="fa-solid fa-list-check"></i>Tarefas da campanha</div><button class="btn btn-sm btn-primary" onclick="CA.novaTarefa()"><i class="fa-solid fa-plus"></i>Nova tarefa</button></div>' +
        (l.tarefas.length ? l.tarefas.slice().sort(function (a, b) { return (a.status === 'done') - (b.status === 'done') || String(a.date).localeCompare(String(b.date)); }).map(function (t) {
          var s = STT[t.status] || ['—', 'cinza'], atr = t.status !== 'done' && t.date && t.date < td;
          return '<div class="ca-item' + (t.status === 'done' ? ' feito' : '') + '" onclick="editTask(\'' + t.id + '\')"><i class="ca-bola" style="background:' + esc(t.color || 'var(--accent-blue)') + '"></i>' +
            '<div class="ca-item-txt"><b>' + esc(t.title) + '</b><small>' + (t.date ? dBr(t.date) : 'sem data') + (t.assignee ? ' · ' + esc(t.assignee) : '') + '</small></div>' +
            (atr ? '<span class="pf-selo pf-vermelho">Atrasada</span>' : '') + (typeof priorityBadge === 'function' ? priorityBadge(t.priority) : '') +
            '<span class="pf-selo pf-' + s[1] + '">' + s[0] + '</span></div>';
        }).join('') : '<p class="ca-vazio-txt">Nenhuma tarefa ligada. Crie aqui ou escolha esta campanha no campo "Campanha" de uma tarefa.</p>') + '</div>';
    } else if (ui.aba === 'aprov') {
      corpo = '<div class="card"><div class="card-header"><div class="card-title"><i class="fa-solid fa-check-double"></i>Peças da campanha</div><button class="btn btn-sm btn-primary" onclick="CA.novaPeca()"><i class="fa-solid fa-plus"></i>Enviar material</button></div>' +
        (l.aprov.length ? '<div class="ca-pecas">' + l.aprov.map(function (a) {
          var s = STA[a.status] || ['Rascunho', 'cinza'];
          var capa = (a.arquivos && a.arquivos[0] && (a.arquivos[0].t === 'vid' ? a.arquivos[0].poster : a.arquivos[0].src)) || '';
          return '<button class="ca-peca" onclick="CA.abrirPeca(\'' + a.id + '\')">' +
            '<div class="ca-peca-img">' + (capa ? '<img src="' + esc(capa) + '" alt="">' : '<i class="fa-regular fa-image"></i>') + '</div>' +
            '<b>' + esc(a.title || 'Peça') + '</b><span class="pf-selo pf-' + s[1] + '">' + s[0] + '</span></button>';
        }).join('') + '</div>' : '<p class="ca-vazio-txt">Nenhuma peça ligada. Ao enviar material para aprovação, escolha esta campanha em "Campanha relacionada".</p>') + '</div>';
    } else if (ui.aba === 'capt') {
      corpo = '<div class="card"><div class="card-header"><div class="card-title"><i class="fa-solid fa-video"></i>Captações da campanha</div><button class="btn btn-sm btn-primary" onclick="CA.novaCaptacao()"><i class="fa-solid fa-plus"></i>Agendar captação</button></div>' +
        (l.capt.length ? l.capt.slice().sort(function (a, b) { return String(a.data).localeCompare(String(b.data)); }).map(function (c) {
          var s = (window.CP && window.CP.ST && window.CP.ST[c.status]) || { nome: 'A confirmar', cor: 'laranja' };
          return '<div class="ca-item" onclick="CA.abrirCaptacao(\'' + c.id + '\')"><i class="fa-solid fa-video ca-ico"></i><div class="ca-item-txt"><b>' + esc(c.titulo) + '</b>' +
            '<small>' + dBr(c.data) + (c.hora ? ' · ' + esc(c.hora) : '') + (c.local ? ' · ' + esc(c.local) : '') + (c.responsavel ? ' · ' + esc(c.responsavel) : '') + '</small></div>' +
            '<span class="pf-selo pf-' + s.cor + '">' + s.nome + '</span></div>';
        }).join('') : '<p class="ca-vazio-txt">Nenhuma captação ligada a esta campanha.</p>') + '</div>';
    } else if (ui.aba === 'verba') {
      corpo = '<div class="card"><div class="card-header"><div class="card-title"><i class="fa-solid fa-wallet"></i>Gastos da campanha</div>' +
          '<div class="ca-verba-tot">' + brl(l.gasto) + (prev ? ' <small>de ' + brl(prev) + ' previstos · ' + (l.gasto > prev ? '<b class="ca-estourou">passou ' + brl(l.gasto - prev) + '</b>' : 'sobram ' + brl(prev - l.gasto)) + '</small>' : '') + '</div></div>' +
        (prev ? '<div class="ca-verba grande"><i style="width:' + Math.min(100, Math.round(l.gasto / prev * 100)) + '%" class="' + (l.gasto > prev ? 'estourou' : '') + '"></i></div>' : '') +
        '<div class="ca-verba-add"><input type="date" class="form-control" id="caV_data" value="' + td + '"><input class="form-control" id="caV_loja" placeholder="Loja" list="vbLojas">' +
          '<input class="form-control" id="caV_desc" placeholder="Descrição"><input class="form-control" id="caV_os" placeholder="Boletim/OS"><input class="form-control" id="caV_valor" placeholder="Valor" inputmode="decimal">' +
          '<button class="btn btn-primary btn-sm" onclick="CA.addGasto()"><i class="fa-solid fa-plus"></i>Lançar</button></div>' +
        (l.verba.length ? '<table class="ca-tabela"><thead><tr><th>Data</th><th>Loja</th><th>Descrição</th><th>Boletim/OS</th><th class="dir">Valor</th></tr></thead><tbody>' +
          l.verba.slice().sort(function (a, b) { return String(a.data).localeCompare(String(b.data)); }).map(function (v) {
            return '<tr onclick="CA.abrirGasto(\'' + v.id + '\')"><td>' + dBr(v.data) + '</td><td><b>' + esc(v.loja || '') + '</b></td><td>' + esc(v.descricao || '') + '</td><td>' + esc(v.os || '') + '</td><td class="dir"><b>' + brl(v.valor) + '</b></td></tr>';
          }).join('') + '</tbody></table>' : '<p class="ca-vazio-txt">Nenhum gasto lançado nesta campanha. Os lançamentos também aparecem na aba Verba.</p>') + '</div>';
    } else {
      var ev = [];
      l.tarefas.forEach(function (t) { if (t.date) ev.push({ d: t.date, ico: 'fa-list-check', txt: t.title, tipo: 'Tarefa', ok: t.status === 'done' }); });
      l.capt.forEach(function (c) { if (c.data) ev.push({ d: c.data, ico: 'fa-video', txt: c.titulo, tipo: 'Captação', ok: c.status === 'gravado' || c.status === 'editado' }); });
      l.verba.forEach(function (v) { if (v.data) ev.push({ d: v.data, ico: 'fa-wallet', txt: (v.descricao || '') + ' · ' + brl(v.valor), tipo: 'Gasto', ok: true }); });
      l.aprov.forEach(function (a) { var d = a.__createdAt ? new Date(a.__createdAt) : null; if (d) ev.push({ d: d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'), ico: 'fa-check-double', txt: a.title, tipo: 'Peça enviada', ok: a.status === 'approved' }); });
      if (p.inicio) ev.push({ d: p.inicio, ico: 'fa-play', txt: 'Início da campanha', tipo: 'Marco', marco: true });
      if (p.deadline) ev.push({ d: p.deadline, ico: 'fa-flag-checkered', txt: 'Fim da campanha', tipo: 'Marco', marco: true });
      ev.sort(function (a, b) { return a.d.localeCompare(b.d); });
      var hojeFeito = false;
      corpo = '<div class="card"><div class="card-header"><div class="card-title"><i class="fa-solid fa-timeline"></i>Linha do tempo</div></div>' +
        (ev.length ? '<div class="ca-linha">' + ev.map(function (e) {
          var marcaHoje = '';
          if (!hojeFeito && e.d > td) { hojeFeito = true; marcaHoje = '<div class="ca-hoje"><span>hoje · ' + dBr(td) + '</span></div>'; }
          return marcaHoje + '<div class="ca-ev' + (e.marco ? ' marco' : '') + (e.ok ? ' ok' : '') + '"><span class="ca-ev-d">' + dCurta(e.d) + '</span><i class="fa-solid ' + e.ico + '"></i>' +
            '<div><b>' + esc(e.txt) + '</b><small>' + e.tipo + '</small></div></div>';
        }).join('') + (!hojeFeito ? '<div class="ca-hoje"><span>hoje · ' + dBr(td) + '</span></div>' : '') + '</div>' : '<p class="ca-vazio-txt">Nada com data ainda.</p>') + '</div>';
    }

    el.innerHTML =
      '<div class="ca-det" style="--ca-cor:' + esc(p.cor || '#1C2C86') + '">' +
        '<button class="ca-voltar" onclick="CA.fechar()"><i class="fa-solid fa-arrow-left"></i> Todas as campanhas</button>' +
        '<div class="section-header"><div>' +
          '<div class="ca-det-selo">' + selo(p.status) + (typeof catBadge === 'function' ? ' ' + catBadge(p.category) : '') + '</div>' +
          '<div class="section-title">' + esc(p.name) + '</div>' +
          '<div class="section-subtitle">' + (p.inicio ? dBr(p.inicio) + ' → ' : '') + (p.deadline ? dBr(p.deadline) : 'sem data de fim') + (p.assignee ? ' · responsável: ' + esc(p.assignee) : '') + '</div>' +
        '</div><div class="ca-topo-acoes">' +
          '<select class="form-control ca-st" onchange="CA.status(this.value)">' + Object.keys(ST).map(function (k) { return '<option value="' + k + '"' + (p.status === k ? ' selected' : '') + '>' + ST[k].nome + '</option>'; }).join('') + '</select>' +
          '<button class="btn btn-secondary" onclick="CA.editar(\'' + p.id + '\')"><i class="fa-solid fa-pen"></i>Editar</button>' +
          '<button class="btn btn-ghost" onclick="CA.excluir(\'' + p.id + '\')" title="Excluir"><i class="fa-solid fa-trash"></i></button>' +
        '</div></div>' +
        '<div class="stat-grid">' +
          '<div class="stat-card blue"><div class="stat-label"><i class="fa-solid fa-list-check"></i>Tarefas</div><div class="stat-value">' + (l.tarefas.length - l.tAbertas) + '/' + l.tarefas.length + '</div><div class="stat-sub">' + l.tAbertas + ' em aberto</div></div>' +
          '<div class="stat-card green"><div class="stat-label"><i class="fa-solid fa-check-double"></i>Peças</div><div class="stat-value">' + l.aprov.filter(function (a) { return a.status === 'approved'; }).length + '/' + l.aprov.length + '</div><div class="stat-sub">' + l.aPend + ' aguardando</div></div>' +
          '<div class="stat-card magenta"><div class="stat-label"><i class="fa-solid fa-video"></i>Captações</div><div class="stat-value">' + l.capt.length + '</div><div class="stat-sub">' + l.cProx + ' próximas</div></div>' +
          '<div class="stat-card orange"><div class="stat-label"><i class="fa-solid fa-wallet"></i>Verba</div><div class="stat-value ca-menor">' + brl(l.gasto) + '</div><div class="stat-sub">' + (prev ? Math.round(l.gasto / prev * 100) + '% de ' + brl(prev) : 'sem verba prevista') + '</div></div>' +
        '</div>' +
        '<div class="ca-abas">' + abas.map(function (a) {
          return '<button class="' + (ui.aba === a[0] ? 'on' : '') + '" onclick="CA.aba(\'' + a[0] + '\')">' + a[1] + (a[2] !== '' ? ' <em>' + a[2] + '</em>' : '') + '</button>';
        }).join('') + '</div>' + corpo +
      '</div>';
  }

  function render() {
    montar();
    var lista = document.getElementById('caLista'), det = document.getElementById('caDetalhe');
    if (!lista) return;
    if (ui.aberta && camp(ui.aberta)) { lista.style.display = 'none'; det.style.display = ''; renderDetalhe(); }
    else { ui.aberta = null; lista.style.display = ''; det.style.display = 'none'; det.innerHTML = ''; renderLista(); }
  }

  // ---------- cadastro ----------
  function preencher(p) {
    var s = function (k, v) { var e = document.getElementById('ca_' + k); if (e) e.value = v == null ? '' : v; };
    s('id', p.id); s('name', p.name); s('category', p.category || 'click'); s('inicio', p.inicio); s('fim', p.deadline);
    s('assignee', p.assignee); s('status', p.status || 'planning'); s('verba', p.verbaPrevista ? String(p.verbaPrevista).replace('.', ',') : '');
    s('client', p.client); s('objetivo', p.objetivo); s('metas', p.metas); s('checklist', (p.checklist || []).join('\n'));
    s('desc', p.desc); s('resultado', p.resultado);
    document.querySelectorAll('#ca_canais [data-canal]').forEach(function (b) { b.classList.toggle('active', (p.canais || []).indexOf(b.dataset.canal) !== -1); });
    var cor = p.cor || CORES[0];
    document.querySelectorAll('#ca_cores button').forEach(function (b) { b.classList.toggle('on', b.dataset.cor === cor); });
  }

  function nova() {
    montar();
    var cat = (typeof DB !== 'undefined' && DB.settings && DB.settings.category !== 'all') ? DB.settings.category : 'click';
    preencher({ id: '', status: 'planning', category: cat, inicio: hoje(), cor: CORES[Math.floor(Math.random() * CORES.length)] });
    document.getElementById('caModalTitulo').textContent = 'Nova campanha';
    openModal('campanhaModal');
    setTimeout(function () { document.getElementById('ca_name').focus(); }, 60);
  }
  function editar(id) {
    montar();
    var p = camp(id); if (!p) return;
    preencher(p);
    document.getElementById('caModalTitulo').textContent = 'Editar campanha';
    openModal('campanhaModal');
  }

  function salvar() {
    var g = function (k) { var e = document.getElementById('ca_' + k); return e ? e.value.trim() : ''; };
    var nome = g('name'); if (!nome) { showToast('Dê um nome para a campanha', 'error'); return; }
    if (g('inicio') && g('fim') && g('fim') < g('inicio')) { showToast('O fim está antes do início', 'error'); return; }
    var id = g('id') || genId();
    var antigo = camp(id) || {};
    var checklist = g('checklist').split('\n').map(function (s) { return s.trim(); }).filter(Boolean);
    // mantém o "feito" dos itens do checklist que continuaram iguais
    var velho = antigo.checklist || [], velhoSt = antigo.checklistState || [];
    var estado = checklist.map(function (it) { var i = velho.indexOf(it); return i >= 0 ? !!velhoSt[i] : false; });
    var corBtn = document.querySelector('#ca_cores button.on');
    var p = Object.assign({}, antigo, {
      id: id, name: nome, category: g('category'), inicio: g('inicio'), deadline: g('fim'), assignee: g('assignee'), status: g('status'),
      verbaPrevista: lerValor(g('verba')), client: g('client'), objetivo: g('objetivo'), metas: g('metas'),
      canais: Array.prototype.map.call(document.querySelectorAll('#ca_canais [data-canal].active'), function (b) { return b.dataset.canal; }),
      checklist: checklist, checklistState: estado, desc: g('desc'), resultado: g('resultado'),
      cor: corBtn ? corBtn.dataset.cor : (antigo.cor || CORES[0]), demands: antigo.demands || []
    });
    if (checklist.length) p.progress = Math.round(estado.filter(Boolean).length / checklist.length * 100);
    else if (p.progress == null) p.progress = 0;
    firebaseCreate('projects', p);
    if (typeof addActivity === 'function') { try { addActivity('Campanha "' + nome + '" ' + (antigo.id ? 'atualizada' : 'criada'), 'project'); } catch (e) {} } // eslint-disable-line no-undef
    closeModal('campanhaModal');
    showToast(antigo.id ? 'Campanha atualizada!' : 'Campanha criada!', 'success');
    if (!antigo.id) ui.aberta = id;
    if (typeof currentPage !== 'undefined' && currentPage !== 'projetos') navigate('projetos');
    depois(render);
  }

  function excluir(id) {
    var p = camp(id); if (!p) return;
    var l = ligados(id);
    var n = l.tarefas.length + l.aprov.length + l.capt.length + l.verba.length;
    if (!confirm('Excluir a campanha "' + p.name + '"?' + (n ? '\n\nAs ' + n + ' coisas ligadas a ela (tarefas, peças, captações, gastos) NÃO são apagadas — só perdem a ligação.' : ''))) return;
    firebaseDelete('projects', id);
    ui.aberta = null;
    showToast('Campanha excluída', 'info');
    depois(render);
  }

  function salvarCamp(p) { firebaseCreate('projects', p); depois(render); }

  // ---------- API ----------
  window.CA = {
    render: render, nova: nova, editar: editar, salvar: salvar, excluir: excluir,
    abrir: function (id) { ui.aberta = id; ui.aba = 'geral'; if (typeof currentPage !== 'undefined' && currentPage !== 'projetos') navigate('projetos'); else render(); window.scrollTo(0, 0); },
    fechar: function () { ui.aberta = null; render(); },
    aba: function (a) { ui.aba = a; renderDetalhe(); },
    vista: function (v) { ui.vista = v; render(); },
    filtro: function (f) { ui.filtro = f; render(); },
    buscar: function (t) { ui.busca = t; clearTimeout(ui._t); ui._t = setTimeout(function () { render(); var i = document.querySelector('#caLista .search-bar input'); if (i) { i.focus(); i.setSelectionRange(i.value.length, i.value.length); } }, 250); },
    ano: function (n) { ui.ano = String(Number(ui.ano) + n); render(); },
    status: function (st) {
      var p = camp(ui.aberta); if (!p) return;
      salvarCamp(Object.assign({}, p, { status: st }));
      showToast('Campanha agora está "' + ST[st].nome + '"', 'success');
      if (st === 'done' && !p.resultado) setTimeout(function () { showToast('Dica: preencha o resultado da campanha em Editar', 'info'); }, 600);
    },
    check: function (i) {
      var p = camp(ui.aberta); if (!p) return;
      var st = (p.checklistState || []).slice(); while (st.length < (p.checklist || []).length) st.push(false);
      st[i] = !st[i];
      salvarCamp(Object.assign({}, p, { checklistState: st, progress: Math.round(st.filter(Boolean).length / (p.checklist.length || 1) * 100) }));
    },
    addCheck: function () {
      var inp = document.getElementById('caNovoCheck'); var t = inp && inp.value.trim(); var p = camp(ui.aberta); if (!t || !p) return;
      var cl = (p.checklist || []).concat([t]), st = (p.checklistState || []).slice(); while (st.length < cl.length) st.push(false);
      salvarCamp(Object.assign({}, p, { checklist: cl, checklistState: st, progress: Math.round(st.filter(Boolean).length / cl.length * 100) }));
    },
    demanda: function (i) {
      var p = camp(ui.aberta); if (!p) return;
      var d = (p.demands || []).map(function (x, k) { return k === i ? Object.assign({}, x, { done: !x.done }) : x; });
      salvarCamp(Object.assign({}, p, { demands: d }));
    },
    addDemanda: function () {
      var inp = document.getElementById('caNovaDemanda'); var t = inp && inp.value.trim(); var p = camp(ui.aberta); if (!t || !p) return;
      salvarCamp(Object.assign({}, p, { demands: (p.demands || []).concat([{ text: t, done: false }]) }));
    },
    demandaTarefa: function (i) {
      var p = camp(ui.aberta); if (!p || !p.demands || !p.demands[i]) return;
      CA.novaTarefa(p.demands[i].text);
    },
    novaTarefa: function (titulo) {
      var p = camp(ui.aberta); if (!p) return;
      if (typeof resetTaskModal === 'function') { try { resetTaskModal(); } catch (e) {} } // eslint-disable-line no-undef
      openModal('taskModal');
      setTimeout(function () {
        var s = function (id, v) { var e = document.getElementById(id); if (e) e.value = v; };
        s('t_project', p.id); s('t_category', p.category === 'geral' ? 'click' : (p.category || 'click'));
        if (titulo) s('t_title', titulo);
      }, 30);
    },
    novaPeca: function () {
      var p = camp(ui.aberta); if (!p) return;
      if (typeof apNovo === 'function') apNovo(); else openModal('approvalModal');
      setTimeout(function () { var e = document.getElementById('ap_project'); if (e) e.value = p.id; var c = document.getElementById('ap_category'); if (c && p.category !== 'geral') c.value = p.category; }, 60);
    },
    abrirPeca: function (id) { navigate('aprovacoes'); if (typeof apAbrir === 'function') setTimeout(function () { apAbrir(id); }, 300); },
    novaCaptacao: function () {
      var p = camp(ui.aberta); if (!p || !window.CP) return;
      window.CP.nova(p.inicio && p.inicio > hoje() ? p.inicio : undefined);
      setTimeout(function () { var e = document.getElementById('cp_campanha'); if (e) e.value = p.id; var c = document.getElementById('cp_category'); if (c) c.value = p.category || 'click'; }, 40);
    },
    abrirCaptacao: function (id) { if (window.CP) window.CP.editar(id); },
    addGasto: function () {
      var p = camp(ui.aberta); if (!p) return;
      var g = function (k) { return (document.getElementById('caV_' + k) || {}).value || ''; };
      var valor = lerValor(g('valor'));
      if (!g('data') || !g('desc').trim() || !valor) { showToast('Data, descrição e valor são obrigatórios', 'error'); return; }
      firebaseCreate('verba', {
        id: genId(), empresa: p.category === 'impresul' ? 'impresul' : 'click', data: g('data'), loja: g('loja').trim().toUpperCase(),
        descricao: g('desc').trim().toUpperCase(), os: g('os').trim(), categoria: 'Outros', valor: valor, projeto: p.id, obs: ''
      });
      showToast('Gasto de ' + brl(valor) + ' lançado', 'success');
      depois(render);
    },
    abrirGasto: function (id) { if (window.VB) window.VB.editar(id); },
    ST: ST
  };

  // ---------- substitui as funções antigas de Projetos ----------
  function ligar() {
    montar();
    window.renderProjects = function () { if (typeof currentPage === 'undefined' || currentPage === 'projetos') render(); try { if (typeof populateProjSelects === 'function') populateProjSelects(); } catch (e) {} }; // eslint-disable-line no-undef
    window.openProjectDetail = function (id) { CA.abrir(id); };
    window.editProject = function (id) { CA.editar(id); };
    window.deleteProject = function (id) { CA.excluir(id); };
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', ligar);
  else ligar();
})();
