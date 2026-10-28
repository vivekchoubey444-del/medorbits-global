import importlib.util
from pathlib import Path
p=Path(__file__).parents[1]/"agent.py"
s=importlib.util.spec_from_file_location("agent",p); m=importlib.util.module_from_spec(s); s.loader.exec_module(m)
def test_traversal_rejected(tmp_path):
    try: m.safe_target(tmp_path.resolve(),"../bad.txt")
    except ValueError: return
    assert False
def test_json_render():
    assert b'"ok": true' in m.render({"path":"x.json","kind":"json","data":{"ok":True}})
