#!/usr/bin/env python3
"""
Fix pg_dump data-only files where app_user rows have misaligned registration_status.

Handles positional INSERTs (`INSERT INTO public.app_user VALUES (...)`), column-list INSERTs,
and a small regex fallback for `NULL, 'en', true, false, 0` fragments.

Second pass: coerce legacy integer ``0``/``1`` in the ``force_password_change`` slot to
``false``/``true`` (scoped to ``app_user`` INSERT/COPY blocks only — not global).

Usage:
  python3 scripts/patch_payroll_dump_app_user.py path/to/dump.sql -o /tmp/fixed.sql
"""

from __future__ import annotations

import argparse
import re
import shutil
import sys

# Column-list form: first "(" is the column list, followed by VALUES
INSERT_HEAD = re.compile(
    r"INSERT\s+INTO\s+(?:ONLY\s+)?(?:(?:public|pg_catalog)\.)?(?:\"app_user\"|app_user)\s*\(",
    re.IGNORECASE | re.DOTALL,
)

# Positional form: INSERT INTO ... app_user VALUES ( ... ) — no "(" immediately after table name
POS_VALUES_HEAD = re.compile(
    r"INSERT\s+INTO\s+(?:ONLY\s+)?(?:(?:public|pg_catalog)\.)?(?:\"app_user\"|app_user)\s+VALUES\s*\(",
    re.IGNORECASE | re.DOTALL,
)

# COPY … app_user — data lines until \. terminator (only used when present)
COPY_APP_USER_HEAD = re.compile(
    r"^COPY\s+(?:public\.)?(?:\"app_user\"|app_user)\s+",
    re.IGNORECASE | re.MULTILINE,
)

# Full 15-column ORM row: force_password_change is 0-based index 10
_APP_USER_NCOL = 15
_FORCE_PW_IDX = 10


def _split_top_level_commas(inner: str) -> list[str]:
    """Split comma-separated column names (no nested parens in column list)."""
    parts: list[str] = []
    cur: list[str] = []
    depth = 0
    in_quote = False
    i = 0
    while i < len(inner):
        c = inner[i]
        if in_quote:
            cur.append(c)
            if c == '"' and (i == 0 or inner[i - 1] != "\\"):
                in_quote = False
            i += 1
            continue
        if c == '"':
            in_quote = True
            cur.append(c)
            i += 1
            continue
        if c == "(":
            depth += 1
            cur.append(c)
        elif c == ")":
            depth -= 1
            cur.append(c)
        elif c == "," and depth == 0:
            parts.append("".join(cur).strip())
            cur = []
        else:
            cur.append(c)
        i += 1
    if cur:
        parts.append("".join(cur).strip())
    return [p for p in parts if p]


def _norm_col(name: str) -> str:
    return name.strip().strip('"').lower()


def _closing_paren_index(sql: str, open_idx: int) -> int | None:
    """sql[open_idx] == '(' — return index of matching ')' respecting SQL string literals."""
    if open_idx >= len(sql) or sql[open_idx] != "(":
        return None
    depth = 0
    i = open_idx
    in_str = False
    esc = False
    while i < len(sql):
        ch = sql[i]
        if in_str:
            if esc:
                esc = False
            elif ch == "\\":
                esc = True
            elif ch == "'" and i + 1 < len(sql) and sql[i + 1] == "'":
                i += 1
            elif ch == "'":
                in_str = False
            i += 1
            continue
        if ch == "'":
            in_str = True
            i += 1
            continue
        if ch == "(":
            depth += 1
        elif ch == ")":
            depth -= 1
            if depth == 0:
                return i
        i += 1
    return None


def _read_pg_value(s: str, i: int) -> tuple[str, int]:
    """Read one PostgreSQL literal from a VALUES tuple; return (token_text, next_index)."""
    n = len(s)
    while i < n and s[i] in " \t\n\r":
        i += 1
    if i >= n:
        return "", i
    if s[i] == "'":
        start = i
        i += 1
        while i < n:
            if s[i] == "'" and i + 1 < n and s[i + 1] == "'":
                i += 2
                continue
            if s[i] == "'":
                i += 1
                break
            i += 1
        return s[start:i], i
    start = i
    while i < n and s[i] != ",":
        i += 1
    return s[start:i].strip(), i


