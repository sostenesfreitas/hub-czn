from scripts.ko_pipeline.detemplatize import detemplatize


def test_empty_string():
    assert detemplatize("") == ("", [])


def test_plain_text_unchanged():
    assert detemplatize("On Critical Hit") == ("On Critical Hit", [])


def test_dollar_term_is_unwrapped_and_recorded():
    assert detemplatize("inflict $Agony$") == ("inflict Agony", ["Agony"])


def test_multiword_term():
    assert detemplatize("from the $Draw pile$") == ("from the Draw pile", ["Draw pile"])


def test_placeholder_becomes_value_token():
    assert detemplatize("draw #result_ev_0# cards") == ("draw X cards", [])


def test_cal_expression_becomes_value_token():
    assert detemplatize("damage {cal}#rev_0_0#*100{/}% up") == ("damage X% up", [])


def test_color_tags_stripped_keeping_inner_text():
    assert detemplatize("<cc>50</>% chance") == ("50% chance", [])


def test_br_becomes_space():
    assert detemplatize("line one<br>line two") == ("line one line two", [])


def test_duplicate_terms_recorded_once_in_order():
    text, terms = detemplatize("$Fortitude$ then $Agony$ then $Fortitude$")
    assert text == "Fortitude then Agony then Fortitude"
    assert terms == ["Fortitude", "Agony"]


def test_full_real_example():
    raw = "On Critical Hit, <cc>50</>% chance to <cc>#rev_0_0#</> $Agony$"
    assert detemplatize(raw) == ("On Critical Hit, 50% chance to X Agony", ["Agony"])


def test_whitespace_collapsed():
    assert detemplatize("a  <cc></>  b") == ("a b", [])


def test_cal_expression_spanning_lines():
    assert detemplatize("damage {cal}#rev_0_0#\n*100{/}% up") == ("damage X% up", [])
