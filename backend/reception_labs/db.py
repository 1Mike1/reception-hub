"""
Database abstraction layer.

Provides a uniform `Repository` interface backed by either:
  • MongoDB (if MONGODB_URI is set in environment), or
  • JSON files on disk (default fallback)

Existing JSON files (`clients.json`, `plans.json`) are auto-migrated on first
MongoDB connection so no data is lost when switching backends.

Public surface:
    db.clients.find_all()           -> List[dict]
    db.clients.find_one(query)      -> Optional[dict]
    db.clients.insert(doc)          -> dict
    db.clients.replace_all(docs)    -> None
    db.clients.update_one(query, update_fn)
    db.plans.* (same interface)

Switching backends requires no code changes anywhere else in the app.
"""
from __future__ import annotations

import json
import logging
import os
from typing import Any, Callable, Dict, List, Optional

logger = logging.getLogger(__name__)

# ─── Paths ────────────────────────────────────────────────────────────────────
_THIS_DIR = os.path.dirname(os.path.abspath(__file__))
CLIENTS_JSON_PATH = os.path.join(_THIS_DIR, "clients.json")
PLANS_JSON_PATH = os.path.join(_THIS_DIR, "plans.json")
SENT_EMAILS_JSON_PATH = os.path.join(_THIS_DIR, "sent_emails.json")
ADMINS_JSON_PATH = os.path.join(_THIS_DIR, "admins.json")


# ═════════════════════════════════════════════════════════════════════════════
# JSON BACKEND
# ═════════════════════════════════════════════════════════════════════════════

