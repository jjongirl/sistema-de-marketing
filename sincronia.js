/* ============================================================
   SINCRONIA DA APARÊNCIA ENTRE APARELHOS
   Os dados (tarefas, campanhas, verba...) já ficam no Firebase.
   Já a aparência ficava só no navegador — então o app do celular
   abria com outro visual. Agora ela acompanha o login da pessoa:
     · claro / escuro
     · estilo, cores e cantos (painel 🎨 Aparência)
     · imagem de fundo (se não for grande demais)
   Vale a última mudança feita, em qualquer aparelho.
   Fica em teams/impresul/perfis/{email}.prefs
============================================================ */
(function () {
  var K_VISUAL = 'impresulVisual';
  var K_IMG = 'impresulVisualImg';
  var K_AT = 'impresulPrefsAt';      // quando a aparência deste aparelho mudou por último
  var IMG_MAX = 700000;              // limite do documento do Firebase é 1 MB

  var email = '', ultimo = null, aplicando = false, timer = null;
  var APP = window.navigator.standalone === true ||
    (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches);

  function ls(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function lsSet(k, v) { try { if (v === null || v === undefined) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (e) {} }
  function norm(e) { return String(e || '').trim().toLowerCase(); }
  function chave(e) { return norm(e).replace(/[^a-z0-9]+/g, '_'); }

  function pronto() {
    try {
      return typeof fdb !== 'undefined' && fdb && typeof COL === 'function' &&
        typeof CURRENT_USER !== 'undefined' && CURRENT_USER && CURRENT_USER.email &&
        typeof DB !== 'undefined' && window.__appIniciado;
    } catch (e) { return false; }
  }
  function doc() { return COL('perfis').doc(chave(email)); }

  function tema() {
    var t = (DB.settings && DB.settings.theme) || document.documentElement.getAttribute('data-theme');
    return t === 'light' ? 'light' : 'dark';
  }
  function atual() {
    var img = ls(K_IMG);
    return {
      theme: tema(),
      visual: ls(K_VISUAL) || '',
      img: img && img.length <= IMG_MAX ? img : (img ? null : '')  // null = grande demais, não mexe
    };
  }
  function igual(a, b) {
    return a && b && a.theme === b.theme && a.visual === b.visual &&
      (a.img === null || b.img === null || a.img === b.img);
  }

  function enviar(p) {
    var at = Number(ls(K_AT)) || Date.now();
    var dados = { theme: p.theme, visual: p.visual, at: at };
    if (p.img !== null) dados.img = p.img;
    doc().set({ email: email, prefs: dados }, { merge: true })
      .catch(function (e) { console.warn('[sincronia] não salvou a aparência:', e.message); });
  }

  function aplicar(r) {
    aplicando = true;
    lsSet(K_VISUAL, r.visual || null);
    if (typeof r.img === 'string') lsSet(K_IMG, r.img || null);
    lsSet(K_AT, String(r.at || Date.now()));
    try { DB.settings.theme = r.theme === 'light' ? 'light' : 'dark'; save(); } catch (e) {}
    // recarrega uma vez para o painel de aparência montar tudo com o visual novo
    location.reload();
  }

  function comparar() {
    if (!pronto() || aplicando) return;
    doc().get().then(function (d) {
      var r = d.exists && d.data() && d.data().prefs;
      var local = atual();
      var localAt = Number(ls(K_AT)) || 0;
      ultimo = local;
      if (!localAt) {
        // primeira vez neste aparelho
        if (r) {
          if (igual(local, r)) lsSet(K_AT, String(r.at || Date.now()));
          else aplicar(r);
        } else if (!APP) {
          // navegador que já era usado: o visual dele vira o padrão da conta.
          // (o app recém-instalado não envia nada: ele só tem o visual padrão)
          lsSet(K_AT, String(Date.now()));
          enviar(local);
        }
        return;
      }
      if (!r) { enviar(local); return; }
      if (igual(local, r)) return;
      if ((r.at || 0) > localAt) aplicar(r);
      else enviar(local);
    }).catch(function (e) { console.warn('[sincronia] não leu a aparência:', e.message); });
  }

  // vigia mudanças feitas neste aparelho (botão claro/escuro, painel Aparência)
  function vigiar() {
    if (!pronto() || aplicando || !ultimo) return;
    var p = atual();
    if (igual(p, ultimo)) return;
    ultimo = p;
    lsSet(K_AT, String(Date.now()));
    clearTimeout(timer);
    timer = setTimeout(function () { enviar(p); }, 800);
  }

  var espera = setInterval(function () {
    if (!pronto()) return;
    clearInterval(espera);
    email = norm(CURRENT_USER.email);
    comparar();
    setInterval(vigiar, 2000);
    // quando o app volta para a frente (celular), confere se mudou em outro lugar
    document.addEventListener('visibilitychange', function () { if (!document.hidden) comparar(); });
  }, 800);
})();
