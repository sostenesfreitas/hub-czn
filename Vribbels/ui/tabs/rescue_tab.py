"""Rescue Records tab for viewing gacha pull history."""

import json
import tkinter as tk
from tkinter import ttk, filedialog, messagebox
from pathlib import Path
from datetime import datetime
from collections import Counter

from game_data import CHARACTERS, PARTNERS
from ..base_tab import BaseTab

CDN_BASE = "https://cdn.czndecksmeta.com/face/character/portrait_character_{res_id}.webp"
PITY_CAP = 70


# ── data helpers ──────────────────────────────────────────────────────────────

def _char_details(res_id: int) -> dict:
    """Return full character/partner details for a res_id."""
    char = CHARACTERS.get(res_id)
    if char:
        return {
            "name": char.get("name", f"#{res_id}"),
            "grade": char.get("grade", 3),
            "class": char.get("class"),
            "attribute": char.get("attribute"),
            "kind": "Combatant",
            "known": True,
        }
    partner = PARTNERS.get(res_id)
    if partner and partner.get("name") != "Unknown":
        return {
            "name": partner.get("name", f"#{res_id}"),
            "grade": partner.get("grade", 3),
            "class": partner.get("class"),
            "attribute": None,
            "kind": "Partner",
            "known": True,
        }
    return {
        "name": f"#{res_id}",
        "grade": 3,
        "class": None,
        "attribute": None,
        "kind": "Unknown",
        "known": False,
    }


def _banner_type(gacha_id: str) -> str:
    """Convert gacha_id to human-readable banner type."""
    if "pickup_combatant" in gacha_id:
        return "Seasonal Combatant Rescue Rate-Up"
    if "pickup_partner" in gacha_id:
        return "Seasonal Partner Rescue Rate-Up"
    if "free" in gacha_id:
        return "Free Rescue"
    if "standard" in gacha_id or "normal" in gacha_id:
        return "Standard Rescue"
    return gacha_id.replace("_", " ").title()


def _expand_batch(record: dict) -> list[dict]:
    """Expand one gacha batch record into individual pull rows."""
    try:
        rewards = json.loads(record.get("reward", "[]"))
    except (json.JSONDecodeError, TypeError):
        rewards = []
    try:
        prisms = json.loads(record.get("prism", "[]"))
    except (json.JSONDecodeError, TypeError):
        prisms = []

    gacha_id = record.get("gacha_id", "")
    try:
        ts = int(record.get("createAt", 0))
    except (ValueError, TypeError):
        ts = 0

    return [
        {
            "res_id": int(r),
            "gacha_id": gacha_id,
            "timestamp": ts,
            "is_featured": bool(prisms[i]) if i < len(prisms) else False,
        }
        for i, r in enumerate(rewards)
    ]


