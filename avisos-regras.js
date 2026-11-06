/* ============================================================
   REGRAS DOS AVISOS — usadas em DOIS lugares:
     • no sistema (avisos.js → sino "Para você hoje" e notificações)
     • no e-mail diário (api/avisos-diarios.js, na Vercel)
   Assim o e-mail e o sino sempre mostram a mesma coisa.

   montar(dados, pessoa, hojeIso) devolve, para UMA pessoa:
     { atrasadas:[], hoje:[], amanha:[], semana:[], atencao:[], total }
   dados  = { tasks, captacoes, approvals, pautas, projects, cobrancas }
   pessoa = { nome, email }   (o nome é comparado com "responsável")
============================================================ */
(function (raiz) {
  var EQUIPE = [
    { name: 'Mariana', email: 'mariana@impresul.com.br' },
    { name: 'Laura',   email: 'laura@impresul.com.br' },
    { name: 'Felix',   email: 'matheus.felix@impresul.com.br' },
    { name: 'Victor',  email: 'victor@impresul.com.br' },
    { name: 'Andréia', email: 'andreia@impresul.com.br' }
  ];
  var DIA = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];

  function norm(s) { return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim(); }
  function somaDias(iso, n) { var d = new Date(iso + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); }
  function diaSemana(iso) { return new Date(iso + 'T12:00:00Z').getUTCDay(); }
  function dataBr(iso) { if (!iso) return ''; var p = iso.split('-'); return p[2] + '/' + p[1]; }
  function diasAte(de, ate) { return Math.round((new Date(ate + 'T12:00:00Z') - new Date(de + 'T12:00:00Z')) / 86400000); }

  // nomes que identificam a pessoa ("Mariana", "mariana silva", e-mail...)
  function nomesDe(pessoa, equipe) {
    var out = [];
    if (pessoa.nome) { out.push(norm(pessoa.nome)); out.push(norm(pessoa.nome).split(/\s+/)[0]); }
    (equipe || EQUIPE).forEach(function (t) { if (pessoa.email && norm(t.email) === norm(pessoa.email)) out.push(norm(t.name)); });
    if (pessoa.email) out.push(norm(pessoa.email));
    return out.filter(function (n, i, a) { return n && a.indexOf(n) === i; });
  }
  function ehDela(valor, nomes) {
    if (!valor) return false;
    var partes = Array.isArray(valor) ? valor : String(valor).split(/\s*(?:,|;|\/|&|\s+e\s+)\s*/);
    return partes.some(function (p) {
      var n = norm(p); if (!n) return false;
      return nomes.some(function (m) { return n === m || n.split(/\s+/)[0] === m; });
    });
  }
  function pautaHoje(p, iso) {
    var dow = diaSemana(iso);
    if (p.frequency === 'daily') return true;
    if (p.frequency === 'weekly') return (p.days || []).indexOf(dow) !== -1;
    if (p.frequency === 'monthly') return iso.slice(8, 10) === '01';
    return (p.days || []).indexOf(dow) !== -1;
  }

  function montar(dados, pessoa, hojeIso, equipe) {
    dados = dados || {};
    var nomes = nomesDe(pessoa || {}, equipe);
    var amanha = somaDias(hojeIso, 1), em7 = somaDias(hojeIso, 7);
    var r = { atrasadas: [], hoje: [], amanha: [], semana: [], atencao: [] };
    var segunda = diaSemana(hojeIso) === 1;
    var add = function (grupo, it) { r[grupo].push(it); };

    // TAREFAS (a tarefa criada automaticamente para uma pauta fica de fora: a pauta já aparece)
    var idsPautas = {};
    (dados.pautas || []).forEach(function (p) { idsPautas[p.id] = true; });
    (dados.tasks || []).forEach(function (t) {
      if (t.status === 'done' || !ehDela(t.assignee, nomes) || !t.date) return;
      if (t.pautaId && idsPautas[t.pautaId]) return;
      var it = { tipo: 'tarefa', id: t.id, icone: '📝', titulo: t.title, data: t.date, hora: t.time || '', detalhe: t.priority === 'urgent' ? 'urgente' : t.priority === 'high' ? 'prioridade alta' : '' };
      if (t.date < hojeIso) { it.detalhe = 'venceu em ' + dataBr(t.date); add('atrasadas', it); }
      else if (t.date === hojeIso) add('hoje', it);
      else if (t.date === amanha) add('amanha', it);
      else if (segunda && t.date <= em7) add('semana', it);
    });

    // CAPTAÇÕES (quem grava ou quem participa)
    (dados.captacoes || []).forEach(function (c) {
      if (c.status !== 'a_confirmar' && c.status !== 'confirmada' && c.status) return;
      if (!ehDela(c.responsavel, nomes) && !ehDela(c.participantes, nomes)) return;
      if (!c.data) return;
      var eq = String(c.equipamentos || '').split('\n').map(function (s) { return s.trim(); }).filter(Boolean);
      var it = { tipo: 'captacao', id: c.id, icone: '🎬', titulo: c.titulo, data: c.data, hora: c.hora || '',
        detalhe: [c.local, c.status === 'a_confirmar' ? 'ainda não confirmada' : ''].filter(Boolean).join(' · '),
        lista: eq };
      if (c.data === hojeIso) add('hoje', it);
      else if (c.data === amanha) add('amanha', it);
      else if (c.data > amanha && segunda && c.data <= em7) add('semana', it);
      if (c.status === 'a_confirmar' && c.data > hojeIso && diasAte(hojeIso, c.data) <= 3) {
        add('atencao', { tipo: 'captacao', id: c.id, icone: '⏳', titulo: 'Confirmar captação: ' + c.titulo, data: c.data, detalhe: 'é em ' + diasAte(hojeIso, c.data) + ' dia(s) e ainda está "a confirmar"' });
      }
    });

    // PAUTAS / ROTINAS DO DIA
    // (concluída = marcada como feita, ou a tarefa ligada a ela já foi concluída)
    var tarefaDaPauta = {};
    (dados.tasks || []).forEach(function (t) { if (t.pautaId) tarefaDaPauta[t.pautaId] = t; });
    (dados.pautas || []).forEach(function (p) {
      if (!ehDela(p.assignee, nomes) || !pautaHoje(p, hojeIso)) return;
      var tp = tarefaDaPauta[p.id];
      if (p.status === 'done' || p.status === 'not_done' || (tp && tp.status === 'done')) return;
      add('hoje', { tipo: 'pauta', id: p.id, icone: '🔁', titulo: p.name, data: hojeIso, hora: p.time || '', detalhe: 'rotina' });
    });

    // APROVAÇÕES
    (dados.approvals || []).forEach(function (a) {
      if (!ehDela(a.assignee, nomes)) return;
      if (a.status === 'revision') add('atencao', { tipo: 'aprovacao', id: a.id, icone: '✏️', titulo: 'Ajustes pedidos: ' + (a.title || 'peça'), detalhe: 'o cliente pediu ajustes' });
      else if (a.status === 'pending' && a.__createdAt) {
        var dias = Math.floor((new Date(hojeIso + 'T12:00:00Z') - a.__createdAt) / 86400000);
        if (dias >= 3) add('atencao', { tipo: 'aprovacao', id: a.id, icone: '📨', titulo: 'Sem retorno há ' + dias + ' dias: ' + (a.title || 'peça'), detalhe: 'vale cobrar o aprovador' });
      }
    });

    // CAMPANHAS
    (dados.projects || []).forEach(function (p) {
      if (p.status === 'done' || !ehDela(p.assignee, nomes)) return;
      if (p.inicio === hojeIso) add('hoje', { tipo: 'campanha', id: p.id, icone: '🚀', titulo: 'Campanha começa hoje: ' + p.name, data: hojeIso });
      if (p.deadline && p.deadline >= hojeIso && diasAte(hojeIso, p.deadline) <= 3) {
        var d = diasAte(hojeIso, p.deadline);
        add('atencao', { tipo: 'campanha', id: p.id, icone: '🏁', titulo: 'Campanha ' + (d === 0 ? 'termina hoje' : 'termina em ' + d + ' dia(s)') + ': ' + p.name, data: p.deadline });
      }
      if (p.deadline && p.deadline < hojeIso) add('atencao', { tipo: 'campanha', id: p.id, icone: '📌', titulo: 'Campanha passou do fim e não foi encerrada: ' + p.name, data: p.deadline, detalhe: 'encerre e registre o resultado' });
    });

    // OUTROS SETORES (cobranças)
    (dados.cobrancas || []).forEach(function (c) {
      if ((c.status !== 'pending' && c.status !== 'overdue') || !ehDela(c.responsible, nomes)) return;
      if (c.status === 'overdue' || (c.deadlineDate && c.deadlineDate < hojeIso)) add('atrasadas', { tipo: 'setor', id: c.id, icone: '🔔', titulo: c.name, data: c.deadlineDate || '', detalhe: 'cobrança atrasada' });
      else if (c.deadlineDate === hojeIso) add('hoje', { tipo: 'setor', id: c.id, icone: '🔔', titulo: c.name, data: hojeIso, hora: c.deadlineTime || '', detalhe: 'cobrança' });
    });

    var porHora = function (a, b) { return (a.data || '').localeCompare(b.data || '') || (a.hora || '99').localeCompare(b.hora || '99'); };
    Object.keys(r).forEach(function (k) { r[k].sort(porHora); });
    r.total = r.atrasadas.length + r.hoje.length + r.amanha.length + r.atencao.length;
    r.segunda = segunda;
    return r;
  }

  // data de hoje no horário de Brasília (o servidor da Vercel roda em UTC)
  function hojeBrasil(agora) {
    var p = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(agora || new Date());
    return p; // "2026-11-06"
  }

  var API = { montar: montar, ehDela: ehDela, nomesDe: nomesDe, hojeBrasil: hojeBrasil, somaDias: somaDias, dataBr: dataBr, EQUIPE: EQUIPE, DIA: DIA };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  else raiz.AvisosRegras = API;
})(typeof window !== 'undefined' ? window : this);
