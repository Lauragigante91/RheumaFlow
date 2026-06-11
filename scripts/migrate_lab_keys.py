"""
Migrazione una tantum: ri-canonicalizza le chiavi in lab_exams.values.

Chiavi composte (risultato del bug hb_emoglobina, gb_wbc, …) → chiavi canoniche.
Chiavi old-panel (pcr, ferritina, creatinina, …) → chiavi canoniche.
"""

import os

from pymongo import MongoClient

MONGO_URI = os.environ["MONGODB_URI"]
DB_NAME   = "rheumaflow"
COLL_NAME = "lab_exams"

# Ogni voce: old_key → new_key
REMAP = {
    # Compound-slug keys (dal bug r.name invece di r.param_key)
    "hb_emoglobina":  "hb",
    "gb_wbc":         "wbc",
    "plt_piastrine":  "plt",
    "ves_esr":        "ves",
    "pcr_crp":        "crp",
    "ast_got":        "ast",
    "alt_gpt":        "alt",
    # Old panel keys (lab_panels.js prima della fix B)
    "pcr":            "crp",
    "ferritina":      "ferritin",
    "creatinina":     "creatinine",
    "aldolasi":       "aldolase",
    "vit_d":          "vitd",
    # Chiave con suffisso errato (migration precedente mancante)
    "fattore_reumatoide_fr": "fr",
}

def migrate():
    client = MongoClient(MONGO_URI)
    coll = client[DB_NAME][COLL_NAME]

    total   = 0
    updated = 0

    for doc in coll.find({}):
        total += 1
        values = doc.get("values") or {}
        new_values = {}
        changed = False

        for k, v in values.items():
            new_k = REMAP.get(k, k)
            if new_k != k:
                changed = True
            # Avoid clobbering a key that already exists with the target name
            if new_k in new_values:
                # Keep existing (already canonical) value, skip duplicate
                continue
            new_values[new_k] = v

        if changed:
            coll.update_one({"_id": doc["_id"]}, {"$set": {"values": new_values}})
            updated += 1
            print(f"  Updated {doc.get('_id')} (date={doc.get('date')}): "
                  f"{list(values.keys())} → {list(new_values.keys())}")

    client.close()
    print(f"\nDone. Checked {total} docs, updated {updated}.")

if __name__ == "__main__":
    migrate()
