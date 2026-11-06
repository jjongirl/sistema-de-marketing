# Atualização do sistema de marketing

Estes são **todos** os arquivos que mudaram ou foram criados (24 no total).
Os outros arquivos do repositório (`aprovacao.html`, `pautas.json`, `firestore.rules`,
`LOGO-IMPRESUL.svg`, `api/send-email.js`, `SETUP.md` etc.) **não mudaram** — não precisa mexer neles.

## Como subir no GitHub

**Pelo site do GitHub (mais fácil):**
1. Abra o repositório → botão **Add file → Upload files**
2. Arraste **todo o conteúdo desta pasta** (os arquivos e a pasta `api`) — não a pasta em si
3. Quando perguntar, confirme que é para **substituir** `index.html` e `package.json`
4. Escreva uma mensagem (ex.: "Novo visual, perfil, captação, verba, campanhas, biblioteca e avisos") → **Commit changes**

> A pasta `api` precisa ficar como `api/avisos-diarios.js` no repositório, ao lado do `api/send-email.js` que já existe.

**Pelo GitHub Desktop:** copie o conteúdo desta pasta por cima da pasta do repositório no seu computador (substituindo quando perguntar), confira as mudanças e faça **Commit** + **Push**.

Se a Vercel estiver ligada ao GitHub, ela publica sozinha depois do commit.

## O que é cada arquivo

| Arquivo | Para que serve |
|---|---|
| `index.html` | **alterado** — carrega os arquivos novos, menu novo (Meu Perfil, Captação, Verba, Campanhas, Biblioteca, Gerador de Prompts), Projetos → Campanhas, sem Reels Studio e Transcritor no menu |
| `package.json` | **alterado** — ganhou o `firebase-admin` (usado pelo e-mail diário) |
| `tema-visual.css` / `.js` | Painel 🎨 Aparência: estilos, cores, layouts, cantos, legibilidade |
| `perfil.css` / `.js` | Aba Meu Perfil: pauta, o que eu fiz, foto, botão de avisos |
| `caderno.css` / `.js` | Meu caderno (no Perfil): pastas, páginas, tarefas e imagens |
| `captacao.css` / `.js` | Aba Captação: agenda de gravações |
| `verba.css` / `.js` | Aba Verba: despesas, lojas, limite e relatório para imprimir |
| `campanhas.css` / `.js` | Aba Campanhas (no lugar de Projetos) |
| `biblioteca.css` / `.js` | Aba Biblioteca da marca |
| `gerador-prompt.css` / `.js` | Aba Gerador de Prompts (dentro do sistema) |
| `avisos.css` / `.js` | Avisos no sino e notificações do computador |
| `avisos-regras.js` | Regras dos avisos (usadas pelo sistema e pelo e-mail) |
| `api/avisos-diarios.js` | E-mail diário das 7h (roda na Vercel) |
| `vercel.json` | Agenda o e-mail diário |
| `AVISOS-SETUP.md` | Passo a passo para ligar o e-mail diário (Firebase + Vercel) |

## Depois de subir

- Para o **e-mail diário** funcionar, siga o `AVISOS-SETUP.md` (uma vez só).
- O resto já funciona assim que a Vercel publicar. Se algo parecer "antigo", aperte **Ctrl + F5** para o navegador baixar os arquivos novos.
