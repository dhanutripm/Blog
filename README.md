# ✒️ Quillpad – Blog REST API

A Blog REST API built with **Node.js** and **Express.js** for the *Web Development – Week 06 Minor Project*.
Besides the required CRUD operations it adds drafts, a **trash bin with restore**, **search / filter / sort / pagination**,
auto-generated **slugs and reading time**, view & like counters, a **stats endpoint**, optional **API-key protection**,
an **OpenAPI spec** and a ready-to-import **Postman collection**.

---

## 1. Project Overview

| Requirement (from the brief) | How Quillpad covers it |
|---|---|
| Create / Read / Update / Delete blog posts | `POST`, `GET`, `PUT`/`PATCH`, `DELETE` on `/posts` |
| Post fields: Title, Content, Author, Category, Created Date | `title`, `content`, `author`, `category`, `createdDate` (set by the server) |
| Return 404 when a post does not exist | Every `:id` route returns `404` with a clear message |
| Update title, content, category or author | `PUT`/`PATCH /posts/:id` accept any subset of fields |
| Proper status codes + JSON | `200, 201, 400, 401, 404, 409, 413, 500` – always the same JSON envelope |
| Validation + meaningful errors | Field-level errors, e.g. `{"field":"title","message":"title must be between 3 and 150 characters"}` |
| Middleware, routing, error handling | Request-id + logger, validators, API-key guard, 404 handler, central error handler |
| Storage: array / JSON file / MongoDB | In-memory **or** JSON-file storage (atomic writes) – switch with `STORAGE=memory\|file` |
| Bonus: pagination, search & filter, Swagger-style docs | ✅ implemented (OpenAPI 3 JSON at `/docs`) |

### What makes Quillpad different
- **Trash & restore** – `DELETE` is a *soft delete*; `?permanent=true` removes forever; `POST /posts/:id/restore` brings a post back.
- **Slugs** – each post gets a URL-friendly slug; every `:id` route accepts the UUID **or** the slug (`/posts/soft-delete-vs-hard-delete-...`).
- **Drafts** – posts are `draft` or `published`; filter with `?status=`.
- **Reading time, views, likes** – calculated / counted automatically.
- **Multi-word search** – `?search=rest api` requires every word to appear in title, content, author or tags.
- **Stats dashboard** – `GET /posts/stats` (totals, categories, top tags/authors, most viewed).
- **Optional API key** – set `API_KEY` and all write routes require an `x-api-key` header.
- **Zero extra dependencies** – only `express`; tests use Node's built-in test runner.

---

## 2. API Endpoints

Base URL: `http://localhost:3000`

| Method | Route | Description | Success | Errors |
|---|---|---|---|---|
| `POST` | `/posts` | Create a post | `201` | `400` |
| `GET` | `/posts` | List posts (search/filter/sort/paginate) | `200` | `400` |
| `GET` | `/posts/:id` | Get one post by UUID **or slug** (counts a view) | `200` | `400`, `404` |
| `PUT` | `/posts/:id` | Update a post (any subset of fields) | `200` | `400`, `404` |
| `PATCH` | `/posts/:id` | Partial update (same rules as PUT) | `200` | `400`, `404` |
| `DELETE` | `/posts/:id` | Move to trash (`?permanent=true` = delete forever) | `200` | `400`, `404` |
| `GET` | `/posts/trash` | List trashed posts | `200` | – |
| `POST` | `/posts/:id/restore` | Restore from trash | `200` | `404`, `409` |
| `POST` | `/posts/:id/like` | Like a post | `200` | `404` |
| `GET` | `/posts/stats` | Blog statistics | `200` | – |
| `GET` | `/health` | Health check | `200` | – |
| `GET` | `/docs` | OpenAPI 3 specification (JSON) | `200` | – |

> `trash` and `stats` are reserved words – no post can get those slugs.

