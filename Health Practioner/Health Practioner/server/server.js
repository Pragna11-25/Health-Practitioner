require("dotenv").config();
const fs = require("fs");
const path = require("path");
const http = require("http");
const express = require("express");
const { MongoClient, ObjectId } = require("mongodb");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const multer = require("multer");
const { Server } = require("socket.io");

const app = express();

let users;
let conversations;
let messages;
let socketIo = null;

const signToken = (payload) => jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || "7d" });
const toId = (value) => {
  try {
    return new ObjectId(value);
  } catch (err) {
    throw new Error(`Invalid ObjectId format: ${value}`);
  }
};

const auth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
    if (!token) return res.status(401).json({ message: "Unauthorized" });

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await users.findOne({ _id: toId(decoded.userId) }, { projection: { password: 0 } });
    if (!user) return res.status(401).json({ message: "Invalid user" });
    req.user = user;
    return next();
  } catch (_err) {
    return res.status(401).json({ message: "Invalid or expired token" });
  }
};

app.use(helmet());
const allowedOrigins = new Set([
  ...(process.env.CLIENT_ORIGIN || "http://localhost:5173").split(",").map((origin) => origin.trim()).filter(Boolean),
  "http://127.0.0.1:5173",
  "http://0.0.0.0:5173",
]);
console.log("Allowed CORS origins:", Array.from(allowedOrigins));

// Handle CORS preflight responses explicitly so browsers receive correct headers.
app.use((req, res, next) => {
  if (req.method !== "OPTIONS") return next();
  const origin = req.headers.origin;
  if (!origin || allowedOrigins.has(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin || "");
    res.setHeader("Access-Control-Allow-Credentials", "true");
    res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type,Authorization");
    return res.sendStatus(204);
  }
  console.warn(`Blocked CORS preflight from origin: ${origin}`);
  return res.sendStatus(403);
});
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.has(origin)) return callback(null, true);
      return callback(new Error(`CORS origin not allowed: ${origin}`));
    },
    credentials: true,
  })
);
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(rateLimit({ windowMs: 15 * 60 * 1000, max: 300 }));

const uploadDir = path.resolve("uploads");
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
app.use("/uploads", express.static(uploadDir));

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => cb(null, `${Date.now()}-${file.originalname.replace(/[^a-zA-Z0-9_.-]/g, "_")}`),
});
const upload = multer({ storage, limits: { fileSize: Number(process.env.MAX_FILE_SIZE_MB || 20) * 1024 * 1024 } });

const buildMessagePreview = (text, attachments) => {
  const t = (text || "").trim();
  if (t) return t.length > 100 ? `${t.slice(0, 100)}…` : t;
  if (!attachments?.length) return "Message";
  const cat = attachments[0].fileCategory || "other";
  if (cat === "image") return "Photo";
  if (cat === "video") return "Video";
  if (cat === "audio") return "Voice note";
  if (cat === "document") return "Document";
  if (cat === "dicom") return "Medical image";
  return "Attachment";
};

const DELETED_PLACEHOLDER = "This message has been deleted";

const serializeMessage = (m, senderMap) => ({
  _id: m._id.toString(),
  conversationId: m.conversationId.toString(),
  senderId: senderMap.get(m.senderId.toString()) || { _id: m.senderId.toString(), fullName: "Unknown", role: "patient" },
  text: m.deleted ? "" : m.text || "",
  attachments: m.deleted ? [] : m.attachments || [],
  createdAt: m.createdAt,
  deleted: Boolean(m.deleted),
  deletedAt: m.deletedAt || null,
  deletedPlaceholder: m.deleted ? DELETED_PLACEHOLDER : null,
});

const refreshConversationLastMessage = async (convDoc) => {
  const convId = convDoc._id;
  const last = await messages
    .find({ conversationId: convId, deleted: { $ne: true } })
    .sort({ createdAt: -1 })
    .limit(1)
    .toArray();
  const now = new Date();
  if (last.length > 0) {
    const m = last[0];
    const preview = buildMessagePreview(m.text, m.attachments);
    await conversations.updateOne(
      { _id: convId },
      { $set: { lastMessageAt: m.createdAt, lastMessagePreview: preview, lastMessageSenderId: m.senderId, updatedAt: now } }
    );
  } else {
    await conversations.updateOne(
      { _id: convId },
      {
        $set: {
          lastMessagePreview: "",
          lastMessageAt: convDoc.createdAt || now,
          lastMessageSenderId: null,
          updatedAt: now,
        },
      }
    );
  }
};

