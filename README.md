# Consultório – agendamento de terapia

Sistema web para **um terapeuta** organizar os atendimentos **online e presenciais**:

- O **paciente sugere** o horário ideal → o **terapeuta valida**: confirma (podendo ajustar o horário) ou **propõe outro**.
- **Chat** entre terapeuta e paciente para combinar mudanças de horário.
- **Google Agenda**: consultas confirmadas entram na agenda do terapeuta, com **link do Google Meet** quando são online.
- **Lembretes automáticos** por **WhatsApp** e e-mail para **os dois** (por padrão 24h e 2h antes), verificados **a cada 30 minutos**.
- **Anotações por paciente**, visíveis **somente para o terapeuta** e criptografadas no banco.
- **Configurações**: todas as chaves de API (Google, WhatsApp, e-mail) são trocadas por uma tela, sem mexer no código, para que outra pessoa possa usar o sistema.

## Tecnologias

| Parte | Tecnologia |
|---|---|
| Site e API | Next.js 16 (App Router, Server Actions) + TypeScript |
| Estilo | Tailwind CSS 4 |
| Banco | PostgreSQL + Prisma 7 |
| Login | Sessão própria (JWT em cookie httpOnly com `jose`, senha com `bcryptjs`) |
| Hospedagem | Vercel (plano gratuito) + Neon (Postgres gratuito) |
| Lembretes | cron externo a cada 30 min → `/api/cron/lembretes` |
| Integrações | Google Calendar API, WhatsApp Cloud API (Meta), Resend (e-mail) |

## Estrutura

```
prisma/schema.prisma          tabelas: User, Appointment, ReminderLog, Note, Message, Setting
src/proxy.ts                  bloqueia /admin e /paciente sem login
src/lib/
  appointments.ts             regras de consulta + sincronização com o Google Agenda
  reminders.ts                motor de lembretes (roda a cada 30 min)
  settings.ts                 configurações editáveis (chaves de API)
  crypto.ts                   criptografia AES-256-GCM (chaves e anotações)
  integrations/               google.ts, whatsapp.ts, email.ts
src/app/
  actions/                    ações dos formulários (login, agendamento, configurações)
  api/cron/lembretes/         endpoint chamado pelo cron
  api/chat/                   mensagens do chat
  api/google/                 conexão OAuth com o Google
  admin/                      área do terapeuta (agenda, pacientes, configurações)
  paciente/                   área do paciente (consultas e mensagens)
.github/workflows/lembretes.yml   cron de 30 min pelo GitHub Actions
```

### Fluxo de uma consulta

```
paciente sugere ──► PENDING ──► terapeuta confirma ─────────────► CONFIRMED ──► Google Agenda + lembretes
                       │                                              ▲
                       └──► terapeuta propõe outro ──► PROPOSED ──► paciente aceita
qualquer lado pode cancelar ──► CANCELED (evento removido do Google)
```

## Rodar no computador

Requisitos: Node 20+ e um PostgreSQL.

```bash
npm install
cp .env.example .env      # preencha as variáveis (veja abaixo)
npx prisma migrate dev    # cria as tabelas
npm run dev               # http://localhost:3000
```

Na primeira vez, o site abre a tela **/setup** para criar a conta do terapeuta.

### Variáveis de ambiente

Só a infraestrutura fica em variáveis de ambiente. As chaves das integrações ficam na tela de Configurações.

| Variável | Para quê |
|---|---|
| `DATABASE_URL` | conexão com o Postgres |
| `AUTH_SECRET` | assina o cookie de login (`openssl rand -base64 32`) |
| `ENCRYPTION_KEY` | criptografa chaves de API e anotações (`openssl rand -base64 32`). **Guarde bem: se perder, as anotações não podem ser lidas.** |
| `CRON_SECRET` | senha que o cron envia para disparar os lembretes |
| `APP_URL` | endereço público do site (ex.: `https://consultorio.vercel.app`) |

## Publicar na Vercel (plano gratuito)

1. Suba o repositório no GitHub e importe o projeto em vercel.com.
2. Em **Storage**, adicione um banco **Neon (Postgres)**. A integração cria `DATABASE_URL` sozinha.
3. Em **Settings → Environment Variables**, adicione `AUTH_SECRET`, `ENCRYPTION_KEY`, `CRON_SECRET` e `APP_URL`.
4. Faça o deploy. O comando de build já roda as migrações (`prisma migrate deploy`).
5. Abra o site, crie a conta do terapeuta em **/setup** e vá para **Configurações**.

> O plano Hobby da Vercel é para **uso não comercial**. Se o projeto passar a ser comercial, é preciso migrar para o plano Pro.

## Lembretes a cada 30 minutos

No plano gratuito, o **cron da Vercel só roda uma vez por dia**, então ele não é usado. Escolha uma das opções abaixo.

