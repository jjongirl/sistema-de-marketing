/* ============================================================
   ABA "VERBA" — controle de despesas de marketing
   ------------------------------------------------------------
   • Cada despesa fica salva na coleção "verba" (Firebase), pelo
     mesmo caminho do resto do sistema (aparece no Registro).
   • Lançamento rápido em linha, igual a planilha:
       Data · Loja · Descrição · Boletim/OS · Valor
   • Relatório para imprimir no mesmo modelo usado hoje
     ("Relatório de despesas MKT Click"), com assinatura e data.
   • Limite mensal por empresa (fica nas configurações da equipe).
   • Importar linhas coladas do Google Planilhas e exportar CSV.
   Tudo dentro de window.VB.
============================================================ */
/* global DB, genId, firebaseCreate, firebaseDelete, openModal, closeModal, showToast, fbSaveSettings, save, today, AUDIT_CAMPOS */
(function () {
  var EMP = {
    click:    { nome: 'Click', longo: 'Click Impresso', titulo: 'Relatório de despesas MKT Click' },
    impresul: { nome: 'Impresul', longo: 'Impresul', titulo: 'Relatório de despesas MKT Impresul' }
  };
  var CATS = ['Impressos', 'Comunicação visual', 'Brindes', 'Impulsionamento / anúncios', 'Eventos', 'Freelancer / serviços', 'Fotografia / vídeo', 'Material de escritório', 'Outros'];
  var MES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
  var LS_IMPRIMIR = 'impresulVerbaImprimir';

  var ui = { empresa: 'click', mes: null, de: '', ate: '', busca: '', cat: '' };

  if (typeof AUDIT_CAMPOS === 'object' && AUDIT_CAMPOS) {
    try { Object.assign(AUDIT_CAMPOS, { valor: 'valor', loja: 'loja', os: 'boletim/OS', descricao: 'descrição', empresa: 'empresa', categoria: 'categoria' }); } catch (e) {}
  }

  // ---------- utilidades ----------
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function norm(s) { return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim(); }
  function hojeIso() {
    var d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }
  function brl(v) { return (Number(v) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }); }
  function dataBr(iso, comAno) { if (!iso) return ''; var p = iso.split('-'); return p[2] + '/' + p[1] + (comAno ? '/' + p[0] : ''); }
  function lerValor(t) {
    if (typeof t === 'number') return t;
    var s = String(t || '').replace(/[^\d,.-]/g, '');
    if (s.indexOf(',') !== -1) s = s.replace(/\./g, '').replace(',', '.'); // 1.234,56
    var n = parseFloat(s); return isNaN(n) ? 0 : Math.round(n * 100) / 100;
  }
  function lerData(t, anoPadrao) {
    t = String(t || '').trim();
    var m = t.match(/^(\d{1,2})[\/.-](\d{1,2})(?:[\/.-](\d{2,4}))?$/);
    if (m) {
      var ano = m[3] ? (m[3].length === 2 ? '20' + m[3] : m[3]) : anoPadrao;
      return ano + '-' + m[2].padStart(2, '0') + '-' + m[1].padStart(2, '0');
    }
    if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return t;
    return '';
  }
  function fimDoMes(ym) { var a = +ym.slice(0, 4), m = +ym.slice(5, 7); return ym + '-' + String(new Date(a, m, 0).getDate()).padStart(2, '0'); }
  function lista() { return (typeof DB !== 'undefined' && Array.isArray(DB.verba)) ? DB.verba : []; }
  function semFirebase() { return typeof fdb === 'undefined' || !fdb; } // eslint-disable-line no-undef
  function periodo() {
    if (!ui.mes) ui.mes = hojeIso().slice(0, 7);
    if (ui.mes === 'custom') return { de: ui.de || hojeIso(), ate: ui.ate || hojeIso() };
    return { de: ui.mes + '-01', ate: fimDoMes(ui.mes) };
  }
  function limites() { return (typeof DB !== 'undefined' && DB.settings && DB.settings.verbaLimites) || {}; }
  function doPeriodo(empresa) {
    var p = periodo(), b = norm(ui.busca);
    return lista().filter(function (v) {
      if (empresa && empresa !== 'todas' && v.empresa !== empresa) return false;
      if (!v.data || v.data < p.de || v.data > p.ate) return false;
      if (ui.cat && v.categoria !== ui.cat) return false;
      if (b && norm([v.loja, v.descricao, v.os, v.categoria, v.obs].join(' ')).indexOf(b) === -1) return false;
      return true;
    }).sort(function (a, b) { return (a.data + (a.__createdAt || 0)).localeCompare(b.data + (b.__createdAt || 0)); });
  }
  function soma(arr) { return Math.round(arr.reduce(function (s, v) { return s + (Number(v.valor) || 0); }, 0) * 100) / 100; }
  function lojasUsadas(emp) {
    var vistas = {};
    lista().forEach(function (v) { if (v.loja && (!emp || v.empresa === emp)) vistas[v.loja.trim().toUpperCase()] = 1; });
    return Object.keys(vistas).sort();
  }
  // Lista de lojas para clicar: a cadastrada em "Lojas" (fica nas configurações da
  // equipe); enquanto não houver cadastro, usa as lojas já lançadas.
  // Lojas do grupo (valem para Click e Impresul até alguém mudar no botão "lojas").
  // "LOJAS" = despesa que vale para todas as lojas (como no relatório impresso).
  var LOJAS_PADRAO = ['LOJAS', 'ANDRADAS', 'ANITA', 'ASSIS', 'AZENHA', 'CACHOEIRINHA', 'CANOAS', 'CRISTÓVÃO', 'CURITIBA',
    'GOETHE', 'GRAVATAÍ', 'IPIRANGA', 'NILO', 'NOVO HAMBURGO', 'OSVALDO', 'PROTÁSIO', 'SÃO LEOPOLDO', 'TOTAL', 'WENCESLAU'];
  function lojasDe(emp) {
    var cad = (typeof DB !== 'undefined' && DB.settings && DB.settings.verbaLojas && DB.settings.verbaLojas[emp]) || null;
    if (cad && cad.length) return cad.slice();
    var l = LOJAS_PADRAO.slice();
    lojasUsadas(emp).forEach(function (n) { if (l.indexOf(n) === -1) l.push(n); });
    return l;
  }
  function opcoesLoja(emp, atual) {
    var l = lojasDe(emp);
    atual = String(atual || '').trim().toUpperCase();
    if (atual && l.indexOf(atual) === -1) l.push(atual);
    return '<option value="">Escolha a loja…</option>' +
      l.map(function (n) { return '<option value="' + esc(n) + '"' + (n === atual ? ' selected' : '') + '>' + esc(n) + '</option>'; }).join('') +
      '<option value="__nova">+ Outra loja…</option>';
  }
  function gravarLojas(obj) {
    DB.settings.verbaLojas = obj;
    if (typeof fbSaveSettings === 'function') fbSaveSettings(); else if (typeof save === 'function') save();
  }
  // escolheu "+ Outra loja…": pergunta o nome, guarda na lista e já seleciona
  function lojaEscolhida(sel, emp) {
    if (sel.value !== '__nova') return;
    var nome = (prompt('Nome da nova loja (' + (EMP[emp] || {}).longo + '):') || '').trim().toUpperCase();
    if (!nome) { sel.value = ''; return; }
    var todas = { click: lojasDe('click'), impresul: lojasDe('impresul') };
    if (todas[emp].indexOf(nome) === -1) {
      todas[emp].push(nome);
      // mantém "LOJAS" no topo e o resto em ordem alfabética
      todas[emp] = todas[emp].filter(function (n) { return n === 'LOJAS'; })
        .concat(todas[emp].filter(function (n) { return n !== 'LOJAS'; }).sort(function (a, b) { return a.localeCompare(b, 'pt-BR'); }));
    }
    gravarLojas(todas);
    sel.innerHTML = opcoesLoja(emp, nome);
    showToast('Loja "' + nome + '" adicionada à lista', 'success');
  }

  // ---------- montagem ----------
  function montar() {
    var pg = document.getElementById('page-verba');
    if (!pg || pg.dataset.montado) return;
    pg.dataset.montado = '1';
    pg.innerHTML =
      '<div class="section-header"><div>' +
        '<div class="section-title">Verba</div>' +
        '<div class="section-subtitle">Despesas de marketing e comunicação visual · relatório pronto para imprimir e assinar</div>' +
      '</div><div class="vb-topo-acoes">' +
        '<button class="btn btn-secondary" onclick="VB.importar()"><i class="fa-solid fa-file-import"></i>Importar da planilha</button>' +
        '<button class="btn btn-secondary" onclick="VB.csv()"><i class="fa-solid fa-file-csv"></i>Exportar</button>' +
        '<button class="btn btn-primary" onclick="VB.imprimir()"><i class="fa-solid fa-print"></i>Imprimir relatório</button>' +
      '</div></div>' +
      '<div class="vb-barra">' +
        '<div class="vb-emp" id="vbEmp"></div>' +
        '<div class="vb-periodo"><select class="form-control" id="vbMes" onchange="VB.mes(this.value)"></select>' +
          '<span id="vbCustom" class="vb-custom"><input type="date" class="form-control" id="vbDe" onchange="VB.custom()"> até <input type="date" class="form-control" id="vbAte" onchange="VB.custom()"></span></div>' +
      '</div>' +
      '<div class="stat-grid" id="vbStats"></div>' +
      '<div class="card vb-card">' +
        '<div class="card-header"><div class="card-title"><i class="fa-solid fa-receipt"></i><span id="vbTitulo">Lançamentos</span></div>' +
          '<div class="vb-filtros"><div class="search-bar" style="width:220px"><i class="fa-solid fa-magnifying-glass"></i><input type="text" placeholder="Buscar loja, descrição, OS..." oninput="VB.buscar(this.value)"></div>' +
          '<select class="form-control" id="vbCatFiltro" onchange="VB.categoria(this.value)" style="width:auto"></select></div></div>' +
        '<div class="vb-tabela-wrap"><table class="vb-tabela"><thead><tr>' +
          '<th style="width:118px">Data</th><th style="width:200px">Loja <button class="vb-lojas-btn" onclick="VB.lojas()" title="Cadastrar as lojas da Click e da Impresul"><i class="fa-solid fa-pen"></i> lojas</button></th><th>Descrição</th><th style="width:130px">Boletim/OS</th><th style="width:160px">Categoria</th><th class="dir" style="width:120px">Valor</th><th style="width:70px"></th>' +
        '</tr>' +
        '<tr class="vb-novo">' +
          '<td><input type="date" class="form-control" id="vbN_data"></td>' +
          '<td><div class="vb-loja-campo"><select class="form-control" id="vbN_loja" onchange="VB.lojaEscolhida(this)"></select>' +
            '<button type="button" class="vb-loja-mais" onclick="VB.novaLoja(\'vbN_loja\')" title="Adicionar uma loja nova à lista"><i class="fa-solid fa-plus"></i></button></div></td>' +
          '<td><input class="form-control" id="vbN_desc" placeholder="O que foi comprado / feito"></td>' +
          '<td><input class="form-control" id="vbN_os" placeholder="Nº"></td>' +
          '<td><select class="form-control" id="vbN_cat">' + CATS.map(function (c) { return '<option>' + c + '</option>'; }).join('') + '</select></td>' +
          '<td><input class="form-control dir" id="vbN_valor" inputmode="decimal" placeholder="0,00"></td>' +
          '<td><button class="btn btn-primary btn-sm" onclick="VB.adicionar()" title="Adicionar (Enter)"><i class="fa-solid fa-plus"></i></button></td>' +
        '</tr></thead><tbody id="vbLinhas"></tbody>' +
        '<tfoot><tr><td colspan="5" class="dir vb-total-rot">Total do período</td><td class="dir vb-total" id="vbTotal"></td><td></td></tr></tfoot></table></div>' +
        '<datalist id="vbLojas"></datalist>' +
        '<label class="vb-auto"><input type="checkbox" id="vbAutoPrint" onchange="VB.autoPrint(this.checked)"> Abrir o relatório para imprimir sempre que eu adicionar uma despesa</label>' +
      '</div>' +
      '<div class="card vb-card" id="vbResumo"></div>';

    pg.querySelector('.vb-novo').addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); VB.adicionar(); } });
    try { document.getElementById('vbAutoPrint').checked = localStorage.getItem(LS_IMPRIMIR) === '1'; } catch (e) {}
    montarModais();
  }

  function montarModais() {
    if (document.getElementById('verbaModal')) return;
    var m = document.createElement('div');
    m.className = 'modal-overlay'; m.id = 'verbaModal';
    m.innerHTML =
      '<div class="modal">' +
        '<div class="modal-header"><div class="modal-title">Editar despesa</div><button class="modal-close" onclick="closeModal(\'verbaModal\')"><i class="fa-solid fa-xmark"></i></button></div>' +
        '<input type="hidden" id="vb_id">' +
        '<div class="vb-form-2"><div class="form-group"><label class="form-label">Data</label><input type="date" class="form-control" id="vb_data"></div>' +
          '<div class="form-group"><label class="form-label">Empresa</label><select class="form-control" id="vb_empresa" onchange="document.getElementById(\'vb_loja\').innerHTML=VB._opcoesLoja(this.value,\'\')"><option value="click">Click Impresso</option><option value="impresul">Impresul</option></select></div></div>' +
        '<div class="vb-form-2"><div class="form-group"><label class="form-label">Loja</label><div class="vb-loja-campo"><select class="form-control" id="vb_loja" onchange="VB.lojaEscolhida(this, document.getElementById(\'vb_empresa\').value)"></select>' +
          '<button type="button" class="vb-loja-mais" onclick="VB.novaLoja(\'vb_loja\', document.getElementById(\'vb_empresa\').value)" title="Adicionar uma loja nova à lista"><i class="fa-solid fa-plus"></i></button></div></div>' +
          '<div class="form-group"><label class="form-label">Boletim / OS</label><input class="form-control" id="vb_os"></div></div>' +
        '<div class="form-group"><label class="form-label">Descrição</label><input class="form-control" id="vb_desc"></div>' +
        '<div class="vb-form-2"><div class="form-group"><label class="form-label">Categoria</label><select class="form-control" id="vb_cat">' + CATS.map(function (c) { return '<option>' + c + '</option>'; }).join('') + '</select></div>' +
          '<div class="form-group"><label class="form-label">Valor (R$)</label><input class="form-control" id="vb_valor" inputmode="decimal"></div></div>' +
        '<div class="form-group"><label class="form-label">Campanha / projeto <span class="vb-opc">(opcional)</span></label><select class="form-control" id="vb_proj"></select></div>' +
        '<div class="form-group"><label class="form-label">Observações</label><textarea class="form-control" id="vb_obs" rows="2"></textarea></div>' +
        '<div class="modal-footer"><button class="btn btn-ghost vb-excluir" onclick="VB.excluir()"><i class="fa-solid fa-trash"></i>Excluir</button>' +
          '<button class="btn btn-secondary" onclick="closeModal(\'verbaModal\')">Cancelar</button>' +
          '<button class="btn btn-primary" onclick="VB.salvar()"><i class="fa-solid fa-check"></i>Salvar</button></div>' +
      '</div>';
    document.body.appendChild(m);

    var imp = document.createElement('div');
    imp.className = 'modal-overlay'; imp.id = 'verbaImportModal';
    imp.innerHTML =
      '<div class="modal modal-lg">' +
        '<div class="modal-header"><div class="modal-title">Importar do Google Planilhas</div><button class="modal-close" onclick="closeModal(\'verbaImportModal\')"><i class="fa-solid fa-xmark"></i></button></div>' +
        '<p class="vb-ajuda">Na planilha, selecione as linhas (sem o cabeçalho) nas colunas <b>Data · Loja · Descrição · Boletim/OS · Valor</b>, copie (Ctrl+C) e cole aqui embaixo (Ctrl+V).</p>' +
        '<div class="vb-form-2"><div class="form-group"><label class="form-label">Empresa</label><select class="form-control" id="vbI_emp"><option value="click">Click Impresso</option><option value="impresul">Impresul</option></select></div>' +
          '<div class="form-group"><label class="form-label">Ano (para datas sem ano, ex.: 05/10)</label><input class="form-control" id="vbI_ano" inputmode="numeric"></div></div>' +
        '<textarea class="form-control vb-colar" id="vbI_txt" rows="8" placeholder="05/10\tLOJAS\tLAMINA ESTACIONAMENTO\t112372\tR$28,00" oninput="VB.previa()"></textarea>' +
        '<div id="vbI_previa" class="vb-previa"></div>' +
        '<div class="modal-footer"><button class="btn btn-secondary" onclick="closeModal(\'verbaImportModal\')">Cancelar</button>' +
          '<button class="btn btn-primary" id="vbI_ok" onclick="VB.confirmarImport()" disabled><i class="fa-solid fa-file-import"></i>Importar</button></div>' +
      '</div>';
    document.body.appendChild(imp);

    var lj = document.createElement('div');
    lj.className = 'modal-overlay'; lj.id = 'verbaLojasModal';
    lj.innerHTML =
      '<div class="modal modal-lg">' +
        '<div class="modal-header"><div class="modal-title"><i class="fa-solid fa-store"></i> Lojas</div><button class="modal-close" onclick="closeModal(\'verbaLojasModal\')"><i class="fa-solid fa-xmark"></i></button></div>' +
        '<p class="vb-ajuda">Escreva <b>uma loja por linha</b>. Elas aparecem na lista do campo "Loja", é só clicar. Vale para a equipe toda.</p>' +
        '<div class="vb-form-2">' +
          '<div class="form-group"><label class="form-label">Lojas da Click Impresso</label><textarea class="form-control vb-lojas-txt" id="vbL_click" rows="12" placeholder="LOJA CENTRO&#10;LOJA PORTO&#10;..."></textarea><small class="vb-opc" id="vbL_nclick"></small></div>' +
          '<div class="form-group"><label class="form-label">Lojas da Impresul</label><textarea class="form-control vb-lojas-txt" id="vbL_impresul" rows="12" placeholder="MATRIZ&#10;FILIAL ...&#10;..."></textarea><small class="vb-opc" id="vbL_nimpresul"></small></div>' +
        '</div>' +
        '<div class="modal-footer"><button class="btn btn-secondary" onclick="closeModal(\'verbaLojasModal\')">Cancelar</button>' +
          '<button class="btn btn-primary" onclick="VB.salvarLojas()"><i class="fa-solid fa-check"></i>Salvar lojas</button></div>' +
      '</div>';
    document.body.appendChild(lj);
    ['click', 'impresul'].forEach(function (k) {
      lj.querySelector('#vbL_' + k).addEventListener('input', function () { contarLojas(k); });
    });
  }

  // ---------- desenho ----------
  function render() {
    montar();
    if (!document.getElementById('vbLinhas')) return;
    var p = periodo(), emp = ui.empresa;

    // empresa
    document.getElementById('vbEmp').innerHTML = ['click', 'impresul', 'todas'].map(function (k) {
      return '<button class="' + (emp === k ? 'on' : '') + '" onclick="VB.empresa(\'' + k + '\')">' + (k === 'todas' ? 'Todas' : EMP[k].longo) + '</button>';
    }).join('');

    // meses com lançamentos + atual
    var meses = {}; meses[hojeIso().slice(0, 7)] = 1;
    lista().forEach(function (v) { if (v.data) meses[v.data.slice(0, 7)] = 1; });
    var sel = document.getElementById('vbMes');
    sel.innerHTML = Object.keys(meses).sort().reverse().map(function (ym) {
      return '<option value="' + ym + '"' + (ui.mes === ym ? ' selected' : '') + '>' + MES[+ym.slice(5, 7) - 1] + ' de ' + ym.slice(0, 4) + '</option>';
    }).join('') + '<option value="custom"' + (ui.mes === 'custom' ? ' selected' : '') + '>Outro período...</option>';
    document.getElementById('vbCustom').style.display = ui.mes === 'custom' ? '' : 'none';
    if (ui.mes === 'custom') { document.getElementById('vbDe').value = p.de; document.getElementById('vbAte').value = p.ate; }

    // filtro categoria
    var cf = document.getElementById('vbCatFiltro');
    cf.innerHTML = '<option value="">Todas as categorias</option>' + CATS.map(function (c) { return '<option' + (ui.cat === c ? ' selected' : '') + '>' + c + '</option>'; }).join('');

    // lojas
    document.getElementById('vbLojas').innerHTML = lojasDe('click').concat(lojasDe('impresul')).map(function (l) { return '<option value="' + esc(l) + '">'; }).join('');
    var selN = document.getElementById('vbN_loja');
    if (selN && emp !== 'todas' && document.activeElement !== selN) {
      // mantém a loja escolhida só se continuar na mesma empresa
      var antes = selN.dataset.emp === emp && selN.value !== '__nova' ? selN.value : '';
      selN.innerHTML = opcoesLoja(emp, antes);
      selN.dataset.emp = emp;
    }

    // linha nova: data padrão
    var nd = document.getElementById('vbN_data');
    if (!nd.value || nd.value < p.de || nd.value > p.ate) nd.value = (hojeIso() >= p.de && hojeIso() <= p.ate) ? hojeIso() : p.de;

    var itens = doPeriodo(emp);
    var total = soma(itens);
    var lim = emp === 'todas' ? (Number(limites().click || 0) + Number(limites().impresul || 0)) : Number(limites()[emp] || 0);
    var mesUnico = ui.mes !== 'custom';

    // números
    var porCat = {};
    itens.forEach(function (v) { var c = v.categoria || 'Outros'; porCat[c] = (porCat[c] || 0) + (Number(v.valor) || 0); });
    var maior = Object.keys(porCat).sort(function (a, b) { return porCat[b] - porCat[a]; })[0];
    var pct = lim ? Math.min(100, Math.round(total / lim * 100)) : 0;
    document.getElementById('vbStats').innerHTML =
      '<div class="stat-card blue"><div class="stat-label"><i class="fa-solid fa-wallet"></i>Gasto no período</div><div class="stat-value">' + brl(total) + '</div><div class="stat-sub">' + itens.length + ' lançamento(s)</div></div>' +
      '<div class="stat-card ' + (lim && total > lim ? 'red' : 'green') + '"><div class="stat-label"><i class="fa-solid fa-piggy-bank"></i>' + (lim ? 'Saldo do limite' : 'Limite do mês') + '</div>' +
        '<div class="stat-value">' + (lim ? brl(lim - total) : '—') + '</div>' +
        '<div class="stat-sub">' + (lim ? (mesUnico ? pct + '% de ' + brl(lim) + ' usados' : 'limite é mensal') : '<button class="vb-link" onclick="VB.limite()">definir limite</button>') + '</div>' +
        (lim && mesUnico ? '<div class="vb-uso"><i style="width:' + pct + '%" class="' + (total > lim ? 'estourou' : pct > 80 ? 'alerta' : '') + '"></i></div>' : '') + '</div>' +
      '<div class="stat-card orange"><div class="stat-label"><i class="fa-solid fa-tags"></i>Maior categoria</div><div class="stat-value vb-menor">' + esc(maior || '—') + '</div><div class="stat-sub">' + (maior ? brl(porCat[maior]) : 'sem despesas') + '</div></div>' +
      '<div class="stat-card magenta"><div class="stat-label"><i class="fa-solid fa-calendar"></i>Período</div><div class="stat-value vb-menor">' + dataBr(p.de, true) + '<br>' + dataBr(p.ate, true) + '</div>' +
        '<div class="stat-sub"><button class="vb-link" onclick="VB.limite()"><i class="fa-solid fa-sliders"></i> limites mensais</button></div></div>';

    document.getElementById('vbTitulo').textContent = 'Lançamentos · ' + (emp === 'todas' ? 'todas as empresas' : EMP[emp].longo);
    document.querySelector('.vb-novo').style.display = emp === 'todas' ? 'none' : '';

    document.getElementById('vbLinhas').innerHTML = itens.length ? itens.map(function (v) {
      return '<tr onclick="VB.editar(\'' + v.id + '\')">' +
        '<td>' + dataBr(v.data, true) + (emp === 'todas' ? ' <span class="vb-tag ' + v.empresa + '">' + (EMP[v.empresa] || {}).nome + '</span>' : '') + '</td>' +
        '<td class="vb-loja">' + esc(v.loja || '') + '</td>' +
        '<td>' + esc(v.descricao || '') + (v.obs ? ' <i class="fa-regular fa-note-sticky vb-nota" title="' + esc(v.obs) + '"></i>' : '') + '</td>' +
        '<td>' + esc(v.os || '') + '</td>' +
        '<td><span class="vb-cat">' + esc(v.categoria || 'Outros') + '</span></td>' +
        '<td class="dir vb-valor">' + brl(v.valor) + '</td>' +
        '<td class="dir"><button class="btn btn-xs btn-ghost" onclick="event.stopPropagation();VB.editar(\'' + v.id + '\')" title="Editar"><i class="fa-solid fa-pen"></i></button></td></tr>';
    }).join('') : '<tr class="vb-vazio"><td colspan="7"><i class="fa-solid fa-receipt"></i> Nenhuma despesa neste período' + (emp === 'todas' ? '' : '. Use a linha de cima para lançar a primeira.') + '</td></tr>';
    document.getElementById('vbTotal').textContent = brl(total);

    // resumo por categoria + por mês (ano)
    var ano = p.de.slice(0, 4);
    var porMes = new Array(12).fill(0);
    lista().forEach(function (v) {
      if ((emp === 'todas' || v.empresa === emp) && v.data && v.data.slice(0, 4) === ano) porMes[+v.data.slice(5, 7) - 1] += Number(v.valor) || 0;
    });
    var maxMes = Math.max.apply(null, porMes.concat([1]));
    var cats = Object.keys(porCat).sort(function (a, b) { return porCat[b] - porCat[a]; });
    document.getElementById('vbResumo').innerHTML =
      '<div class="card-header"><div class="card-title"><i class="fa-solid fa-chart-column"></i>Resumo</div></div>' +
      '<div class="vb-resumo">' +
        '<div><div class="vb-sub">Por categoria no período</div>' +
          (cats.length ? cats.map(function (c) {
            var pc = total ? Math.round(porCat[c] / total * 100) : 0;
            return '<div class="vb-rc"><span>' + esc(c) + '</span><div class="vb-rc-barra"><i style="width:' + pc + '%"></i></div><b>' + brl(porCat[c]) + '</b><em>' + pc + '%</em></div>';
          }).join('') : '<p class="vb-vazio-txt">Sem despesas no período.</p>') + '</div>' +
        '<div><div class="vb-sub">Mês a mês em ' + ano + '</div><div class="vb-meses">' +
          porMes.map(function (v, i) {
            return '<div class="vb-m' + (ui.mes === ano + '-' + String(i + 1).padStart(2, '0') ? ' on' : '') + '" title="' + MES[i] + ': ' + brl(v) + '" onclick="VB.mes(\'' + ano + '-' + String(i + 1).padStart(2, '0') + '\')">' +
              '<i style="height:' + Math.round(v / maxMes * 100) + '%"></i><span>' + MES[i].slice(0, 3) + '</span></div>';
          }).join('') + '</div>' +
          '<div class="vb-ano-total">Total no ano: <b>' + brl(porMes.reduce(function (s, x) { return s + x; }, 0)) + '</b></div></div>' +
      '</div>';
  }

  // ---------- ações ----------
  function adicionar() {
    var g = function (id) { return document.getElementById('vbN_' + id).value.trim(); };
    var data = g('data'), desc = g('desc'), valor = lerValor(g('valor'));
    if (!data) { showToast('Coloque a data', 'error'); return; }
    if (!desc) { showToast('Descreva a despesa', 'error'); document.getElementById('vbN_desc').focus(); return; }
    if (!valor) { showToast('Coloque o valor', 'error'); document.getElementById('vbN_valor').focus(); return; }
    var item = {
      id: genId(), empresa: ui.empresa === 'todas' ? 'click' : ui.empresa, data: data,
      loja: g('loja').toUpperCase(), descricao: desc.toUpperCase(), os: g('os'), categoria: g('cat'), valor: valor, projeto: '', obs: ''
    };
    firebaseCreate('verba', item);
    ['desc', 'os', 'valor'].forEach(function (k) { document.getElementById('vbN_' + k).value = ''; });
    document.getElementById('vbN_desc').focus();
    showToast('Despesa de ' + brl(valor) + ' lançada', 'success');
    setTimeout(function () {
      render();
      var auto = false; try { auto = localStorage.getItem(LS_IMPRIMIR) === '1'; } catch (e) {}
      if (auto) imprimir();
    }, semFirebase() ? 30 : 400);
  }

  function editar(id) {
    montar();
    var v = lista().find(function (x) { return x.id === id; }); if (!v) return;
    var s = function (k, val) { document.getElementById('vb_' + k).value = val == null ? '' : val; };
    var projs = (typeof DB !== 'undefined' && DB.projects) || [];
    document.getElementById('vb_proj').innerHTML = '<option value="">Nenhuma</option>' + projs.map(function (p) { return '<option value="' + esc(p.id) + '">' + esc(p.name) + '</option>'; }).join('');
    s('id', v.id); s('data', v.data); s('empresa', v.empresa || 'click'); s('os', v.os); s('desc', v.descricao);
    document.getElementById('vb_loja').innerHTML = opcoesLoja(v.empresa || 'click', v.loja);
    s('cat', v.categoria || 'Outros'); s('valor', (Number(v.valor) || 0).toFixed(2).replace('.', ',')); s('proj', v.projeto || ''); s('obs', v.obs);
    openModal('verbaModal');
  }

  function salvar() {
    var g = function (k) { return document.getElementById('vb_' + k).value.trim(); };
    var id = g('id'); var antigo = lista().find(function (x) { return x.id === id; }); if (!antigo) return;
    var valor = lerValor(g('valor'));
    if (!g('data') || !g('desc') || !valor) { showToast('Data, descrição e valor são obrigatórios', 'error'); return; }
    firebaseCreate('verba', Object.assign({}, antigo, {
      data: g('data'), empresa: g('empresa'), loja: g('loja').toUpperCase(), os: g('os'), descricao: g('desc').toUpperCase(),
      categoria: g('cat'), valor: valor, projeto: g('proj'), obs: g('obs')
    }));
    closeModal('verbaModal');
    showToast('Despesa atualizada', 'success');
    setTimeout(render, semFirebase() ? 30 : 400);
  }

  function excluir() {
    var id = document.getElementById('vb_id').value;
    if (!id || !confirm('Excluir esta despesa?')) return;
    firebaseDelete('verba', id);
    closeModal('verbaModal');
    setTimeout(render, 30);
    showToast('Despesa excluída', 'success');
  }

  function definirLimite() {
    var l = limites();
    var c = prompt('Limite MENSAL de verba da Click Impresso (R$). Deixe vazio para sem limite:', l.click ? String(l.click).replace('.', ',') : '');
    if (c === null) return;
    var i = prompt('Limite MENSAL de verba da Impresul (R$). Deixe vazio para sem limite:', l.impresul ? String(l.impresul).replace('.', ',') : '');
    if (i === null) return;
    DB.settings.verbaLimites = { click: lerValor(c), impresul: lerValor(i) };
    if (typeof fbSaveSettings === 'function') fbSaveSettings(); else if (typeof save === 'function') save();
    showToast('Limites salvos', 'success');
    render();
  }

  // ---------- relatório para imprimir ----------
  function htmlRelatorio(empresa) {
    var p = periodo();
    var itens = doPeriodo(empresa);
    var e = EMP[empresa];
    var linhas = itens.map(function (v) {
      return '<tr><td>' + dataBr(v.data) + '</td><td class="loja">' + esc(v.loja || '') + '</td><td>' + esc(v.descricao || '') + '</td><td>' + esc(v.os || '') + '</td><td class="dir">' + brl(v.valor) + '</td></tr>';
    });
    while (linhas.length < 11) linhas.push('<tr><td>&nbsp;</td><td></td><td></td><td></td><td></td></tr>');
    return '<section class="folha">' +
      '<div class="sobre">Verba utilizada para fins de comunicação visual da ' + esc(e.longo) + '</div>' +
      '<h1>' + esc(e.titulo) + '</h1>' +
      '<div class="per">' + dataBr(p.de, true) + ' - ' + dataBr(p.ate, true) + '</div>' +
      '<table><thead><tr><th style="width:9%">Data</th><th style="width:17%">Loja</th><th>Descrição</th><th style="width:16%">Boletim/OS</th><th class="dir" style="width:13%">Valor</th></tr></thead>' +
      '<tbody>' + linhas.join('') + '</tbody></table>' +
      '<div class="total">' + brl(soma(itens)) + '</div>' +
      '<div class="assina"><div><b>Assinatura</b><i></i></div><div><b>Data</b><i></i></div></div>' +
    '</section>';
  }

  function imprimir() {
    var emps = ui.empresa === 'todas' ? ['click', 'impresul'] : [ui.empresa];
    var doc = '<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8"><title>Relatório de despesas</title>' +
      '<link href="https://fonts.googleapis.com/css2?family=Roboto:wght@400;500;700&display=swap" rel="stylesheet">' +
      '<style>' +
      '@page{size:A4;margin:14mm 12mm}' +
      '*{box-sizing:border-box;margin:0;padding:0}' +
      'body{font-family:Roboto,Arial,sans-serif;color:#222;-webkit-print-color-adjust:exact;print-color-adjust:exact}' +
      '.folha{padding:6px 4px;page-break-after:always}.folha:last-child{page-break-after:auto}' +
      '.sobre{color:#7b5cd6;font-size:12px;margin-bottom:26px}' +
      'h1{color:#2b3590;font-size:40px;font-weight:700;letter-spacing:-.5px;line-height:1.1}' +
      '.per{color:#e5157a;font-weight:700;font-size:14px;margin:8px 0 30px}' +
      'table{width:100%;border-collapse:collapse;font-size:12px}' +
      'th{color:#2b3590;font-size:14px;font-weight:700;text-align:left;padding:0 4px 10px}' +
      'td{padding:6px 4px;height:26px;color:#555;text-transform:uppercase}' +
      'tbody tr:nth-child(odd) td{background:#f2f2f2}' +
      'td.loja{font-weight:700;color:#444}' +
      '.dir{text-align:right}' +
      'tbody tr:last-child td{border-bottom:1px solid #aaa}' +
      '.total{text-align:right;color:#e5157a;font-size:26px;font-weight:700;margin-top:10px}' +
      '.assina{display:flex;gap:12%;margin-top:40px}' +
      '.assina div{flex:1}.assina div:last-child{flex:0 0 32%}' +
      '.assina b{display:block;color:#2b3590;font-size:14px;margin-bottom:28px}' +
      '.assina i{display:block;border-bottom:1px solid #aaa}' +
      '</style></head><body>' + emps.map(htmlRelatorio).join('') + '</body></html>';

    var velho = document.getElementById('vbPrintFrame'); if (velho) velho.remove();
    var f = document.createElement('iframe');
    f.id = 'vbPrintFrame';
    f.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden';
    document.body.appendChild(f);
    var d = f.contentWindow.document;
    d.open(); d.write(doc); d.close();
    var foi = false;
    var mandar = function () { if (foi) return; foi = true; try { f.contentWindow.focus(); f.contentWindow.print(); } catch (e) { showToast('Não consegui abrir a impressão', 'error'); } };
    f.onload = function () {
      try { (f.contentDocument.fonts && f.contentDocument.fonts.ready ? f.contentDocument.fonts.ready : Promise.resolve()).then(function () { setTimeout(mandar, 150); }); }
      catch (e) { setTimeout(mandar, 400); }
    };
    setTimeout(mandar, 2500); // garantia se a fonte demorar
  }

  // ---------- exportar / importar ----------
  function csv() {
    var emp = ui.empresa, itens = doPeriodo(emp), p = periodo();
    var q = function (s) { s = String(s == null ? '' : s); return /[;"\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
    var linhas = [['Data', 'Empresa', 'Loja', 'Descrição', 'Boletim/OS', 'Categoria', 'Valor'].join(';')].concat(itens.map(function (v) {
      return [dataBr(v.data, true), (EMP[v.empresa] || {}).longo || '', v.loja, v.descricao, v.os, v.categoria, (Number(v.valor) || 0).toFixed(2).replace('.', ',')].map(q).join(';');
    }));
    var blob = new Blob(['﻿' + linhas.join('\r\n')], { type: 'text/csv;charset=utf-8' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'verba-' + (emp === 'todas' ? 'todas' : emp) + '-' + p.de + '_a_' + p.ate + '.csv';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 2000);
  }

  var importadas = [];
  function previa() {
    var txt = document.getElementById('vbI_txt').value;
    var ano = document.getElementById('vbI_ano').value.trim() || hojeIso().slice(0, 4);
    importadas = [];
    var erros = 0;
    txt.split(/\r?\n/).forEach(function (l) {
      if (!l.trim()) return;
      var c = l.split(/\t|;/).map(function (s) { return s.trim(); });
      if (/^data$/i.test(c[0])) return; // cabeçalho
      var data = lerData(c[0], ano), valor = lerValor(c[c.length - 1]);
      if (!data || !valor) { erros++; return; }
      importadas.push({ data: data, loja: (c[1] || '').toUpperCase(), descricao: (c[2] || '').toUpperCase(), os: c.length >= 5 ? c[3] : '', valor: valor });
    });
    var el = document.getElementById('vbI_previa');
    el.innerHTML = importadas.length || erros
      ? '<b>' + importadas.length + '</b> despesa(s) prontas · total ' + brl(soma(importadas)) + (erros ? ' · <span class="vb-err">' + erros + ' linha(s) ignoradas (sem data ou valor)</span>' : '') +
        (importadas.length ? '<table class="vb-tabela mini"><tbody>' + importadas.slice(0, 6).map(function (v) {
          return '<tr><td>' + dataBr(v.data, true) + '</td><td>' + esc(v.loja) + '</td><td>' + esc(v.descricao) + '</td><td>' + esc(v.os) + '</td><td class="dir">' + brl(v.valor) + '</td></tr>';
        }).join('') + (importadas.length > 6 ? '<tr><td colspan="5">… e mais ' + (importadas.length - 6) + '</td></tr>' : '') + '</tbody></table>' : '')
      : '';
    document.getElementById('vbI_ok').disabled = !importadas.length;
  }
  function confirmarImport() {
    var emp = document.getElementById('vbI_emp').value;
    importadas.forEach(function (v, i) {
      firebaseCreate('verba', Object.assign({ id: genId() + i, empresa: emp, categoria: 'Comunicação visual', projeto: '', obs: 'importado da planilha' }, v));
    });
    showToast(importadas.length + ' despesa(s) importadas', 'success');
    closeModal('verbaImportModal');
    if (importadas.length) { ui.empresa = emp; ui.mes = importadas[importadas.length - 1].data.slice(0, 7); }
    importadas = [];
    setTimeout(render, semFirebase() ? 30 : 600);
  }

  function linhasLojas(id) {
    var vistas = {};
    return document.getElementById(id).value.split(/\r?\n/).map(function (s) { return s.trim().toUpperCase(); })
      .filter(function (s) { if (!s || vistas[s]) return false; vistas[s] = 1; return true; });
  }
  function contarLojas(k) {
    var n = linhasLojas('vbL_' + k).length;
    document.getElementById('vbL_n' + k).textContent = n ? n + ' loja(s)' : '';
  }

  window.VB = {
    lojas: function () {
      montar();
      document.getElementById('vbL_click').value = lojasDe('click').join('\n');
      document.getElementById('vbL_impresul').value = lojasDe('impresul').join('\n');
      contarLojas('click'); contarLojas('impresul');
      openModal('verbaLojasModal');
    },
    salvarLojas: function () {
      gravarLojas({ click: linhasLojas('vbL_click'), impresul: linhasLojas('vbL_impresul') });
      closeModal('verbaLojasModal');
      showToast('Lojas salvas', 'success');
      render();
    },
    lojaEscolhida: function (sel, emp) { lojaEscolhida(sel, emp || (ui.empresa === 'todas' ? 'click' : ui.empresa)); },
    // botão "+" ao lado do campo Loja
    novaLoja: function (selId, emp) {
      var sel = document.getElementById(selId); if (!sel) return;
      var antes = sel.value;
      sel.value = '__nova';
      lojaEscolhida(sel, emp || (ui.empresa === 'todas' ? 'click' : ui.empresa));
      if (!sel.value && antes && antes !== '__nova') sel.value = antes; // cancelou: volta a loja que estava
    },
    _opcoesLoja: opcoesLoja,
    render: render, adicionar: adicionar, editar: editar, salvar: salvar, excluir: excluir, imprimir: imprimir, csv: csv,
    limite: definirLimite, previa: previa, confirmarImport: confirmarImport,
    importar: function () {
      montar();
      document.getElementById('vbI_emp').value = ui.empresa === 'todas' ? 'click' : ui.empresa;
      document.getElementById('vbI_ano').value = periodo().de.slice(0, 4);
      document.getElementById('vbI_txt').value = ''; previa();
      openModal('verbaImportModal');
      setTimeout(function () { document.getElementById('vbI_txt').focus(); }, 60);
    },
    empresa: function (e) { ui.empresa = e; render(); },
    mes: function (m) { ui.mes = m; if (m === 'custom' && !ui.de) { var p = new Date(); ui.de = p.getFullYear() + '-01-01'; ui.ate = hojeIso(); } render(); },
    custom: function () { ui.de = document.getElementById('vbDe').value; ui.ate = document.getElementById('vbAte').value; render(); },
    buscar: function (t) { ui.busca = t; clearTimeout(ui._t); ui._t = setTimeout(render, 150); },
    categoria: function (c) { ui.cat = c; render(); },
    autoPrint: function (on) { try { localStorage.setItem(LS_IMPRIMIR, on ? '1' : '0'); } catch (e) {} },
    _periodo: periodo, _relatorio: htmlRelatorio
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', montar);
  else montar();
})();
