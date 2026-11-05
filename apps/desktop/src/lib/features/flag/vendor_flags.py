"""Reproduce the bundled flag data without installing or executing npm packages.

Run from any directory: python path/to/vendor_flags.py
Only pinned public archives are read; npm SHA-512 integrity is verified.
"""
import base64
import hashlib
import io
import json
from pathlib import Path
import tarfile
from urllib.request import urlopen
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parent
VERSIONS = {"flag-icons": "7.6.0", "cldr-localenames-full": "49.0.0"}


def package(name):
    version = VERSIONS[name]
    with urlopen(f"https://registry.npmjs.org/{name}/{version}", timeout=60) as response:
        meta = json.load(response)
    with urlopen(meta["dist"]["tarball"], timeout=60) as response:
        data = response.read()
    digest = "sha512-" + base64.b64encode(hashlib.sha512(data).digest()).decode()
    if digest != meta["dist"]["integrity"]:
        raise RuntimeError(f"Integrity mismatch: {name}")
    return tarfile.open(fileobj=io.BytesIO(data), mode="r:gz"), {
        "version": version, "url": meta["dist"]["tarball"], "integrity": digest
    }


def read(archive, member):
    stream = archive.extractfile("package/" + member)
    if stream is None:
        raise RuntimeError(f"Missing archive file: {member}")
    return stream.read().decode("utf-8")


def save(relative, data):
    path = ROOT / relative
    path.parent.mkdir(parents=True, exist_ok=True)
    if path.exists():
        existing = path.read_text(encoding="utf-8")
        if existing != data:
            raise RuntimeError(f"Refusing to replace changed generated file: {path}")
    else:
        path.write_text(data, encoding="utf-8", newline="\n")


flags, flag_source = package("flag-icons")
cldr, cldr_source = package("cldr-localenames-full")
countries = [row for row in json.loads(read(flags, "country.json")) if row.get("iso")]
if len(countries) != 249 or len({row["code"] for row in countries}) != 249:
    raise RuntimeError("Expected the 249 distinct ISO country/territory entries")
names = {
    lang: json.loads(read(cldr, f"main/{lang}/territories.json"))["main"][lang]["localeDisplayNames"]["territories"]
    for lang in ["bn", "en"]
}
rows = []
for country in countries:
    code = country["code"]
    if len(code) != 2 or not code.isalpha() or not code.islower():
        raise RuntimeError(f"Invalid ISO code: {code}")
    svg = read(flags, f"flags/4x3/{code}.svg")
    root = ET.fromstring(svg)
    for node in root.iter():
        if node.tag.rsplit("}", 1)[-1] in {"script", "foreignObject"}:
            raise RuntimeError(f"Unexpected active SVG element: {code}")
        for key, value in node.attrib.items():
            key = key.rsplit("}", 1)[-1]
            if key.lower().startswith("on") or (key == "href" and not value.startswith("#")):
                raise RuntimeError(f"Unexpected active SVG attribute: {code}")
    labels = {lang: names[lang][code.upper()] for lang in names}
    rows.append({"id": code, "label": labels, "continent": country.get("continent", "")})
    save(f"flags/{code}.svg", svg)
rows.sort(key=lambda row: row["id"])
save("countries.json", json.dumps(rows, ensure_ascii=False, indent=2) + "\n")
save("licenses/flag-icons-LICENSE.txt", read(flags, "LICENSE"))
save("licenses/CLDR-LICENSE.txt", read(cldr, "LICENSE"))
save("sources.json", json.dumps({"flag-icons": flag_source, "Unicode CLDR": cldr_source}, indent=2) + "\n")
print(f"Bundled {len(rows)} flags and Bengali/English labels; {sum((ROOT / ('flags/' + row['id'] + '.svg')).stat().st_size for row in rows):,} SVG bytes")
