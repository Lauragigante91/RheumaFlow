#!/bin/bash
export PATH="$HOME/.nix-profile/bin:/nix/var/nix/profiles/default/bin:$PATH"

pkill -f "yarn start" 2>/dev/null || true
pkill -f "craco" 2>/dev/null || true
pkill -f "uvicorn server:app" 2>/dev/null || true
pkill -f "mongod --dbpath" 2>/dev/null || true
pkill -f "PORTFWD35" 2>/dev/null || true
sleep 2

MONGO_DATA=/home/runner/workspace/data/mongodb
mkdir -p "$MONGO_DATA"
mongod --dbpath "$MONGO_DATA" --port 27017 --bind_ip 127.0.0.1 --logpath /tmp/mongodb.log --fork

pip install -q \
  uvicorn fastapi python-dotenv motor pymongo \
  pydantic python-jose passlib bcrypt PyJWT \
  httpx openai aiohttp email-validator \
  python-multipart openpyxl \
  pypdf pymupdf pdfplumber pytesseract 2>/dev/null || true

cd /home/runner/workspace/backend
uvicorn server:app --host 0.0.0.0 --port 8000 --log-level info > /tmp/uvicorn.log 2>&1 &
echo "Backend started"

node -e 'const TAG="PORTFWD35";const net=require("net");const s=net.createServer(c=>{const u=net.connect(5000,"127.0.0.1");c.on("error",()=>u.destroy());u.on("error",()=>c.destroy());c.pipe(u);u.pipe(c);});s.on("error",()=>{});s.listen(3000,"0.0.0.0");' &
echo "Port forwarder 3000->5000 started"

cd /home/runner/workspace/frontend
HOST=0.0.0.0 PORT=5000 yarn start