const softDeleteMessageForUser = async (messageId, userId) => {
  try {
    const msg = await messages.findOne({ _id: toId(messageId) });
    if (!msg) return { ok: false, status: 404, message: "Message not found" };
    if (msg.senderId.toString() !== userId.toString()) return { ok: false, status: 403, message: "You can only delete your own messages" };
    if (msg.deleted) return { ok: true, status: 200, already: true, conversationId: msg.conversationId.toString(), messageId: msg._id.toString() };

    const conv = await conversations.findOne({ _id: msg.conversationId });
    if (!conv || !conv.participants.some((id) => id.toString() === userId.toString())) {
      return { ok: false, status: 403, message: "Conversation access denied" };
    }

    const now = new Date();
    await messages.updateOne(
      { _id: msg._id },
      { $set: { deleted: true, deletedAt: now, text: "", attachments: [], updatedAt: now } }
    );

    await refreshConversationLastMessage(conv);

    return { ok: true, status: 200, conversationId: msg.conversationId.toString(), messageId: msg._id.toString(), deletedAt: now };
  } catch (err) {
    console.error("softDeleteMessageForUser error:", err);
    return { ok: false, status: 400, message: "Failed to delete message" };
  }
};

const enrichConversationForUser = async (conv, currentUserId) => {
  const me = currentUserId.toString();
  const allIds = [...new Set(conv.participants.map((id) => id.toString()))];
  const people = await users
    .find({ _id: { $in: allIds.map((id) => toId(id)) } }, { projection: { fullName: 1, role: 1, specialization: 1 } })
    .toArray();
  const personMap = new Map(
    people.map((p) => [
      p._id.toString(),
      { _id: p._id.toString(), fullName: p.fullName, role: p.role, specialization: p.specialization || "" },
    ])
  );

  const readAtByUser = conv.readAtByUser || {};
  const myLastRead = readAtByUser[me] ? new Date(readAtByUser[me]) : new Date(0);
  const unreadCount = await messages.countDocuments({
    conversationId: conv._id,
    senderId: { $ne: currentUserId },
    deleted: { $ne: true },
    createdAt: { $gt: myLastRead },
  });

  const lastSenderId = conv.lastMessageSenderId ? conv.lastMessageSenderId.toString() : null;

  return {
    _id: conv._id.toString(),
    participants: conv.participants.map((id) => personMap.get(id.toString())).filter(Boolean),
    lastMessageAt: conv.lastMessageAt,
    lastMessagePreview: conv.lastMessagePreview || "",
    lastMessageSenderId: lastSenderId,
    unreadCount,
  };
};

app.get("/api/health", (_req, res) => res.json({ status: "ok" }));

app.post("/api/auth/register", async (req, res) => {
  try {
    const { role, fullName, email, password } = req.body;
    if (!["patient", "practitioner"].includes(role)) return res.status(400).json({ message: "Invalid role" });

    const normalizedEmail = (email || "").toLowerCase().trim();
    const existing = await users.findOne({ email: normalizedEmail });
    if (existing) return res.status(409).json({ message: "Email already in use" });

    const hash = await bcrypt.hash(password, 12);
    const now = new Date();
    const result = await users.insertOne({
      role,
      fullName: (fullName || "").trim(),
      email: normalizedEmail,
      password: hash,
      phone: "",
      specialization: "",
      age: null,
      gender: "",
      bio: "",
      createdAt: now,
      updatedAt: now,
    });

    const user = await users.findOne({ _id: result.insertedId });
    const token = signToken({ userId: user._id.toString(), role: user.role });
    return res.status(201).json({ token, user: { id: user._id.toString(), fullName: user.fullName, email: user.email, role: user.role } });
  } catch (err) {
    console.error("Registration error:", err);
    return res.status(500).json({ message: "Registration failed" });
  }
});

app.post("/api/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    const normalizedEmail = (email || "").toLowerCase().trim();
    const user = await users.findOne({ email: normalizedEmail });
    if (!user) return res.status(401).json({ message: "Invalid credentials" });

    const ok = await bcrypt.compare(password, user.password);
    if (!ok) return res.status(401).json({ message: "Invalid credentials" });

    const token = signToken({ userId: user._id.toString(), role: user.role });
    return res.json({ token, user: { id: user._id.toString(), fullName: user.fullName, email: user.email, role: user.role } });
  } catch (_err) {
    return res.status(500).json({ message: "Login failed" });
  }
});

app.get("/api/users/me", auth, (req, res) => {
  const safeUser = { ...req.user };
  delete safeUser.password;
  safeUser._id = safeUser._id.toString();
  return res.json({ user: safeUser });
});

app.patch("/api/users/me", auth, async (req, res) => {
  try {
    const allow = ["fullName", "phone", "specialization", "age", "gender", "bio"];
    const updates = {};
    allow.forEach((f) => {
      if (req.body[f] !== undefined) updates[f] = req.body[f];
    });
    updates.updatedAt = new Date();

    await users.updateOne({ _id: req.user._id }, { $set: updates });
    const user = await users.findOne({ _id: req.user._id }, { projection: { password: 0 } });
    user._id = user._id.toString();
    return res.json({ user });
  } catch (_err) {
    return res.status(500).json({ message: "Profile update failed" });
  }
});