def _split_pg_tuple_values(s: str) -> list[str] | None:
    """Split top-level comma-separated VALUES inside a single `(...)`."""
    vals: list[str] = []
    i = 0
    n = len(s)
    while i < n:
        while i < n and s[i] in " \t\n\r":
            i += 1
        if i >= n:
            break
        v, j = _read_pg_value(s, i)
        vals.append(v)
        i = j
        while i < n and s[i] in " \t\n\r":
            i += 1
        if i >= n:
            break
        if s[i] == ",":
            i += 1
            continue
        return None
    return vals


def _join_pg_tuple_values(vals: list[str]) -> str:
    return ", ".join(vals)


def _fix_force_password_in_tuple_inner(inner: str) -> tuple[str, bool]:
    """Coerce 0/1 to false/true in the force_password_change column (index 10 of 15)."""
    parts = _split_pg_tuple_values(inner)
    if parts is None or len(parts) != _APP_USER_NCOL:
        return inner, False
    raw = parts[_FORCE_PW_IDX].strip()
    if raw == "0":
        parts[_FORCE_PW_IDX] = "false"
        return _join_pg_tuple_values(parts), True
    if raw == "1":
        parts[_FORCE_PW_IDX] = "true"
        return _join_pg_tuple_values(parts), True
    return inner, False


def _rewrite_positional_app_user_values(sql: str, mutator) -> tuple[str, bool]:
    """Walk INSERT INTO … app_user VALUES (…) and apply mutator(inner) -> (new_inner, changed)."""
    parts: list[str] = []
    pos = 0
    changed = False
    for m in POS_VALUES_HEAD.finditer(sql):
        parts.append(sql[pos : m.start()])
        open_paren = m.end() - 1
        close_paren = _closing_paren_index(sql, open_paren)
        if close_paren is None:
            pos = m.end()
            continue
        inner = sql[open_paren + 1 : close_paren]
        new_inner, ch = mutator(inner)
        if ch:
            changed = True
            parts.append(sql[m.start() : open_paren + 1])
            parts.append(new_inner)
            parts.append(sql[close_paren])
            pos = close_paren + 1
        else:
            parts.append(sql[m.start() : close_paren + 1])
            pos = close_paren + 1
    parts.append(sql[pos:])
    return "".join(parts), changed


def _fix_force_password_in_column_insert_stmt(stmt: str) -> tuple[str, bool]:
    m = INSERT_HEAD.search(stmt)
    if not m:
        return stmt, False
    open_paren = stmt.find("(", m.end() - 1)
    depth = 0
    i = open_paren
    col_end = -1
    while i < len(stmt):
        if stmt[i] == "(":
            depth += 1
        elif stmt[i] == ")":
            depth -= 1
            if depth == 0:
                col_end = i + 1
                break
        i += 1
    if col_end < 0:
        return stmt, False
    col_inner = stmt[open_paren + 1 : col_end - 1] if open_paren >= 0 else ""
    cols = [_norm_col(c) for c in _split_top_level_commas(col_inner)]
    try:
        fi = cols.index("force_password_change")
    except ValueError:
        return stmt, False

    rest = stmt[col_end:]
    mval = re.search(r"VALUES\s*\(", rest, re.IGNORECASE)
    if not mval:
        return stmt, False
    open_v = col_end + mval.end() - 1
    if open_v >= len(stmt) or stmt[open_v] != "(":
        return stmt, False
    close_v = _closing_paren_index(stmt, open_v)
    if close_v is None:
        return stmt, False
    inner = stmt[open_v + 1 : close_v]
    parts = _split_pg_tuple_values(inner)
    if parts is None or len(parts) != len(cols) or fi >= len(parts):
        return stmt, False
    raw = parts[fi].strip()
    if raw == "0":
        parts[fi] = "false"
    elif raw == "1":
        parts[fi] = "true"
    else:
        return stmt, False
    new_inner = _join_pg_tuple_values(parts)
    return stmt[: open_v + 1] + new_inner + stmt[close_v:], True