def _build_export(raw_records: list[dict]) -> dict:
    """Build the pity-tracker export dict from raw batch records."""
    # Expand and sort oldest → newest for sequential pull numbering
    all_pulls = []
    for rec in raw_records:
        all_pulls.extend(_expand_batch(rec))
    all_pulls.sort(key=lambda p: p["timestamp"])

    pity_by_banner: dict[str, int] = {}
    five_star_pities: list[int] = []
    four_star_pities: list[int] = []
    notable: list[dict] = []

    for i, pull in enumerate(all_pulls):
        pull_number = i + 1
        banner = _banner_type(pull["gacha_id"])
        pity_by_banner[banner] = pity_by_banner.get(banner, 0) + 1
        current_pity = pity_by_banner[banner]

        res_id = pull["res_id"]
        det = _char_details(res_id)

        if det["grade"] >= 4:
            ts = (datetime.fromtimestamp(pull["timestamp"]).strftime("%Y-%m-%d %H:%M:%S")
                  if pull["timestamp"] else "")
            notable.append({
                "name": det["name"],
                "rarity": det["grade"],
                "pity": current_pity,
                "rescue_type": banner,
                "timestamp": ts,
                "pull_number": pull_number,
                "image": CDN_BASE.format(res_id=res_id),
                "class": det["class"],
                "attribute": det["attribute"],
                "rarity_source": "exact" if det["known"] else "unknown",
                "data_warning": (None if det["known"]
                                 else f"Character #{res_id} not in database"),
            })
            if det["grade"] == 5:
                five_star_pities.append(current_pity)
                pity_by_banner[banner] = 0  # reset pity after 5-star
            else:
                four_star_pities.append(current_pity)

    banner_counts = Counter(_banner_type(p["gacha_id"]) for p in all_pulls)
    main_banner = banner_counts.most_common(1)[0][0] if banner_counts else "Unknown"

    avg_5 = round(sum(five_star_pities) / len(five_star_pities), 1) if five_star_pities else 0.0
    avg_4 = round(sum(four_star_pities) / len(four_star_pities), 1) if four_star_pities else 0.0

    return {
        "banner": main_banner,
        "total_pulls": len(all_pulls),
        "characters": notable,
        "summary": {
            "five_star_count": len(five_star_pities),
            "four_star_count": len(four_star_pities),
            "average_pity_5star": avg_5,
            "average_pity_4star": avg_4,
            "current_pity_by_banner": pity_by_banner,
            "pity_cap": PITY_CAP,
            "suspicious_pulls": 0,
        },
    }


# ── tab ───────────────────────────────────────────────────────────────────────

