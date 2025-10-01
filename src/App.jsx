import React, { useState, useEffect } from "react";
import { db } from "./firebase";
import { doc, setDoc, getDoc, onSnapshot, updateDoc } from "firebase/firestore";

export default function App() {
  const [roomId, setRoomId] = useState("");
  const [room, setRoom] = useState(null);
  const [name, setName] = useState("");

  async function createRoom() {
    const id = Math.random().toString(36).substring(2, 8);
    const newRoom = {
      id,
      participants: {},
      revealed: false,
    };
    await setDoc(doc(db, "rooms", id), newRoom);
    setRoomId(id);
  }

  async function joinRoom(id) {
    setRoomId(id);
    const snap = await getDoc(doc(db, "rooms", id));
    if (snap.exists()) {
      setRoom(snap.data());
    }
  }

  // Subscribe to realtime updates
  useEffect(() => {
    if (!roomId) return;
    const unsub = onSnapshot(doc(db, "rooms", roomId), (snap) => {
      if (snap.exists()) {
        setRoom(snap.data());
      }
    });
    return () => unsub();
  }, [roomId]);

  async function setCard(card) {
    if (!room || !name) return;
    const ref = doc(db, "rooms", room.id);
    const newRoom = {
      ...room,
      participants: {
        ...room.participants,
        [name]: {
          card,
          lastSeen: new Date().toISOString(),
        },
      },
    };
    await setDoc(ref, newRoom);
  }

  async function revealCards() {
    if (!room) return;
    await updateDoc(doc(db, "rooms", room.id), { revealed: true });
  }

  async function resetRound() {
    if (!room) return;
    await updateDoc(doc(db, "rooms", room.id), {
      revealed: false,
      participants: {},
    });
  }

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">🃏 Planning Poker (Firebase)</h1>

      {!room && (
        <div className="space-x-2">
          <button onClick={createRoom} className="px-4 py-2 bg-blue-500 text-white rounded">
            Create Room
          </button>
          <input
            className="border px-2 py-1"
            placeholder="Room ID"
            value={roomId}
            onChange={(e) => setRoomId(e.target.value)}
          />
          <button onClick={() => joinRoom(roomId)} className="px-4 py-2 bg-green-500 text-white rounded">
            Join Room
          </button>
        </div>
      )}

      {room && (
        <div className="mt-4">
          <p>Room ID: <strong>{room.id}</strong></p>
          <input
            className="border px-2 py-1 mt-2"
            placeholder="Your Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <div className="mt-4 space-x-2">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                onClick={() => setCard(n)}
                className="px-3 py-2 bg-gray-200 rounded hover:bg-gray-300"
              >
                {n}
              </button>
            ))}
          </div>

          <div className="mt-4">
            <h2 className="font-semibold">Participants</h2>
            <ul className="list-disc pl-6">
              {room.participants && Object.entries(room.participants).map(([pName, p]) => (
                <li key={pName}>
                  {pName}: {room.revealed ? p.card : "❓"}
                </li>
              ))}
            </ul>
          </div>

          <div className="mt-4 space-x-2">
            <button onClick={revealCards} className="px-4 py-2 bg-purple-500 text-white rounded">
              Reveal
            </button>
            <button onClick={resetRound} className="px-4 py-2 bg-red-500 text-white rounded">
              Reset
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
