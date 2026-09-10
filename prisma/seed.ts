import { PrismaClient } from "@prisma/client";
import { execSync } from "child_process";
import dotenv from "dotenv";

dotenv.config();

if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = "file:./dev.db";
}

const prisma = new PrismaClient();

async function ensureTablesExist() {
  try {
    await prisma.user.findFirst();
  } catch (err: unknown) {
    const error = err as { code?: string; message?: string };
    if (error?.code === "P2021" || error?.message?.includes("does not exist")) {
      console.log("Database tables not yet initialized. Running prisma db push automatically...");
      const cli = process.versions.bun ? "bunx" : "npx";
      execSync(`${cli} prisma db push --skip-generate`, { stdio: "inherit" });
    }
  }
}

async function main() {
  // Seed data should only be used when in a dev environment
  if (process.env.NODE_ENV !== "development") {
    console.log(
      `Skipping seed data: NODE_ENV is "${process.env.NODE_ENV}", seed data is only populated when NODE_ENV is specifically set to "development".`,
    );
    return;
  }

  console.log("Seeding SQLite database via Prisma ORM engine...");

  await ensureTablesExist();

  // 1. Create or upsert test/demo user
  const user = await prisma.user.upsert({
    where: { email: "niklass.schaeffer@gmail.com" },
    update: {},
    create: {
      email: "niklass.schaeffer@gmail.com",
      username: "Niklass",
      avatarUrl:
        "https://www.gravatar.com/avatar/60b64d008544a42337d11345f1b1c368?s=100&d=identicon",
      provider: "local",
    },
  });

  console.log(`User seeded: ${user.email} (${user.id})`);

  // 2. Seed initial streamers
  const defaultStreamers = [
    {
      username: "tarik",
      displayName: "tarik",
      avatar:
        "https://images.unsplash.com/photo-1566492031773-4f4e44671857?w=150&auto=format&fit=crop&q=80",
      isLive: true,
      game: "VALORANT",
      viewerCount: 28410,
      points: 14850,
      watchStreak: 5,
      isMining: true,
      priority: 1,
      enabled: true,
      chestAvailable: false,
      nextChestEstimateSeconds: 42,
      totalPointsMined: 3200,
      lastClaimTime: new Date(Date.now() - 14 * 60000).toISOString(),
      uptimeMinutes: 340,
      userId: user.id,
    },
    {
      username: "shroud",
      displayName: "shroud",
      avatar:
        "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80",
      isLive: true,
      game: "Counter-Strike 2",
      viewerCount: 19820,
      points: 11200,
      watchStreak: 3,
      isMining: true,
      priority: 2,
      enabled: true,
      chestAvailable: true,
      nextChestEstimateSeconds: 0,
      totalPointsMined: 2450,
      lastClaimTime: new Date(Date.now() - 15 * 60000).toISOString(),
      uptimeMinutes: 215,
      userId: user.id,
    },
    {
      username: "xqcow",
      displayName: "xQc",
      avatar:
        "https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?w=150&auto=format&fit=crop&q=80",
      isLive: true,
      game: "Just Chatting",
      viewerCount: 42100,
      points: 24900,
      watchStreak: 12,
      isMining: false,
      priority: 3,
      enabled: true,
      chestAvailable: false,
      nextChestEstimateSeconds: 480,
      totalPointsMined: 950,
      lastClaimTime: new Date(Date.now() - 40 * 60000).toISOString(),
      uptimeMinutes: 520,
      userId: user.id,
    },
    {
      username: "pokimane",
      displayName: "pokimane",
      avatar:
        "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80",
      isLive: false,
      game: "Just Chatting",
      viewerCount: 0,
      points: 8450,
      watchStreak: 1,
      isMining: false,
      priority: 4,
      enabled: true,
      chestAvailable: false,
      nextChestEstimateSeconds: 900,
      totalPointsMined: 400,
      uptimeMinutes: 0,
      userId: user.id,
    },
    {
      username: "caedrel",
      displayName: "Caedrel",
      avatar:
        "https://images.unsplash.com/photo-1527980965255-d3b416303d12?w=150&auto=format&fit=crop&q=80",
      isLive: true,
      game: "League of Legends",
      viewerCount: 31250,
      points: 6200,
      watchStreak: 7,
      isMining: false,
      priority: 5,
      enabled: true,
      chestAvailable: false,
      nextChestEstimateSeconds: 310,
      totalPointsMined: 340,
      lastClaimTime: new Date(Date.now() - 65 * 60000).toISOString(),
      uptimeMinutes: 190,
      userId: user.id,
    },
    {
      username: "fps_shaka",
      displayName: "fps_shaka",
      avatar:
        "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80",
      isLive: false,
      game: "Apex Legends",
      viewerCount: 0,
      points: 15300,
      watchStreak: 0,
      isMining: false,
      priority: 6,
      enabled: false,
      chestAvailable: false,
      nextChestEstimateSeconds: 900,
      totalPointsMined: 0,
      uptimeMinutes: 0,
      userId: user.id,
    },
  ];

  for (const s of defaultStreamers) {
    const existingSeed = await prisma.streamer.findFirst({ where: { username: s.username } });
    if (existingSeed) continue;
    await prisma.streamer.create({ data: s });
  }
  console.log(`Seeded ${defaultStreamers.length} streamers into SQLite.`);

  // 3. Seed Miner Settings
  await prisma.minerSetting.upsert({
    where: { userId: user.id },
    update: {},
    create: {
      userId: user.id,
      authToken: "",
      clientId: "kimne78kx3ncx6brgo4mv6wki5h1ko",
      isSimulationMode: true,
      maxConcurrentStreams: 2,
      priorityMode: "points_asc",
      autoClaimBonus: true,
      claimDelaySeconds: 4,
      followRaids: true,
      autoClaimDrops: true,
      autoBetPredictions: true,
      predictionStrategy: "smart_ratio",
      maxBetPoints: 100,
      checkIntervalSeconds: 3,
    },
  });
  console.log("Seeded miner configuration in SQLite.");

  // 4. Seed Statistical Data (Past hourly points)
  const existingStats = await prisma.statisticalRecord.count();
  if (existingStats === 0) {
    const now = new Date();
    for (let i = 8; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 3600000);
      const hourStr = d.getHours().toString().padStart(2, "0") + ":00";
      const basePoints = Math.floor(180 + Math.random() * 220);
      const claims = Math.floor(basePoints / 50);
      const raids = i === 2 ? 1 : 0;
      const predictions = i === 1 ? 1 : 0;
      const drops = i === 4 ? 1 : 0;

      await prisma.statisticalRecord.create({
        data: {
          userId: user.id,
          hourKey: hourStr,
          pointsMined: basePoints,
          claimsCount: claims,
          raidsCount: raids,
          predictionsWon: predictions,
          predictionsLost: 0,
          netPredictionPoints: predictions * 180,
          dropsCount: drops,
          chestsPoints: claims * 50,
          watchTimePoints: basePoints - claims * 50,
          recordedAt: d,
        },
      });
    }
    console.log("Seeded 9 hourly statistical records in SQLite.");
  }

  // 5. Seed initial log records
  const existingLogs = await prisma.logRecord.count();
  if (existingLogs === 0) {
    const defaultLogs = [
      {
        level: "INFO",
        channel: undefined,
        message: "Twitch Channel Points Miner SQLite DB initialized with Prisma ORM.",
      },
      {
        level: "INFO",
        channel: undefined,
        message: "Connected to local SQLite database file:./dev.db via Prisma.",
      },
      {
        level: "WATCH",
        channel: "tarik",
        message: "Assigned watch slot #1 to tarik (VALORANT, 28,410 viewers).",
      },
      {
        level: "WATCH",
        channel: "shroud",
        message: "Assigned watch slot #2 to shroud (Counter-Strike 2).",
      },
      {
        level: "CLAIM",
        channel: "shroud",
        message: "Claimed Community Points Bonus (+50 pts) via GraphQL claim mutation.",
        pointsDelta: 50,
      },
      {
        level: "RAID",
        channel: "tarik",
        message: "Streamer raided Kyedae (+250 points caught via RaidCommunityPoints)!",
        pointsDelta: 250,
      },
      {
        level: "PREDICTION",
        channel: "tarik",
        message:
          'Prediction matched "Will Tarik drop 30k?": Bet 100 points, Won 280 points (+180 net).',
        pointsDelta: 180,
      },
    ];

    for (const log of defaultLogs) {
      await prisma.logRecord.create({
        data: {
          level: log.level,
          channel: log.channel,
          message: log.message,
          pointsDelta: log.pointsDelta,
          userId: user.id,
        },
      });
    }
    console.log("Seeded initial log records in SQLite.");
  }

  console.log("Prisma seeding completed successfully.");
}

main()
  .catch((e) => {
    console.error("Error during seeding:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
