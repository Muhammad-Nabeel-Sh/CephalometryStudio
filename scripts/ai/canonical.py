"""
Canonical landmark + dataset constants for the multi-dataset AI work.

This is the single source of truth for:
  * the CEPHA29 channel order (must match src/data/landmarkMap.js `CEPHA29`)
  * the ISBI 2015 landmark order (must match the harness ISBI19 list)
  * the canonical mapping between them (the shared 19)
  * dataset acquisition defaults (mm/px, URLs)

The app's `src/lib/landmarkMap.js` remains authoritative for the frontend; keep
these in sync. A self-check (`python scripts/ai/canonical.py`) verifies the
mapping is internally consistent.
"""

# ── Channel orders ────────────────────────────────────────────────────────────
# CEPHA29 output-channel order (Aariz model). Must match landmarkMap.js.
CEPHA29 = [
    "A", "ANS", "Ar", "B", "Co", "Gn", "Go", "LIA", "LIT", "LMT", "LPM",
    "Li", "Ls", "Me", "N", "N`", "Or", "PNS", "Pn", "Po", "Pog", "Pog`",
    "R", "S", "Sn", "UIA", "UIT", "UMT", "UPM",
]

# ISBI 2015 order (19). Must match eval-landmark-model.py ISBI19.
ISBI19 = [
    "S", "N", "Or", "Po", "A", "B", "Pog", "Me", "Gn", "Go",
    "L1", "U1", "UL", "LL", "Sn", "Pog'", "PNS", "ANS", "Ar",
]

# ── Canonical mapping: ISBI symbol -> CEPHA29 symbol ─────────────────────────
# Only these 19 can be merged safely (same anatomical definition). The other 10
# CEPHA29 landmarks have no ISBI equivalent.
ISBI_TO_CEPHA = {
    "S": "S",
    "N": "N",
    "Or": "Or",
    "Po": "Po",
    "A": "A",
    "B": "B",
    "Pog": "Pog",
    "Me": "Me",
    "Gn": "Gn",
    "Go": "Go",
    "L1": "LIT",   # lower incisor tip
    "U1": "UIT",   # upper incisor tip
    "UL": "Ls",    # upper lip (labrale superius)
    "LL": "Li",    # lower lip (labrale inferius)
    "Sn": "Sn",
    "Pog'": "Pog`",  # soft-tissue pogonion
    "PNS": "PNS",
    "ANS": "ANS",
    "Ar": "Ar",
}

# CEPHA29 landmarks with no ISBI equivalent (Aariz-only).
CEPHA29_ONLY = [s for s in CEPHA29 if s not in set(ISBI_TO_CEPHA.values())]

# Human-readable canonical names (for the registry / mapping table).
CANONICAL_NAMES = {
    "S": "Sella turcica", "N": "Nasion", "Or": "Orbitale", "Po": "Porion",
    "A": "Point A (subspinale)", "B": "Point B (supramentale)",
    "Pog": "Pogonion", "Me": "Menton", "Gn": "Gnathion", "Go": "Gonion",
    "Ar": "Articulare", "PNS": "Posterior Nasal Spine", "ANS": "Anterior Nasal Spine",
    "Sn": "Subnasale", "Pog`": "Soft-tissue Pogonion",
    "LIT": "Lower Incisor Tip", "UIT": "Upper Incisor Tip",
    "Ls": "Labrale superius", "Li": "Labrale inferius",
    "Co": "Condylion", "LIA": "Lower Incisor Apex", "LMT": "Lower Molar Cusp Tip",
    "LPM": "Lower 2nd PM Cusp Tip", "N`": "Soft Tissue Nasion", "Pn": "Pronasale",
    "R": "Ramus", "UIA": "Upper Incisor Apex", "UMT": "Upper Molar Cusp Tip",
    "UPM": "Upper 2nd PM Cusp Tip",
}

# ── Dataset defaults ──────────────────────────────────────────────────────────
# ISBI 2015: ~0.1 mm/pixel (harness default). Aariz spacing is per-image.
ISBI_PIXEL_MM = 0.1

# Public sources (used by the Kaggle notebook / harness).
AARIZ_FIGSHARE = "https://doi.org/10.6084/m9.figshare.27986417"
AARIZ_ZIP = "https://ndownloader.figshare.com/files/51041642"
AARIZ_ZIP_MD5 = "e0bd645bca6759abdae4f199d841bda6"
ISBI_KAGGLE = "jiahongqian/cephalometric-landmarks"
ISBI_ANN_CSV = ("https://raw.githubusercontent.com/stolariks/medical-landmark-detection/"
                "main/data/isbi-2015/test/annotations.csv")
ISBI_IMG_BASE = ("https://raw.githubusercontent.com/stolariks/medical-landmark-detection/"
                 "main/data/isbi-2015/test/cepha400/")

# Production model (baseline).
PROD_MODEL_URL = ("https://huggingface.co/MuhammadNabeelSh/cephalometry-landmarks/"
                  "resolve/main/landmarks-cepha29.int8.onnx")
PROD_MODEL_SHA256 = "f7f1db9cc2de37c0fa94dab431d7d3446d1d8ffc62fa92e6610c2380af83080d"


# ── Helpers ───────────────────────────────────────────────────────────────────
def cepha_index(symbol):
    """Index of a CEPHA29 symbol, or -1."""
    try:
        return CEPHA29.index(symbol)
    except ValueError:
        return -1


def isbi_to_cepha_channel():
    """ISBI channel index -> CEPHA29 channel index (in ISBI order)."""
    return [cepha_index(ISBI_TO_CEPHA[s]) for s in ISBI19]


def _self_check():
    assert len(CEPHA29) == 29, len(CEPHA29)
    assert len(ISBI19) == 19, len(ISBI19)
    assert set(ISBI_TO_CEPHA) == set(ISBI19), "mapping keys must equal ISBI19"
    assert set(ISBI_TO_CEPHA.values()) <= set(CEPHA29), "mapped values must be CEPHA29"
    assert len(set(ISBI_TO_CEPHA.values())) == 19, "mapping must be injective"
    assert all(cepha_index(ISBI_TO_CEPHA[s]) >= 0 for s in ISBI19)
    assert len(CEPHA29_ONLY) == 10, CEPHA29_ONLY
    print("canonical mapping OK:", len(ISBI19), "shared,", len(CEPHA29_ONLY), "Aariz-only")
    print("  ISBI channel -> CEPHA index:", isbi_to_cepha_channel())
    print("  Aariz-only:", ", ".join(CEPHA29_ONLY))


if __name__ == "__main__":
    _self_check()
