// api/avisos-diarios.js
// ------------------------------------------------------------------
// E-mail diário de avisos para cada pessoa da equipe.
//
// Quem chama:
//   1) A própria Vercel, todo dia às 7h (Brasília) — ver vercel.json.
//      A Vercel manda "Authorization: Bearer <CRON_SECRET>".
//   2) O botão "Me mandar o e-mail de hoje agora" (Meu Perfil → Avisos),
//      com o token de login do Firebase → manda só para quem clicou.
//
// Variáveis de ambiente na Vercel (Settings → Environment Variables):
//   FIREBASE_SERVICE_ACCOUNT  JSON da conta de serviço do Firebase
//                             (pode colar o JSON inteiro, ou em base64)
//   CRON_SECRET               qualquer senha longa (a Vercel usa sozinha)
//   SMTP_HOST, SMTP_PORT, SMTP_SECURE, SMTP_USER, SMTP_PASS, SMTP_FROM_NAME
//                             (as mesmas que o send-email.js já usa)
//   APP_URL                   opcional — endereço do sistema para o botão do e-mail
//   AVISOS_FIM_DE_SEMANA      opcional — "1" para mandar também sábado e domingo
//   AVISOS_EQUIPE             opcional — JSON [{ "name": "...", "email": "..." }]
//                             (se não tiver, usa a equipe de avisos-regras.js)
// ------------------------------------------------------------------
const nodemailer = require('nodemailer');
const admin = require('firebase-admin');
const Regras = require('../avisos-regras.js');

const TEAM_ID = 'impresul';
const COLECOES = ['tasks', 'captacoes', 'approvals', 'pautas', 'projects', 'cobrancas'];

function iniciarFirebase() {
  if (admin.apps.length) return admin.app();
  let bruto = process.env.FIREBASE_SERVICE_ACCOUNT || '';
  if (!bruto) throw new Error('FIREBASE_SERVICE_ACCOUNT não configurada na Vercel');
  if (!bruto.trim().startsWith('{')) bruto = Buffer.from(bruto, 'base64').toString('utf8');
  const conta = JSON.parse(bruto);
  if (conta.private_key) conta.private_key = conta.private_key.replace(/\\n/g, '\n');
  return admin.initializeApp({ credential: admin.credential.cert(conta) });
}

function transportador() {
  const { SMTP_HOST, SMTP_PORT, SMTP_SECURE, SMTP_USER, SMTP_PASS } = process.env;
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) throw new Error('Variáveis SMTP não configuradas na Vercel');
  return nodemailer.createTransport({
    host: SMTP_HOST, port: parseInt(SMTP_PORT || '465', 10),
    secure: SMTP_SECURE === 'true' || SMTP_PORT === '465',
    auth: { user: SMTP_USER, pass: SMTP_PASS }, tls: { rejectUnauthorized: false }
  });
}

async function lerDados(db) {
  const base = db.collection('teams').doc(TEAM_ID);
  const dados = {};
  await Promise.all(COLECOES.map(async (c) => {
    const snap = await base.collection(c).get();
    dados[c] = snap.docs.map((d) => Object.assign({ id: d.id }, d.data()));
  }));
  const team = await base.get();
  const settings = (team.exists && team.data().settings) || {};
  return { dados, settings };
}

// ---------- e-mail ----------
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const DIAS = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado'];
const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

function linhaItem(it, mostrarData) {
  const quando = [mostrarData && it.data ? Regras.dataBr(it.data) : '', it.hora].filter(Boolean).join(' · ');
  const lista = it.lista && it.lista.length
    ? `<div style="font-size:12px;color:#6b7280;margin-top:4px">Levar: ${it.lista.map(esc).join(', ')}</div>` : '';
  return `<tr><td style="padding:10px 0;border-bottom:1px solid #eef0f5;vertical-align:top;width:28px;font-size:16px">${it.icone || '•'}</td>
    <td style="padding:10px 0;border-bottom:1px solid #eef0f5">
      <div style="font-size:14px;font-weight:600;color:#14205a">${esc(it.titulo)}</div>
      ${(quando || it.detalhe) ? `<div style="font-size:12px;color:#6b7280;margin-top:2px">${esc([quando, it.detalhe].filter(Boolean).join(' · '))}</div>` : ''}
      ${lista}</td></tr>`;
}
function secao(titulo, cor, itens, mostrarData) {
  if (!itens || !itens.length) return '';
  return `<h3 style="margin:24px 0 6px;font-size:12px;letter-spacing:.1em;text-transform:uppercase;color:${cor}">${titulo} (${itens.length})</h3>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse">${itens.map((i) => linhaItem(i, mostrarData)).join('')}</table>`;
}