**Opção A – cron-job.org (recomendado, gratuito e pontual)**
1. Crie uma conta em cron-job.org → *Create cronjob*.
2. URL: `https://SEU-SITE/api/cron/lembretes`. Agenda: a cada 30 minutos.
3. Em *Advanced → Headers*, adicione `Authorization` com o valor `Bearer SEU_CRON_SECRET`.

**Opção B – GitHub Actions (já incluído em `.github/workflows/lembretes.yml`)**
1. No GitHub: *Settings → Secrets and variables → Actions*, crie `APP_URL` e `CRON_SECRET`.
2. Pronto. O GitHub pode atrasar alguns minutos. Em repositórios públicos, ele pausa agendamentos depois de 60 dias sem commits. Em repositórios privados, cada execução consome minutos da cota gratuita (cerca de 1.440 dos 2.000 minutos/mês).

Como funciona: a cada execução, o sistema procura consultas confirmadas que cruzaram um marco (ex.: faltam menos de 24h). Envia o lembrete ao paciente e ao terapeuta e registra o envio em `ReminderLog`, para nunca repetir. Com o intervalo de 30 min, o lembrete de 24h chega entre 24h e 23h30 antes. Os marcos são configuráveis em Configurações (padrão `24,2`).

Na tela de Configurações existe o botão **"Verificar lembretes agora"** para testar.

## Configurar as integrações

Tudo é feito em **/admin/configuracoes**.

### Google Agenda
1. No Google Cloud Console, crie um projeto e ative a **Google Calendar API**.
2. Configure a **tela de consentimento OAuth** (tipo *Externo*) e adicione seu e-mail como usuário de teste.
3. Crie **credenciais OAuth → Aplicativo da Web** e cadastre a URL de redirecionamento mostrada na tela de Configurações (`https://SEU-SITE/api/google/callback`).
4. Cole o **Client ID** e o **Client Secret** em Configurações, salve e clique em **Conectar Google Agenda**.

> ⚠️ Enquanto o app do Google estiver em modo **"Teste"**, o acesso expira a cada **7 dias**. Para não precisar reconectar, mude para **"Em produção"** na tela de consentimento. Para uso próprio, não é preciso passar pela verificação; o Google só mostra um aviso de "app não verificado" na hora de conectar.

### WhatsApp (Cloud API da Meta)
1. Em developers.facebook.com, crie um app do tipo **Business** e adicione o produto **WhatsApp**.
2. Vincule o número. O número usado pela API precisa ser cadastrado na Cloud API. Confira na documentação da Meta se o seu número do app WhatsApp Business pode ser usado em modo de coexistência; se não puder, use um número separado.
3. Crie um **token permanente**: Business Settings → *System Users* → gerar token com as permissões `whatsapp_business_messaging` e `whatsapp_business_management`. O token temporário do painel expira em 24h.
4. No WhatsApp Manager, crie o template (categoria **Utilidade**), por exemplo:
   `Olá {{1}}, lembrete da sua consulta em {{2}}. {{3}}`
   Os campos são: `{{1}}` nome, `{{2}}` data e hora, `{{3}}` link do Meet ou endereço.
5. Em Configurações, preencha o token, o **Phone Number ID**, o nome do template e o idioma (`pt_BR`). Use **"Enviar WhatsApp de teste"** para conferir.

### E-mail (opcional, Resend)
Crie uma conta em resend.com (o plano gratuito permite 3.000 e-mails/mês), verifique seu domínio, gere uma API key e preencha o remetente. O e-mail é usado para avisos de confirmação, mudança de horário e novas mensagens no chat, além de servir de reserva para os lembretes.

## Privacidade e segurança (LGPD)

- As anotações e as chaves de API ficam **criptografadas** (AES-256-GCM) com a `ENCRYPTION_KEY`.
- Somente o terapeuta (ADMIN) acessa anotações e dados de outros pacientes. Cada paciente vê apenas as próprias consultas e a própria conversa.
- Os lembretes e eventos da agenda não levam conteúdo clínico. O título do evento usa só o primeiro nome e a inicial do sobrenome.
- O cadastro registra o aceite do termo de privacidade (`/privacidade`). **Revise o texto do termo** com um profissional e confira as normas do seu conselho (ex.: CFP) sobre prontuário e atendimento online.
- Faça backups do banco. O Neon guarda histórico, mas exportar periodicamente é recomendado.

## Jogo: Baía dos Corsários

Em `public/jogo/` há um jogo de tiro tático em terceira pessoa (5 contra 5, rodadas, compra de armas, plantar/desarmar o barril) numa ilha pirata. É independente do sistema do consultório: abra `public/jogo/index.html` direto no navegador ou acesse `/jogo/index.html` com o app rodando. Feito com three.js (em `public/jogo/vendor/`), sem etapa de build.