def _fix_copy_app_user_block(block: str) -> tuple[str, bool]:
    """
    COPY … app_user … FROM stdin; then lines until \\.
    Tab-separated; NULL is often \\N. Fix column index 10 when value is 0 or 1.
    """
    lines = block.splitlines(keepends=True)
    if not lines:
        return block, False
    changed = False
    out: list[str] = []
    data = False
    for line in lines:
        if not data:
            out.append(line)
            if re.search(r"FROM\s+stdin\s*;?\s*$", line, re.IGNORECASE):
                data = True
            continue
        if line.startswith("\\."):
            out.append(line)
            break
        if not line.strip():
            out.append(line)
            continue
        row = line.rstrip("\r\n")
        sep = "\t"
        cols = row.split(sep)
        if len(cols) == _APP_USER_NCOL and cols[_FORCE_PW_IDX] in ("0", "1"):
            cols[_FORCE_PW_IDX] = "false" if cols[_FORCE_PW_IDX] == "0" else "true"
            nl = "\n" if line.endswith("\n") else ""
            eol = "\r\n" if line.endswith("\r\n") else nl
            out.append(sep.join(cols) + (eol if eol else "\n"))
            changed = True
        else:
            out.append(line)
    return "".join(out), changed


def _apply_force_password_copy_fix(sql: str) -> tuple[str, bool]:
    """COPY public.app_user blocks only; data lines until \\."""
    pos = 0
    out: list[str] = []
    changed = False
    for m in COPY_APP_USER_HEAD.finditer(sql):
        out.append(sql[pos : m.start()])
        rest = sql[m.start() :]
        rm = re.search(r"^\s*\\\.\s*$", rest, re.MULTILINE)
        if not rm:
            out.append(rest)
            return "".join(out), changed
        blk = rest[: rm.end()]
        fixed_b, c3 = _fix_copy_app_user_block(blk)
        changed |= c3
        out.append(fixed_b)
        pos = m.start() + rm.end()
    out.append(sql[pos:])
    return "".join(out), changed


def _apply_force_password_bool_fix(sql: str) -> tuple[str, bool]:
    """Second pass: 0/1 → false/true in force_password_change within app_user INSERT/COPY only."""
    any_changed = False

    sql, ch = _rewrite_positional_app_user_values(sql, _fix_force_password_in_tuple_inner)
    any_changed |= ch

    blocks = _find_insert_blocks(sql)
    if blocks:
        parts: list[str] = []
        pos = 0
        for start, end in blocks:
            parts.append(sql[pos:start])
            chunk = sql[start:end]
            fixed, c2 = _fix_force_password_in_column_insert_stmt(chunk)
            any_changed |= c2
            parts.append(fixed)
            pos = end
        parts.append(sql[pos:])
        sql = "".join(parts)

    sql, c3 = _apply_force_password_copy_fix(sql)
    any_changed |= c3

    return sql, any_changed


def _patch_positional_tuple(inner: str) -> tuple[str, bool]:
    """
    Move trailing registration_status into the slot after preferred_language when the tuple
    still has the legacy run `'en'|'lo', true, false, 0` (is_active … as stored before the
    column was reordered).
    """
    inner_st = inner.rstrip()
    mtrail = re.search(r",\s*'(ACTIVE|REJECTED|PENDING)'\s*$", inner_st)
    status = mtrail.group(1) if mtrail else None
    if mtrail:
        core = inner_st[: mtrail.start()].rstrip()
    else:
        core = inner_st

    # ACTIVE-ish users: is_active true, force false, failed 0 — status was last in legacy dumps
    pat_active = re.compile(r"'(en|lo)'\s*,\s*true\s*,\s*false\s*,\s*0\s*,", re.IGNORECASE)
    # REJECTED (or similar): is_active false, force true, failed 0 — same column-order bug
    pat_rejected = re.compile(r"'(en|lo)'\s*,\s*false\s*,\s*true\s*,\s*0\s*,", re.IGNORECASE)

    if pat_active.search(core):
        use = status if status else "ACTIVE"
        if status == "REJECTED":
            # inconsistent: do not guess
            return inner, False

        def repl_a(m: re.Match) -> str:
            lang = m.group(1)
            return f"'{lang}', '{use}', true, false, 0,"

        return pat_active.sub(repl_a, core, count=1), True

    if pat_rejected.search(core):
        if status == "ACTIVE":
            return inner, False
        use = status if status else "REJECTED"

        def repl_r(m: re.Match) -> str:
            lang = m.group(1)
            return f"'{lang}', '{use}', false, true, 0,"

        return pat_rejected.sub(repl_r, core, count=1), True

    return inner, False


