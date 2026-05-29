# 🚀 Grupo Impresul — OpsHub: Guia de Implantação

## Visão Geral

Este sistema usa:
- **Frontend:** `index.html` (HTML/CSS/JS puro, sem frameworks)
- **Backend:** Vercel Serverless Functions (`api/send-email.js`)
- **Banco de dados em tempo real:** Google Firebase Firestore
- **E-mail:** Nodemailer via SMTP (Gmail, Outlook, etc.)

---

## PASSO 1 — Criar projeto no Firebase

1. Acesse [https://console.firebase.google.com](https://console.firebase.google.com)
2. Clique em **"Adicionar projeto"** → nomeie como `grupo-impresul-ops`
3. Desative o Google Analytics (opcional) → clique em **"Criar projeto"**
4. No menu lateral, clique em **"Firestore Database"**
5. Clique em **"Criar banco de dados"**
6. Selecione **"Iniciar no modo de teste"** → escolha a região `us-east1` ou `southamerica-east1` → **"Ativar"**
7. No menu lateral, clique em **"Configurações do projeto"** (ícone ⚙️)
8. Desça até **"Seus aplicativos"** → clique em **"</>  Web"**
9. Registre o app com o nome `impresul-ops` → **"Registrar app"**
10. **Copie** o objeto `firebaseConfig` que aparecer. Exemplo:

```javascript
const firebaseConfig = {
  apiKey: "AIzaSy...",
  authDomain: "grupo-impresul-ops.firebaseapp.com",
  projectId: "grupo-impresul-ops",
  storageBucket: "grupo-impresul-ops.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abc123"
};
```

11. Abra o arquivo `index.html`, localize o bloco `FIREBASE_CONFIG` (linha ~1930) e substitua os valores:

```javascript
const FIREBASE_CONFIG = {
  apiKey:            "AIzaSy...",         // ← cole aqui
  authDomain:        "grupo-impresul-ops.firebaseapp.com",
  projectId:         "grupo-impresul-ops",
  storageBucket:     "grupo-impresul-ops.appspot.com",
  messagingSenderId: "123456789",
  appId:             "1:123456789:web:abc123"
};
```

---

## PASSO 2 — Configurar regras do Firestore

1. No Firebase Console → **Firestore** → aba **"Regras"**
2. Substitua as regras pelo conteúdo do arquivo `firestore.rules`:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /teams/impresul {
      allow read, write: if true;
      match /{collection}/{docId} {
        allow read, write: if true;
      }
    }
    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```

3. Clique em **"Publicar"**

---

## PASSO 3 — Criar conta Vercel e fazer deploy

### 3a. Instalar Vercel CLI (no seu computador)

```bash
npm install -g vercel
```

### 3b. Estrutura de arquivos necessária

```
grupo-impresul-ops/
├── index.html          ← arquivo principal do sistema
├── package.json        ← dependências (nodemailer)
├── vercel.json         ← configuração do Vercel
├── firestore.rules     ← regras do Firestore
├── firestore.indexes.json
└── api/
    └── send-email.js   ← API de envio de e-mails
```

### 3c. Fazer o deploy

```bash
# Na pasta do projeto:
cd grupo-impresul-ops
vercel login          # faz login na sua conta Vercel
vercel                # deploy de desenvolvimento
vercel --prod         # deploy em produção
```

O Vercel vai gerar uma URL como: `https://grupo-impresul-ops.vercel.app`

---

## PASSO 4 — Configurar variáveis de ambiente no Vercel

No [painel Vercel](https://vercel.com/dashboard) → seu projeto → **Settings → Environment Variables**

Adicione cada uma dessas variáveis:

| Nome da variável    | Valor de exemplo                        | Obrigatório |
|---------------------|-----------------------------------------|-------------|
| `SMTP_HOST`         | `smtp.gmail.com`                        | ✅ Sim       |
| `SMTP_PORT`         | `465`                                   | ✅ Sim       |
| `SMTP_SECURE`       | `true`                                  | ✅ Sim       |
| `SMTP_USER`         | `marketing@impresul.com.br`             | ✅ Sim       |
| `SMTP_PASS`         | `sua_senha_de_app_google`               | ✅ Sim       |
| `SMTP_FROM_NAME`    | `Grupo Impresul — Marketing`            | Opcional     |

### ⚠️ Como gerar senha de app do Gmail

1. Acesse [https://myaccount.google.com/security](https://myaccount.google.com/security)
2. Ative a **Verificação em duas etapas** (obrigatório)
3. Pesquise **"Senhas de app"** nas configurações
4. Crie uma senha para **"Outro (nome personalizado)"** → escreva "Vercel Impresul"
5. Copie a senha de 16 caracteres gerada → use como `SMTP_PASS`

### Para Outlook/Office 365

```
SMTP_HOST = smtp.office365.com
SMTP_PORT = 587
SMTP_SECURE = false
```

### Para Zoho Mail

```
SMTP_HOST = smtp.zoho.com
SMTP_PORT = 465
SMTP_SECURE = true
```

---

## PASSO 5 — Refazer deploy após variáveis

```bash
vercel --prod
```

Ou pelo painel Vercel: **Deployments → Redeploy**

---

## PASSO 6 — Testar

1. Acesse a URL do Vercel
2. Vá em **"Outros Setores & Cobrança Imediata"**
3. Crie uma cobrança com um e-mail real
4. Clique em **"Enviar Lembrete"**
5. Verifique a caixa de entrada do destinatário ✅

---

## Uso Simultâneo por Múltiplas Pessoas

O sistema é **100% multi-usuário em tempo real** via Firebase Firestore:

- Qualquer pessoa com o link do Vercel pode acessar
- Mudanças feitas por uma pessoa aparecem **imediatamente** para todas as outras
- Não é necessário login (mas pode ser adicionado via Firebase Auth futuramente)
- O banco de dados é compartilhado sob o workspace `teams/impresul`

---

## Compartilhar com a equipe

Basta enviar o link gerado pelo Vercel, por exemplo:
```
https://grupo-impresul-ops.vercel.app
```

Todos acessam o mesmo sistema, em tempo real, sem instalar nada.

---

## Domínio personalizado (opcional)

No Vercel → **Settings → Domains** → adicione seu domínio:
```
ops.impresul.com.br
```

---

## Resumo de arquivos

| Arquivo                  | Finalidade                                  |
|--------------------------|---------------------------------------------|
| `index.html`             | Sistema completo (UI + lógica Firebase)     |
| `api/send-email.js`      | API de e-mail real (Nodemailer/SMTP)        |
| `package.json`           | Dependência: nodemailer                     |
| `vercel.json`            | Configuração de deploy Vercel               |
| `firestore.rules`        | Permissões do Firestore                     |
| `firestore.indexes.json` | Índices das consultas Firestore             |
| `SETUP.md`               | Este guia                                   |

---

## Suporte

Em caso de dúvidas sobre configuração, verifique:
- [Documentação Firebase](https://firebase.google.com/docs/firestore)
- [Documentação Vercel](https://vercel.com/docs)
- [Nodemailer](https://nodemailer.com/about/)