### Post object
```json
{
  "id": "00000000-0000-4000-8000-000000000001",
  "title": "Why Every Beginner Should Build a REST API First",
  "slug": "why-every-beginner-should-build-a-rest-api-first",
  "content": "A REST API is the quickest way ...",
  "author": "Priya Nair",
  "category": "Backend",
  "tags": ["rest", "express", "beginners"],
  "status": "published",
  "readingTime": 1,
  "views": 42,
  "likes": 7,
  "createdDate": "2026-10-02T09:30:00.000Z",
  "updatedDate": "2026-10-02T09:30:00.000Z",
  "deletedAt": null
}
```

### Request body rules (create / update)
| Field | Rule | Create | Update |
|---|---|---|---|
| `title` | string, 3–150 chars | required | optional |
| `content` | string, 10–20000 chars | required | optional |
| `author` | string, 2–60 chars (`authorName` also accepted) | required | optional |
| `category` | string, 2–40 chars | required | optional |
| `tags` | array of ≤ 8 strings (2–30 chars), lower-cased, de-duplicated | optional | optional |
| `status` | `draft` \| `published` (default `published`) | optional | optional |

Unknown fields (e.g. `id`, `views`) are rejected with `400`. `PUT`/`PATCH` need at least one field.

### List query parameters – `GET /posts`
| Param | Meaning | Default |
|---|---|---|
| `search` | every word must appear in title/content/author/tags | – |
| `category`, `author`, `tag` | exact match, case-insensitive | – |
| `status` | `draft` \| `published` \| `all` | all |
| `sort` | `createdDate` \| `updatedDate` \| `title` \| `views` \| `likes` | `createdDate` |
| `order` | `asc` \| `desc` | `desc` |
| `page` | page number (≥ 1) | `1` |
| `limit` | page size (1–100) | `50` |

### Response formats
Success:
```json
{ "success": true, "message": "3 post(s) found", "data": [ ... ],
  "meta": { "total": 3, "page": 1, "limit": 50, "totalPages": 1, "hasNext": false, "hasPrev": false } }
```
Error:
```json
{ "success": false, "message": "Validation failed", "requestId": "a1b2c3d4",
  "errors": [ { "field": "title", "message": "title is required" } ] }
```

---

## 3. Technologies Used
- **Node.js** (18+) – runtime
- **Express.js 4** – routing & middleware
- **JSON file / in-memory storage** – custom `JsonStore` (queued, atomic writes)
- **node:test** – built-in test runner (no Jest needed)
- **Postman / Thunder Client / Insomnia** – manual API testing
- **OpenAPI 3** – API documentation

## 4. Project Structure
```
quillpad-blog-api/
├── app.js                    # builds the Express app (middleware + routes + error handling)
├── server.js                 # reads config, creates the store, starts listening
├── routes/
│   └── postRoutes.js         # route table for /posts
├── controllers/
│   └── postController.js    # HTTP layer: status codes, messages, 404s
├── models/
│   ├── postModel.js          # business logic (create, list, search, trash, stats ...)
│   └── JsonStore.js          # storage engine (JSON file or memory)
├── middleware/
│   ├── requestLogger.js      # request id + logging
│   ├── validate.js           # body / query / :id validation
│   ├── apiKey.js             # optional x-api-key guard
│   ├── notFound.js           # unknown route -> 404
│   └── errorHandler.js       # one JSON error format for everything
├── utils/                    # AppError, helpers (slugify, readingTime), pure validators
├── data/posts.json           # sample data (5 posts) – also the live file in "file" mode
├── docs/                     # openapi.json + Postman collection
├── tests/                    # unit + end-to-end tests
├── .env.example
└── package.json
```
Request flow: **request → logger → JSON parser → route → validation → controller → model → store → JSON response**
(any error → `errorHandler`).

## 5. Installation Steps
```bash
# 1. Clone
git clone <https://github.com/dhanutripm/Blog.git>
cd quillpad-blog-api

# 2. Install dependencies
npm install

# 3. (optional) configure – copy .env.example values into your shell
#    PORT=3000  STORAGE=file|memory  API_KEY=<secret>

# 4. Start the server
npm start            # or: npm run dev  (auto-restart on file changes)
```
Open http://localhost:3000 – you should see the API info JSON.