class RescueTab(BaseTab):
    def __init__(self, parent, context):
        super().__init__(parent, context)
        self._loaded_path: Path | None = None
        self._loaded_mtime: float = 0
        self.setup_ui()

    def setup_ui(self):
        main_frame = ttk.Frame(self.frame)
        main_frame.pack(fill=tk.BOTH, expand=True, padx=10, pady=10)

        # Header
        header = ttk.Frame(main_frame)
        header.pack(fill=tk.X, pady=(0, 8))
        ttk.Label(header, text="Rescue Records",
                  font=("Segoe UI", 14, "bold")).pack(side=tk.LEFT)
        self.status_label = ttk.Label(header, text="No rescue data captured yet",
                                       foreground=self.colors["fg_dim"])
        self.status_label.pack(side=tk.LEFT, padx=(15, 0))

        # Buttons
        btn_frame = ttk.Frame(main_frame)
        btn_frame.pack(fill=tk.X, pady=(0, 8))
        ttk.Button(btn_frame, text="Refresh", command=self.refresh_records,
                   width=12).pack(side=tk.LEFT)
        ttk.Button(btn_frame, text="Export JSON", command=self._export_json,
                   width=14).pack(side=tk.LEFT, padx=(8, 0))
        ttk.Button(btn_frame, text="Clear", command=self._clear_records,
                   width=10).pack(side=tk.LEFT, padx=(8, 0))

        # Treeview
        tree_frame = ttk.Frame(main_frame)
        tree_frame.pack(fill=tk.BOTH, expand=True)

        cols = ("type", "name", "rescue_type", "time")
        self.tree = ttk.Treeview(tree_frame, columns=cols, show="headings",
                                  selectmode="browse")
        self.tree.heading("type", text="Type")
        self.tree.heading("name", text="Rescue List")
        self.tree.heading("rescue_type", text="Rescue Type")
        self.tree.heading("time", text="Rescue Time")
        self.tree.column("type", width=120, anchor=tk.CENTER, minwidth=80)
        self.tree.column("name", width=200, minwidth=120)
        self.tree.column("rescue_type", width=320, minwidth=160)
        self.tree.column("time", width=200, anchor=tk.CENTER, minwidth=150)

        vsb = ttk.Scrollbar(tree_frame, orient=tk.VERTICAL, command=self.tree.yview)
        self.tree.configure(yscrollcommand=vsb.set)
        self.tree.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)
        vsb.pack(side=tk.RIGHT, fill=tk.Y)

        # Grade-based row colours
        self.tree.tag_configure("grade5", foreground=self.colors["yellow"])
        self.tree.tag_configure("grade4", foreground=self.colors["purple"])
        self.tree.tag_configure("grade3", foreground=self.colors["fg"])

        # How-to
        help_frame = ttk.LabelFrame(main_frame, text="How to capture Rescue Records",
                                     padding=8)
        help_frame.pack(fill=tk.X, pady=(8, 0))
        ttk.Label(
            help_frame,
            text=(
                "1. Start Capture (Debug WebSocket traffic not required)\n"
                "2. In-game: open the Rescue screen → Rescue Records tab\n"
                "3. Navigate through all pages — each page is captured automatically\n"
                "4. Records appear here in real-time while capture is running"
            ),
            justify=tk.LEFT,
            foreground=self.colors["fg_dim"],
        ).pack(anchor=tk.W)

    # ── public interface ──────────────────────────────────────────────────────

    def refresh_records(self):
        """Load the most recent rescue records file if newer than current view."""
        latest = self.context.capture_manager.get_latest_rescue_records()
        if not latest:
            self.status_label.config(text="No rescue data captured yet")
            return
        if latest == self._loaded_path and latest.stat().st_mtime == self._loaded_mtime:
            return
        self._load_file(latest)

    # ── internal ─────────────────────────────────────────────────────────────

    def _load_file(self, path: Path):
        try:
            with open(path, encoding="utf-8") as f:
                data = json.load(f)
        except Exception as e:
            self.status_label.config(text=f"Error loading file: {e}")
            return

        raw_records = data.get("records", [])
        self._loaded_path = path
        self._loaded_mtime = path.stat().st_mtime

        # Expand batches → individual pulls, newest first for display
        pulls = []
        for rec in raw_records:
            pulls.extend(_expand_batch(rec))
        pulls.sort(key=lambda p: p["timestamp"], reverse=True)

        self.tree.delete(*self.tree.get_children())
        for pull in pulls:
            det = _char_details(pull["res_id"])
            banner = _banner_type(pull["gacha_id"])
            ts = (datetime.fromtimestamp(pull["timestamp"]).strftime("%Y-%m-%d %H:%M:%S")
                  if pull["timestamp"] else "")
            tag = f"grade{min(det['grade'], 5)}"
            self.tree.insert("", tk.END,
                             values=(det["kind"], det["name"], banner, ts),
                             tags=(tag,))

        captured_at = data.get("capture_time", "")
        try:
            captured_at = datetime.fromisoformat(captured_at).strftime("%Y-%m-%d %H:%M")
        except Exception:
            pass

        self.status_label.config(
            text=f"{len(pulls)} pulls ({len(raw_records)} sessions) — captured {captured_at}"
        )

    def _export_json(self):
        """Export rescue records as pity-tracker JSON."""
        if not self._loaded_path:
            messagebox.showinfo("No Data", "Load rescue records first.")
            return

        try:
            with open(self._loaded_path, encoding="utf-8") as f:
                data = json.load(f)
        except Exception as e:
            messagebox.showerror("Error", f"Could not read file: {e}")
            return

        export = _build_export(data.get("records", []))

        path = filedialog.asksaveasfilename(
            title="Export Rescue Records",
            defaultextension=".json",
            filetypes=[("JSON files", "*.json"), ("All files", "*.*")],
            initialfile="rescue_records_export.json",
        )
        if not path:
            return

        with open(path, "w", encoding="utf-8") as f:
            json.dump(export, f, indent=2, ensure_ascii=False)

        total = export["total_pulls"]
        n5 = export["summary"]["five_star_count"]
        n4 = export["summary"]["four_star_count"]
        messagebox.showinfo(
            "Export Complete",
            f"Exported {total} pulls ({n5} five-star, {n4} four-star) to:\n{path}"
        )

    def _clear_records(self):
        self.tree.delete(*self.tree.get_children())
        self._loaded_path = None
        self._loaded_mtime = 0
        self.status_label.config(text="Cleared. Refresh to reload.")
