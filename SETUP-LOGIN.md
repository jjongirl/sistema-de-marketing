# Login, Registro de Alterações e Link de Aprovação

Guia das três funcionalidades novas. São **5 passos** — leva uns 20 minutos.

---

## PASSO 1 — Ativar o login por e-mail e senha

1. Firebase Console → **Authentication** → **Get started**
2. Aba **Sign-in method** → **E-mail/senha** → **Ativar** (só a primeira
   chave; o "link de e-mail sem senha" pode ficar desligado) → **Salvar**

## PASSO 2 — Desativar o autocadastro ⚠️

**Este passo não é opcional.** Sem ele, qualquer pessoa que descubra o
endereço do sistema consegue criar uma conta sozinha e entrar.

1. Authentication → aba **Settings** → seção **User actions**
2. **Desmarcar** "Enable create (sign-up)" → **Salvar**

A partir daí, só você cria contas — pelo próprio console.

> Se a sua versão do console não tiver essa opção, use a alternativa da
> lista de permissão que está comentada dentro do `firestore.rules`.

## PASSO 3 — Criar as contas da equipe

Authentication → aba **Users** → **Add user** → e-mail e senha provisória.

Pode ser qualquer e-mail — não precisa ser Google, não precisa ser do
mesmo domínio.

Combine uma senha provisória e peça para a pessoa trocar no primeiro
acesso, pelo botão da chave (🔑) no rodapé da barra lateral.

**No primeiro login o sistema pergunta como a pessoa quer aparecer** no
Registro de Alterações. O nome fica salvo e é o que assina cada ação.

### Filtro de domínio (opcional)

No `index.html`, perto do fim:

```js
const AUTH_DOMINIO = '';
```

Vazio = aceita qualquer e-mail cadastrado por você. Se quiser uma trava a
mais, coloque `'impresul.com.br'` e só e-mails desse domínio entram.

## PASSO 4 — Publicar as regras

Firebase Console → **Firestore Database** → aba **Regras** → colar o
conteúdo de `firestore.rules` → **Publicar**.

A partir daqui o banco fica fechado. Se esquecer este passo, o login
funciona mas os dados continuam abertos — **é o passo mais importante.**

## PASSO 5 — Subir os arquivos

- `index.html` (atualizado)
- `aprovacao.html` (novo)
- `firestore.rules` (atualizado)

Nada muda no deploy da Vercel — continua site estático + a função de
e-mail.

---

## Como cada coisa funciona

### Login

Tela de entrada com e-mail e senha, olho para revelar a senha e link de
**"Esqueci minha senha"** (o Firebase envia o e-mail de redefinição
sozinho — nada a configurar).

Os dados só começam a carregar **depois** que a conta é validada. A sessão
fica salva no navegador, então não precisa logar toda vez.

No rodapé da barra lateral aparecem o nome e o e-mail da pessoa, mais dois
botões: 🔑 troca de senha e ⏻ sair.

### Registro de Alterações

Nova aba no menu (**Registro**, embaixo de Insights). Toda criação, edição
e exclusão em qualquer aba entra ali:

- quem fez
- o que fez (criou / alterou / excluiu)
- qual item
- **quais campos mudaram** — ex.: "alterou Post do Dia dos Pais (status, responsável)"
- quando

Filtros por aba, por pessoa, por tipo de ação e busca por nome do item.
Edição que não muda nada de fato não vira linha no log.

Além disso, cada registro no banco passa a carregar `__createdBy` e
`__updatedBy`. Na folha de aprovação isso vira uma linha discreta de
autoria.

O log carrega os **500 mais recentes**. O histórico completo fica no
Firestore, na coleção `audit`.

### Link de aprovação para o cliente

Botão **"Gerar link do cliente"** na folha da peça. Ele cria um token
aleatório (`crypto.randomUUID`), copia para a coleção
`aprovacoes_publicas` só o que o cliente precisa ver — título, empresa,
formato, legenda e slides — e copia o endereço para a área de
transferência.

O e-mail de aprovação passa a levar esse link no lugar dos botões de
`mailto:`. Se o link não puder ser gerado, o e-mail volta sozinho ao
formato antigo.

O cliente abre `aprovacao.html?t=<token>`, vê a peça em tamanho real,
navega pelos slides e escolhe **Aprovar / Pedir ajuste / Reprovar**.
Comentário é obrigatório nos dois últimos.

A resposta volta sozinha: muda o status, entra como comentário assinado
"Cliente (link)", aparece no Registro como "Cliente (link público)" e
dispara um aviso na tela de quem estiver com o sistema aberto.

**Travas do link:**

| Trava | Efeito |
|---|---|
| Decisão única | Depois de responder, o cliente vê a resposta registrada e não consegue reescrever |
| Validade de 30 dias | Passou disso, o link mostra "expirado" |
| Campos restritos | As regras só deixam mudar `status`, `comentarioCliente` e `decididoEm` |
| Revogável | O botão 🚫 apaga o documento público na hora |

Para mudar a validade, altere `AP_PUB_DIAS` no `index.html`.

---

## Duas coisas que também mudaram no caminho

- **`localStorage` mais leve.** Com o Firebase ativo, as aprovações
  (imagens em base64) e o registro não são mais gravados no cache do
  navegador. Era o caminho mais provável para estourar a cota de ~5 MB.

- **Excluir agora pergunta em todas as abas.** Metas e Insights apagavam
  direto; agora pedem confirmação como as outras.

---

## Se algo der errado

**"Login por e-mail/senha não está ativado"** — faltou o Passo 1.

**"Missing or insufficient permissions"** — as regras não foram
publicadas, ou você usou a versão com lista de permissão sem criar o
documento em `/equipe/{uid}`.

**A pessoa esqueceu a senha** — ela mesma resolve pelo link na tela de
login. Se preferir, redefina pelo console: Authentication → Users → os
três pontinhos ao lado do usuário → **Reset password**.

**Alguém deixou a empresa** — Authentication → Users → desativar ou
excluir a conta. O acesso cai na hora, e o histórico dela no Registro
continua lá.

**O cliente vê "Link não encontrado"** — o `FIREBASE_CONFIG` do
`aprovacao.html` precisa ser exatamente o mesmo do `index.html`.

**A resposta do cliente não volta** — confirme que a regra de `update`
sem login foi publicada e que o link não expirou.