def _patch_positional_value_inserts(sql: str) -> tuple[str, bool]:
    """Rewrite INSERT INTO ... app_user VALUES (...) rows."""
    parts: list[str] = []
    pos = 0
    changed = False
    for m in POS_VALUES_HEAD.finditer(sql):
        parts.append(sql[pos : m.start()])
        open_paren = m.end() - 1
        close_paren = _closing_paren_index(sql, open_paren)
        if close_paren is None:
            pos = m.end()
            continue
        inner = sql[open_paren + 1 : close_paren]
        new_inner, ch = _patch_positional_tuple(inner)
        if ch:
            changed = True
            parts.append(sql[m.start() : open_paren + 1])
            parts.append(new_inner)
            parts.append(sql[close_paren])
            pos = close_paren + 1
        else:
            parts.append(sql[m.start() : close_paren + 1])
            pos = close_paren + 1
    parts.append(sql[pos:])
    return "".join(parts), changed


def _find_insert_blocks(sql: str) -> list[tuple[int, int]]:
    """Return (start, end) of each INSERT INTO ... app_user ... ; statement."""
    blocks: list[tuple[int, int]] = []
    pos = 0
    while True:
        m = INSERT_HEAD.search(sql, pos)
        if not m:
            break
        start = m.start()
        # Find '(' starting column list
        open_paren = sql.find("(", m.end() - 1)
        if open_paren < 0:
            pos = m.end()
            continue
        depth = 0
        i = open_paren
        while i < len(sql):
            if sql[i] == "(":
                depth += 1
            elif sql[i] == ")":
                depth -= 1
                if depth == 0:
                    col_end = i + 1
                    break
            i += 1
        else:
            pos = m.end()
            continue
        rest = sql[col_end:].lstrip()
        if not rest.upper().startswith("VALUES"):
            pos = m.end()
            continue
        val_start = col_end + rest.find("VALUES") + len("VALUES")
        # End statement: semicolon at end of INSERT (first ; after VALUES that closes the row — heuristic: next line ending ); or );
        # pg_dump --column-inserts: usually one INSERT ending with );
        j = val_start
        depth = 0
        in_str = False
        esc = False
        while j < len(sql):
            ch = sql[j]
            if in_str:
                if esc:
                    esc = False
                elif ch == "\\":
                    esc = True
                elif ch == "'" and j + 1 < len(sql) and sql[j + 1] == "'":
                    j += 1
                elif ch == "'":
                    in_str = False
                j += 1
                continue
            if ch == "'":
                in_str = True
                j += 1
                continue
            if ch == "(":
                depth += 1
            elif ch == ")":
                depth -= 1
            elif ch == ";" and depth == 0:
                end = j + 1
                blocks.append((start, end))
                pos = end
                break
            j += 1
        else:
            pos = m.end()
    return blocks


