# ONUW Project

A locally hosted, multi-device implementation of the social deduction game  
**One Night Ultimate Werewolf**.

This project is designed to run entirely without accounts or matchmaking and
supports real-time multiplayer gameplay using WebSockets.

---

## Project Goals

- Recreate the full ruleset of **One Night Ultimate Werewolf**
- Support **3–10 players** on multiple devices
- Use a **local or self-hosted server** (LAN or internet-hosted)
- Ensure **hidden information is never leaked**
- Keep the codebase simple, readable, and well-structured

---

## Tech Stack (Initial)

- **Node.js**
- **Express** (static hosting)
- **WebSockets (`ws`)** for real-time communication
- Vanilla **HTML / CSS / JavaScript** client

> No frameworks, no databases, no cloud dependencies required.

---

## Project Structure

ONUW-Project/
├── server.js server entry point

├── game.js logic (roles, phases, rules)

├── package.json
└── public/

├── index.html 

├── client.js  logic
└── styles.css 


---

## Current Status

**Commit #1 – Project scaffolding**

- File structure created
- Package configuration in place
- No game logic implemented yet

Upcoming milestones:
- WebSocket lobby system
- Role dealing and night phase
- Voting and results resolution

---

## Getting Started

```bash
npm install
npm start
