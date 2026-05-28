import { useCallback, useEffect, useRef, useState } from "react";
import { BrowserRouter, Navigate, Route, Routes, Link, useNavigate, useLocation } from "react-router-dom";
import axios from "axios";
import { io } from "socket.io-client";

// Robust env-aware API selection for production builds
const _defaultApi = typeof window !== "undefined" && window.location.hostname === "localhost" ? "http://localhost:5000/api" : "https://health-practitioner.onrender.com/api";
const _defaultSocket = typeof window !== "undefined" && window.location.hostname === "localhost" ? "http://localhost:5000" : "https://health-practitioner.onrender.com";
const API = import.meta.env.VITE_API_URL || _defaultApi;
const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || _defaultSocket;
const API_HOST = API.replace(/\/api\/?$/, "");

const http = axios.create({ baseURL: API });
http.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

function formatListTime(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const isYesterday = d.toDateString() === yesterday.toDateString();
  if (isToday) return d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  if (isYesterday) return "Yesterday";
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function formatBubbleTime(iso) {
  if (!iso) return "";
  return new Date(iso).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

const DELETED_MSG_LABEL = "This message has been deleted";

function ChatAttachment({ att, baseUrl }) {
  const href = att.fileUrl?.startsWith("http") ? att.fileUrl : `${baseUrl}${att.fileUrl}`;
  const label = att.originalName || "File";
  if (att.fileCategory === "image") {
    return (
      <a className="chat-attachment chat-attachment--image" href={href} target="_blank" rel="noreferrer">
        <img src={href} alt={label} loading="lazy" />
        <span className="visually-hidden">{label}</span>
      </a>
    );
  }
  if (att.fileCategory === "video") {
    return (
      <div className="chat-attachment chat-attachment--media">
        <video controls preload="metadata" src={href} />
        <a className="chat-attachment__link" href={href} target="_blank" rel="noreferrer">
          {label}
        </a>
      </div>
    );
  }
  if (att.fileCategory === "audio") {
    return (
      <div className="chat-attachment chat-attachment--media chat-attachment--audio">
        <audio controls src={href} />
        <a className="chat-attachment__link" href={href} target="_blank" rel="noreferrer">
          {label}
        </a>
      </div>
    );
  }
  return (
    <a className="chat-attachment chat-attachment--file" href={href} target="_blank" rel="noreferrer">
      <span className="chat-attachment__icon" aria-hidden>
        {att.fileCategory === "dicom" ? "◈" : att.fileCategory === "document" ? "📄" : "📎"}
      </span>
      <span className="chat-attachment__meta">
        <span className="chat-attachment__name">{label}</span>
        <span className="chat-attachment__type">{att.fileCategory}</span>
      </span>
    </a>
  );
}

function ChatMessageRow({ m, user, baseUrl, onDelete }) {
  const mine = m.senderId?._id === user._id;
  const deleted = Boolean(m.deleted);
  const [menuOpen, setMenuOpen] = useState(false);
  const wrapRef = useRef(null);
  const longPressTimer = useRef(null);

  useEffect(() => {
    if (!menuOpen) return undefined;
    const onDocClick = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setMenuOpen(false);
    };
    document.addEventListener("click", onDocClick, true);
    return () => document.removeEventListener("click", onDocClick, true);
  }, [menuOpen]);

  const confirmAndDelete = () => {
    if (!window.confirm("Delete this message for everyone in the chat? The content will be removed.")) return;
    void onDelete(m._id);
    setMenuOpen(false);
  };

  const startLongPress = () => {
    if (!mine || deleted) return;
    clearTimeout(longPressTimer.current);
    longPressTimer.current = setTimeout(() => {
      longPressTimer.current = null;
      setMenuOpen(true);
    }, 550);
  };

  const cancelLongPress = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  return (
    <article
      ref={wrapRef}
      className={`chat-msg ${mine ? "chat-msg--mine" : "chat-msg--theirs"} ${mine && !deleted ? "chat-msg--actions" : ""}`}
      onTouchStart={startLongPress}
      onTouchEnd={cancelLongPress}
      onTouchMove={cancelLongPress}
    >
      {mine && !deleted ? (
        <div className="chat-msg__toolbar">
          <button
            type="button"
            className="chat-msg__menu-trigger"
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            aria-label="Message options"
            onClick={(e) => {
              e.stopPropagation();
              setMenuOpen((o) => !o);
            }}
          >
            ⋮
          </button>
          {menuOpen ? (
            <div className="chat-msg__dropdown" role="menu">
              <button type="button" className="chat-msg__dropdown-item" role="menuitem" onClick={confirmAndDelete}>
                Delete for everyone
              </button>
            </div>
          ) : null}
          <button
            type="button"
            className="chat-msg__delete-hover"
            aria-label="Delete message"
            title="Delete message"
            onClick={(e) => {
              e.stopPropagation();
              confirmAndDelete();
            }}
          >
            Delete
          </button>
        </div>
      ) : null}

      <div className={`chat-msg__bubble ${deleted ? "chat-msg__bubble--deleted" : ""}`}>
        {!mine && <span className="chat-msg__sender">{m.senderId?.fullName || "Participant"}</span>}
        {deleted ? (
          <p className="chat-msg__deleted">{m.deletedPlaceholder || DELETED_MSG_LABEL}</p>
        ) : (
          <>
            {m.text ? <p className="chat-msg__text">{m.text}</p> : null}
            {m.attachments?.length ? m.attachments.map((a) => <ChatAttachment key={a.fileName} att={a} baseUrl={API_HOST} />) : null}
          </>
        )}
        <time className="chat-msg__time" dateTime={m.createdAt}>
          {mine ? "You · " : ""}
          {formatBubbleTime(m.createdAt)}
        </time>
      </div>
    </article>
  );
}

function Login({ onAuth }) {
  const nav = useNavigate();
  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState("");
  const submit = async (e) => {
    e.preventDefault();
    try {
      const { data } = await http.post("/auth/login", form);
      onAuth(data);
      nav("/dashboard");
    } catch (err) {
      setError(err.response?.data?.message || "Login failed");
    }
  };
  return (
    <main className="auth-wrap">
      <form className="card auth-form" onSubmit={submit}>
        <h1>Patient-Practitioner Hub</h1>
        <p>Secure teleconsultation communication</p>
        {error && <p className="error">{error}</p>}
        <label>Email</label>
        <input type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        <label>Password</label>
        <input type="password" required value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
        <button type="submit">Login</button>
        <small>Need an account? <Link to="/register">Register</Link></small>
      </form>
    </main>
  );
}

function Register({ onAuth }) {
  const nav = useNavigate();
  const [form, setForm] = useState({ role: "patient", fullName: "", email: "", password: "" });
  const [error, setError] = useState("");
  const submit = async (e) => {
    e.preventDefault();
    try {
      const { data } = await http.post("/auth/register", form);
      onAuth(data);
      nav("/dashboard");
    } catch (err) {
      setError(err.response?.data?.message || "Registration failed");
    }
  };
  return (
    <main className="auth-wrap">
      <form className="card auth-form" onSubmit={submit}>
        <h1>Create Secure Account</h1>
        {error && <p className="error">{error}</p>}
        <label>Role</label>
        <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
          <option value="patient">Patient</option>
          <option value="practitioner">Practitioner</option>
        </select>
        <label>Full name</label>
        <input required value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} />
        <label>Email</label>
        <input type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        <label>Password</label>
        <input type="password" minLength={8} required value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
        <button type="submit">Register</button>
      </form>
    </main>
  );
}

