# Beginner-Friendly Guide: Deploy the Vektori Layer to Production on AWS

This guide is meant for someone with zero AWS experience. It uses the simplest production path that is still realistic:

- Your web app stays as is
- A separate FastAPI service handles memory ingest and search
- AWS App Runner hosts the service
- AWS RDS for PostgreSQL stores the data
- Your existing web app calls the service over HTTP, just like it already expects

This guide assumes your current web app is already wired to call a Vektori service through the contract in the existing integration files.

---

## 1. What you are building

In simple terms, you are creating a small API service that does three things:

1. Receive journal/chat messages from your web app
2. Store them safely
3. Search them later when the app asks for memory context

Your web app will continue to work the same way, but instead of talking to a mock or local shim, it will talk to this new production API.

---

## 2. What you need before you start

You will need:

- An AWS account
- A computer with Docker installed
- A terminal window
- Your web app repository
- A basic ability to copy/paste commands

If you do not have Docker yet, install it first.

---

## 3. The easiest AWS setup

Use this stack:

- AWS App Runner: hosts your FastAPI API
- Amazon RDS for PostgreSQL: stores your memory data
- Amazon ECR: stores your Docker image
- AWS Secrets Manager: stores passwords and keys

This is the easiest path because you do not need to manage servers yourself.

---

## 4. Create a simple FastAPI service locally

Create a new folder for the service, for example:

```bash
mkdir vektori-service
cd vektori-service
```

Create a file named `main.py` with this content:

```python
import os
from typing import List, Optional
from fastapi import FastAPI, Header, HTTPException
from pydantic import BaseModel
import psycopg2
from psycopg2.extras import RealDictCursor

app = FastAPI(title="Vektori Production API")

DATABASE_URL = os.getenv("DATABASE_URL", "")
API_KEY = os.getenv("API_KEY", "")


class Message(BaseModel):
    role: str
    content: str


class AddRequest(BaseModel):
    user_id: str
    session_id: Optional[str] = None
    messages: List[Message]


class SearchRequest(BaseModel):
    user_id: str
    query: str


def get_conn():
    if not DATABASE_URL:
        raise RuntimeError("DATABASE_URL is not set")
    return psycopg2.connect(DATABASE_URL)


def init_db():
    conn = get_conn()
    cur = conn.cursor()
    cur.execute("""
    CREATE TABLE IF NOT EXISTS memory_items (
        id SERIAL PRIMARY KEY,
        user_id TEXT NOT NULL,
        session_id TEXT,
        role TEXT NOT NULL,
        content TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
    """)
    conn.commit()
    cur.close()
    conn.close()


@app.on_event("startup")
def startup_event():
    init_db()


@app.get("/health")
def health():
    return {"ok": True, "status": "healthy"}


@app.post("/add")
def add(payload: AddRequest, authorization: Optional[str] = Header(None)):
    if API_KEY and authorization != f"Bearer {API_KEY}":
        raise HTTPException(status_code=401, detail="Unauthorized")

    conn = get_conn()
    cur = conn.cursor()

    for msg in payload.messages:
        cur.execute(
            "INSERT INTO memory_items (user_id, session_id, role, content) VALUES (%s, %s, %s, %s)",
            (payload.user_id, payload.session_id, msg.role, msg.content),
        )

    conn.commit()
    cur.close()
    conn.close()

    return {"ok": True, "stored": len(payload.messages)}


@app.get("/search")
def search(user_id: str, q: str, authorization: Optional[str] = Header(None)):
    if API_KEY and authorization != f"Bearer {API_KEY}":
        raise HTTPException(status_code=401, detail="Unauthorized")

    conn = get_conn()
    cur = conn.cursor(cursor_factory=RealDictCursor)
    cur.execute(
        """
        SELECT role, content
        FROM memory_items
        WHERE user_id = %s
          AND LOWER(content) LIKE LOWER(%s)
        ORDER BY created_at DESC
        LIMIT 10
        """,
        (user_id, f"%{q}%"),
    )
    rows = cur.fetchall()
    cur.close()
    conn.close()

    return {
        "facts": [{"text": row["content"], "score": 1.0} for row in rows],
        "episodes": [],
        "sentences": [],
    }
```

Create a file named `requirements.txt`:

```txt
fastapi
uvicorn
psycopg2-binary
pydantic
```

Install the requirements locally:

```bash
pip install -r requirements.txt
```

Run the service locally:

```bash
uvicorn main:app --host 0.0.0.0 --port 8000
```

Open this in your browser or terminal:

```bash
http://localhost:8000/health
```

You should see a JSON response.

---

## 5. Create a Docker image

Create a file named `Dockerfile`:

```dockerfile
FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 8000

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
```

Build it locally:

```bash
docker build -t vektori-service .
```

Run it locally:

```bash
docker run -p 8000:8000 -e DATABASE_URL=postgresql://postgres:password@host.docker.internal:5432/postgres -e API_KEY=testkey vektori-service
```

If this works locally, you are ready to move to AWS.

---

## 6. Create your AWS account and login

If you do not already have AWS access:

1. Go to AWS
2. Create an account
3. Sign in to the AWS Console
4. Open the IAM section
5. Make sure you have permissions to use:
   - ECR
   - App Runner
   - RDS
   - Secrets Manager

If you are not sure whether your account has permissions, ask an admin or use an account that already has them.

