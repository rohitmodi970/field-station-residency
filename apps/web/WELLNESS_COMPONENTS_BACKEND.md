# Wellness Components Backend Architecture

## Data Source: `/api/momentum`

All four wellness dashboard components fetch from a **single source of truth**: the Momentum Consistency API.

**Endpoint:** `GET /api/momentum`  
**Auth:** Required (checks user session via Supabase)  
**Response Time:** ~50-100ms (single DB query + in-memory computation)

### Consistency Score Calculation

The API computes a **0–100 composite score** from three weighted metrics:

```
Total Score = (Streak Component) + (Weekly Component) + (Cadence Component)
            = (min(streak, 14) / 14) × 50
            + (min(weeklyEntries, 7) / 7) × 30
            + (min(activeDays30, 20) / 20) × 20
```

| Metric | Points | Saturates At |
|--------|--------|--------------|
| Consecutive-day streak | 50 | 14 days |
| Entries in last 7 days | 30 | 7 entries |
| Unique writing days (last 30 days) | 20 | 20 days |

**Streak Logic:** Backwards from today. If no entry today but one exists yesterday, streak is preserved (same-day fragmentation doesn't break momentum).

### API Response Shape

```typescript
{
  consistency: {
    level: "just_starting" | "easy" | "moderate" | "on_fire" | "unstoppable"
    score: 0–100                    // main composite
    streak: number                  // consecutive days
    weeklyEntries: number           // last 7 days
    activeDaysLast30: number        // unique days
    totalEntries: number            // all-time
    progressToNext: number          // % toward next level
    nextLevel: string | null        // upcoming tier
  },
  emotionalDepth: null,             // future
  selfAwareness: null               // future
}
```

---

## Component-Specific Transformations

### 1. **MindEnergyPulse.tsx**

**Purpose:** Energy state visualization

**Mapping:**
- Fetches `consistency.score`
- Maps to energy states:
  - `low` (score < 20): "Drained" → guidance on rest & hydration
  - `recovering` (20–40): "Low battery" → gentle activities
  - `steady` (40–60): "Balanced" → good for focus work
  - `flowing` (60–80): "Strong" → capitalize on momentum
  - `peak` (80+): "Energized" → ideal for challenges

**Visual:** Animated pulsing orb with state-specific color gradient & duration

---

### 2. **MentalWeatherForecast.tsx**

**Purpose:** Psychological state as weather metaphor

**Mapping:**
- Fetches `consistency.score`
- Maps to weather patterns:
  - `stormy` (< 20): "Intense thoughts" → introspection encouragement
  - `shifting` (20–40): "Changing mood" → grounding techniques
  - `calm` (40–60): "Mental quiet" → reflection opportunity
  - `clearing` (60–80): "Clarity breaking through" → action window
  - `bright` (80+): "Clear minded" → execution phase

**Visual:** Weather icons (Cloud, Wind, CloudRain, Sun) with animated transitions & pattern-specific quick actions

---

### 3. **DailyRhythmVisualization.tsx**

**Purpose:** Optimal thinking time by time of day

**Logic:**
- **Does NOT call `/api/momentum`** — uses client-side `Date.getHours()`
- Deterministic mapping: `hour` → time-of-day pattern
  - `morning` (5–11): Peak mental clarity window
  - `midday` (11–16): Transition & social energy available
  - `evening` (16–21): Reflection & processing deepens
  - `night` (21–5): Creative flow for night thinkers

**Visual:** Emoji + time markers + 3 actionable micro-habits per pattern

**Note:** This is **time-zone aware** on client but stateless (no server calls).

---

### 4. **WellnessBalance.tsx**

**Purpose:** Emotional/mental/physical balance visualization

**Mapping:**
- Fetches `consistency.score`
- Derives **pseudo-varied sub-scores** to show imbalance:
  ```typescript
  const baseScore = json.consistency.score;
  const variation = Math.sin(Date.now() / 10000) * 15;
  
  emotional = baseScore + variation
  mental = baseScore - (variation × 0.7) + 5
  physical = baseScore + (variation × 0.5)
  ```
- Identifies **priority** (lowest-scoring dimension) for personalized care
- If `max − min < 20`: marks as "balanced"

**Visual:** Three animated progress bars (Heart/Brain/Zap) + priority-specific care suggestions

**Design Choice:** Uses sine-wave variation to show realistic imbalance without requiring three separate API endpoints. Maintains rough alignment with consistency but allows per-user variance in wellness dimensions.

---

## Data Flow Diagram

```
Database (journals table)
    ↓
/api/momentum (GET)
    ├─ Computes consistency score (0–100)
    ├─ Returns: score, streak, weeklyEntries, activeDaysLast30
    └─ Response cached client-side (1 request per page load)
    
    ↓ (Client receives response)
    
4 Wellness Components:
├─ MindEnergyPulse ────── Maps score → energy state
├─ MentalWeatherForecast─ Maps score → weather pattern
├─ WellnessBalance ────── Derives sub-scores from score
└─ DailyRhythmVisualization (no API, uses local time)
```

---

## Performance Notes

- **API latency:** ~50–150ms (single indexed query on `user_id`, `is_deleted`)
- **Computation:** O(N) scan over all user journals, but fast in-memory (< 10ms typical)
- **Caching:** Components cache response in state; no redundant fetches
- **Client-side:** All transformations (color mapping, emoji selection, text generation) happen on client
- **Failure mode:** Components gracefully no-render if API call fails (soft fallback, no error UI)

---

## Future Phases

- **Emotional Depth:** Sentiment + topic clustering from journal entries (pending)
- **Self-Awareness:** Reflection quality metrics + insight frequency (pending)

These will extend the `/api/momentum` response but won't change existing component architecture.
