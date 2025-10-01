import React, { useEffect, useMemo, useState } from "react";

// Planning Poker — Single-file React component
// - Uses Tailwind CSS classes for styling (no imports required here).
// - Works across tabs in the same browser by syncing state via localStorage + "storage" event.
// - Room data is stored under key: `planning-poker:room:{roomId}`.
// - Intended as a drop-in App.jsx for a Create React App / Vite project using Tailwind.

const DEFAULT_DECK = ["0", "1/2", "1", "2", "3", "5", "8", "13", "20", "40", "100", "?", "☕️"];

function uid(len = 6) {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let s = "";
  for (let i = 0; i < len; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

function nowIso() {
  return new Date().toISOString();
}

function readRoom(roomId) {
  try {
    const raw = localStorage.getItem(`planning-poker:room:${roomId}`);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}

function writeRoom(roomId, room) {
  localStorage.setItem(`planning-poker:room:${roomId}`, JSON.stringify(room));
}

export default function PlanningPokerApp() {
  const [view, setView] = useState("lobby"); // lobby, table
  const [roomId, setRoomId] = useState("");
  const [name, setName] = useState("");
  const [room, setRoom] = useState(null);
  const [deck, setDeck] = useState(DEFAULT_DECK.join(","));
  const [selectedCard, setSelectedCard] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);

  // Keep room in sync with localStorage across tabs
  useEffect(() => {
    function onStorage(e) {
      if (!e.key) return;
      if (!e.key.startsWith("planning-poker:room:")) return;
      const id = e.key.replace("planning-poker:room:", "");
      if (id !== roomId) return;
      const r = readRoom(id);
      setRoom(r);
      // If a participant's selection changed and reveal is false, clear my selection if my name not in participants
    }

    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [roomId]);

  // Load room when roomId changes
  useEffect(() => {
    if (!roomId) {
      setRoom(null);
      return;
    }
    const r = readRoom(roomId);
    setRoom(r);
  }, [roomId]);

  // Join or create helpers
  function createRoom() {
    const id = uid(5).toUpperCase();
    const initial = {
      id,
      createdAt: nowIso(),
      deck: DEFAULT_DECK,
      reveal: false,
      owner: null,
      participants: {}, // name -> { name, joinedAt, card: null, lastSeen }
      history: [],
    };
    writeRoom(id, initial);
    setRoomId(id);
    setRoom(initial);
    setIsAdmin(false);
    setView("table");
  }

  function joinRoom() {
    if (!roomId || !name) return alert("Please enter room ID and your name.");
    const r = readRoom(roomId);
    if (!r) return alert("Room not found.");
    const me = { name, joinedAt: nowIso(), card: null, lastSeen: nowIso() };
    r.participants[name] = me;
    if (!r.owner) r.owner = name; // first to join becomes owner
    writeRoom(roomId, r);
    setRoom(r);
    setIsAdmin(r.owner === name);
    setSelectedCard(null);
    setView("table");
  }

  function leaveRoom() {
    if (!room || !name) return;
    const r = readRoom(room.id) || room;
    delete r.participants[name];
    if (r.owner === name) r.owner = Object.keys(r.participants)[0] || null;
    writeRoom(r.id, r);
    setRoom(null);
    setRoomId("");
    setView("lobby");
    setIsAdmin(false);
    setSelectedCard(null);
  }

  function toggleReveal() {
    if (!room) return;
    const r = readRoom(room.id) || room;
    r.reveal = !r.reveal;
    if (!r.reveal) {
      // when hiding again, move current round to history
      const round = {
        at: nowIso(),
        participants: { ...r.participants },
      };
      r.history = [round, ...r.history].slice(0, 50);
      // clear participant cards for a new round
      Object.keys(r.participants).forEach((k) => (r.participants[k].card = null));
    }
    writeRoom(r.id, r);
    setRoom(r);
  }

  function setCardForMe(card) {
    if (!room || !name) return;
    const r = readRoom(room.id) || room;
    if (!r.participants[name]) return alert("You're not in the room (rejoin).");
    r.participants[name].card = card;
    r.participants[name].lastSeen = nowIso();
    writeRoom(r.id, r);
    setRoom(r);
    setSelectedCard(card);
  }

  function resetRound() {
    if (!room) return;
    const r = readRoom(room.id) || room;
    Object.keys(r.participants).forEach((k) => (r.participants[k].card = null));
    r.reveal = false;
    writeRoom(r.id, r);
    setRoom(r);
    setSelectedCard(null);
  }

  function kickParticipant(target) {
    if (!room) return;
    const r = readRoom(room.id) || room;
    delete r.participants[target];
    if (r.owner === target) r.owner = Object.keys(r.participants)[0] || null;
    writeRoom(r.id, r);
    setRoom(r);
  }

  function updateDeckFromInput(text) {
    const values = text.split(",").map((s) => s.trim()).filter(Boolean);
    setDeck(text);
    if (!room) return;
    const r = readRoom(room.id) || room;
    r.deck = values.length ? values : DEFAULT_DECK;
    writeRoom(r.id, r);
    setRoom(r);
  }

  function exportCsv() {
    if (!room) return;
    const rows = [
      ["name", "card", "joinedAt", "lastSeen"],
      ...Object.values(room.participants).map(p => [p.name, p.card || "", p.joinedAt, p.lastSeen])
    ];
    const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `planning-poker-${room.id}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const participantsList = useMemo(() => {
    if (!room) return [];
    return Object.values(room.participants).sort((a, b) => a.name.localeCompare(b.name));
  }, [room]);

  // Minimal UI components
  if (view === "lobby") {
    return (
      <div className="min-h-screen bg-slate-50 p-6 flex items-start justify-center">
        <div className="w-full max-w-4xl">
          <header className="mb-6">
            <h1 className="text-3xl font-bold">Planning Poker</h1>
            <p className="text-sm text-slate-600">Simple, local-storage backed planning poker app — works across tabs.</p>
          </header>

          <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white p-6 rounded-xl shadow">
              <h2 className="text-xl font-semibold mb-2">Create a new room</h2>
              <p className="text-sm text-slate-600 mb-4">Creates a short join code you can share with teammates (works in this browser).</p>
              <button className="px-4 py-2 rounded bg-sky-600 text-white hover:bg-sky-700" onClick={createRoom}>Create room</button>
            </div>

            <div className="bg-white p-6 rounded-xl shadow">
              <h2 className="text-xl font-semibold mb-2">Join an existing room</h2>
              <label className="block text-sm text-slate-700">Room ID</label>
              <input value={roomId} onChange={e => setRoomId(e.target.value.toUpperCase())} className="w-full mt-1 mb-3 p-2 border rounded" placeholder="ABC12" />
              <label className="block text-sm text-slate-700">Your name</label>
              <input value={name} onChange={e => setName(e.target.value)} className="w-full mt-1 mb-3 p-2 border rounded" placeholder="Eve" />
              <div className="flex gap-2">
                <button className="px-4 py-2 rounded bg-emerald-600 text-white hover:bg-emerald-700" onClick={joinRoom}>Join room</button>
                <button className="px-4 py-2 rounded border" onClick={() => { setRoomId(uid(5).toUpperCase()); setName(''); }}>Generate ID</button>
              </div>
            </div>
          </section>

          <footer className="mt-8 text-sm text-slate-500">Tip: open multiple tabs and join the same room to simulate multiple participants.</footer>
        </div>
      </div>
    );
  }

  // Table view
  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-start justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold">Room {room?.id}</h1>
            <div className="text-sm text-slate-600">Owner: {room?.owner || '—'} • Players: {Object.keys(room?.participants || {}).length}</div>
          </div>
          <div className="flex gap-2">
            <button className="px-3 py-2 rounded border" onClick={() => { navigator.clipboard?.writeText(window.location.href); }}>Copy link</button>
            <button className="px-3 py-2 rounded border" onClick={() => { setView('lobby'); }}>Back</button>
            <button className="px-3 py-2 rounded bg-red-600 text-white" onClick={leaveRoom}>Leave</button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left: deck + controls */}
          <div className="bg-white p-4 rounded-xl shadow">
            <h2 className="font-semibold mb-2">Deck</h2>
            <textarea rows={2} value={deck} onChange={(e) => updateDeckFromInput(e.target.value)} className="w-full p-2 border rounded mb-3" />
            <div className="flex flex-wrap gap-2">
              { (room?.deck || DEFAULT_DECK).map((c) => (
                <button key={c} onClick={() => setCardForMe(c)} className={`px-3 py-2 rounded border ${selectedCard === c ? 'bg-sky-600 text-white' : ''}`}>{c}</button>
              ))}
              <button onClick={() => setCardForMe(null)} className="px-3 py-2 rounded border">Clear</button>
            </div>

            <div className="mt-4">
              <div className="flex gap-2">
                {isAdmin && (
                  <>
                    <button className="px-3 py-2 rounded bg-indigo-600 text-white" onClick={toggleReveal}>{room?.reveal ? 'Hide' : 'Reveal'}</button>
                    <button className="px-3 py-2 rounded border" onClick={resetRound}>Reset</button>
                    <button className="px-3 py-2 rounded border" onClick={exportCsv}>Export CSV</button>
                  </>
                )}
              </div>
            </div>

            <div className="mt-4 text-sm text-slate-600">
              <div>Joined as <strong>{name}</strong></div>
              <div>Joined at: {room?.participants?.[name]?.joinedAt}</div>
              <div>Reveal: {room?.reveal ? 'Yes' : 'No'}</div>
            </div>
          </div>

          {/* Middle: participants */}
          <div className="bg-white p-4 rounded-xl shadow col-span-1 lg:col-span-1">
            <h2 className="font-semibold mb-2">Participants</h2>
            <ul className="space-y-2">
              {participantsList.map(p => (
                <li key={p.name} className="flex items-center justify-between p-2 border rounded">
                  <div>
                    <div className="font-medium">{p.name} {p.name === room.owner && <span className="text-xs ml-2 px-1 rounded bg-slate-100">owner</span>}</div>
                    <div className="text-xs text-slate-500">Joined: {new Date(p.joinedAt).toLocaleString()}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm">{ room.reveal ? (p.card ?? '—') : (p.card ? 'Selected' : '—') }</div>
                    {isAdmin && p.name !== name && (
                      <div className="mt-2 flex gap-2">
                        <button className="px-2 py-1 rounded border text-xs" onClick={() => kickParticipant(p.name)}>Kick</button>
                      </div>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </div>

          {/* Right: history & stats */}
          <div className="bg-white p-4 rounded-xl shadow">
            <h2 className="font-semibold mb-2">History & Stats</h2>
            <div className="mb-3">
              <h3 className="text-sm font-medium">Last rounds</h3>
              <div className="space-y-3 max-h-56 overflow-auto mt-2">
                {room?.history?.length ? room.history.map((h, i) => (
                  <div key={i} className="p-2 border rounded">
                    <div className="text-xs text-slate-500">{new Date(h.at).toLocaleString()}</div>
                    <div className="text-sm mt-1">{Object.values(h.participants).map(pp => `${pp.name}: ${pp.card ?? '—'}`).join(' • ')}</div>
                  </div>
                )) : <div className="text-sm text-slate-500">No rounds yet</div>}
              </div>
            </div>

            <div>
              <h3 className="text-sm font-medium">When revealed</h3>
              <div className="mt-2 text-sm">
                {room?.reveal ? (
                  <div>Cards are revealed. Average (numeric cards): {computeAverage(room) ?? '—'}</div>
                ) : (
                  <div>Cards are hidden. Reveal to see results.</div>
                )}
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}

// simple numeric average using numeric-looking cards
function computeAverage(room) {
  if (!room) return null;
  const vals = Object.values(room.participants)
    .map(p => p.card)
    .filter(Boolean)
    .map(v => parseFloat(String(v).replace(/[^0-9.\-]/g, "")))
    .filter(n => !Number.isNaN(n));
  if (!vals.length) return null;
  const sum = vals.reduce((a, b) => a + b, 0);
  return (sum / vals.length).toFixed(2);
}