---

## 7. Create a PostgreSQL database in RDS

This is the part that stores the memory data.

In the AWS Console:

1. Open RDS
2. Click Create database
3. Choose Standard Create
4. Choose PostgreSQL
5. Choose a small instance size to start
6. Set:
   - DB instance identifier: `force-vektori-db`
   - Master username: `postgres`
   - Master password: choose a strong password
7. Create the database

Important:

- Wait for it to finish creating
- Save the endpoint address somewhere
- Save the username and password securely

You will need the database endpoint later.

---

## 8. Create a repository in ECR

ECR stores your Docker image.

In the AWS Console:

1. Open ECR
2. Click Create repository
3. Name it `force-vektori`
4. Create it

After it is created, AWS will give you commands to push your image.

You can also use the AWS CLI if installed.

---

## 9. Push your Docker image to ECR

Use the commands shown by AWS in the ECR page.

Typical pattern:

```bash
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin <your-account-id>.dkr.ecr.us-east-1.amazonaws.com

docker build -t force-vektori .

docker tag force-vektori:latest <your-account-id>.dkr.ecr.us-east-1.amazonaws.com/force-vektori:latest

docker push <your-account-id>.dkr.ecr.us-east-1.amazonaws.com/force-vektori:latest
```

If this fails, it usually means one of these:

- AWS CLI is not installed
- Your AWS account is not configured
- You do not have permission to push to ECR

---

## 10. Deploy the service with AWS App Runner

Now you deploy the container.

In the AWS Console:

1. Open App Runner
2. Click Create service
3. Choose Container image
4. Select the image in ECR
5. Set the port to `8000`
6. Give the service a name such as `force-vektori`
7. Add environment variables:
   - `DATABASE_URL`
   - `API_KEY`

Example values:

```text
DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@YOUR_RDS_ENDPOINT:5432/postgres
API_KEY=some-strong-secret
```

Then create the service.

App Runner will give you a public URL like:

```text
https://something.us-east-1.awsapprunner.com
```

Save that URL.

---

## 11. Update your web app environment variables

In your deployed web app, set the Vektori environment variables to point to the new App Runner URL.

Use values like these:

```env
VEKTORI_ENABLED=true
VEKTORI_BASE_URL=https://YOUR_APP_RUNNER_URL
VEKTORI_API_KEY=some-strong-secret
VEKTORI_ADD_PATH=/add
VEKTORI_SEARCH_PATH=/search
VEKTORI_HEALTH_PATH=/health
VEKTORI_CLEAR_PATH=/clear
```

Then redeploy your web app so it starts using the new service.

---

## 12. Test the deployment

Test the health endpoint:

```bash
curl https://YOUR_APP_RUNNER_URL/health
```

Expected result:

```json
{"ok":true,"status":"healthy"}
```

Test the add endpoint:

```bash
curl -X POST https://YOUR_APP_RUNNER_URL/add \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer some-strong-secret" \
  -d '{
    "user_id": "demo-user",
    "session_id": "demo-session",
    "messages": [
      {"role": "user", "content": "I had a migraine today"},
      {"role": "assistant", "content": "I am sorry to hear that"}
    ]
  }'
```

Test the search endpoint:

```bash
curl "https://YOUR_APP_RUNNER_URL/search?user_id=demo-user&q=migraine"
```

If that works, your production Vektori layer is live.

---

## 13. What to expect if something breaks

Here are the most common issues and what they mean:

### Problem: App Runner service crashes

Usually this means:

- the container failed to start
- the app could not connect to the database
- the environment variable is wrong

### Problem: Health endpoint returns an error

Usually this means:

- the service is not running
- the port is wrong
- the app is failing on startup

### Problem: Search returns nothing

Usually this means:

- the database is empty
- the add endpoint did not save data
- the database connection string is wrong

### Problem: Web app says Vektori is disabled

Usually this means:

- the web app environment variables are missing
- the service URL is incorrect
- the app was not redeployed after the change

---

## 14. Security basics you should not skip

Before going live, make sure you have:

- a strong API key
- HTTPS enabled by default
- database credentials stored securely
- logs enabled
- backups enabled for the database

If you are unsure about security, start with this minimum:

- do not use `testkey` in production
- do not leave the database password in plain text in code
- do not expose the database publicly unless absolutely necessary

---

## 15. The simplest production checklist

Use this checklist:

- [ ] Install Docker
- [ ] Create the FastAPI app locally
- [ ] Test it locally
- [ ] Create a Dockerfile
- [ ] Build the Docker image
- [ ] Create an RDS PostgreSQL database
- [ ] Create an ECR repository
- [ ] Push the Docker image to ECR
- [ ] Create an App Runner service
- [ ] Add environment variables
- [ ] Copy the App Runner URL
- [ ] Update the web app env vars
- [ ] Redeploy the web app
- [ ] Test `/health`, `/add`, and `/search`

---

## 16. Recommended next step

If you want the most practical next step, build this in a very simple way first:

- a FastAPI API
- one PostgreSQL table
- three endpoints: health, add, search
- deployed on App Runner

That is enough to get production working without overcomplicating the setup.

If you want, the next step can be to turn this into a ready-to-copy project structure for your repo, including:

- a complete FastAPI service folder
- a Dockerfile
- a requirements file
- a deployment-ready README
