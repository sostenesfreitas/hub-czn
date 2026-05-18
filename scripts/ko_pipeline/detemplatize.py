"""Convert raw CZN game text markup into clean display text.

The game stores localised strings with templating markup:
  $term$            — jargon/keyword highlight
  #placeholder#     — a runtime numeric value
  {cal}expr{/}      — a runtime calculation expression
  <cc>..</>, <br>,  — colour / formatting tags
  <color_*>, <u>, <i>, <rc>, <#hex>

`detemplatize` strips formatting, replaces runtime values with a readable
token, unwraps `$term$` keeping the term, and returns the clean text plus
the ordered, de-duplicated list of jargon terms it found.
"""
from __future__ import annotations

import re

VALUE_TOKEN = "X"

_CAL = re.compile(r"\{cal\}.*?\{/\}")
_PLACEHOLDER = re.compile(r"#[^#]+#")
_BR = re.compile(r"<br\s*/?>", re.IGNORECASE)
_TAG = re.compile(r"<[^>]+>")
_TERM = re.compile(r"\$([^$]+)\$")
_WS = re.compile(r"\s+")


def detemplatize(raw: str) -> tuple[str, list[str]]:
    """Return (clean_text, jargon_terms) for a raw game string."""
    if not raw:
        return "", []

    text = _CAL.sub(VALUE_TOKEN, raw)
    text = _PLACEHOLDER.sub(VALUE_TOKEN, text)
    text = _BR.sub(" ", text)
    text = _TAG.sub("", text)

    terms: list[str] = []

    def _capture(match: re.Match[str]) -> str:
        term = match.group(1).strip()
        if term and term not in terms:
            terms.append(term)
        return term

    text = _TERM.sub(_capture, text)
    text = _WS.sub(" ", text).strip()
    return text, terms
