#!/usr/bin/env python3
"""Anonymized Phuket group snapshot via the Supabase CLI.

Prefers `supabase db query --read-only --remote` (CLI 3). Prints JSON with first-name labels only.
Never prints emails, full names, tokens, or connection strings.
"""
from __future__ import annotations

import hashlib
import json
import os
import re
import subprocess
import sys
from collections import defaultdict
from decimal import Decimal, ROUND_HALF_UP
from typing import Any
from urllib.parse import urlparse


UUID_RE = re.compile(r"^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$")


def round_money(amount: float) -> float:
    return float(Decimal(str(amount)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP))


def stringify_rows(rows: list[Any]) -> list[dict[str, str]]:
    out: list[dict[str, str]] = []
    for row in rows:
        if not isinstance(row, dict):
            continue
        out.append({key: "" if value is None else str(value) for key, value in row.items()})
    return out


def redact(text: str) -> str:
    text = re.sub(r"postgres(?:ql)?://\S+", "postgresql://***", text)
    text = re.sub(r"Bearer \S+", "Bearer ***", text)
    return text.strip().splitlines()[-1] if text.strip() else "query failed"


def parse_query_json(raw: str) -> list[dict[str, str]]:
    payload = raw.strip()
    for prefix in ("[", "{"):
        idx = payload.find(prefix)
        if idx >= 0:
            payload = payload[idx:]
            break
    body = json.loads(payload or "[]")
    if isinstance(body, dict):
        body = body.get("data") or body.get("result") or body.get("rows") or []
    if not isinstance(body, list):
        raise SystemExit("supabase db query returned unexpected JSON")
    return stringify_rows(body)


def repo_root() -> str:
    return os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def ensure_linked_ref() -> None:
    ref = os.environ.get("SUPABASE_PROJECT_REF", "").strip() or "xesuklogveedeppxbbit"
    temp = os.path.join(repo_root(), "supabase", ".temp")
    os.makedirs(temp, exist_ok=True)
    path = os.path.join(temp, "project-ref")
    if not os.path.exists(path) or not open(path, encoding="utf-8").read().strip():
        with open(path, "w", encoding="utf-8") as handle:
            handle.write(ref)


def run_supabase(args: list[str], extra_env: dict[str, str] | None = None) -> subprocess.CompletedProcess[str]:
    env = os.environ.copy()
    if extra_env:
        env.update(extra_env)
    return subprocess.run(
        ["supabase", *args],
        check=False,
        capture_output=True,
        text=True,
        cwd=repo_root(),
        env=env,
    )


def cli_query(sql: str) -> list[dict[str, str]]:
    ensure_linked_ref()
    # SQL is the operand, so --remote stays after it. Bare --remote is the linked project.
    # --read-only skips the hosted-mutation prompt, which CI cannot answer.
    linked = run_supabase(["db", "query", "--read-only", "-o", "json", sql, "--remote"])
    if linked.returncode == 0:
        try:
            return parse_query_json(linked.stdout)
        except json.JSONDecodeError:
            raise SystemExit(f"remote query returned non-JSON: {redact(linked.stdout)}") from None

    db_url = os.environ.get("SUPABASE_DATABASE_URL", "").strip()
    if db_url:
        parsed = urlparse(db_url)
        if parsed.scheme.startswith("postgres"):
            remote = run_supabase(
                ["db", "query", "--read-only", "-o", "json", sql, f"--remote={db_url}"]
            )
            if remote.returncode == 0:
                try:
                    return parse_query_json(remote.stdout)
                except json.JSONDecodeError:
                    raise SystemExit(f"db-url query returned non-JSON: {redact(remote.stdout)}") from None
            url_error = redact(remote.stderr or remote.stdout)
        else:
            url_error = "database url is not postgres"
    else:
        url_error = "no database url"

    local = run_supabase(["db", "query", "--read-only", "-o", "json", sql])
    if local.returncode == 0:
        try:
            return parse_query_json(local.stdout)
        except json.JSONDecodeError:
            raise SystemExit(f"local query returned non-JSON: {redact(local.stdout)}") from None

    raise SystemExit(
        "supabase db query failed: "
        f"remote={redact(linked.stderr or linked.stdout)}; "
        f"db-url={url_error}; "
        f"local={redact(local.stderr or local.stdout)}"
    )


