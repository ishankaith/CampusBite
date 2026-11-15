
# CampusBite — Restaurant Ordering & Delivery Platform

CampusBite is a full-stack restaurant ordering and delivery application built with React and FastAPI. It allows customers to browse restaurants, place food orders, and track their orders. Restaurant owners can manage menus and incoming orders, while delivery partners can manage delivery assignments.

The application uses a React frontend, a FastAPI REST API, and an SQLite relational database. Docker Compose is used to run the frontend and backend together.

## Features

### Customer
- Register and log in.
- Browse approved restaurants and view their menus.
- Add items to a cart, update quantities, and remove items.
- Place orders using a simulated payment flow. No real payment gateway is connected.
- View previous and current orders.
- View order details and delivery status.
- Submit eligible cancellation requests.
- Submit ratings and reviews for delivered orders.
- Request a return or refund after delivery.
- View AI-generated order summaries and ask questions about their order history.

### Restaurant Owner
- Access the restaurant-owner dashboard.
- Manage restaurant information.
- Add, update, and delete menu items.
- View incoming orders for the restaurant.
- Update restaurant order-preparation statuses.
- Assign delivery partners to eligible orders.
- View restaurant order and sales information.
- View and manage eligible return/refund requests.

### Delivery Partner
- Access the delivery dashboard.
- View available orders and delivery assignments.
- Claim eligible delivery assignments.
- View customer delivery information for assigned orders.
- Update delivery statuses.
- View assigned and completed deliveries.

### Admin
- Access the administrative dashboard.
- Review restaurant applications.
- Approve or reject restaurant applications.
- View payment and refund records.
- Review eligible cancellation and return/refund requests.

### AI Order Assistant
- Uses the Google Gemini API.
- Generates summaries based on the authenticated customer's order history.
- Answers questions about the customer's own orders.
- Retrieves order information from the backend database rather than accepting another customer's order data from the frontend.
- Uses backend environment variables for the Gemini API key.
- Implements basic request limits and timeout/error handling.

## Technology Stack

| Area | Technologies |
|---|---|
| Frontend | React, JavaScript ES6+, React Hooks |
| Frontend tooling | Vite, React Router DOM |
| API communication | Fetch API |
| Backend | Python, FastAPI |
| Data validation | Pydantic |
| ORM | SQLAlchemy |
| Database | SQLite |
| Authentication | JWT, bcrypt password hashing |
| AI integration | Google Gemini API |
| Web server | Nginx |
| Containerization | Docker, Docker Compose |
| Version control | Git and GitHub |

**AI integration note:** The project uses Google Gemini rather than the OpenAI API specified in the original capstone brief. This is an implementation difference and should not be represented as an OpenAI integration.

## Project Structure

The main project structure is:

```text
campusbite/
│
├── backend/
│   ├── app/
│   │   ├── main.py
│   │   ├── auth.py
│   │   ├── auth_routes.py
│   │   ├── user_routes.py
│   │   ├── routes.py
│   │   ├── order_routes.py
│   │   ├── delivery_routes.py
│   │   ├── review_routes.py
│   │   ├── admin_routes.py
│   │   ├── ai_routes.py
│   │   ├── database.py
│   │   ├── models.py
│   │   └── schemas.py
│   │
│   ├── Dockerfile
│   ├── .env.example
│   └── .env                 # Local only; do not commit
│
├── frontend/
│   ├── public/
│   ├── src/
│   │   ├── components/
│   │   ├── context/
│   │   ├── pages/
│   │   ├── services/
│   │   ├── App.jsx
│   │   ├── App.css
│   │   ├── index.css
│   │   └── main.jsx
│   │
│   ├── Dockerfile
│   ├── nginx.conf
│   ├── package.json
│   └── package-lock.json
│
├── docker-compose.yml
├── requirements.txt
├── .dockerignore
├── .gitignore
├── DOCKER_SETUP.md
└── README.md
```

Local-only files such as `.env`, SQLite databases, virtual environments, `node_modules`, and database backups should not be committed to the repository.

## Prerequisites

For the Docker setup:

- Docker Desktop with Docker Compose.
- Git.

For local development without Docker:

- Python 3.11 or compatible version.
- Node.js and npm.

## Environment Configuration

The backend requires environment variables for authentication and AI integration.

1. Ensure the example file is named exactly `backend/.env.example`.
2. Create the local environment file by copying the example:

**Windows PowerShell:**

```powershell
Copy-Item backend\.env.example backend\.env
```

3. Open `backend/.env` and replace the placeholder values.

Example configuration:

```env
SECRET_KEY=replace_with_a_long_random_secret
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=60

GEMINI_API_KEY=your_google_ai_studio_api_key
GEMINI_MODEL=gemini-3.8-flash

AI_MAX_REQUESTS_PER_MINUTE=5
AI_MAX_REQUESTS_PER_DAY=40
GEMINI_TIMEOUT_MS=30000
```

### Environment Variables