app.get("/api/users/role/:role", auth, async (req, res) => {
  const { role } = req.params;
  if (!["patient", "practitioner"].includes(role)) return res.status(400).json({ message: "Invalid role filter" });

  const docs = await users
    .find({ role }, { projection: { fullName: 1, role: 1, specialization: 1, email: 1 } })
    .sort({ fullName: 1 })
    .toArray();

  return res.json({
    users: docs.map((u) => ({
      _id: u._id.toString(),
      fullName: u.fullName,
      role: u.role,
      specialization: u.specialization || "",
      email: u.email,
    })),
  });
});

app.post("/api/chat/conversations", auth, async (req, res) => {
  try {
    const { partnerId } = req.body;
    if (!partnerId) return res.status(400).json({ message: "partnerId is required" });

    const me = req.user._id.toString();
    const partner = partnerId.toString();
    const pairKey = [me, partner].sort().join(":");

    let conversation = await conversations.findOne({ pairKey });
    if (!conversation) {
      const now = new Date();
      const result = await conversations.insertOne({
        pairKey,
        participants: [toId(me), toId(partner)],
        lastMessageAt: now,
        lastMessagePreview: "",
        readAtByUser: {},
        createdAt: now,
        updatedAt: now,
      });
      conversation = await conversations.findOne({ _id: result.insertedId });
    }

    const payload = await enrichConversationForUser(conversation, req.user._id);
    return res.json({ conversation: payload });
  } catch (_err) {
    return res.status(500).json({ message: "Unable to open conversation" });
  }
});

app.get("/api/chat/conversations", auth, async (req, res) => {
  const convDocs = await conversations.find({ participants: req.user._id }).sort({ lastMessageAt: -1 }).toArray();
  const enriched = await Promise.all(convDocs.map((c) => enrichConversationForUser(c, req.user._id)));
  return res.json({ conversations: enriched });
});

app.get("/api/chat/messages/:conversationId", auth, async (req, res) => {
  const conversation = await conversations.findOne({ _id: toId(req.params.conversationId) });
  if (!conversation || !conversation.participants.some((id) => id.toString() === req.user._id.toString())) {
    return res.status(403).json({ message: "Conversation access denied" });
  }

  const now = new Date();
  await conversations.updateOne(
    { _id: conversation._id },
    { $set: { [`readAtByUser.${req.user._id.toString()}`]: now, updatedAt: now } }
  );

  const docs = await messages.find({ conversationId: conversation._id }).sort({ createdAt: 1 }).toArray();
  const senderIds = [...new Set(docs.map((m) => m.senderId.toString()))];
  const senders = await users
    .find({ _id: { $in: senderIds.map((id) => toId(id)) } }, { projection: { fullName: 1, role: 1 } })
    .toArray();
  const senderMap = new Map(senders.map((s) => [s._id.toString(), { _id: s._id.toString(), fullName: s.fullName, role: s.role }]));

  return res.json({
    messages: docs.map((m) => serializeMessage(m, senderMap)),
  });
});

app.delete("/api/chat/messages/:messageId", auth, async (req, res) => {
  try {
    const result = await softDeleteMessageForUser(req.params.messageId, req.user._id);
    if (!result.ok) return res.status(result.status).json({ message: result.message });
    if (!result.already) {
      socketIo?.to(result.conversationId).emit("message_deleted", {
        messageId: result.messageId,
        conversationId: result.conversationId,
        deletedAt: result.deletedAt,
      });
    }
    const conv = await conversations.findOne({ _id: toId(result.conversationId) });
    const enriched = conv ? await enrichConversationForUser(conv, req.user._id) : null;
    return res.json({ ok: true, deletedAt: result.deletedAt || null, conversation: enriched });
  } catch (err) {
    console.error("Delete message error:", err);
    return res.status(400).json({ message: err.message || "Failed to delete message" });
  }
});

app.post("/api/upload", auth, upload.single("file"), (req, res) => {
  if (!req.file) return res.status(400).json({ message: "File is required" });
  const lower = req.file.originalname.toLowerCase();
  let fileCategory = "other";
  if (req.file.mimetype.startsWith("image/")) fileCategory = "image";
  else if (req.file.mimetype.startsWith("video/") || lower.match(/\.(mp4|webm|mov|mkv)$/)) fileCategory = "video";
  else if (req.file.mimetype.startsWith("audio/") || lower.match(/\.(mp3|wav|ogg|webm)$/)) fileCategory = "audio";
  else if (req.file.mimetype === "application/dicom" || lower.endsWith(".dcm")) fileCategory = "dicom";
  else if (req.file.mimetype.includes("pdf") || req.file.mimetype.includes("word") || req.file.mimetype.includes("text")) fileCategory = "document";

  return res.status(201).json({
    attachment: {
      originalName: req.file.originalname,
      fileName: req.file.filename,
      mimeType: req.file.mimetype,
      size: req.file.size,
      fileUrl: `/uploads/${req.file.filename}`,
      fileCategory,
    },
  });
});