def first_name(value: str) -> str:
    token = (value or "").strip().split(" ")[0]
    return token or "Member"


def unique_label(name: str, used: dict[str, int]) -> str:
    used[name] = used.get(name, 0) + 1
    if used[name] == 1:
        return name
    return f"{name} {used[name]}"


def short_id(value: str) -> str:
    if not value:
        return ""
    return hashlib.sha256(value.encode("utf-8")).hexdigest()[:10]


def canonical_map(participants: list[dict[str, str]]) -> dict[str, str]:
    best: dict[str, tuple[int, str]] = {}
    rank = {"member": 2, "former": 1}

    def key_for(row: dict[str, str]) -> str | None:
        email_hash = row.get("email_hash") or ""
        user_id = row.get("user_id") or ""
        if email_hash:
            return f"e:{email_hash}"
        if user_id:
            return f"u:{user_id}"
        return None

    for row in participants:
        ident = key_for(row)
        if not ident:
            continue
        score = rank.get(row.get("type") or "", 0)
        current = best.get(ident)
        if not current or score > current[0]:
            best[ident] = (score, row["id"])

    remap: dict[str, str] = {}
    for row in participants:
        ident = key_for(row)
        if not ident:
            continue
        winner = best[ident][1]
        if winner != row["id"]:
            remap[row["id"]] = winner
    return remap


def compute_balances(
    participants: list[dict[str, str]],
    expense_rows: list[dict[str, str]],
    split_rows: list[dict[str, str]],
    settlement_rows: list[dict[str, str]],
) -> list[dict[str, Any]]:
    remap = canonical_map(participants)
    by_id = {row["id"]: row for row in participants}
    labels_used: dict[str, int] = {}
    labels: dict[str, str] = {}

    def canon(pid: str) -> str:
        return remap.get(pid, pid)

    def label_for(pid: str) -> str:
        if pid in labels:
            return labels[pid]
        row = by_id.get(pid) or {}
        labels[pid] = unique_label(first_name(row.get("first_name") or ""), labels_used)
        return labels[pid]

    nets: dict[tuple[str, str], float] = defaultdict(float)
    splits_by_tx: dict[str, list[dict[str, str]]] = defaultdict(list)
    for row in split_rows:
        splits_by_tx[row["transaction_id"]].append(row)

    for tx in expense_rows:
        payer = canon(tx.get("paid_by_participant_id") or "")
        if not payer:
            continue
        currency = (tx.get("currency") or "").upper()
        amount = float(tx["amount"])
        splits = splits_by_tx.get(tx["id"]) or []
        if not splits:
            continue
        nets[(payer, currency)] += amount
        for split in splits:
            pid = canon(split.get("participant_id") or "")
            if not pid:
                continue
            nets[(pid, currency)] -= float(split["amount"])

    for row in settlement_rows:
        sender = canon(row.get("from_participant_id") or "")
        receiver = canon(row.get("to_participant_id") or "")
        if not sender or not receiver:
            continue
        currency = (row.get("currency") or "").upper()
        amount = float(row["amount"])
        if amount <= 0:
            continue
        nets[(sender, currency)] += amount
        nets[(receiver, currency)] -= amount

    balances: list[dict[str, Any]] = []
    for (pid, currency), amount in sorted(nets.items()):
        rounded = round_money(amount)
        if abs(rounded) <= 0.01:
            continue
        person = by_id.get(pid) or {}
        balances.append({
            "label": label_for(pid),
            "user_id": short_id(person.get("user_id") or pid),
            "participant_id": short_id(pid),
            "amount": rounded,
            "currency": currency,
        })
    return balances


def require_uuid(value: str) -> str:
    if not UUID_RE.match(value or ""):
        raise SystemExit("group id from query was not a UUID")
    return value


def table_exists(name: str) -> bool:
    rows = cli_query(
        f"""
        SELECT 1 AS present
        FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = '{name}'
        LIMIT 1;
        """
    )
    return bool(rows)


def column_exists(table: str, column: str) -> bool:
    rows = cli_query(
        f"""
        SELECT 1 AS present
        FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = '{table}' AND column_name = '{column}'
        LIMIT 1;
        """
    )
    return bool(rows)


