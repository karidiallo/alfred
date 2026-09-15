# Alfred v0.1

Pierwszy działający milestone:

**Discord -> Alfred -> OpenAI -> odpowiedź na Discordzie**

Bez Supabase, dashboardu i automatycznej pamięci. Najpierw uruchamiamy rdzeń.

## 1. Wymagania

- Node.js (najnowsze LTS)
- konto OpenAI API + API key
- aplikacja/bot w Discord Developer Portal

## 2. Instalacja

```bash
npm install
cp .env.example .env
```

Uzupełnij `.env`:

```env
OPENAI_API_KEY=...
DISCORD_BOT_TOKEN=...
DISCORD_CHANNEL_ID=...
OPENAI_MODEL=gpt-5.6-sol
```

`DISCORD_CHANNEL_ID` jest opcjonalne. Jeśli ustawisz ID kanału, Alfred odpowiada na każdą wiadomość w tym kanale. Jeśli zostawisz puste, odpowiada w DM oraz gdy oznaczysz bota.

## 3. Discord Developer Portal

1. Utwórz New Application.
2. Wejdź w **Bot** i utwórz bota.
3. Skopiuj token do `DISCORD_BOT_TOKEN`.
4. W **Privileged Gateway Intents** włącz **Message Content Intent**.
5. W OAuth2 / URL Generator wybierz scope `bot`.
6. Nadaj co najmniej uprawnienia:
   - View Channels
   - Send Messages
   - Read Message History
7. Otwórz wygenerowany link i dodaj Alfreda do swojego serwera.

## 4. ID kanału (opcjonalnie, ale polecane)

W Discordzie włącz Developer Mode, kliknij prawym na kanał `#alfred` -> Copy Channel ID -> wklej do `.env` jako `DISCORD_CHANNEL_ID`.

## 5. Start

```bash
npm run dev
```

Powinna pojawić się informacja:

```text
Alfred online jako ...
```

Napisz wiadomość na skonfigurowanym kanale.

## Co działa w v0.1

- Discord jako interfejs
- GPT-5.6 Sol domyślnie
- Alfred Master Instructions
- kontekst rozmowy utrzymywany przez Responses API w trakcie działania procesu
- osobne rozmowy dla kanałów/DM

## Czego świadomie jeszcze NIE ma

- trwałej pamięci po restarcie
- Supabase
- Life State
- knowledge base
- dashboard API
- Memory Keepera
- learning loop

Następny milestone po udanym teście: **v0.2 Supabase + persistent Current State**.
