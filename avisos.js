/* ============================================================
   AVISOS NO SISTEMA
   ------------------------------------------------------------
   • Sino (topo): bloco "Para você hoje" com o que é da pessoa
     logada — atrasadas, hoje, amanhã e pontos de atenção.
     A bolinha vermelha acende quando há algo novo no dia.
   • Notificações do navegador (se a pessoa permitir):
       – resumo do dia na primeira vez que abre o sistema
       – X min antes de uma captação / tarefa com horário
     (só funcionam com o sistema aberto em alguma aba)
   • Preferências (botão "Avisos" no Meu Perfil): liga/desliga o
     e-mail diário e as notificações, e manda um e-mail de teste.
   As regras ficam em avisos-regras.js (as mesmas do e-mail).
   Tudo dentro de window.AV.
============================================================ */
/* global DB, CURRENT_USER, AvisosRegras, fbSaveSettings, save, showToast, openModal, closeModal, firebase */
(function () {
  var LS_PREF = 'impresulAvisosPref';
  var LS_VISTO = 'impresulAvisosVisto:';
  var LS_NOTIF = 'impresulAvisosNotif:';
  var GRUPOS = [['atrasadas', 'Atrasadas', 'vermelho'], ['hoje', 'Hoje', 'azul'], ['atencao', 'Atenção', 'laranja'], ['amanha', 'Amanhã', 'cinza']];

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function hoje() { var d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
  function usuario() { return (typeof CURRENT_USER !== 'undefined' && CURRENT_USER) || null; }
  function prefs() {
    var p = {}; try { p = JSON.parse(localStorage.getItem(LS_PREF) || '{}'); } catch (e) {}
    return Object.assign({ navegador: false, antesCaptacao: 60, antesTarefa: 15 }, p);
  }
  function gravarPrefs(p) { try { localStorage.setItem(LS_PREF, JSON.stringify(p)); } catch (e) {} }
  function emailDesligado(email) {
    var l = (typeof DB !== 'undefined' && DB.settings && DB.settings.avisosEmailDesligados) || [];
    return l.map(function (x) { return String(x).toLowerCase(); }).indexOf(String(email || '').toLowerCase()) !== -1;
  }

  function calcular() {
    var u = usuario();
    if (!u || !u.email || typeof AvisosRegras === 'undefined' || typeof DB === 'undefined') return null;
    return AvisosRegras.montar({
      tasks: DB.tasks, captacoes: DB.captacoes, approvals: DB.approvals, pautas: DB.pautas,
      projects: DB.projects, cobrancas: DB.cobrancas
    }, { nome: u.nome, email: u.email }, hoje(), (typeof TEAM !== 'undefined' ? TEAM : null)); // eslint-disable-line no-undef
  }

  function chaveVisto() { var u = usuario(); return LS_VISTO + (u && u.email || '') + ':' + hoje(); }
  function jaViuHoje() { try { return localStorage.getItem(chaveVisto()) === '1'; } catch (e) { return false; } }
  function marcarVisto() { try { localStorage.setItem(chaveVisto(), '1'); } catch (e) {} }

  // ---------- sino ----------
  function blocoSino(r) {
    if (!r) return '';
    if (!r.total) return '<div class="av-bloco av-tudo-certo"><i class="fa-regular fa-face-smile"></i> Nada pendente para você hoje.</div>';
    var html = '<div class="av-bloco"><div class="av-tit"><span><i class="fa-solid fa-sun"></i> Para você hoje</span><button onclick="AV.preferencias()" title="Preferências de aviso"><i class="fa-solid fa-sliders"></i></button></div>';
    GRUPOS.forEach(function (g) {
      var itens = r[g[0]]; if (!itens.length) return;
      html += '<div class="av-grupo"><div class="av-g-tit av-' + g[2] + '">' + g[1] + ' <em>' + itens.length + '</em></div>' +
        itens.slice(0, 6).map(function (it) {
          return '<button class="av-item" onclick="AV.abrir(\'' + it.tipo + '\',\'' + esc(it.id) + '\')"><span class="av-ico">' + it.icone + '</span>' +
            '<span class="av-txt"><b>' + esc(it.titulo) + '</b>' +
            '<small>' + [it.hora, g[0] === 'atrasadas' || g[0] === 'atencao' ? '' : '', it.detalhe].filter(Boolean).map(esc).join(' · ') + '</small></span></button>';
        }).join('') + (itens.length > 6 ? '<div class="av-mais">+ ' + (itens.length - 6) + ' no Meu Perfil</div>' : '') + '</div>';
    });
    return html + '</div>';
  }

  function pintarSino() {
    var lista = document.getElementById('notifList'); if (!lista) return;
    var r = calcular();
    var velho = document.getElementById('avBloco'); if (velho) velho.remove();
    if (r) {
      var div = document.createElement('div'); div.id = 'avBloco'; div.innerHTML = blocoSino(r);
      lista.parentNode.insertBefore(div, lista);
      var dot = document.getElementById('notifDot');
      if (dot && r.total && !jaViuHoje()) dot.style.display = 'block';
    }
  }

  function ligarSino() {
    if (typeof window.renderNotifPanel !== 'function' || window.__avSino) return;
    window.__avSino = window.renderNotifPanel;
    window.renderNotifPanel = function () {
      var x = window.__avSino.apply(this, arguments);
      try { pintarSino(); } catch (e) { console.warn('[avisos]', e); }
      return x;
    };
    if (typeof window.toggleNotifPanel === 'function' && !window.__avToggle) {
      window.__avToggle = window.toggleNotifPanel;
      window.toggleNotifPanel = function () {
        var p = document.getElementById('notifPanel');
        if (p && !p.classList.contains('open')) marcarVisto(); // vai abrir: conta como "visto hoje"
        return window.__avToggle.apply(this, arguments);
      };
    }
  }

  // ---------- notificações do navegador ----------
  function podeNotificar() { return 'Notification' in window && Notification.permission === 'granted' && prefs().navegador; }
  function jaNotificou(k) { try { return localStorage.getItem(LS_NOTIF + k) === '1'; } catch (e) { return true; } }
  function notificar(chave, titulo, corpo) {
    if (!podeNotificar() || jaNotificou(chave)) return;
    try { localStorage.setItem(LS_NOTIF + chave, '1'); } catch (e) {}
    try {
      var n = new Notification(titulo, { body: corpo, icon: 'LOGO-IMPRESUL.svg', tag: chave });
      n.onclick = function () { window.focus(); n.close(); };
    } catch (e) {}
  }
  function minutos(hhmm) { var m = String(hhmm || '').match(/^(\d{1,2}):(\d{2})/); return m ? (+m[1]) * 60 + (+m[2]) : null; }

  function checarNotificacoes() {
    if (!podeNotificar()) return;
    var r = calcular(); if (!r) return;
    var td = hoje(), agora = new Date(), min = agora.getHours() * 60 + agora.getMinutes();
    var p = prefs();
    if (r.total && agora.getHours() >= 7) {
      var partes = [];
      if (r.atrasadas.length) partes.push(r.atrasadas.length + ' atrasada(s)');
      if (r.hoje.length) partes.push(r.hoje.length + ' para hoje');
      if (r.atencao.length) partes.push(r.atencao.length + ' ponto(s) de atenção');
      notificar('resumo:' + td, 'Bom dia! Sua pauta de hoje', partes.join(' · '));
    }
    r.hoje.forEach(function (it) {
      var h = minutos(it.hora); if (h == null) return;
      var antes = it.tipo === 'captacao' ? Number(p.antesCaptacao) : Number(p.antesTarefa);
      if (!antes) return;
      var falta = h - min;
      if (falta >= 0 && falta <= antes) {
        notificar(it.tipo + ':' + it.id + ':' + td, (it.tipo === 'captacao' ? '🎬 Captação às ' : '⏰ Às ') + it.hora + ': ' + it.titulo,
          (it.detalhe || '') + (it.lista && it.lista.length ? '\nLeve: ' + it.lista.join(', ') : ''));
      }
    });
  }

  // ---------- preferências ----------
  function montarModal() {
    if (document.getElementById('avisosModal')) return;
    var m = document.createElement('div');
    m.className = 'modal-overlay'; m.id = 'avisosModal';
    m.innerHTML =
      '<div class="modal">' +
        '<div class="modal-header"><div class="modal-title"><i class="fa-solid fa-bell"></i> Meus avisos</div><button class="modal-close" onclick="closeModal(\'avisosModal\')"><i class="fa-solid fa-xmark"></i></button></div>' +
        '<div class="av-pref">' +
          '<div class="av-op"><div><b><i class="fa-solid fa-envelope"></i> E-mail todo dia de manhã</b><small>Por volta das 7h, com o que está com o seu nome: atrasadas, hoje, amanhã e atenção. Às segundas vem o resumo da semana.</small></div>' +
            '<label class="av-sw"><input type="checkbox" id="avEmail"><i></i></label></div>' +
          '<div class="av-op"><div><b><i class="fa-solid fa-desktop"></i> Notificações no computador</b><small id="avNavTxt">Aparecem no canto da tela enquanto o sistema estiver aberto em alguma aba.</small></div>' +
            '<label class="av-sw"><input type="checkbox" id="avNav"><i></i></label></div>' +
          '<div class="av-f2"><div class="form-group"><label class="form-label">Avisar antes da captação</label><select class="form-control" id="avAntesC">' +
              [[0, 'Não avisar'], [30, '30 min antes'], [60, '1 hora antes'], [120, '2 horas antes']].map(function (o) { return '<option value="' + o[0] + '">' + o[1] + '</option>'; }).join('') + '</select></div>' +
            '<div class="form-group"><label class="form-label">Avisar antes de tarefa com horário</label><select class="form-control" id="avAntesT">' +
              [[0, 'Não avisar'], [10, '10 min antes'], [15, '15 min antes'], [30, '30 min antes'], [60, '1 hora antes']].map(function (o) { return '<option value="' + o[0] + '">' + o[1] + '</option>'; }).join('') + '</select></div></div>' +
          '<div class="av-teste"><button class="btn btn-secondary" id="avBtnTeste" onclick="AV.testarEmail()"><i class="fa-solid fa-paper-plane"></i>Me mandar o e-mail de hoje agora</button>' +
            '<small id="avTesteTxt">Serve para ver como fica. Só funciona depois que a configuração na Vercel estiver feita.</small></div>' +
        '</div>' +
        '<div class="modal-footer"><button class="btn btn-secondary" onclick="closeModal(\'avisosModal\')">Cancelar</button><button class="btn btn-primary" onclick="AV.salvarPreferencias()"><i class="fa-solid fa-check"></i>Salvar</button></div>' +
      '</div>';
    document.body.appendChild(m);
  }

  function preferencias() {
    montarModal();
    var u = usuario() || {}, p = prefs();
    document.getElementById('avEmail').checked = !emailDesligado(u.email);
    document.getElementById('avNav').checked = p.navegador && ('Notification' in window) && Notification.permission === 'granted';
    document.getElementById('avAntesC').value = String(p.antesCaptacao);
    document.getElementById('avAntesT').value = String(p.antesTarefa);
    var txt = document.getElementById('avNavTxt');
    if (!('Notification' in window)) txt.textContent = 'Este navegador não suporta notificações.';
    else if (Notification.permission === 'denied') txt.innerHTML = 'O navegador está <b>bloqueando</b> as notificações deste site. Libere no cadeado ao lado do endereço e tente de novo.';
    openModal('avisosModal');
  }

  function salvarPreferencias() {
    var u = usuario() || {};
    var p = prefs();
    p.antesCaptacao = Number(document.getElementById('avAntesC').value);
    p.antesTarefa = Number(document.getElementById('avAntesT').value);
    var querNav = document.getElementById('avNav').checked;
    var fim = function () {
      gravarPrefs(p);
      // e-mail: lista compartilhada de quem NÃO quer receber (fica nas configurações da equipe)
      var querEmail = document.getElementById('avEmail').checked;
      if (u.email && typeof DB !== 'undefined' && DB.settings) {
        var l = (DB.settings.avisosEmailDesligados || []).filter(function (x) { return String(x).toLowerCase() !== u.email.toLowerCase(); });
        if (!querEmail) l.push(u.email.toLowerCase());
        DB.settings.avisosEmailDesligados = l;
        if (typeof fbSaveSettings === 'function') fbSaveSettings(); else if (typeof save === 'function') save();
      }
      closeModal('avisosModal');
      showToast('Avisos salvos', 'success');
      checarNotificacoes();
    };
    if (querNav && 'Notification' in window && Notification.permission !== 'granted') {
      Notification.requestPermission().then(function (perm) {
        p.navegador = perm === 'granted';
        if (perm !== 'granted') showToast('O navegador não liberou as notificações', 'warning');
        fim();
      });
    } else { p.navegador = querNav; fim(); }
  }

  function testarEmail() {
    var btn = document.getElementById('avBtnTeste'), txt = document.getElementById('avTesteTxt');
    var usr = (typeof firebase !== 'undefined' && firebase.auth && firebase.auth().currentUser) || null;
    if (!usr) { txt.textContent = 'Entre com o seu login para testar.'; return; }
    btn.disabled = true; txt.textContent = 'Enviando...';
    usr.getIdToken().then(function (tk) {
      return fetch('/api/avisos-diarios?teste=1', { method: 'POST', headers: { Authorization: 'Bearer ' + tk } });
    }).then(function (r) { return r.json().catch(function () { return { ok: false, erro: 'resposta inválida (' + r.status + ')' }; }); })
      .then(function (d) {
        btn.disabled = false;
        txt.textContent = d.ok ? 'Enviado para ' + (d.para || 'o seu e-mail') + '. Confira a caixa de entrada (e o spam).' : 'Não foi: ' + (d.erro || 'erro desconhecido');
      })
      .catch(function (e) { btn.disabled = false; txt.textContent = 'Não foi: ' + e.message; });
  }

  // ---------- API ----------
  window.AV = {
    calcular: calcular, preferencias: preferencias, salvarPreferencias: salvarPreferencias, testarEmail: testarEmail,
    abrir: function (tipo, id) {
      var p = document.getElementById('notifPanel'); if (p) p.classList.remove('open');
      if (tipo === 'campanha' && window.CA) return window.CA.abrir(id);
      if (typeof window.perfilAbrir === 'function') return window.perfilAbrir(tipo, id);
    },
    _checar: checarNotificacoes, _pintar: pintarSino
  };

  function iniciar() {
    ligarSino();
    setInterval(function () { try { checarNotificacoes(); } catch (e) {} }, 60000);
    setTimeout(function () { try { pintarSino(); checarNotificacoes(); } catch (e) {} }, 4000);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar);
  else iniciar();
})();