| Variable | Purpose | Default |
|---|---|---|
| `PORT` | server port | `3000` |
| `STORAGE` | `file` = persist to `data/posts.json`, `memory` = RAM only | `file` |
| `API_KEY` | if set, write routes need header `x-api-key` | off |
| `NODE_ENV` | `development` adds stack traces to 500 responses | – |

Windows PowerShell example: `$env:STORAGE="memory"; npm start`

## 6. Testing Instructions

### A) Automated tests
```bash
npm test
```
- `helpers`, `validators`, `model`, `controller` tests need nothing but Node.
- `api.test.js` boots the real server on a random port and calls every route (needs `npm install` first).

### B) Manual testing with Postman / Thunder Client / Insomnia
1. Start the server (`npm start`).
2. Import `docs/Quillpad.postman_collection.json`.
3. Run the folders **top to bottom** – the first request saves `postId` and `postSlug`, and each request has built-in assertions.
4. Take screenshots of passing requests and save them in `docs/screenshots/` (your *API Testing Results*).

### C) Quick curl examples
```bash
# Create
curl -X POST http://localhost:3000/posts -H "Content-Type: application/json" \
  -d '{"title":"My first post","content":"Hello from my brand new blog API!","author":"Dhanutri","category":"Backend","tags":["node"]}'

# List with search + pagination
curl "http://localhost:3000/posts?search=rest&sort=views&order=desc&page=1&limit=5"

# Get by slug, update, like
curl http://localhost:3000/posts/my-first-post
curl -X PATCH http://localhost:3000/posts/my-first-post -H "Content-Type: application/json" -d '{"category":"Web"}'
curl -X POST http://localhost:3000/posts/my-first-post/like

# Trash, list trash, restore, delete forever
curl -X DELETE http://localhost:3000/posts/my-first-post
curl http://localhost:3000/posts/trash
curl -X POST http://localhost:3000/posts/my-first-post/restore
curl -X DELETE "http://localhost:3000/posts/my-first-post?permanent=true"

# With API key enabled (API_KEY=secret)
curl -X POST http://localhost:3000/posts -H "x-api-key: secret" -H "Content-Type: application/json" -d '{...}'
```

### D) Expected results checklist
| # | Request | Expected |
|---|---|---|
| 1 | `POST /posts` valid body | `201`, post with `id`, `slug`, `createdDate` |
| 2 | `POST /posts` `{"title":"x"}` | `400` + list of missing/invalid fields |
| 3 | `POST /posts` body `{oops` | `400` "Malformed JSON in request body" |
| 4 | `GET /posts` | `200`, array + `meta` |
| 5 | `GET /posts?limit=0` | `400` |
| 6 | `GET /posts/<id or slug>` | `200` |
| 7 | `GET /posts/unknown-post` | `404` |
| 8 | `GET /posts/bad%20id!` | `400` |
| 9 | `PUT /posts/<id>` `{"category":"News"}` | `200`, updated |
| 10 | `PUT /posts/<id>` `{}` | `400` |
| 11 | `DELETE /posts/<id>` | `200`, post in `/posts/trash` |
| 12 | `POST /posts/<id>/restore` twice | `200` then `409` |
| 13 | `DELETE /posts/<id>?permanent=true` twice | `200` then `404` |
| 14 | `GET /nope` | `404` "Route GET /nope not found" |

## 7. Design Decisions
- **Layered code** (routes → controller → model → store) keeps each file small and testable.
- **App factory** (`createApp({ store })`) lets tests inject an in-memory store.
- **Stable slugs** – editing a title does not change the URL.
- **Soft delete by default** – accidental deletes are recoverable.
- **Atomic file writes** – data is written to a temp file and renamed, so `posts.json` can't be corrupted half-way.
- **Strict validation** – whitelisted fields only, so clients can't overwrite `id`, `views` or dates.

## 8. Possible Future Improvements
MongoDB storage, JWT user accounts, comments, Swagger UI, deployment on Render/Railway.

## 9. Author
Dhanutri Medar