function Profile({ user, reloadUser }) {
  const [form, setForm] = useState({ fullName: "", phone: "", specialization: "", age: "", gender: "", bio: "" });
  const [saved, setSaved] = useState(false);
  useEffect(() => {
    if (!user) return;
    setForm({
      fullName: user.fullName || "",
      phone: user.phone || "",
      specialization: user.specialization || "",
      age: user.age || "",
      gender: user.gender || "",
      bio: user.bio || "",
    });
  }, [user]);
  const submit = async (e) => {
    e.preventDefault();
    await http.patch("/users/me", { ...form, age: form.age ? Number(form.age) : undefined });
    await reloadUser();
    setSaved(true);
  };
  return (
    <main className="auth-wrap">
      <form className="card auth-form" onSubmit={submit}>
        <h1>Profile Management</h1>
        {saved && <p className="ok">Profile updated securely</p>}
        <label>Full name</label>
        <input value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} />
        <label>Phone</label>
        <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
        {user?.role === "practitioner" && <>
          <label>Specialization</label>
          <input value={form.specialization} onChange={(e) => setForm({ ...form, specialization: e.target.value })} />
        </>}
        <label>Age</label>
        <input type="number" value={form.age} onChange={(e) => setForm({ ...form, age: e.target.value })} />
        <label>Gender</label>
        <input value={form.gender} onChange={(e) => setForm({ ...form, gender: e.target.value })} />
        <label>Bio</label>
        <textarea value={form.bio} onChange={(e) => setForm({ ...form, bio: e.target.value })} />
        <button>Save</button>
      </form>
    </main>
  );
}