app.use((err, _req, res, _next) => {
  console.error("Unhandled error:", err);
  if (err.code === "LIMIT_FILE_SIZE") return res.status(413).json({ message: "File exceeds upload size limit" });
  return res.status(500).json({ message: "Unexpected server error" });
});

const start = async () => {
  const client = new MongoClient(process.env.MONGODB_URI);
  await client.connect();
  const database = client.db();
  users = database.collection("users");
  conversations = database.collection("conversations");
  messages = database.collection("messages");

  // Backfill legacy conversation rows created before pairKey existed.
  const legacyConversations = await conversations
    .find({
      $or: [{ pairKey: { $exists: false } }, { pairKey: null }],
      participants: { $type: "array" },
    })
    .toArray();

  for (const conv of legacyConversations) {
    if (!Array.isArray(conv.participants) || conv.participants.length !== 2) continue;
    const ids = conv.participants.map((id) => id.toString()).sort();
    const pairKey = `${ids[0]}:${ids[1]}`;
    await conversations.updateOne({ _id: conv._id }, { $set: { pairKey, updatedAt: new Date() } });
  }

  await users.createIndex({ email: 1 }, { unique: true });
  // Replace old unique index to avoid crashes from historical null pairKey values.
  try {
    await conversations.dropIndex("pairKey_1");
  } catch (_err) {
    // Ignore "index not found" and continue.
  }
  await conversations.createIndex(
    { pairKey: 1 },
    { unique: true, partialFilterExpression: { pairKey: { $type: "string" } } }
  );
  await conversations.createIndex({ participants: 1 });
  await messages.createIndex({ conversationId: 1, createdAt: 1 });

  const server = http.createServer(app);
  const io = new Server(server, { cors: { origin: process.env.CLIENT_ORIGIN, credentials: true } });
  socketIo = io;

  io.use((socket, next) => {
    try {
      const decoded = jwt.verify(socket.handshake.auth?.token, process.env.JWT_SECRET);
      socket.user = decoded;
      next();
    } catch (_err) {
      next(new Error("Unauthorized socket"));
    }
  });

  io.on("connection", (socket) => {
    socket.on("join_conversation", (conversationId) => socket.join(conversationId));
    socket.on("send_message", async ({ conversationId, text, attachments = [] }) => {
      const conv = await conversations.findOne({ _id: toId(conversationId) });
      if (!conv || !conv.participants.some((id) => id.toString() === socket.user.userId)) return;

      const now = new Date();
      const payload = {
        conversationId: conv._id,
        senderId: toId(socket.user.userId),
        text: text || "",
        attachments: Array.isArray(attachments) ? attachments : [],
        deleted: false,
        createdAt: now,
        updatedAt: now,
      };
      const inserted = await messages.insertOne(payload);
      const preview = buildMessagePreview(payload.text, payload.attachments);
      await conversations.updateOne(
        { _id: conv._id },
        {
          $set: {
            lastMessageAt: now,
            lastMessagePreview: preview,
            lastMessageSenderId: toId(socket.user.userId),
            updatedAt: now,
          },
        }
      );
      const sender = await users.findOne({ _id: toId(socket.user.userId) }, { projection: { fullName: 1, role: 1 } });

      io.to(conversationId).emit("new_message", {
        _id: inserted.insertedId.toString(),
        conversationId: conv._id.toString(),
        senderId: { _id: socket.user.userId, fullName: sender?.fullName || "Unknown", role: sender?.role || "patient" },
        text: payload.text,
        attachments: payload.attachments,
        createdAt: now,
        deleted: false,
        lastMessagePreview: preview,
        lastMessageSenderId: socket.user.userId,
      });
    });

    socket.on("delete_message", async ({ conversationId, messageId }) => {
      if (!conversationId || !messageId) return;
      const conv = await conversations.findOne({ _id: toId(conversationId) });
      if (!conv || !conv.participants.some((id) => id.toString() === socket.user.userId)) return;
      const result = await softDeleteMessageForUser(messageId, socket.user.userId);
      if (!result.ok || result.already) return;
      io.to(result.conversationId).emit("message_deleted", {
        messageId: result.messageId,
        conversationId: result.conversationId,
        deletedAt: result.deletedAt,
      });
    });
  });

  const PORT = process.env.PORT || 5000;
  server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
};

start().catch((err) => {
  console.error("Server startup failed:", err.message);
  process.exit(1);
});
