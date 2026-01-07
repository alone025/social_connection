## Conference Networking Bot

Node.js + Telegram bot + MongoDB + Socket.IO second screen for conferences and communities.

### Requirements

- Node.js ≥ 18 (for local runs)
- Docker & docker-compose (for quick deploy)
- MongoDB ≥ 5 (if running without Docker)

### Environment Configuration

#### Quick Setup

1. **Copy the example environment file:**
   ```bash
   cp .env.example .env
   ```

2. **Edit `.env` and fill in your values:**
   - `TELEGRAM_BOT_TOKEN` — Get from [@BotFather](https://t.me/BotFather) on Telegram
   - `MONGODB_URI` — MongoDB connection string
   - `SECOND_SCREEN_API_KEY` — Generate a secure random string (e.g., `openssl rand -hex 32`)
   - `MAIN_ADMIN_TELEGRAM_IDS` — Your Telegram user ID(s), comma-separated (get from [@userinfobot](https://t.me/userinfobot))

#### Environment Variables

**Required:**
- `TELEGRAM_BOT_TOKEN` — Telegram bot token from @BotFather
- `MONGODB_URI` — MongoDB connection string (format: `mongodb://[user:pass@]host[:port][/database]`)
- `SECOND_SCREEN_API_KEY` — Secret key for protecting second screen API endpoints (min 16 chars recommended)

**Optional:**
- `MAIN_ADMIN_TELEGRAM_IDS` — Comma-separated Telegram user IDs for main admins
- `PORT` — HTTP server port (default: `3000`)
- `BASE_URL` or `SERVER_URL` — Base URL for second screen links (default: `http://localhost:3000`)
- `NODE_ENV` — Environment mode: `development`, `staging`, or `production` (default: `development`)

#### Environment-Specific Configuration

The application supports environment-specific configuration files:

- `.env.development` — For local development
- `.env.staging` — For staging environment
- `.env.production` — For production

The application will automatically load `.env.<NODE_ENV>` first, then fall back to `.env` if the environment-specific file doesn't exist.

**Example:**
```bash
# Set environment
export NODE_ENV=production

# Application will load:
# 1. .env.production (if exists)
# 2. .env (fallback)
```

**Important:** All `.env*` files are ignored by git. Never commit secrets to the repository.

### Run locally (without Docker)

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Set up environment:**
   ```bash
   cp .env.example .env
   # Edit .env with your actual values
   ```

3. **Start the application:**
   ```bash
   # Development mode (default)
   npm run dev

   # Or with explicit environment
   NODE_ENV=development npm start
   ```

The application will:
- Validate all required environment variables on startup
- Show warnings for missing optional variables
- Exit with clear error messages if required variables are missing

The server will start on `http://localhost:3000`.

**Available endpoints:**
- `GET /health` — Health check endpoint (public)
- `GET /second-screen/:code?key=<SECOND_SCREEN_API_KEY>` — Second screen HTML page (protected via query parameter)
- `GET /conference/:code/polls` — Get polls for conference (protected, requires `X-SECOND-SCREEN-KEY` header)
- `GET /conference/:code/questions` — Get questions for conference (protected, requires `X-SECOND-SCREEN-KEY` header)
- `GET /conference/:code/stats` — Get conference statistics (protected, requires `X-SECOND-SCREEN-KEY` header)

**Security:**
- All `/conference/*` REST endpoints require the `X-SECOND-SCREEN-KEY` header with a valid API key
- Second screen HTML page requires the `key` query parameter
- Socket.IO connections require authentication via `secondScreenKey` in handshake auth
- Without a valid API key, all second screen endpoints return `401 Unauthorized`

### Run with Docker (recommended for quick demo)

1. Create a `.env` file near `docker-compose.yml`:

```bash
TELEGRAM_BOT_TOKEN=your-telegram-bot-token
SECOND_SCREEN_API_KEY=your-second-screen-key
MAIN_ADMIN_TELEGRAM_IDS=123456789
MONGO_ROOT_USER=root
MONGO_ROOT_PASSWORD=example
```

2. Build and start:

```bash
docker-compose up --build
```

This will:

- start MongoDB on port `27017`
- build and run the app on port `3000`

### Telegram bot usage (short)

- `/start` — registration + краткая справка
- `/my_conferences` — список ваших конференций
- `/create_conference <название>` — создать конференцию (main / conference admin)
- `/join <код>` — присоединиться к конференции
- `/end_conference <код>` — завершить конференцию (main / conference admin)
- `/set_conf_admin <код> <telegramId>` — назначить конференционного админа (main)
- `/unset_conf_admin <код> <telegramId>` — снять админа (main)
- `/ask <код> <вопрос>` — задать вопрос
- `/mod_questions <код>` — список вопросов на модерации (админы)
- `/approve_question <код> <questionId>` — одобрить вопрос (админы)
- `/reject_question <код> <questionId>` — отклонить вопрос (админы)
- `/set_slide <код> <url> [заголовок]` — задать слайд на второй экран (админы)
- `/clear_slide <код>` — убрать слайд (админы)

### Second Screen

Open in browser or WebView:

- `http(s)://<host>/second-screen/<conferenceCode>?key=<SECOND_SCREEN_API_KEY>`

It will:

- subscribe to Socket.IO with the same key
- show approved Q&A in real time
- show the current slide/URL set by admins