| Variable | Purpose |
|---|---|
| `SECRET_KEY` | Secret used for JWT authentication. Set a strong, private value. |
| `ALGORITHM` | JWT signing algorithm. |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | JWT access-token lifetime. |
| `GEMINI_API_KEY` | Google Gemini API key for AI features. |
| `GEMINI_MODEL` | Gemini model used by the AI assistant. |
| `AI_MAX_REQUESTS_PER_MINUTE` | Per-user AI request limit per minute. |
| `AI_MAX_REQUESTS_PER_DAY` | Per-user AI request limit per day. |
| `GEMINI_TIMEOUT_MS` | Gemini request timeout in milliseconds. |

The AI assistant requires a valid Gemini API key. Never commit `backend/.env` or expose API keys in frontend code.

## Running the Application with Docker Compose

Docker Compose is the recommended way to run the complete application.

Open a terminal in the project root directory, the folder containing `docker-compose.yml`.

If this is a fresh clone and the SQLite database file does not exist, create it before starting the containers:

```powershell
if (-not (Test-Path backend\campusbite.db)) {
    New-Item -ItemType File -Path backend\campusbite.db | Out-Null
}
```

Build and start the application:

```bash
docker compose up --build -d
```

Check the running containers:

```bash
docker compose ps
```

View backend logs:

```bash
docker compose logs -f backend
```

### Application URLs

| Service | URL |
|---|---|
| CampusBite frontend | http://localhost:8080 |
| FastAPI backend | http://localhost:8000 |
| Interactive API documentation | http://localhost:8000/docs |
| OpenAPI schema | http://localhost:8000/openapi.json |
| Backend health check | http://localhost:8000/health |

The frontend container uses Nginx to serve the built React application. Docker Compose waits for the backend health check before starting the frontend service.

### Stopping and restarting

Stop the containers:

```bash
docker compose down
```

Start them again without rebuilding:

```bash
docker compose up -d
```

The SQLite database is stored on the host at `backend/campusbite.db` and mounted into the backend container. Stopping the containers does not remove that host database file.

## Running the Frontend Locally

Open a separate terminal in the project root:

```bash
cd frontend
npm install
npm run dev
```

Vite will normally make the frontend available at:

```text
http://localhost:5173
```

The frontend API service uses `http://127.0.0.1:8000` as its default backend address. The `VITE_API_URL` environment variable can be used to override that address.

## Running the Backend Locally

Open a terminal in the project root.

Create and activate a Python virtual environment:

```powershell
python -m venv backend\.venv
.\backend\.venv\Scripts\Activate.ps1
```

Install the backend dependencies using the root-level requirements file:

```bash
pip install -r requirements.txt
```

Change into the backend directory:

```bash
cd backend
```

Start the FastAPI development server:

```bash
uvicorn app.main:app --reload
```

The backend will be available at:

```text
http://127.0.0.1:8000
```

The local backend also requires the `backend/.env` file described in the Environment Configuration section.

## Database

CampusBite uses SQLite with SQLAlchemy ORM.

The database file is:

```text
backend/campusbite.db
```

The backend defines its database models in `backend/app/models.py` and its database connection in `backend/app/database.py`.

The application uses relational tables for users, restaurants, menu items, orders, order items, restaurant fulfilments, fulfilment items, delivery assignments, payment transactions, cancellation requests, refund transactions, return requests, and restaurant reviews.

The application creates database tables during backend initialization. The SQLite database file is kept outside the Docker image so that application data can persist across container restarts.

Do not upload the live database or database backup files to GitHub.

## API Documentation

CampusBite exposes REST APIs through FastAPI.

The interactive API documentation is available at:

```text
http://localhost:8000/docs
```

The OpenAPI schema is available at:

```text
http://localhost:8000/openapi.json
```

The API is organized into functional areas covering:

- User registration, login, and authentication.
- Restaurant listing and restaurant management.
- Menu management.
- Order creation, retrieval, and status updates.
- Delivery assignment and delivery status updates.
- Reviews and ratings.
- Cancellation and return/refund requests.
- Administrative operations.
- AI-powered order summaries and questions.

The `/health` endpoint can be used to check whether the backend is running.

## Authentication and Security

The backend uses JWT-based authentication and bcrypt password hashing.

Role-based access checks are applied to protected backend endpoints. The frontend stores the authentication token in local storage and sends it with protected API requests.

Sensitive configuration values are read by the backend from environment variables. Keep the following out of the public repository:

- `.env` files.
- API keys and JWT secrets.
- SQLite database files and backups.
- Python virtual environments.
- Node dependency folders.
- Cache and generated files.

A root-level `.gitignore` should protect these files before the first Git commit. The `.gitignore` inside `frontend/` does not protect files in the project root or the backend directory.

## Current Scope Notes

The following differences should be considered when comparing the application with the original capstone brief:

- The AI integration uses Google Gemini rather than OpenAI.


## Submission

The capstone submission requires a **Public GitHub repository URL**.

Before submitting:

1. Confirm the repository visibility is set to Public.
2. Confirm the React frontend, FastAPI backend, Dockerfiles, `docker-compose.yml`, requirements file, and README are included.
3. Confirm `backend/.env.example` is included.
4. Confirm actual `.env` files, API keys, passwords, databases, backups, `.venv`, and `node_modules` are excluded.
5. Confirm that the repository is accessible and that the application can be started using the documented instructions.

**Submission format:** Public GitHub Repository URL