def main() -> None:
    has_settlement = column_exists("groups", "settlement_currency")
    has_unify = column_exists("groups", "unify_balances")
    settlement_sql = "coalesce(settlement_currency, '')" if has_settlement else "''"
    unify_sql = "coalesce(unify_balances, false)::text" if has_unify else "'false'"

    groups = cli_query(
        f"""
        SELECT id::text, name, {settlement_sql} AS settlement_currency,
               {unify_sql} AS unify_balances, created_at::text
        FROM public.groups
        WHERE name ILIKE '%phuket%'
        ORDER BY created_at DESC;
        """
    )
    if not groups:
        sample = cli_query("SELECT name FROM public.groups ORDER BY created_at DESC LIMIT 12;")
        raise SystemExit(
            "no group name matched Phuket. sample names: "
            + ", ".join((row.get("name") or "")[:40] for row in sample)
        )

    group = groups[0]
    group_id = require_uuid(group["id"])

    participants = cli_query(
        f"""
        SELECT id::text,
               coalesce(user_id::text, '') AS user_id,
               coalesce(type, '') AS type,
               split_part(coalesce(full_name, ''), ' ', 1) AS first_name,
               CASE
                 WHEN email IS NULL OR btrim(email) = '' THEN ''
                 ELSE md5(lower(btrim(email)))
               END AS email_hash
        FROM public.participants
        WHERE group_id = '{group_id}';
        """
    )
    expenses = cli_query(
        f"""
        SELECT id::text, amount::text, currency,
               coalesce(paid_by_participant_id::text, '') AS paid_by_participant_id
        FROM public.transactions
        WHERE group_id = '{group_id}' AND type = 'expense';
        """
    )
    splits = cli_query(
        f"""
        SELECT s.transaction_id::text, coalesce(s.participant_id::text, '') AS participant_id,
               s.amount::text
        FROM public.transaction_splits s
        JOIN public.transactions t ON t.id = s.transaction_id
        WHERE t.group_id = '{group_id}' AND t.type = 'expense';
        """
    )
    settlements = cli_query(
        f"""
        SELECT coalesce(from_participant_id::text, '') AS from_participant_id,
               coalesce(to_participant_id::text, '') AS to_participant_id,
               amount::text, currency
        FROM public.settlements
        WHERE group_id = '{group_id}';
        """
    )
    overrides = cli_query(
        f"""
        SELECT from_currency, to_currency, rate::text, source
        FROM public.group_exchange_rates
        WHERE group_id = '{group_id}';
        """
    ) if table_exists("group_exchange_rates") else []
    market = cli_query(
        """
        SELECT quote_currency, rate::text, as_of::text, provider
        FROM public.exchange_rates
        WHERE base_currency = 'USD';
        """
    ) if table_exists("exchange_rates") else []

    usd_rates = {"USD": 1.0}
    as_of = None
    for row in market:
        code = (row.get("quote_currency") or "").upper()
        rate = float(row["rate"])
        if code and rate > 0:
            usd_rates[code] = rate
        as_of = row.get("as_of") or as_of

    snapshot = {
        "group": {
            "name": group["name"],
            "settlement_currency": (group.get("settlement_currency") or "").upper() or None,
            "unify_balances": str(group.get("unify_balances") or "").lower() in {"true", "t", "1"},
            "member_count": len(participants),
            "expense_count": len(expenses),
            "settlement_count": len(settlements),
            "match_count": len(groups),
            "source": "supabase db query",
        },
        "rate_book": {
            "as_of": as_of,
            "usd_rates": usd_rates,
            "overrides": [
                {
                    "from": row["from_currency"].upper(),
                    "to": row["to_currency"].upper(),
                    "rate": float(row["rate"]),
                    "source": row.get("source") or "group",
                }
                for row in overrides
            ],
        },
        "balances": compute_balances(participants, expenses, splits, settlements),
    }

    out_path = os.environ.get("SNAPSHOT_PATH", "phuket-snapshot.json")
    with open(out_path, "w", encoding="utf-8") as handle:
        json.dump(snapshot, handle, indent=2)
        handle.write("\n")
    json.dump(snapshot, sys.stdout, indent=2)
    sys.stdout.write("\n")


if __name__ == "__main__":
    main()