def _apply_regex_fallbacks(sql: str) -> tuple[str, bool]:
    """Fix known misaligned rows when column-order logic did not apply."""
    changed = False
    out = sql
    # Full broken tail: ministry NULL then language boolean where varchar was omitted
    patterns: list[tuple[str, str]] = [
        (
            r"(,\s*NULL\s*,\s*'(en|lo)')\s*,\s*true\s*,\s*false\s*,\s*0\s*,",
            r"\1, 'ACTIVE', true, false, 0,",
        ),
        (
            r"(,\s*NULL\s*,\s*'(en|lo)')\s*,\s*false\s*,\s*true\s*,\s*0\s*,",
            r"\1, 'REJECTED', false, true, 0,",
        ),
        (
            r"(,\s*NULL\s*,\s*'(en|lo)')\s*,\s*true\s*,",
            r"\1, 'ACTIVE', true,",
        ),
    ]
    for pat, repl in patterns:
        out2, n = re.subn(pat, repl, out, flags=re.IGNORECASE)
        if n:
            changed = True
            out = out2
    return out, changed


def _patch_insert_statement(stmt: str) -> tuple[str, bool]:
    m = INSERT_HEAD.search(stmt)
    if not m:
        return stmt, False
    open_paren = stmt.find("(", m.end() - 1)
    depth = 0
    i = open_paren
    while i < len(stmt):
        if stmt[i] == "(":
            depth += 1
        elif stmt[i] == ")":
            depth -= 1
            if depth == 0:
                col_inner = stmt[open_paren + 1 : i]
                col_end = i + 1
                break
        i += 1
    else:
        return stmt, False

    cols = [_norm_col(c) for c in _split_top_level_commas(col_inner)]
    try:
        li = cols.index("preferred_language")
        ri = cols.index("registration_status")
    except ValueError:
        return stmt, False

    if ri != li + 1:
        # unusual column order — do not guess
        return stmt, False

    rest = stmt[col_end:].lstrip()
    if not rest.upper().startswith("VALUES"):
        return stmt, False

    val_start = col_end + rest.find("VALUES") + len("VALUES")
    values_part = stmt[val_start:]
    new_vals = values_part
    changed = False
    for lang in ("en", "lo"):
        # Misaligned: missing varchar for registration_status → true bound there
        pat = rf"'{lang}'\s*,\s*true\s*,"
        repl = f"'{lang}', 'ACTIVE', true,"
        nnew, n = re.subn(pat, repl, new_vals, flags=re.IGNORECASE)
        if n:
            changed = True
            new_vals = nnew
    if not changed:
        return stmt, False
    return stmt[:val_start] + new_vals, True


def patch(sql: str) -> tuple[str, bool]:
    sql, pv = _patch_positional_value_inserts(sql)
    any_changed = pv

    blocks = _find_insert_blocks(sql)
    if blocks:
        out: list[str] = []
        pos = 0
        for start, end in blocks:
            out.append(sql[pos:start])
            chunk = sql[start:end]
            fixed, ch = _patch_insert_statement(chunk)
            any_changed |= ch
            out.append(fixed)
            pos = end
        out.append(sql[pos:])
        result = "".join(out)
    else:
        result = sql

    result2, fb = _apply_regex_fallbacks(result)
    if fb:
        any_changed = True

    result3, ff = _apply_force_password_bool_fix(result2)
    if ff:
        any_changed = True
    return result3, any_changed


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("input_path")
    ap.add_argument("-o", "--output", help="Write here; default: overwrite input with .bak backup")
    args = ap.parse_args()
    path = args.input_path
    with open(path, encoding="utf-8", errors="replace") as f:
        original = f.read()
    fixed, changed = patch(original)

    if changed:
        print(
            "patch_payroll_dump_app_user: applied registration_status and/or force_password_change fixes.",
            file=sys.stderr,
        )
    else:
        print(
            "patch_payroll_dump_app_user: no changes. If load still fails, re-export with "
            "INCLUDE_USERS=0 or fix app_user rows on the source DB then pg_dump again.",
            file=sys.stderr,
        )
    if args.output:
        with open(args.output, "w", encoding="utf-8") as f:
            f.write(fixed)
        print(args.output)
        return
    bak = path + ".bak"
    shutil.copy2(path, bak)
    with open(path, "w", encoding="utf-8") as f:
        f.write(fixed)
    print(path, f"(backup: {bak})")


if __name__ == "__main__":
    main()
