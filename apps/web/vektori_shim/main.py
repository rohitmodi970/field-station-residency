from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
import json
import os
import re
from pathlib import Path

try:
    from vektori import Vektori
    HAS_VEKTORI = True
except Exception:
    HAS_VEKTORI = False

app = FastAPI(title="Vektori Shim")

# Upsert store keyed by (user_id, session_id) for idempotent ingest
_store: Dict[str, Dict[str, Any]] = {}
_vektori_client = None
_vektori_ready = False
_STORE_PATH = Path(os.environ.get('VEKTORI_MOCK_STORE_PATH', Path(__file__).resolve().parent.parent / '.vektori-mock-store.json'))

STOP_WORDS = {
    'a', 'an', 'the', 'and', 'or', 'but', 'if', 'then', 'else', 'when', 'at', 'by', 'for',
    'with', 'about', 'to', 'from', 'in', 'on', 'what', 'are', 'my', 'is', 'how', 'where',
    'why', 'who', 'did', 'have', 'has', 'had', 'been', 'was', 'were', 'write', 'wrote',
    'tell', 'me', 'give', 'show', 'find', 'get', 'do', 'does', 'i', 'you', 'we', 'they',
}

SYNONYM_GROUPS = [
    ['allergy', 'allergies', 'allergic'],
    ['med', 'meds', 'medication', 'medications', 'medicine', 'medicines'],
    ['timing', 'timings', 'schedule', 'scheduled'],
    ['goal', 'goals', 'habit', 'habits', 'resolution', 'resolutions'],
    ['thyroid'],
    ['dose', 'doses', 'dosage'],
    ['symptom', 'symptoms'],
    ['mood', 'feeling', 'feelings', 'emotion', 'emotions'],
]

class AddRequest(BaseModel):
    user_id: str
    session_id: Optional[str] = None
    messages: List[Dict[str, Any]]

class SearchRequest(BaseModel):
    user_id: str
    query: str
    depth: str = "l1"
    context_window: int = 2

class ClearRequest(BaseModel):
    user_id: str
    session_id: Optional[str] = None
    scope: str = "user"

def _store_key(user_id: str, session_id: Optional[str]) -> str:
    return f"{user_id}::{session_id or '__default__'}"

def _load_store() -> None:
    global _store
    if not _STORE_PATH.exists():
        _store = {}
        return

    try:
        raw = json.loads(_STORE_PATH.read_text(encoding='utf-8'))
        if isinstance(raw, dict):
            _store = raw
            print(f'[vektori-shim] loaded {len(_store)} entries from {_STORE_PATH}')
        else:
            _store = {}
    except Exception as exc:
        print(f'[vektori-shim] failed to load store: {exc!r}')
        _store = {}

def _save_store() -> None:
    try:
        _STORE_PATH.parent.mkdir(parents=True, exist_ok=True)
        _STORE_PATH.write_text(json.dumps(_store, ensure_ascii=False), encoding='utf-8')
    except Exception as exc:
        print(f'[vektori-shim] failed to save store: {exc!r}')

def _stem(word: str) -> str:
    w = word.lower().strip()
    if len(w) <= 3:
        return w
    if w.endswith('ies') and len(w) > 4:
        return f"{w[:-3]}y"
    if w.endswith('es') and len(w) > 4:
        return w[:-2]
    if w.endswith('s') and not w.endswith('ss') and len(w) > 3:
        return w[:-1]
    return w

def _expand_single_term(term: str) -> List[str]:
    normalized = term.lower().strip()
    if not normalized:
        return []

    expanded = {normalized, _stem(normalized)}
    for group in SYNONYM_GROUPS:
        stems = [_stem(item) for item in group]
        if normalized in group or _stem(normalized) in stems:
            for item in group:
                expanded.add(item)
                expanded.add(_stem(item))
    return [item for item in expanded if item]

def _expand_terms(terms: List[str]) -> List[str]:
    expanded = set()
    for term in terms:
        for variant in _expand_single_term(term):
            expanded.add(variant)
    return list(expanded)

def _extract_terms(query: str) -> List[str]:
    words = re.sub(r'[^\w\s]', ' ', query.lower()).split()
    terms = [w for w in words if len(w) >= 2 and w not in STOP_WORDS]
    return terms if terms else [query.lower().strip()]

@app.on_event("startup")
async def startup_event():
    global _vektori_client, _vektori_ready
    _load_store()

    if HAS_VEKTORI:
        try:
            api_key = os.environ.get('VEKTORI_API_KEY')
            url = os.environ.get('VEKTORI_BASE_URL') or os.environ.get('VEKTORI_BASE_URL')
            _vektori_client = Vektori(api_key=api_key, url=url)
            print(f"[vektori-shim] Vektori client initialized (api_key={'set' if api_key else 'none'}, url={url})")
            _vektori_ready = True
        except Exception as e:
            _vektori_client = None
            print('[vektori-shim] Vektori client failed to initialize; falling back to mock')
            print(f'[vektori-shim] initialization error: {e!r}')
            _vektori_ready = False
    else:
        print('[vektori-shim] vektori package not available; running in mock mode with persistent local store')

