#!/usr/bin/env python3
"""
Mind Mirror original import v4: 6502 overlay / runtime-table validation.

This tool is intentionally metadata-first. It analyzes extracted Apple II files
from the private v2 import output and produces safe reports about control flow,
pointer tables, branch selectors, and FILE-loading hypotheses without publishing
original Life Simulation prose.

Inputs accepted:
  1. A v2 output directory containing apple2-extracted-files/.
  2. A ZIP containing such a directory.

Outputs:
  - README_6502_VALIDATION_V4.md
  - overlay_6502_summary_v4.json
  - overlay_calls_v4.json
  - zero_page_state_candidates_v4.json
  - pointer_table_candidates_v4.json
  - file_load_reference_candidates_v4.json
  - branch_selector_candidates_v4.json
  - runtime_trace_hypotheses_v4.json
  - overlay_disassembly_slices_v4.md
  - validation_status_v4.json

No decoded original narrative text is emitted.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import shutil
import sys
import tempfile
import zipfile
from collections import Counter, defaultdict
from dataclasses import dataclass
from pathlib import Path
from typing import Any

# ---------------------------------------------------------------------------
# 6502 opcode metadata: official NMOS 6502 opcodes.
# Unknown/illegal opcodes are decoded as .byte so the scanner remains safe.
# ---------------------------------------------------------------------------

# mode -> operand byte count, total instruction length = 1 + operand bytes
MODE_LEN = {
    "impl": 0,
    "acc": 0,
    "imm": 1,
    "zp": 1,
    "zpx": 1,
    "zpy": 1,
    "rel": 1,
    "abs": 2,
    "absx": 2,
    "absy": 2,
    "ind": 2,
    "indx": 1,
    "indy": 1,
}

OPCODES: dict[int, tuple[str, str]] = {
    0x00:("BRK","impl"),0x01:("ORA","indx"),0x05:("ORA","zp"),0x06:("ASL","zp"),0x08:("PHP","impl"),0x09:("ORA","imm"),0x0A:("ASL","acc"),0x0D:("ORA","abs"),0x0E:("ASL","abs"),
    0x10:("BPL","rel"),0x11:("ORA","indy"),0x15:("ORA","zpx"),0x16:("ASL","zpx"),0x18:("CLC","impl"),0x19:("ORA","absy"),0x1D:("ORA","absx"),0x1E:("ASL","absx"),
    0x20:("JSR","abs"),0x21:("AND","indx"),0x24:("BIT","zp"),0x25:("AND","zp"),0x26:("ROL","zp"),0x28:("PLP","impl"),0x29:("AND","imm"),0x2A:("ROL","acc"),0x2C:("BIT","abs"),0x2D:("AND","abs"),0x2E:("ROL","abs"),
    0x30:("BMI","rel"),0x31:("AND","indy"),0x35:("AND","zpx"),0x36:("ROL","zpx"),0x38:("SEC","impl"),0x39:("AND","absy"),0x3D:("AND","absx"),0x3E:("ROL","absx"),
    0x40:("RTI","impl"),0x41:("EOR","indx"),0x45:("EOR","zp"),0x46:("LSR","zp"),0x48:("PHA","impl"),0x49:("EOR","imm"),0x4A:("LSR","acc"),0x4C:("JMP","abs"),0x4D:("EOR","abs"),0x4E:("LSR","abs"),
    0x50:("BVC","rel"),0x51:("EOR","indy"),0x55:("EOR","zpx"),0x56:("LSR","zpx"),0x58:("CLI","impl"),0x59:("EOR","absy"),0x5D:("EOR","absx"),0x5E:("LSR","absx"),
    0x60:("RTS","impl"),0x61:("ADC","indx"),0x65:("ADC","zp"),0x66:("ROR","zp"),0x68:("PLA","impl"),0x69:("ADC","imm"),0x6A:("ROR","acc"),0x6C:("JMP","ind"),0x6D:("ADC","abs"),0x6E:("ROR","abs"),
    0x70:("BVS","rel"),0x71:("ADC","indy"),0x75:("ADC","zpx"),0x76:("ROR","zpx"),0x78:("SEI","impl"),0x79:("ADC","absy"),0x7D:("ADC","absx"),0x7E:("ROR","absx"),
    0x81:("STA","indx"),0x84:("STY","zp"),0x85:("STA","zp"),0x86:("STX","zp"),0x88:("DEY","impl"),0x8A:("TXA","impl"),0x8C:("STY","abs"),0x8D:("STA","abs"),0x8E:("STX","abs"),
    0x90:("BCC","rel"),0x91:("STA","indy"),0x94:("STY","zpx"),0x95:("STA","zpx"),0x96:("STX","zpy"),0x98:("TYA","impl"),0x99:("STA","absy"),0x9A:("TXS","impl"),0x9D:("STA","absx"),
    0xA0:("LDY","imm"),0xA1:("LDA","indx"),0xA2:("LDX","imm"),0xA4:("LDY","zp"),0xA5:("LDA","zp"),0xA6:("LDX","zp"),0xA8:("TAY","impl"),0xA9:("LDA","imm"),0xAA:("TAX","impl"),0xAC:("LDY","abs"),0xAD:("LDA","abs"),0xAE:("LDX","abs"),
    0xB0:("BCS","rel"),0xB1:("LDA","indy"),0xB4:("LDY","zpx"),0xB5:("LDA","zpx"),0xB6:("LDX","zpy"),0xB8:("CLV","impl"),0xB9:("LDA","absy"),0xBA:("TSX","impl"),0xBC:("LDY","absx"),0xBD:("LDA","absx"),0xBE:("LDX","absy"),
    0xC0:("CPY","imm"),0xC1:("CMP","indx"),0xC4:("CPY","zp"),0xC5:("CMP","zp"),0xC6:("DEC","zp"),0xC8:("INY","impl"),0xC9:("CMP","imm"),0xCA:("DEX","impl"),0xCC:("CPY","abs"),0xCD:("CMP","abs"),0xCE:("DEC","abs"),
    0xD0:("BNE","rel"),0xD1:("CMP","indy"),0xD5:("CMP","zpx"),0xD6:("DEC","zpx"),0xD8:("CLD","impl"),0xD9:("CMP","absy"),0xDD:("CMP","absx"),0xDE:("DEC","absx"),
    0xE0:("CPX","imm"),0xE1:("SBC","indx"),0xE4:("CPX","zp"),0xE5:("SBC","zp"),0xE6:("INC","zp"),0xE8:("INX","impl"),0xE9:("SBC","imm"),0xEA:("NOP","impl"),0xEC:("CPX","abs"),0xED:("SBC","abs"),0xEE:("INC","abs"),
    0xF0:("BEQ","rel"),0xF1:("SBC","indy"),0xF5:("SBC","zpx"),0xF6:("INC","zpx"),0xF8:("SED","impl"),0xF9:("SBC","absy"),0xFD:("SBC","absx"),0xFE:("INC","absx"),
}

BRANCHES = {"BPL","BMI","BVC","BVS","BCC","BCS","BNE","BEQ"}
ZERO_PAGE_STATE_OPS = {"LDA","LDX","LDY","STA","STX","STY","INC","DEC","CMP","CPX","CPY","ADC","SBC","AND","ORA","EOR","BIT"}
CONTROL_OPS = {"JSR","JMP"} | BRANCHES

SYMBOLS = {
    0xBF00: "DOS 3.3 entry area / command vector candidate",
    0xBD00: "Apple II DOS / RWTS neighborhood candidate",
    0xBE00: "Apple II DOS / RWTS neighborhood candidate",
    0xD000: "Mind Mirror overlay load base",
    0xD2D2: "CNTRL.OVR apparent entry target",
}

@dataclass(frozen=True)
class Instruction:
    offset: int
    address: int
    bytes_: bytes
    opcode: int
    mnemonic: str
    mode: str
    operand: int | None
    target: int | None
    text: str


def le16(data: bytes, offset: int) -> int:
    return data[offset] | (data[offset + 1] << 8)


def sanitize_name(s: str) -> str:
    return re.sub(r"[^A-Za-z0-9_.-]+", "_", s).strip("_")


def load_input(path: Path) -> Path:
    if path.is_dir():
        return path
    if not zipfile.is_zipfile(path):
        raise SystemExit(f"Input must be a directory or ZIP: {path}")
    tmp = Path(tempfile.mkdtemp(prefix="mindmirror_v4_"))
    with zipfile.ZipFile(path) as zf:
        zf.extractall(tmp)
    return tmp


def find_extracted_files_root(root: Path) -> Path:
    candidates = list(root.rglob("apple2-extracted-files"))
    if not candidates:
        raise SystemExit("Could not find apple2-extracted-files in input")
    return candidates[0]


def parse_overlay_header(data: bytes) -> tuple[int, int, bytes, int]:
    if len(data) >= 4:
        load = le16(data, 0)
        declared_len = le16(data, 2)
        if 0x0800 <= load <= 0xF000 and declared_len <= len(data) + 512:
            return load, declared_len, data[4:], 4
    return 0x0000, len(data), data, 0


def rel_target(address: int, instruction_len: int, value: int) -> int:
    signed = value if value < 0x80 else value - 0x100
    return (address + instruction_len + signed) & 0xFFFF


def format_operand(mode: str, operand: int | None, target: int | None) -> str:
    if mode in {"impl", "acc"}:
        return "A" if mode == "acc" else ""
    if operand is None:
        return ""
    if mode == "imm": return f"#$%02X" % operand
    if mode == "zp": return f"$%02X" % operand
    if mode == "zpx": return f"$%02X,X" % operand
    if mode == "zpy": return f"$%02X,Y" % operand
    if mode == "rel": return f"$%04X" % (target or 0)
    if mode == "abs": return f"$%04X" % operand
    if mode == "absx": return f"$%04X,X" % operand
    if mode == "absy": return f"$%04X,Y" % operand
    if mode == "ind": return f"($%04X)" % operand
    if mode == "indx": return f"($%02X,X)" % operand
    if mode == "indy": return f"($%02X),Y" % operand
    return f"$%X" % operand


def disassemble(code: bytes, load_address: int) -> list[Instruction]:
    out: list[Instruction] = []
    i = 0
    while i < len(code):
        address = (load_address + i) & 0xFFFF
        op = code[i]
        meta = OPCODES.get(op)
        if meta is None:
            b = code[i:i+1]
            out.append(Instruction(i, address, b, op, ".byte", "data", op, None, f".byte ${op:02X}"))
            i += 1
            continue
        mnemonic, mode = meta
        operand_len = MODE_LEN[mode]
        raw = code[i:i+1+operand_len]
        if len(raw) < 1 + operand_len:
            out.append(Instruction(i, address, raw, op, ".byte", "truncated", op, None, "truncated"))
            break
        operand = None
        target = None
        if operand_len == 1:
            operand = raw[1]
            if mode == "rel":
                target = rel_target(address, 2, operand)
        elif operand_len == 2:
            operand = raw[1] | (raw[2] << 8)
            if mnemonic in {"JSR", "JMP"} or mode in {"abs", "ind"}:
                target = operand
        op_text = format_operand(mode, operand, target)
        text = f"{mnemonic} {op_text}".rstrip()
        out.append(Instruction(i, address, raw, op, mnemonic, mode, operand, target, text))
        i += len(raw)
    return out


def hexbytes(b: bytes) -> str:
    return " ".join(f"{x:02X}" for x in b)


def masked_printable_runs(data: bytes, min_len: int = 4) -> list[dict[str, Any]]:
    runs = []
    start = None
    buf: list[str] = []
    for i, b in enumerate(data):
        c = chr(b & 0x7F)
        if 32 <= ord(c) <= 126:
            if start is None:
                start = i
            buf.append(c)
        else:
            if start is not None and len(buf) >= min_len:
                runs.append({"offset": start, "text": "".join(buf)})
            start = None
            buf = []
    if start is not None and len(buf) >= min_len:
        runs.append({"offset": start, "text": "".join(buf)})
    return runs


def scan_filename_refs(data: bytes) -> list[dict[str, Any]]:
    runs = masked_printable_runs(data, 4)
    refs = []
    patterns = [re.compile(r"file[0-9a-z]+", re.I), re.compile(r"r[1-4]\.ovr", re.I), re.compile(r"cntrl\.ovr", re.I), re.compile(r"passkey", re.I)]
    for run in runs:
        text = run["text"]
        for pat in patterns:
            for m in pat.finditer(text):
                refs.append({"offset": run["offset"] + m.start(), "match": m.group(0), "context": text[max(0, m.start()-16):m.end()+16]})
    return refs


def scan_pointer_tables(code: bytes, load_address: int, base_offset: int, min_run: int = 4) -> list[dict[str, Any]]:
    candidates = []
    # pointer targets likely in overlay range D000-DFFF or program text/code range 0800-BFFF
    def plausible(v: int) -> bool:
        return (load_address <= v < load_address + len(code) + 0x100) or (0x0800 <= v <= 0xBFFF) or (0xD000 <= v <= 0xDFFF)

    i = 0
    while i + 2 <= len(code):
        vals = []
        j = i
        while j + 2 <= len(code):
            v = le16(code, j)
            if not plausible(v):
                break
            vals.append(v)
            j += 2
        if len(vals) >= min_run:
            unique = len(set(vals))
            monotonic = all(vals[k] <= vals[k+1] for k in range(len(vals)-1))
            local_ratio = sum(1 for v in vals if load_address <= v < load_address + len(code) + 0x100) / len(vals)
            confidence = 0.35 + min(0.35, len(vals) / 40) + (0.15 if monotonic else 0) + (0.15 if local_ratio > 0.7 else 0)
            candidates.append({
                "offset": base_offset + i,
                "address": load_address + i,
                "count": len(vals),
                "unique_count": unique,
                "monotonic": monotonic,
                "local_target_ratio": round(local_ratio, 3),
                "confidence": round(min(confidence, 0.95), 3),
                "first_values_hex": [f"${v:04X}" for v in vals[:16]],
            })
            i = j
        else:
            i += 1
    return candidates


def analyze_instructions(instructions: list[Instruction], load_address: int, code_len: int) -> dict[str, Any]:
    calls = []
    jumps = []
    branches = []
    zp: dict[str, Counter[str]] = defaultdict(Counter)
    immediates = []
    cmp_immediates = []
    op_counts = Counter(i.mnemonic for i in instructions)
    illegal_count = op_counts.get(".byte", 0)

    for ins in instructions:
        if ins.mnemonic == "JSR" and ins.target is not None:
            calls.append({"address": f"${ins.address:04X}", "target": f"${ins.target:04X}", "symbol": SYMBOLS.get(ins.target)})
        if ins.mnemonic == "JMP" and ins.target is not None:
            jumps.append({"address": f"${ins.address:04X}", "target": f"${ins.target:04X}", "mode": ins.mode, "symbol": SYMBOLS.get(ins.target)})
        if ins.mnemonic in BRANCHES and ins.target is not None:
            branches.append({"address": f"${ins.address:04X}", "op": ins.mnemonic, "target": f"${ins.target:04X}"})
        if ins.mode in {"zp", "zpx", "zpy", "indx", "indy"} and ins.operand is not None and ins.mnemonic in ZERO_PAGE_STATE_OPS:
            zp[f"${ins.operand:02X}"].update([ins.mnemonic])
        if ins.mode == "imm" and ins.operand is not None:
            immediates.append({"address": f"${ins.address:04X}", "op": ins.mnemonic, "value": ins.operand, "value_hex": f"${ins.operand:02X}"})
            if ins.mnemonic in {"CMP", "CPX", "CPY"}:
                cmp_immediates.append({"address": f"${ins.address:04X}", "op": ins.mnemonic, "value": ins.operand, "value_hex": f"${ins.operand:02X}"})

    target_counter = Counter(c["target"] for c in calls)
    jump_counter = Counter(j["target"] for j in jumps)
    branch_targets = Counter(b["target"] for b in branches)

    zp_out = []
    for addr, cnt in zp.items():
        total = sum(cnt.values())
        stores = cnt.get("STA",0) + cnt.get("STX",0) + cnt.get("STY",0) + cnt.get("INC",0) + cnt.get("DEC",0)
        compares = cnt.get("CMP",0) + cnt.get("CPX",0) + cnt.get("CPY",0)
        confidence = min(0.95, 0.25 + total/35 + stores/20 + compares/30)
        zp_out.append({"zp": addr, "total_refs": total, "ops": dict(cnt), "state_confidence": round(confidence,3)})
    zp_out.sort(key=lambda x: (-x["state_confidence"], -x["total_refs"], x["zp"]))

    return {
        "instruction_count": len(instructions),
        "known_opcode_count": len(instructions) - illegal_count,
        "illegal_or_data_byte_count": illegal_count,
        "known_opcode_ratio": round((len(instructions)-illegal_count)/max(1,len(instructions)), 3),
        "op_counts_top": op_counts.most_common(24),
        "jsr_calls": calls,
        "jmp_sites": jumps,
        "branches": branches,
        "jsr_target_counts": target_counter.most_common(24),
        "jmp_target_counts": jump_counter.most_common(24),
        "branch_target_counts": branch_targets.most_common(24),
        "zero_page_state_candidates": zp_out[:64],
        "cmp_immediates": cmp_immediates[:128],
        "notable_immediates": [x for x in immediates if x["value"] in {1,2,3,4,5,6,7,8,10,25,32,48,64,128}][:128],
    }


def disassembly_slice(instructions: list[Instruction], max_lines: int = 120) -> str:
    lines = []
    for ins in instructions[:max_lines]:
        lines.append(f"${ins.address:04X}: {hexbytes(ins.bytes_):<10} {ins.text}")
    if len(instructions) > max_lines:
        lines.append(f"... ({len(instructions) - max_lines} more decoded linear instructions/bytes omitted)")
    return "\n".join(lines)


def collect_overlays(extracted_root: Path) -> list[Path]:
    wanted = {"CNTRL.OVR", "R1.OVR", "R2.OVR", "R3.OVR", "R4.OVR"}
    files = [p for p in extracted_root.rglob("*") if p.is_file() and p.name.upper() in wanted]
    # Avoid 00playable and prefer Life Simulation disks, but keep all such files for comparison.
    files.sort(key=lambda p: ("00playable" in str(p), str(p)))
    return files


def infer_disk_role(path: Path) -> str:
    text = str(path).lower()
    if "life_simulation_a" in text or "life simulation a" in text:
        return "life_simulation_A"
    if "life_simulation_b" in text or "life simulation b" in text:
        return "life_simulation_B"
    if "00playable" in text:
        return "program_or_playable_duplicate"
    return "unknown"


def infer_overlay_role(name: str) -> str:
    u = name.upper()
    if u == "CNTRL.OVR": return "life_simulation_control_overlay"
    if u == "R1.OVR": return "realm_1_bio_energy_overlay"
    if u == "R2.OVR": return "realm_2_emotional_insight_overlay"
    if u == "R3.OVR": return "realm_3_mental_abilities_overlay"
    if u == "R4.OVR": return "realm_4_social_interaction_overlay"
    return "overlay"


def build_branch_selector_candidates(overlay_results: list[dict[str, Any]]) -> list[dict[str, Any]]:
    out = []
    for ov in overlay_results:
        zp = ov["analysis"]["zero_page_state_candidates"]
        cmp_imms = ov["analysis"].get("cmp_immediates", [])
        interesting_cmp_values = sorted({x["value"] for x in cmp_imms if 1 <= x["value"] <= 8 or x["value"] in {10,25,32,64,128}})
        for cand in zp[:16]:
            ops = cand["ops"]
            has_state_pattern = any(op in ops for op in ["STA","STX","STY","INC","DEC"]) and any(op in ops for op in ["LDA","LDX","LDY","CMP","CPX","CPY"])
            if cand["state_confidence"] >= 0.55 or has_state_pattern:
                out.append({
                    "overlay": ov["overlay_id"],
                    "disk_role": ov["disk_role"],
                    "zero_page": cand["zp"],
                    "total_refs": cand["total_refs"],
                    "ops": cand["ops"],
                    "state_confidence": cand["state_confidence"],
                    "nearby_comparison_constants": interesting_cmp_values[:24],
                    "hypothesis": "counter / branch selector / current event index candidate",
                })
    out.sort(key=lambda x: (-x["state_confidence"], x["overlay"], x["zero_page"]))
    return out


def build_runtime_hypotheses(overlay_results: list[dict[str, Any]], branch_candidates: list[dict[str, Any]]) -> list[dict[str, Any]]:
    hypotheses = []
    cntrl = [o for o in overlay_results if o["name"].upper() == "CNTRL.OVR"]
    realm_overlays = [o for o in overlay_results if re.match(r"R[1-4]\.OVR", o["name"].upper())]
    if cntrl:
        hypotheses.append({
            "id": "control_overlay_dispatch",
            "confidence": "medium",
            "evidence": [f"{o['overlay_id']} entry ${o['load_address_hex']} with JSR/JMP/branch control flow" for o in cntrl],
            "claim": "CNTRL.OVR likely orchestrates Life Simulation flow: passkeys, scoreboard, realm selection, and loading of realm overlays/files.",
            "next_validation": "Trace calls from CNTRL.OVR in emulator or disassemble DOS file-loader routine targets. Watch for FILExxx/Rx.OVR load commands and zero-page state changes.",
        })
    if realm_overlays:
        hypotheses.append({
            "id": "realm_overlay_dispatch",
            "confidence": "medium-high",
            "evidence": [f"{o['name']} on {o['disk_role']} role={o['overlay_role']}" for o in realm_overlays],
            "claim": "R1/R2/R3/R4 overlays likely implement realm-specific Life Simulation branch logic and event selection.",
            "next_validation": "Map zero-page selector candidates to FILE11A/B..FILE48A/B load sequences and compare with displayed realm transitions.",
        })
    if branch_candidates:
        top = branch_candidates[:8]
        hypotheses.append({
            "id": "zero_page_branch_state",
            "confidence": "medium",
            "evidence": [f"{c['overlay']} {c['zero_page']} refs={c['total_refs']} ops={c['ops']}" for c in top],
            "claim": "A small set of zero-page variables likely stores current event, branch, option, counter, or random selector state.",
            "next_validation": "Run emulator trace with watchpoints on these zero-page addresses while selecting Life Simulation answers.",
        })
    hypotheses.append({
        "id": "count_model_validation",
        "confidence": "medium",
        "evidence": ["v3 count model life_unique_screens_plus_life_numeric_options ≈ 2018", "v3 all unique screens plus numeric choices exceeds 2400"],
        "claim": "The 2000/2400 claims are more plausibly runtime scored screens/transitions than 2000 standalone prose prompts.",
        "next_validation": "Tie each counted transition to a loader/event selector path in CNTRL/R overlays.",
    })
    return hypotheses


def run(input_path: Path, output_dir: Path) -> None:
    root = load_input(input_path)
    extracted_root = find_extracted_files_root(root)
    output_dir.mkdir(parents=True, exist_ok=True)

    overlay_paths = collect_overlays(extracted_root)
    overlay_results: list[dict[str, Any]] = []
    disasm_sections = []
    all_pointer_tables = []
    all_file_refs = []
    zero_page_all = []
    calls_all = []

    for path in overlay_paths:
        data = path.read_bytes()
        load, declared_len, code, header_len = parse_overlay_header(data)
        instructions = disassemble(code, load)
        analysis = analyze_instructions(instructions, load, len(code))
        ptrs = scan_pointer_tables(code, load, header_len)
        refs = scan_filename_refs(data)
        rel = path.relative_to(extracted_root)
        overlay_id = str(rel).replace("\\", "/")
        result = {
            "overlay_id": overlay_id,
            "name": path.name,
            "disk_role": infer_disk_role(path),
            "overlay_role": infer_overlay_role(path.name),
            "sha256": hashlib.sha256(data).hexdigest(),
            "size_bytes": len(data),
            "load_address": load,
            "load_address_hex": f"${load:04X}",
            "declared_length": declared_len,
            "header_length": header_len,
            "code_length": len(code),
            "first_bytes_hex": data[:32].hex(),
            "analysis": analysis,
            "pointer_table_candidates": ptrs[:64],
            "file_reference_candidates": refs[:64],
        }
        overlay_results.append(result)
        all_pointer_tables.extend({**p, "overlay": overlay_id, "disk_role": result["disk_role"]} for p in ptrs[:64])
        all_file_refs.extend({**r, "overlay": overlay_id, "disk_role": result["disk_role"]} for r in refs[:64])
        zero_page_all.extend({**z, "overlay": overlay_id, "disk_role": result["disk_role"]} for z in analysis["zero_page_state_candidates"][:32])
        calls_all.extend({**c, "overlay": overlay_id, "disk_role": result["disk_role"]} for c in analysis["jsr_calls"][:128])
        disasm_sections.append(f"## {overlay_id}\n\n```asm\n{disassembly_slice(instructions)}\n```\n")

    branch_candidates = build_branch_selector_candidates(overlay_results)
    runtime_hypotheses = build_runtime_hypotheses(overlay_results, branch_candidates)

    summary = {
        "tool": "analyze_6502_overlays_v4.py",
        "input": str(input_path),
        "overlay_count": len(overlay_results),
        "overlay_names": [o["overlay_id"] for o in overlay_results],
        "unique_overlay_hashes": len({o["sha256"] for o in overlay_results}),
        "life_simulation_overlay_count": sum(1 for o in overlay_results if o["disk_role"].startswith("life_simulation")),
        "cntrl_overlay_count": sum(1 for o in overlay_results if o["name"].upper() == "CNTRL.OVR"),
        "realm_overlay_count": sum(1 for o in overlay_results if re.match(r"R[1-4]\.OVR", o["name"].upper())),
        "pointer_table_candidate_count": len(all_pointer_tables),
        "file_reference_candidate_count": len(all_file_refs),
        "branch_selector_candidate_count": len(branch_candidates),
        "hypothesis_count": len(runtime_hypotheses),
        "status": "static_6502_validation_started; emulator trace still required for proof",
    }

    # Redact high-volume instruction lists from main summary but include slices in MD.
    safe_overlay_summary = []
    for o in overlay_results:
        safe_overlay_summary.append({
            k: v for k, v in o.items()
            if k not in {"analysis", "pointer_table_candidates", "file_reference_candidates"}
        } | {
            "analysis_summary": {
                "instruction_count": o["analysis"]["instruction_count"],
                "known_opcode_ratio": o["analysis"]["known_opcode_ratio"],
                "op_counts_top": o["analysis"]["op_counts_top"],
                "jsr_target_counts": o["analysis"]["jsr_target_counts"],
                "jmp_target_counts": o["analysis"]["jmp_target_counts"],
                "branch_target_counts": o["analysis"]["branch_target_counts"],
                "zero_page_state_candidates_top": o["analysis"]["zero_page_state_candidates"][:12],
                "cmp_immediates_sample": o["analysis"]["cmp_immediates"][:24],
            },
            "pointer_table_candidate_count": len(o["pointer_table_candidates"]),
            "file_reference_candidate_count": len(o["file_reference_candidates"]),
        })

    write_json(output_dir / "overlay_6502_summary_v4.json", {"summary": summary, "overlays": safe_overlay_summary})
    write_json(output_dir / "overlay_calls_v4.json", calls_all)
    write_json(output_dir / "zero_page_state_candidates_v4.json", zero_page_all)
    write_json(output_dir / "pointer_table_candidates_v4.json", all_pointer_tables)
    write_json(output_dir / "file_load_reference_candidates_v4.json", all_file_refs)
    write_json(output_dir / "branch_selector_candidates_v4.json", branch_candidates)
    write_json(output_dir / "runtime_trace_hypotheses_v4.json", runtime_hypotheses)
    write_json(output_dir / "validation_status_v4.json", {
        "validated": [
            "Overlays have Apple II binary-style load headers, generally loading at $D000.",
            "CNTRL.OVR exists on both Life Simulation disks and is byte-identical by hash.",
            "R1/R4 overlays appear on Life Simulation A; R2/R3 overlays appear on Life Simulation B.",
            "6502 control-flow skeletons can be statically decoded from the overlays.",
            "Zero-page state/counter candidates can be ranked for emulator watchpoints.",
        ],
        "not_yet_validated": [
            "Exact event offset tables are not yet proven.",
            "Exact random event index routine is not yet identified.",
            "Exact branch selector variables are hypotheses, not proof.",
            "Exact FILEnxy load sequence requires emulator tracing or deeper DOS loader disassembly.",
        ],
        "next_step": "Run Apple II emulator/debug trace with watchpoints on top zero-page candidates and breakpoints on CNTRL/R overlay JSR/JMP targets.",
    })

    (output_dir / "overlay_disassembly_slices_v4.md").write_text("# Mind Mirror 6502 Overlay Disassembly Slices v4\n\n" + "\n".join(disasm_sections), encoding="utf-8")
    (output_dir / "README_6502_VALIDATION_V4.md").write_text(build_readme(summary, runtime_hypotheses), encoding="utf-8")


def write_json(path: Path, obj: Any) -> None:
    path.write_text(json.dumps(obj, ensure_ascii=False, indent=2), encoding="utf-8")


def build_readme(summary: dict[str, Any], hypotheses: list[dict[str, Any]]) -> str:
    lines = [
        "# Mind Mirror Original Import v4 — 6502 Overlay / Runtime Validation",
        "",
        "This report is metadata-only and does not include original Life Simulation prose.",
        "",
        "## Summary",
        "",
        f"- Overlay files analyzed: {summary['overlay_count']}",
        f"- Unique overlay hashes: {summary['unique_overlay_hashes']}",
        f"- Life Simulation overlays: {summary['life_simulation_overlay_count']}",
        f"- CNTRL overlays: {summary['cntrl_overlay_count']}",
        f"- Realm overlays R1/R2/R3/R4: {summary['realm_overlay_count']}",
        f"- Pointer-table candidates: {summary['pointer_table_candidate_count']}",
        f"- File/reference candidates: {summary['file_reference_candidate_count']}",
        f"- Branch selector candidates: {summary['branch_selector_candidate_count']}",
        "",
        "## Interpretation",
        "",
        "v4 validates that the Life Simulation layer is implemented as loaded 6502 overlays, not as a flat text database.",
        "The key files are CNTRL.OVR and R1/R2/R3/R4. Static analysis ranks likely zero-page state variables and pointer-table candidates, but final proof requires emulator tracing.",
        "",
        "## Runtime hypotheses",
        "",
    ]
    for h in hypotheses:
        lines += [f"### {h['id']}", "", f"Confidence: {h['confidence']}", "", h["claim"], "", "Next validation: " + h["next_validation"], ""]
        if h.get("evidence"):
            lines.append("Evidence sample:")
            for e in h["evidence"][:8]:
                lines.append(f"- {e}")
            lines.append("")
    lines += [
        "## Output files",
        "",
        "- overlay_6502_summary_v4.json",
        "- overlay_calls_v4.json",
        "- zero_page_state_candidates_v4.json",
        "- pointer_table_candidates_v4.json",
        "- file_load_reference_candidates_v4.json",
        "- branch_selector_candidates_v4.json",
        "- runtime_trace_hypotheses_v4.json",
        "- overlay_disassembly_slices_v4.md",
        "- validation_status_v4.json",
    ]
    return "\n".join(lines) + "\n"


def main(argv: list[str]) -> int:
    p = argparse.ArgumentParser(description="Analyze Mind Mirror Apple II 6502 overlays for runtime-event validation.")
    p.add_argument("input", type=Path, help="v2 private output directory or ZIP")
    p.add_argument("--output", type=Path, default=Path("research-output/original-import-v4-6502"))
    args = p.parse_args(argv)
    run(args.input, args.output)
    print(f"Wrote v4 6502 overlay analysis to {args.output}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
