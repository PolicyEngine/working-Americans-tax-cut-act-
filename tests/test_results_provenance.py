from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


def test_policyengine_layout_has_no_model_provenance_footer():
    layout = (ROOT / "frontend/app/layout.tsx").read_text()

    assert "policyengine.py" not in layout
    assert "v4.4.4" not in layout


def test_results_footnote_shows_model_provenance():
    aggregate = (ROOT / "frontend/components/AggregateImpact.tsx").read_text()

    assert "These estimates are static" in aggregate
    assert "policyengine.py" in aggregate
    assert "v4.4.4" in aggregate