function Dashboard({ user, onLogout }) {
  const [directory, setDirectory] = useState([]);
  const [conversations, setConversations] = useState([]);
  const [activeConversation, setActiveConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [file, setFile] = useState(null);
  const [sidebarTab, setSidebarTab] = useState("chats");
  const [searchChats, setSearchChats] = useState("");
  const [searchContacts, setSearchContacts] = useState("");
  const [mobileView, setMobileView] = useState("list");
  const token = localStorage.getItem("token");
  const socketRef = useRef(null);
  const activeConversationRef = useRef(null);
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);
  const videoInputRef = useRef(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingError, setRecordingError] = useState("");
  const [recordingSupported, setRecordingSupported] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const mediaRecorderRef = useRef(null);
  const recordedChunksRef = useRef([]);
  const recordingTimerRef = useRef(null);

  useEffect(() => {
    activeConversationRef.current = activeConversation;
  }, [activeConversation]);

  useEffect(() => {
    setRecordingSupported(Boolean(window?.MediaRecorder && navigator?.mediaDevices?.getUserMedia));
    return () => {
      if (mediaRecorderRef.current?.state === "recording") {
        mediaRecorderRef.current.stop();
      }
      if (recordingTimerRef.current) {
        window.clearInterval(recordingTimerRef.current);
      }
    };
  }, []);

  const formatRecordingTime = (seconds) => {
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes}:${secs.toString().padStart(2, "0")}`;
  };

  const getRecordingErrorMessage = (error) => {
    if (!error) return "Unable to start recording.";
    const name = error.name || "";
    if (name === "NotAllowedError" || name === "PermissionDeniedError") {
      return "Microphone access was denied. Please allow microphone permissions in your browser and try again.";
    }
    if (name === "NotFoundError" || name === "DevicesNotFoundError") {
      return "No microphone was found. Connect a microphone and try again.";
    }
    if (name === "NotReadableError" || name === "TrackStartError") {
      return "Unable to access your microphone. It may already be in use by another app.";
    }
    return error.message || "Unable to start recording.";
  };

  const finalizeRecording = async () => {
    const chunks = recordedChunksRef.current;
    if (!chunks.length) return;
    const blob = new Blob(chunks, { type: "audio/webm" });
    const voiceFile = new File([blob], `voice-${Date.now()}.webm`, { type: "audio/webm" });
    setFile(voiceFile);
    recordedChunksRef.current = [];
  };

  const stopRecording = () => {
    const recorder = mediaRecorderRef.current;
    if (!recorder) return;
    if (recorder.state === "recording") recorder.stop();
    mediaRecorderRef.current = null;
    setIsRecording(false);
    if (recordingTimerRef.current) {
      window.clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
  };

  const startRecording = async () => {
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error("Audio recording is not supported by your browser.");
      }
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      recordedChunksRef.current = [];
      const recorder = new MediaRecorder(stream);
      recorder.ondataavailable = (event) => {
        if (event.data?.size) recordedChunksRef.current.push(event.data);
      };
      recorder.onstop = async () => {
        stream.getTracks().forEach((track) => track.stop());
        await finalizeRecording();
      };
      recorder.onerror = () => {
        setRecordingError("Recording failed. Please try again.");
      };
      recorder.start();
      mediaRecorderRef.current = recorder;
      setIsRecording(true);
      setRecordingError("");
      setRecordingSeconds(0);
      recordingTimerRef.current = window.setInterval(() => {
        setRecordingSeconds((prev) => prev + 1);
      }, 1000);
    } catch (err) {
      setRecordingError(getRecordingErrorMessage(err));
      setIsRecording(false);
    }
  };

  useEffect(() => {
    if (!token) return undefined;

    const socket = io(SOCKET_URL, {
      auth: { token },
      transports: ["websocket", "polling"],
      reconnection: true,
    });
    socketRef.current = socket;

    return () => {
      socket.removeAllListeners();
      socket.disconnect();
      socketRef.current = null;
    };
  }, [token]);

  const refreshConversations = useCallback(async () => {
    const { data } = await http.get("/chat/conversations");
    setConversations(data.conversations);
  }, []);

  useEffect(() => {
    const boot = async () => {
      const role = user.role === "patient" ? "practitioner" : "patient";
      const [a, b] = await Promise.all([http.get(`/users/role/${role}`), http.get("/chat/conversations")]);
      setDirectory(a.data.users);
      setConversations(b.data.conversations);
    };
    boot().catch(() => {});
  }, [user.role]);

  useEffect(() => {
    if (!activeConversation?._id) return;
    http.get(`/chat/messages/${activeConversation._id}`).then((r) => {
      setMessages(r.data.messages);
      setConversations((prev) =>
        prev.map((c) => (c._id === activeConversation._id ? { ...c, unreadCount: 0 } : c))
      );
    });
    setMobileView("chat");
  }, [activeConversation?._id]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    const socket = socketRef.current;
    if (!socket) return undefined;

    const onNewMessage = (msg) => {
      const active = activeConversationRef.current;
      const normalized = { ...msg, deleted: Boolean(msg.deleted) };
      if (msg.conversationId === active?._id) {
        setMessages((prev) => [...prev, normalized]);
      }

      setConversations((prev) => {
        const idx = prev.findIndex((c) => c._id === msg.conversationId);
        if (idx === -1) {
          void refreshConversations();
          return prev;
        }
        const next = [...prev];
        const conv = { ...next[idx] };
        conv.lastMessageAt = msg.createdAt;
        conv.lastMessagePreview = msg.lastMessagePreview ?? conv.lastMessagePreview;
        conv.lastMessageSenderId = msg.lastMessageSenderId ?? msg.senderId?._id;
        const fromMe = msg.senderId?._id === user._id;
        const isOpen = active?._id === msg.conversationId;
        if (!isOpen && !fromMe) conv.unreadCount = (conv.unreadCount || 0) + 1;
        if (isOpen) conv.unreadCount = 0;
        next[idx] = conv;
        return next.sort((a, b) => new Date(b.lastMessageAt) - new Date(a.lastMessageAt));
      });
    };

    const onMessageDeleted = ({ messageId, conversationId, deletedAt }) => {
      if (conversationId === activeConversationRef.current?._id) {
        const ts =
          deletedAt != null ? new Date(deletedAt).toISOString() : new Date().toISOString();
        setMessages((prev) =>
          prev.map((msg) =>
            msg._id === messageId
              ? {
                  ...msg,
                  deleted: true,
                  text: "",
                  attachments: [],
                  deletedPlaceholder: DELETED_MSG_LABEL,
                  deletedAt: ts,
                }
              : msg
          )
        );
      }
      void refreshConversations();
    };

    socket.on("new_message", onNewMessage);
    socket.on("message_deleted", onMessageDeleted);
    return () => {
      socket.off("new_message", onNewMessage);
      socket.off("message_deleted", onMessageDeleted);
    };
  }, [user._id, refreshConversations]);

  const selectConversation = (c) => {
    setActiveConversation(c);
    socketRef.current?.emit("join_conversation", c._id);
  };

  const openConversation = async (partnerId) => {
    const { data } = await http.post("/chat/conversations", { partnerId });
    setActiveConversation(data.conversation);
    socketRef.current?.emit("join_conversation", data.conversation._id);
    await refreshConversations();
    setSidebarTab("chats");
    setMobileView("chat");
  };

  const sendMessage = async () => {
    if (!activeConversation?._id || (!text.trim() && !file)) return;
    let attachments = [];
    if (file) {
      const body = new FormData();
      body.append("file", file);
      const { data } = await http.post("/upload", body, { headers: { "Content-Type": "multipart/form-data" } });
      attachments = [data.attachment];
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
    socketRef.current?.emit("send_message", { conversationId: activeConversation._id, text, attachments });
    setText("");
  };

  const send = (e) => {
    e.preventDefault();
    void sendMessage();
  };

  const deleteMessage = useCallback(async (messageId) => {
    try {
      const { data } = await http.delete(`/chat/messages/${messageId}`);
      const ts =
        data.deletedAt != null ? new Date(data.deletedAt).toISOString() : new Date().toISOString();
      setMessages((prev) =>
        prev.map((msg) =>
          msg._id === messageId
            ? {
                ...msg,
                deleted: true,
                text: "",
                attachments: [],
                deletedPlaceholder: DELETED_MSG_LABEL,
                deletedAt: ts,
              }
            : msg
        )
      );
      if (data?.conversation) {
        setConversations((prev) => {
          const idx = prev.findIndex((c) => c._id === data.conversation._id);
          const copy = [...prev];
          if (idx === -1) copy.push(data.conversation);
          else copy[idx] = { ...copy[idx], ...data.conversation };
          return copy.sort((a, b) => new Date(b.lastMessageAt) - new Date(a.lastMessageAt));
        });
        setActiveConversation((cur) =>
          cur?._id === data.conversation._id ? { ...cur, ...data.conversation } : cur
        );
      }
    } catch (err) {
      window.alert(err.response?.data?.message || "Could not delete message");
    }
  }, []);

  const partner = activeConversation?.participants?.find((p) => p._id !== user._id);
  const roleLabel = user.role === "patient" ? "Patient" : "Healthcare provider";

  const filteredConversations = conversations.filter((c) => {
    const p = c.participants.find((x) => x._id !== user._id);
    const name = (p?.fullName || "").toLowerCase();
    return name.includes(searchChats.trim().toLowerCase());
  });

  const filteredDirectory = directory.filter((d) => {
    const q = searchContacts.trim().toLowerCase();
    if (!q) return true;
    return d.fullName.toLowerCase().includes(q) || (d.specialization || "").toLowerCase().includes(q);
  });

  return (
    <div className="chat-app">
      <header className="chat-app__top">
        <div className="chat-app__brand">
          <span className="chat-app__logo" aria-hidden>✚</span>
          <div>
            <h1 className="chat-app__title">CareConnect Messages</h1>
            <p className="chat-app__subtitle">
              {user.fullName}
              <span className="chat-app__dot" aria-hidden> · </span>
              <span>{roleLabel}</span>
            </p>
          </div>
        </div>
        <div className="chat-app__actions">
          <Link className="chat-app__link" to="/profile">
            Profile
          </Link>
          <button type="button" className="chat-app__btn chat-app__btn--ghost" onClick={onLogout}>
            Log out
          </button>
        </div>
      </header>

      <div className={`chat-shell ${mobileView === "chat" ? "chat-shell--show-main" : "chat-shell--show-list"}`}>
        <aside className="chat-sidebar" aria-label="Conversations and contacts">
          <div className="chat-sidebar__tabs" role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={sidebarTab === "chats"}
              className={`chat-sidebar__tab ${sidebarTab === "chats" ? "is-active" : ""}`}
              onClick={() => setSidebarTab("chats")}
            >
              Chats
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={sidebarTab === "contacts"}
              className={`chat-sidebar__tab ${sidebarTab === "contacts" ? "is-active" : ""}`}
              onClick={() => setSidebarTab("contacts")}
            >
              {user.role === "patient" ? "Practitioners" : "Patients"}
            </button>
          </div>

          {sidebarTab === "chats" && (
            <div className="chat-sidebar__search">
              <label htmlFor="search-chats" className="visually-hidden">
                Search conversations
              </label>
              <input
                id="search-chats"
                type="search"
                className="chat-sidebar__search-input"
                placeholder="Search conversations…"
                value={searchChats}
                onChange={(e) => setSearchChats(e.target.value)}
                autoComplete="off"
              />
            </div>
          )}

          {sidebarTab === "contacts" && (
            <div className="chat-sidebar__search">
              <label htmlFor="search-contacts" className="visually-hidden">
                Search contacts
              </label>
              <input
                id="search-contacts"
                type="search"
                className="chat-sidebar__search-input"
                placeholder="Find someone…"
                value={searchContacts}
                onChange={(e) => setSearchContacts(e.target.value)}
                autoComplete="off"
              />
            </div>
          )}

          <div className="chat-sidebar__list" role="tabpanel">
            {sidebarTab === "chats" &&
              (filteredConversations.length === 0 ? (
                <p className="chat-sidebar__empty">No conversations yet. Open the Contacts tab to start one.</p>
              ) : (
                <ul className="chat-conversation-list">
                  {filteredConversations.map((c) => {
                    const p = c.participants.find((x) => x._id !== user._id);
                    const preview = c.lastMessagePreview || "No messages yet";
                    const fromMe = c.lastMessageSenderId === user._id;
                    const showPrefix = fromMe && preview !== "No messages yet";
                    return (
                      <li key={c._id}>
                        <button
                          type="button"
                          className={`chat-conversation-item ${activeConversation?._id === c._id ? "is-active" : ""}`}
                          onClick={() => selectConversation(c)}
                        >
                          <span className="chat-avatar" aria-hidden>
                            {(p?.fullName || "?").slice(0, 1).toUpperCase()}
                          </span>
                          <span className="chat-conversation-item__body">
                            <span className="chat-conversation-item__row">
                              <span className="chat-conversation-item__name">{p?.fullName || "Conversation"}</span>
                              <time className="chat-conversation-item__time" dateTime={c.lastMessageAt}>
                                {formatListTime(c.lastMessageAt)}
                              </time>
                            </span>
                            <span className="chat-conversation-item__row chat-conversation-item__row--meta">
                              <span className="chat-conversation-item__preview">
                                {showPrefix ? <span className="chat-preview-you">You: </span> : null}
                                {preview}
                              </span>
                              {c.unreadCount > 0 ? (
                                <span className="chat-unread-badge" aria-label={`${c.unreadCount} unread messages`}>
                                  {c.unreadCount > 99 ? "99+" : c.unreadCount}
                                </span>
                              ) : null}
                            </span>
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              ))}

            {sidebarTab === "contacts" && (
              <ul className="chat-contact-list">
                {filteredDirectory.map((d) => (
                  <li key={d._id}>
                    <button type="button" className="chat-contact-item" onClick={() => openConversation(d._id)}>
                      <span className="chat-avatar chat-avatar--outline" aria-hidden>
                        {d.fullName.slice(0, 1).toUpperCase()}
                      </span>
                      <span className="chat-contact-item__body">
                        <span className="chat-contact-item__name">{d.fullName}</span>
                        <span className="chat-contact-item__hint">
                          {d.specialization || (d.role === "practitioner" ? "Practitioner" : "Patient")}
                        </span>
                      </span>
                      <span className="chat-contact-item__chevron" aria-hidden>
                        →
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </aside>

        <section className="chat-main" aria-label="Active conversation">
          {!activeConversation ? (
            <div className="chat-empty-state">
              <div className="chat-empty-state__card">
                <h2>Select a conversation</h2>
                <p>Choose a chat from the list or start a new one from Contacts. Messages are for professional healthcare communication only.</p>
              </div>
            </div>
          ) : (
            <>
              <div className="chat-main__header">
                <button
                  type="button"
                  className="chat-main__back"
                  onClick={() => setMobileView("list")}
                  aria-label="Back to conversation list"
                >
                  ←
                </button>
                <span className="chat-avatar chat-avatar--header" aria-hidden>
                  {(partner?.fullName || "?").slice(0, 1).toUpperCase()}
                </span>
                <div className="chat-main__header-text">
                  <h2 className="chat-main__peer-name">{partner?.fullName || "Direct chat"}</h2>
                  <p className="chat-main__peer-meta">
                    {partner?.specialization || (partner?.role === "practitioner" ? "Practitioner" : "Patient")}
                  </p>
                </div>
              </div>

              <div className="chat-main__messages" role="log" aria-live="polite" aria-relevant="additions">
                {messages.length === 0 ? (
                  <p className="chat-main__placeholder">No messages yet. Send a message to begin.</p>
                ) : (
                  messages.map((m) => (
                    <ChatMessageRow key={m._id} m={m} user={user} baseUrl={SOCKET_URL} onDelete={deleteMessage} />
                  ))
                )}
                <div ref={messagesEndRef} />
              </div>

              <form className="chat-composer" onSubmit={send}>
                <div className="chat-composer__attach">
                  <input
                    ref={fileInputRef}
                    id="chat-file"
                    type="file"
                    className="visually-hidden"
                    onChange={(e) => setFile(e.target.files?.[0] || null)}
                    accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.txt,.dcm,application/dicom"
                  />
                  <input
                    ref={videoInputRef}
                    id="chat-video-file"
                    type="file"
                    className="visually-hidden"
                    onChange={(e) => setFile(e.target.files?.[0] || null)}
                    accept="video/*"
                    capture="environment"
                  />
                  <button
                    type="button"
                    className="chat-composer__icon-btn"
                    onClick={() => fileInputRef.current?.click()}
                    aria-label="Attach file"
                    title="Attach file"
                  >
                    📎
                  </button>
                  <button
                    type="button"
                    className="chat-composer__icon-btn"
                    onClick={() => videoInputRef.current?.click()}
                    aria-label="Attach video"
                    title="Attach video"
                  >
                    🎥
                  </button>
                  <button
                    type="button"
                    className={`chat-composer__icon-btn chat-composer__record ${isRecording ? "is-active" : ""}`}
                    onClick={isRecording ? stopRecording : startRecording}
                    aria-label={isRecording ? "Stop voice recording" : "Record voice message"}
                    title={isRecording ? "Stop voice recording" : "Record voice message"}
                    disabled={!recordingSupported}
                  >
                    {isRecording ? "■" : "🎙️"}
                  </button>
                  {file ? (
                    <span className="chat-composer__file-pill" title={file.name}>
                      {file.name.length > 24 ? `${file.name.slice(0, 24)}…` : file.name}
                      <button
                        type="button"
                        className="chat-composer__file-clear"
                        onClick={() => {
                          setFile(null);
                          if (fileInputRef.current) fileInputRef.current.value = "";
                        }}
                        aria-label="Remove attachment"
                      >
                        ×
                      </button>
                    </span>
                  ) : null}
                </div>
                {recordingSupported ? (
                  <div className="chat-composer__recording-status">
                    {isRecording ? `Recording ${formatRecordingTime(recordingSeconds)}` : "Tap the mic to record a voice note."}
                  </div>
                ) : (
                  <div className="chat-composer__recording-status chat-composer__recording-status--disabled">
                    Voice notes are unavailable in this browser.
                  </div>
                )}
                {recordingError ? <p className="chat-composer__error">{recordingError}</p> : null}
                <label htmlFor="chat-input" className="visually-hidden">
                  Message
                </label>
                <textarea
                  id="chat-input"
                  className="chat-composer__input"
                  rows={1}
                  placeholder="Type a secure message…"
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      void sendMessage();
                    }
                  }}
                />
                <button type="submit" className="chat-composer__send" disabled={!text.trim() && !file} aria-label="Send message">
                  Send
                </button>
              </form>
            </>
          )}
        </section>
      </div>
    </div>
  );
}

function Protected({ user }) {
  if (!user) return <Navigate to="/login" replace />;
  return null;
}

function AppShell() {
  const location = useLocation();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const loadCurrent = async () => {
    try {
      const token = localStorage.getItem("token");
      if (!token) return setUser(null);
      const { data } = await http.get("/users/me");
      setUser(data.user);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { loadCurrent(); }, []);
  const onAuth = ({ token, user: u }) => {
    localStorage.setItem("token", token);
    setUser({ ...u, _id: u._id || u.id });
  };
  const onLogout = () => { localStorage.removeItem("token"); setUser(null); };
  if (loading) return <div className="loading">Loading secure workspace...</div>;
  return (
    <>
      {user && location.pathname !== "/dashboard" && (
        <nav className="nav nav--global" aria-label="Main">
          <Link to="/dashboard">Messages</Link>
          <Link to="/profile">Profile</Link>
        </nav>
      )}
      <Routes>
        <Route path="/login" element={user ? <Navigate to="/dashboard" replace /> : <Login onAuth={onAuth} />} />
        <Route path="/register" element={user ? <Navigate to="/dashboard" replace /> : <Register onAuth={onAuth} />} />
        <Route path="/dashboard" element={<>{<Protected user={user} />}{user && <Dashboard user={user} onLogout={onLogout} />}</>} />
        <Route path="/profile" element={<>{<Protected user={user} />}{user && <Profile user={user} reloadUser={loadCurrent} />}</>} />
        <Route path="*" element={<Navigate to={user ? "/dashboard" : "/login"} replace />} />
      </Routes>
    </>
  );
}

export default function App() {
  return <BrowserRouter><AppShell /></BrowserRouter>;
}
