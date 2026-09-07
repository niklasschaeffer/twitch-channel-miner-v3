-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "password" TEXT,
    "avatarUrl" TEXT,
    "provider" TEXT NOT NULL DEFAULT 'local',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Streamer" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT,
    "username" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "avatar" TEXT NOT NULL,
    "game" TEXT NOT NULL DEFAULT 'Variety Stream',
    "viewerCount" INTEGER NOT NULL DEFAULT 0,
    "points" INTEGER NOT NULL DEFAULT 0,
    "watchStreak" INTEGER NOT NULL DEFAULT 0,
    "isMining" BOOLEAN NOT NULL DEFAULT false,
    "isLive" BOOLEAN NOT NULL DEFAULT true,
    "priority" INTEGER NOT NULL DEFAULT 1,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "chestAvailable" BOOLEAN NOT NULL DEFAULT false,
    "nextChestEstimateSeconds" INTEGER NOT NULL DEFAULT 900,
    "totalPointsMined" INTEGER NOT NULL DEFAULT 0,
    "lastClaimTime" TEXT,
    "uptimeMinutes" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Streamer_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "StatisticalRecord" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT,
    "hourKey" TEXT NOT NULL,
    "pointsMined" INTEGER NOT NULL DEFAULT 0,
    "claimsCount" INTEGER NOT NULL DEFAULT 0,
    "raidsCount" INTEGER NOT NULL DEFAULT 0,
    "predictionsWon" INTEGER NOT NULL DEFAULT 0,
    "predictionsLost" INTEGER NOT NULL DEFAULT 0,
    "netPredictionPoints" INTEGER NOT NULL DEFAULT 0,
    "dropsCount" INTEGER NOT NULL DEFAULT 0,
    "chestsPoints" INTEGER NOT NULL DEFAULT 0,
    "watchTimePoints" INTEGER NOT NULL DEFAULT 0,
    "recordedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "StatisticalRecord_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MinerSetting" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT,
    "authToken" TEXT NOT NULL DEFAULT '',
    "clientId" TEXT NOT NULL DEFAULT 'kimne78kx3ncx6brgo4mv6wki5h1ko',
    "isSimulationMode" BOOLEAN NOT NULL DEFAULT true,
    "maxConcurrentStreams" INTEGER NOT NULL DEFAULT 2,
    "priorityMode" TEXT NOT NULL DEFAULT 'points_asc',
    "autoClaimBonus" BOOLEAN NOT NULL DEFAULT true,
    "claimDelaySeconds" INTEGER NOT NULL DEFAULT 4,
    "followRaids" BOOLEAN NOT NULL DEFAULT true,
    "autoClaimDrops" BOOLEAN NOT NULL DEFAULT true,
    "autoBetPredictions" BOOLEAN NOT NULL DEFAULT true,
    "predictionStrategy" TEXT NOT NULL DEFAULT 'smart_ratio',
    "maxBetPoints" INTEGER NOT NULL DEFAULT 100,
    "checkIntervalSeconds" INTEGER NOT NULL DEFAULT 3,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "MinerSetting_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "LogRecord" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT,
    "level" TEXT NOT NULL,
    "channel" TEXT,
    "message" TEXT NOT NULL,
    "pointsDelta" INTEGER,
    "timestamp" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "LogRecord_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Streamer_username_key" ON "Streamer"("username");

-- CreateIndex
CREATE UNIQUE INDEX "MinerSetting_userId_key" ON "MinerSetting"("userId");