@app.post("/add")
async def add(req: AddRequest):
    if HAS_VEKTORI and _vektori_client is not None and _vektori_ready:
        try:
            res = _vektori_client.ingest(req.user_id, req.messages, session_id=req.session_id)
            print(f'[vektori-shim] ingest -> vektori user={req.user_id} session={req.session_id} items={len(req.messages)} resp={res}')
            return {"ok": True, "via": "vektori", "result": res}
        except Exception as e:
            print(f'[vektori-shim] vektori ingest error: {e}')
            raise HTTPException(status_code=500, detail=f"Vektori ingest failed: {e}")

    key = _store_key(req.user_id, req.session_id)
    _store[key] = {
        "user_id": req.user_id,
        "session_id": req.session_id,
        "messages": req.messages,
    }
    _save_store()
    return {"ok": True, "via": "mock", "count": len(_store)}

@app.post("/clear")
async def clear(req: ClearRequest):
    if HAS_VEKTORI and _vektori_client is not None and _vektori_ready:
        try:
            if hasattr(_vektori_client, 'clear'):
                _vektori_client.clear(req.user_id)
            return {"ok": True, "via": "vektori"}
        except Exception as e:
            print(f'[vektori-shim] vektori clear error: {e}')
            raise HTTPException(status_code=500, detail=f"Vektori clear failed: {e}")

    if req.session_id:
        _store.pop(_store_key(req.user_id, req.session_id), None)
    else:
        prefix = f"{req.user_id}::"
        for key in list(_store.keys()):
            if key.startswith(prefix):
                _store.pop(key, None)

    _save_store()
    return {"ok": True, "via": "mock", "count": len(_store)}

def _term_matches(content: str, term: str) -> bool:
    haystack = content.lower()
    for variant in _expand_single_term(term):
        if len(variant) <= 3:
            if variant == 'med' and re.search(r'\bmed(?:s|ication|icine|ications|icines)?\b', haystack):
                return True
            if re.search(r'\b' + re.escape(variant) + r'\w*\b', haystack):
                return True
            continue

        if variant in haystack:
            return True

        stem = _stem(variant)
        if stem != variant and re.search(r'\b' + re.escape(stem) + r'\w*\b', haystack):
            return True
    return False

def _search_for_user(user_id: str, q: str, depth: str = "l1"):
    if HAS_VEKTORI and _vektori_client is not None and _vektori_ready:
        top_k = 10 if depth == "l1" else 50
        res = _vektori_client.retrieve(user_id, q, top_k=top_k)
        print(f'[vektori-shim] retrieve -> vektori user={user_id} q="{q}" top_k={top_k}')
        if isinstance(res, dict):
            return {
                "facts": res.get("facts") or [],
                "episodes": res.get("episodes") or [],
                "sentences": res.get("sentences") or [],
            }
        return {"facts": [], "episodes": [], "sentences": []}

    base_terms = _extract_terms(q)
    expanded_terms = _expand_terms(base_terms) or base_terms
    hits = []

    for doc in _store.values():
        if doc.get("user_id") != user_id:
            continue
        for m in doc.get("messages", []):
            text = m.get("content") or m.get("text") or ""
            content = text.lower()
            if not content:
                continue

            matched_base = [term for term in base_terms if _term_matches(content, term)]
            if not matched_base:
                continue

            matched_expanded = [term for term in expanded_terms if _term_matches(content, term)]
            score = len(matched_base) / max(len(base_terms), 1)
            if matched_expanded:
                score += (len(matched_expanded) / max(len(expanded_terms), 1)) * 0.35
            score = min(1.0, score)

            if any(_term_matches((doc.get("session_id") or "").lower(), term) for term in base_terms):
                score = min(1.0, score + 0.15)
            hits.append({"text": text, "score": score})

    hits.sort(key=lambda item: item.get("score", 0), reverse=True)
    return {"facts": hits[:50], "episodes": [], "sentences": []}

@app.post("/search")
async def search_post(req: SearchRequest):
    try:
        payload = _search_for_user(req.user_id, req.query, req.depth)
        return payload
    except Exception as e:
        print(f'[vektori-shim] vektori retrieve error: {e}')
        raise HTTPException(status_code=500, detail=f"Vektori retrieve failed: {e}")

@app.get("/search")
async def search(user_id: str, q: str, depth: str = "l1"):
    try:
        payload = _search_for_user(user_id, q, depth)
        return {"ok": True, "via": "vektori" if _vektori_ready else "mock", **payload}
    except Exception as e:
        print(f'[vektori-shim] vektori retrieve error: {e}')
        raise HTTPException(status_code=500, detail=f"Vektori retrieve failed: {e}")

@app.get("/health")
async def health():
    return {
        "ok": True,
        "vektori_available": HAS_VEKTORI,
        "mock_entries": len(_store),
        "persistent_store": str(_STORE_PATH),
    }
