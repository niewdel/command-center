# Railway honors a Dockerfile over Railpack/Nixpacks. We need apt-installed
# Chromium + system libs so Playwright can launch headless browsers for the
# site-audit module.

FROM node:20-slim

# Chromium + system libraries Playwright needs
RUN apt-get update && apt-get install -y --no-install-recommends \
    chromium \
    fonts-liberation \
    libgbm1 \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libcups2 \
    libdbus-1-3 \
    libdrm2 \
    libnspr4 \
    libnss3 \
    libx11-xcb1 \
    libxcomposite1 \
    libxdamage1 \
    libxrandr2 \
    libxshmfence1 \
    libxkbcommon0 \
  && rm -rf /var/lib/apt/lists/*

# Skip Playwright's bundled chromium download — use the apt-installed one
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
ENV PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --include=dev

COPY . .

RUN npm run build

EXPOSE 3000
CMD ["npm", "run", "start"]
