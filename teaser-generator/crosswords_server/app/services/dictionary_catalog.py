"""Dictionary catalog mapping for server-side tier parity."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Dict


@dataclass(frozen=True)
class DictionaryCatalogEntry:
    """Metadata for one dictionary id used by clients."""

    dictionary_id: str
    label: str
    slot: str
    enabled: bool


DICTIONARY_CATALOG: Dict[str, DictionaryCatalogEntry] = {
    "core": DictionaryCatalogEntry(dictionary_id="core", label="Everyday", slot="CORE", enabled=True),
    "standard": DictionaryCatalogEntry(dictionary_id="standard", label="Eng. Lit", slot="STANDARD", enabled=True),
    "advanced": DictionaryCatalogEntry(dictionary_id="advanced", label="Advanced", slot="ADVANCED", enabled=True),
    "canon": DictionaryCatalogEntry(dictionary_id="canon", label="Canon", slot="CANON", enabled=True),
    "common": DictionaryCatalogEntry(dictionary_id="common", label="Everyday", slot="CORE", enabled=True),
    "modified": DictionaryCatalogEntry(dictionary_id="modified", label="Eng. Lit", slot="STANDARD", enabled=True),
    "twl": DictionaryCatalogEntry(dictionary_id="twl", label="Canon", slot="CANON", enabled=True),
}
