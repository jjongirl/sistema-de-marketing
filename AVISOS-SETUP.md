# Avisos por e-mail — passo a passo

Todo dia útil, por volta das **7h (Brasília)**, cada pessoa da equipe recebe um e-mail com o que está com o nome dela no sistema:

- **Atrasadas** — tarefas vencidas e cobranças de outros setores atrasadas
- **Hoje** — tarefas, captações (com horário, local e o que levar), rotinas da pauta, campanhas que começam hoje
- **Atenção** — captação "a confirmar" chegando, peça com ajustes pedidos, peça sem retorno há 3+ dias, campanha terminando
- **Amanhã** — o que vem no dia seguinte
- **Às segundas** — também o resumo do resto da semana

Se a pessoa não tiver nada, **não recebe e-mail** naquele dia. Sábado e domingo não manda.

Os avisos **dentro do sistema** (sino e notificações do computador) já funcionam sem configurar nada.
Só o e-mail precisa dos passos abaixo — **uma vez só**.

---

## 1. Pegar a chave do Firebase (conta de serviço)

1. Abra o [Console do Firebase](https://console.firebase.google.com/) → projeto **sistema-de-marketing**
2. Clique na engrenagem ⚙️ → **Configurações do projeto** → aba **Contas de serviço**
3. Clique em **Gerar nova chave privada** → **Gerar chave**
4. Vai baixar um arquivo `.json`. Abra no Bloco de Notas e **copie tudo** (de `{` até `}`)

> ⚠️ Essa chave dá acesso total ao banco. **Não** coloque no código, no GitHub nem mande por WhatsApp.
> Ela vai **só** na Vercel (passo 2). Depois de colar lá, pode apagar o arquivo do computador.

## 2. Colocar as variáveis na Vercel

Painel da Vercel → seu projeto → **Settings → Environment Variables** → adicione:

| Nome | Valor |
|---|---|
| `FIREBASE_SERVICE_ACCOUNT` | cole o conteúdo inteiro do `.json` do passo 1 |
| `CRON_SECRET` | uma senha longa qualquer, ex.: `impresul-avisos-8f3k2m9q7x` (a Vercel usa sozinha) |
| `APP_URL` | *(opcional)* o endereço do sistema, ex.: `https://seu-sistema.vercel.app` |

As variáveis de e-mail (`SMTP_HOST`, `SMTP_USER`, `SMTP_PASS`...) **já existem** — são as mesmas que o sistema usa para mandar as cobranças. Se ainda não estiverem lá, veja o `SETUP.md` (passo 4).

Opcionais:
- `AVISOS_FIM_DE_SEMANA` = `1` → manda também sábado e domingo
- `AVISOS_EQUIPE` → para mudar a lista de quem recebe sem mexer no código, ex.:
  `[{"name":"Mariana","email":"mariana@impresul.com.br"},{"name":"Laura","email":"laura@impresul.com.br"}]`

## 3. Publicar

Suba os arquivos novos junto com o resto (GitHub ou `vercel --prod`). Os importantes para o e-mail são:

- `api/avisos-diarios.js`
- `avisos-regras.js`
- `vercel.json` ← é ele que agenda o envio diário
- `package.json` ← ganhou a dependência `firebase-admin`

Depois de publicar, confira em **Vercel → projeto → Settings → Cron Jobs**: deve aparecer `/api/avisos-diarios` com o horário `0 10 * * *` (10h UTC = 7h Brasília).

> No plano grátis da Vercel o horário não é exato: o envio acontece **entre 7h e 8h**.

## 4. Testar

No sistema: **Meu Perfil → Avisos → "Me mandar o e-mail de hoje agora"**.
O e-mail chega só para você (mesmo que você não tenha nada pendente, para dar para ver como fica).

Se aparecer erro, a mensagem diz o que falta:
- *"FIREBASE_SERVICE_ACCOUNT não configurada"* → passo 2
- *"Variáveis SMTP não configuradas"* → `SETUP.md`, passo 4
- *"Invalid login"* / *"Username and Password not accepted"* → a senha de app do e-mail (`SMTP_PASS`) está errada

## Quem recebe

A lista fica em `avisos-regras.js` (`EQUIPE`) — a mesma equipe do sistema. Cada pessoa pode
**desligar o próprio e-mail** em **Meu Perfil → Avisos**. O nome que aparece em "Responsável"
nas tarefas, captações etc. precisa bater com o nome da pessoa na lista (ex.: "Mariana").
