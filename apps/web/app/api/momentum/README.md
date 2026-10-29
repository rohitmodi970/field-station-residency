# Momentum API — Consistency Matrix

**Endpoint:** `GET /api/momentum`

---

## Algorithm

A weighted **0–100 score** computed from three components:

| Component | Weight | Saturates at |
|---|---|---|
| Streak — consecutive days writing | 50 pts | 14 days |
| Weekly velocity — entries in last 7 days | 30 pts | 7 entries |
| 30-day cadence — unique days written in last 30 | 20 pts | 20 days |

```
score = (min(streak, 14) / 14) × 50
      + (min(weeklyEntries, 7) / 7) × 30
      + (min(activeDays30, 20) / 20) × 20
```

### Streak logic
- Counts backwards from **today**.
- If no entry today but one exists **yesterday**, the streak is preserved (so writing later in the day doesn't break it).

---

## Levels

| Score | Level | Emoji |
|---|---|---|
| 0–20 | Just Starting | 🌱 |
| 21–40 | Easy | 💧 |
| 41–60 | Moderate | ⚡ |
| 61–80 | On Fire | 🔥 |
| 81–100 | Unstoppable | 🌟 |

---

## Response shape

```ts
{
  consistency: {
    level: "just_starting" | "easy" | "moderate" | "on_fire" | "unstoppable"
    label: string           // human-readable level name
    emoji: string
    description: string     // motivational message
    score: number           // 0–100
    streak: number          // current consecutive-day streak
    weeklyEntries: number   // entries in last 7 days
    activeDaysLast30: number
    totalEntries: number
    progressToNext: number  // % progress toward next level
    nextLevel: string | null
    nextLevelEmoji: string | null
  },
  emotionalDepth: null,   // future phase
  selfAwareness: null,    // future phase
}
```

---

## Future phases

| Matrix | Status |
|---|---|
| Consistency | ✅ Live |
| Emotional Depth | 🔜 Pending |
| Self-Awareness | 🔜 Pending |