function montarEmail(pessoa, r, hojeIso, appUrl) {
  const d = new Date(hojeIso + 'T12:00:00Z');
  const dataTxt = `${DIAS[d.getUTCDay()]}, ${d.getUTCDate()} de ${MESES[d.getUTCMonth()]}`;
  const primeiro = String(pessoa.name || pessoa.nome || '').split(' ')[0];
  const resumo = [
    r.atrasadas.length ? `${r.atrasadas.length} atrasada(s)` : '',
    r.hoje.length ? `${r.hoje.length} para hoje` : '',
    r.atencao.length ? `${r.atencao.length} ponto(s) de atenção` : ''
  ].filter(Boolean).join(' · ') || 'nada pendente hoje';
  const assunto = `☀️ Sua pauta de ${DIAS[d.getUTCDay()].split('-')[0]}: ${resumo}`;
  const html = `<!DOCTYPE html><html><body style="margin:0;background:#eceae3;font-family:Arial,Helvetica,sans-serif">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td align="center" style="padding:24px 12px">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;background:#ffffff;border-radius:16px;overflow:hidden">
    <tr><td style="background:linear-gradient(135deg,#24359a,#121c5c);background-color:#1c2c86;padding:28px 30px;color:#ffffff">
      <div style="font-size:12px;letter-spacing:.14em;text-transform:uppercase;opacity:.8">Grupo Impresul · Marketing</div>
      <div style="font-size:28px;font-weight:800;margin-top:8px">Bom dia${primeiro ? ', ' + esc(primeiro) : ''}.</div>
      <div style="font-size:14px;opacity:.85;margin-top:6px">${esc(dataTxt)} · ${esc(resumo)}</div>
    </td></tr>
    <tr><td style="padding:6px 30px 26px">
      ${r.total || (r.semana && r.semana.length) ? '' : '<p style="font-size:14px;color:#4a5578;margin:22px 0 0">Nada com o seu nome para hoje. Bom trabalho! 🎉</p>'}
      ${secao('Atrasadas', '#c81e1e', r.atrasadas, false)}
      ${secao('Hoje', '#1c2c86', r.hoje, false)}
      ${secao('Atenção', '#c2410c', r.atencao, true)}
      ${secao('Amanhã', '#646b88', r.amanha, false)}
      ${r.segunda ? secao('Resto da semana', '#7e22ce', r.semana, true) : ''}
      ${appUrl ? `<div style="margin-top:26px"><a href="${esc(appUrl)}" style="display:inline-block;background:#1c2c86;color:#ffffff;text-decoration:none;font-weight:700;font-size:14px;padding:12px 22px;border-radius:10px">Abrir o sistema</a></div>` : ''}
    </td></tr>
    <tr><td style="padding:14px 30px;background:#f6f5f0;font-size:11px;color:#8a90a8">
      Você recebe este e-mail porque tem itens com o seu nome no sistema de marketing.
      Para parar de receber: Meu Perfil → Avisos → desligue "E-mail todo dia de manhã".
    </td></tr>
  </table></td></tr></table></body></html>`;
  return { assunto, html };
}

// ---------- handler ----------
module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const auth = String(req.headers.authorization || '');
  const token = auth.replace(/^Bearer\s+/i, '');
  const ehCron = !!process.env.CRON_SECRET && token === process.env.CRON_SECRET;
  const teste = !ehCron && /(^|[?&])teste=1/.test(req.url || '');

  try {
    iniciarFirebase();
    let soEmail = null;
    if (!ehCron) {
      if (!teste || !token) return res.status(401).json({ ok: false, erro: 'não autorizado' });
      let dec;
      try { dec = await admin.auth().verifyIdToken(token); }       // só quem está logado no sistema
      catch (e) { return res.status(401).json({ ok: false, erro: 'login expirado — saia e entre de novo no sistema' }); }
      soEmail = String(dec.email || '').toLowerCase();
      if (!soEmail) return res.status(401).json({ ok: false, erro: 'conta sem e-mail' });
    }

    const hojeIso = Regras.hojeBrasil();
    const dow = new Date(hojeIso + 'T12:00:00Z').getUTCDay();
    if (ehCron && (dow === 0 || dow === 6) && process.env.AVISOS_FIM_DE_SEMANA !== '1') {
      return res.status(200).json({ ok: true, pulado: 'fim de semana' });
    }

    const { dados, settings } = await lerDados(admin.firestore());
    const desligados = (settings.avisosEmailDesligados || []).map((e) => String(e).toLowerCase());
    let equipe = Regras.EQUIPE;
    try { if (process.env.AVISOS_EQUIPE) equipe = JSON.parse(process.env.AVISOS_EQUIPE); } catch (e) { /* usa a padrão */ }

    let alvos = equipe;
    if (soEmail) {
      alvos = equipe.filter((p) => String(p.email).toLowerCase() === soEmail);
      if (!alvos.length) alvos = [{ name: '', email: soEmail }];
    } else {
      alvos = equipe.filter((p) => desligados.indexOf(String(p.email).toLowerCase()) === -1);
    }

    const appUrl = process.env.APP_URL || (req.headers.host ? `https://${req.headers.host}` : '');
    const tr = transportador();
    const from = `"${process.env.SMTP_FROM_NAME || 'Grupo Impresul — Marketing'}" <${process.env.SMTP_USER}>`;
    const enviados = [], pulados = [];

    for (const p of alvos) {
      const r = Regras.montar(dados, { nome: p.name, email: p.email }, hojeIso, equipe);
      const temAlgo = r.total > 0 || (r.segunda && r.semana.length > 0);
      if (!temAlgo && !soEmail) { pulados.push(p.email); continue; }   // não manda e-mail vazio
      const { assunto, html } = montarEmail(p, r, hojeIso, appUrl);
      await tr.sendMail({ from, to: p.email, subject: assunto, html, text: html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim() });
      enviados.push(p.email);
    }

    console.log('[avisos-diarios]', hojeIso, 'enviados:', enviados, 'sem itens:', pulados);
    return res.status(200).json({ ok: true, data: hojeIso, enviados, semItens: pulados, para: soEmail || undefined });
  } catch (err) {
    console.error('[avisos-diarios] erro:', err);
    return res.status(500).json({ ok: false, erro: err.message });
  }
};

// exportado para teste local
module.exports.montarEmail = montarEmail;