class JsonCollection:
    """A simple list-of-dicts collection persisted to a JSON file."""

    def __init__(self, file_path: str, id_field: str = "id"):
        self.file_path = file_path
        self.id_field = id_field

    def _load(self) -> List[Dict[str, Any]]:
        if not os.path.exists(self.file_path):
            return []
        try:
            with open(self.file_path, "r", encoding="utf-8") as f:
                data = json.load(f)
                return data if isinstance(data, list) else []
        except (json.JSONDecodeError, OSError) as e:
            logger.error(f"Failed to read {self.file_path}: {e}")
            return []

    def _save(self, docs: List[Dict[str, Any]]) -> None:
        try:
            with open(self.file_path, "w", encoding="utf-8") as f:
                json.dump(docs, f, indent=2, default=str)
        except OSError as e:
            logger.error(f"Failed to write {self.file_path}: {e}")
            raise

    # ── Public API ──
    def find_all(self) -> List[Dict[str, Any]]:
        return self._load()

    def find_one(self, query: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        for doc in self._load():
            if all(doc.get(k) == v for k, v in query.items()):
                return doc
        return None

    def insert(self, doc: Dict[str, Any]) -> Dict[str, Any]:
        docs = self._load()
        docs.append(doc)
        self._save(docs)
        return doc

    def replace_all(self, docs: List[Dict[str, Any]]) -> None:
        self._save(docs)

    def update_one(
        self, query: Dict[str, Any], update_fn: Callable[[Dict[str, Any]], Dict[str, Any]]
    ) -> Optional[Dict[str, Any]]:
        docs = self._load()
        updated: Optional[Dict[str, Any]] = None
        for i, doc in enumerate(docs):
            if all(doc.get(k) == v for k, v in query.items()):
                docs[i] = update_fn(doc)
                updated = docs[i]
                break
        if updated is not None:
            self._save(docs)
        return updated


# ═════════════════════════════════════════════════════════════════════════════
# MONGODB BACKEND
# ═════════════════════════════════════════════════════════════════════════════

class MongoCollection:
    """Mongo-backed collection with the same API as JsonCollection.

    Uses synchronous PyMongo so it can be a drop-in for the existing
    synchronous JSON helpers. PyMongo is fast enough for this workload
    (single-instance, low throughput) and avoids refactoring the entire
    request-handler signature surface.
    """

    def __init__(self, mongo_collection, id_field: str = "id"):
        self._coll = mongo_collection
        self.id_field = id_field

    @staticmethod
    def _strip_oid(doc: Dict[str, Any]) -> Dict[str, Any]:
        doc.pop("_id", None)
        return doc

    def find_all(self) -> List[Dict[str, Any]]:
        return [self._strip_oid(d) for d in self._coll.find({})]

    def find_one(self, query: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        doc = self._coll.find_one(query)
        return self._strip_oid(doc) if doc else None

    def insert(self, doc: Dict[str, Any]) -> Dict[str, Any]:
        # Copy to avoid mutating caller's dict with _id
        to_insert = dict(doc)
        self._coll.insert_one(to_insert)
        return self._strip_oid(to_insert)

    def replace_all(self, docs: List[Dict[str, Any]]) -> None:
        # Atomic replace using a transaction-ish pattern
        self._coll.delete_many({})
        if docs:
            self._coll.insert_many([dict(d) for d in docs])

    def update_one(
        self, query: Dict[str, Any], update_fn: Callable[[Dict[str, Any]], Dict[str, Any]]
    ) -> Optional[Dict[str, Any]]:
        doc = self._coll.find_one(query)
        if not doc:
            return None
        doc_clean = self._strip_oid(dict(doc))
        updated = update_fn(doc_clean)
        self._coll.replace_one(query, updated)
        return updated


# ═════════════════════════════════════════════════════════════════════════════
# DB FACADE
# ═════════════════════════════════════════════════════════════════════════════

class _Database:
    """Lazy-initialized singleton exposing `db.clients`, `db.plans`, `db.sent_emails`."""

    def __init__(self):
        self._initialized = False
        self.backend: str = "json"
        self.clients: Any = None
        self.plans: Any = None
        self.sent_emails: Any = None
        self.admins: Any = None

    def init(self) -> None:
        if self._initialized:
            return
        mongo_uri = os.getenv("MONGODB_URI", "").strip()

        if mongo_uri:
            try:
                from pymongo import MongoClient  # type: ignore
                db_name = os.getenv("MONGODB_DB", "receptionist_hub")
                client = MongoClient(mongo_uri, serverSelectionTimeoutMS=3000)
                # Force connection check
                client.admin.command("ping")
                mdb = client[db_name]

                self.clients = MongoCollection(mdb["clients"], id_field="id")
                self.plans = MongoCollection(mdb["plans"], id_field="id")
                self.sent_emails = MongoCollection(mdb["sent_emails"], id_field="conversation_id")
                self.admins = MongoCollection(mdb["admins"], id_field="id")
                self.backend = "mongodb"
                logger.info(f"[DB] Connected to MongoDB database '{db_name}'")

                # One-time migration: import JSON data if collections are empty
                self._migrate_json_to_mongo()
            except Exception as e:
                logger.warning(f"[DB] MongoDB unavailable ({e}); falling back to JSON")
                self._init_json()
        else:
            self._init_json()

        self._initialized = True

    def _init_json(self) -> None:
        self.clients = JsonCollection(CLIENTS_JSON_PATH, id_field="id")
        self.plans = JsonCollection(PLANS_JSON_PATH, id_field="id")
        self.sent_emails = JsonCollection(SENT_EMAILS_JSON_PATH, id_field="conversation_id")
        self.admins = JsonCollection(ADMINS_JSON_PATH, id_field="id")
        self.backend = "json"
        logger.info("[DB] Using JSON file backend")

    def _migrate_json_to_mongo(self) -> None:
        """Copy existing JSON data into Mongo (only if Mongo collections are empty)."""
        for path, coll in [
            (CLIENTS_JSON_PATH, self.clients),
            (PLANS_JSON_PATH, self.plans),
            (SENT_EMAILS_JSON_PATH, self.sent_emails),
            (ADMINS_JSON_PATH, self.admins),
        ]:
            if not os.path.exists(path):
                continue
            if coll.find_all():
                continue  # Mongo already has data; don't overwrite
            try:
                with open(path, "r", encoding="utf-8") as f:
                    docs = json.load(f)
                if isinstance(docs, list) and docs:
                    coll.replace_all(docs)
                    logger.info(f"[DB] Migrated {len(docs)} docs from {os.path.basename(path)} to MongoDB")
            except Exception as e:
                logger.error(f"[DB] Migration failed for {path}: {e}")


# Singleton instance
db = _Database()
