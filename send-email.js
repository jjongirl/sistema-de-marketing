// api/send-email.js
// Vercel Serverless Function — envia e-mails reais via SMTP (Gmail, Outlook, etc.)
// Variáveis de ambiente obrigatórias no painel Vercel:
//   SMTP_HOST      ex: smtp.gmail.com
//   SMTP_PORT      ex: 465  (SSL) ou 587 (TLS)
//   SMTP_SECURE    ex: true  (porta 465) ou false (porta 587)
//   SMTP_USER      ex: marketing@impresul.com.br
//   SMTP_PASS      ex: sua_senha_de_app (Google App Password)
//   SMTP_FROM_NAME ex: Grupo Impresul — Marketing

const nodemailer = require('nodemailer');

// CORS helper — permite o front-end chamar esta API
function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

module.exports = async function handler(req, res) {
  setCors(res);

  // Preflight CORS
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido. Use POST.' });
  }

  // ── 1. Valida payload ────────────────────────────────────────
  const { to, subject, html, from } = req.body || {};

  if (!to || !subject || !html) {
    return res.status(400).json({
      success: false,
      error: 'Campos obrigatórios ausentes: to, subject, html'
    });
  }

  // ── 2. Valida variáveis de ambiente ──────────────────────────
  const {
    SMTP_HOST,
    SMTP_PORT,
    SMTP_SECURE,
    SMTP_USER,
    SMTP_PASS,
    SMTP_FROM_NAME = 'Grupo Impresul — Marketing'
  } = process.env;

  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) {
    console.error('[send-email] Variáveis SMTP não configuradas no Vercel');
    return res.status(500).json({
      success: false,
      error: 'Servidor de e-mail não configurado. Configure SMTP_HOST, SMTP_USER e SMTP_PASS no painel Vercel.'
    });
  }

  // ── 3. Cria transporter ─────────────────────────────────────
  const transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: parseInt(SMTP_PORT || '465'),
    secure: SMTP_SECURE === 'true' || SMTP_PORT === '465',
    auth: {
      user: SMTP_USER,
      pass: SMTP_PASS,
    },
    // TLS options — necessário para alguns provedores
    tls: {
      rejectUnauthorized: false
    }
  });

  // ── 4. Monta e-mail ─────────────────────────────────────────
  const fromAddress = from || `"${SMTP_FROM_NAME}" <${SMTP_USER}>`;

  const mailOptions = {
    from: fromAddress,
    to: Array.isArray(to) ? to.join(', ') : to,
    subject,
    html,
    // Texto simples de fallback
    text: html.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim()
  };

// ── 5. Envia ─────────────────────────────────────────────────
  try {
    // A Vercel é forçada a esperar o Gmail responder por causa dessa Promise
    const info = await new Promise((resolve, reject) => {
      transporter.sendMail(mailOptions, (err, info) => {
        if (err) {
          console.error('[send-email] ❌ Erro ao enviar:', err);
          reject(err);
        } else {
          console.log(`[send-email] ✅ Enviado para ${to} — MessageId: ${info.messageId}`);
          resolve(info);
        }
      });
    });

    return res.status(200).json({
      success: true,
      messageId: info.messageId,
      to,
      subject,
      sentAt: new Date().toISOString()
    });
  } catch (err) {
    console.error('[send-email] ❌ Erro capturado no Catch:', err.message);
    return res.status(500).json({
      success: false,
      error: err.message,
      code: err.code || 'UNKNOWN'
    });
  }
};
