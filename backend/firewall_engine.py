"""
GEN SHERMAN — Firewall Engine
GitHub source: https://github.com/ffalcinelli/pydivert  (WinDivert packet-level)
               https://github.com/henrypp/simplewall     (WFP reference)

Layers:
  1. netsh advfirewall  — persistent Windows Firewall IP ban rules (survives reboot)
  2. pydivert/WinDivert — real-time packet inspection & immediate drop (optional, admin)
  3. Windows Event Log  — brute-force detection (Event ID 4625, 4648)
  4. psutil             — connection-surge detection (high-rate scan/flood)
"""

import os
import re
import json
import time
import datetime
import subprocess
import threading
import ipaddress
from typing import List, Dict, Optional, Tuple

# ── Paths ────────────────────────────────────────────────────────────────────
_BASE = os.path.dirname(__file__)
BAN_DB_PATH      = os.path.join(_BASE, "banned_ips.json")
FIREWALL_LOG_PATH = os.path.join(_BASE, "firewall_log.jsonl")
FW_MAX_LOG       = 1000

# ── Constants ────────────────────────────────────────────────────────────────
RULE_PREFIX = "BERYL_FW_"            # prefix for all BERYL-managed rules
CREATE_NO_WINDOW = 0x08000000

# Ports we must keep open inbound (BERYL services)
SAFE_INBOUND_PORTS = {
    80, 443,              # HTTP/S
    8001,                 # BERYL backend
    5173, 5174, 5175,     # Vite dev server
    8188,                 # ComfyUI
    11434,                # Ollama
}

# Brute-force thresholds
BF_FAIL_THRESHOLD   = 5    # failed attempts before ban
BF_WINDOW_SECONDS   = 300  # look-back window (5 min)
FLOOD_PPS_THRESHOLD = 30   # new connections/IP/minute before flood-ban

# Known safe IPs / subnets (never ban)
WHITELIST: set = {"127.0.0.1", "::1"}

# ── Shared state ─────────────────────────────────────────────────────────────
_fw_lock    = threading.Lock()
_fw_log_mem: List[Dict] = []          # in-memory log (last 200)
_ban_db: Dict[str, Dict] = {}         # ip → ban record
_allow_rules: List[Dict] = []         # inbound allow rules managed by us
_conn_counts: Dict[str, int] = {}     # ip → connection count per interval
_default_block = False                # whether we set default-block-inbound

# ─────────────────────────────────────────────────────────────────────────────
# Logging
# ─────────────────────────────────────────────────────────────────────────────

def _fw_log(level: str, msg: str) -> None:
    entry = {"ts": datetime.datetime.now().isoformat(timespec="seconds"), "level": level, "msg": msg}
    with _fw_lock:
        _fw_log_mem.insert(0, entry)
        del _fw_log_mem[200:]
    try:
        with open(FIREWALL_LOG_PATH, "a", encoding="utf-8") as f:
            f.write(json.dumps(entry) + "\n")
        # Rolling trim
        with open(FIREWALL_LOG_PATH, "r", encoding="utf-8") as f:
            lines = f.readlines()
        if len(lines) > FW_MAX_LOG:
            with open(FIREWALL_LOG_PATH, "w", encoding="utf-8") as f:
                f.writelines(lines[-FW_MAX_LOG:])
    except Exception:
        pass

# ─────────────────────────────────────────────────────────────────────────────
# Ban DB persistence
# ─────────────────────────────────────────────────────────────────────────────

def _load_ban_db() -> None:
    global _ban_db
    try:
        if os.path.exists(BAN_DB_PATH):
            with open(BAN_DB_PATH, "r", encoding="utf-8") as f:
                _ban_db = json.load(f)
    except Exception:
        _ban_db = {}

def _save_ban_db() -> None:
    try:
        with open(BAN_DB_PATH, "w", encoding="utf-8") as f:
            json.dump(_ban_db, f, indent=2)
    except Exception:
        pass

# ─────────────────────────────────────────────────────────────────────────────
# netsh advfirewall wrappers
# ─────────────────────────────────────────────────────────────────────────────

def _netsh(*args, timeout: int = 12) -> Tuple[bool, str]:
    cmd = ["netsh", "advfirewall", "firewall"] + list(args)
    try:
        r = subprocess.run(
            cmd, capture_output=True, text=True, timeout=timeout,
            creationflags=CREATE_NO_WINDOW,
        )
        out = (r.stdout + r.stderr).strip()
        return r.returncode == 0, out
    except Exception as e:
        return False, str(e)


def _rule_name(ip: str, direction: str) -> str:
    safe = ip.replace(".", "_").replace(":", "_").replace("/", "_")
    return f"{RULE_PREFIX}{safe}_{direction}"


def block_ip(ip: str, reason: str = "manual", permanent: bool = True) -> bool:
    """Add Windows Firewall block rules for an IP (both directions)."""
    if ip in WHITELIST:
        return False
    try:
        ipaddress.ip_address(ip)
    except ValueError:
        return False

    rule_in  = _rule_name(ip, "IN")
    rule_out = _rule_name(ip, "OUT")

    ok1, _ = _netsh("add", "rule", f"name={rule_in}",
                    "dir=in", "action=block", f"remoteip={ip}",
                    "enable=yes", "profile=any")
    ok2, _ = _netsh("add", "rule", f"name={rule_out}",
                    "dir=out", "action=block", f"remoteip={ip}",
                    "enable=yes", "profile=any")
    success = ok1 or ok2
    if success:
        _fw_log("BLOCK", f"BLOCKED {ip} — {reason}")
        with _fw_lock:
            if ip not in _ban_db:
                _ban_db[ip] = {}
            _ban_db[ip].update({
                "ip":      ip,
                "reason":  reason,
                "banned":  True,
                "ban_ts":  datetime.datetime.now().isoformat(timespec="seconds"),
            })
        _save_ban_db()
    return success


def unblock_ip(ip: str) -> bool:
    """Remove block rules for an IP."""
    rule_in  = _rule_name(ip, "IN")
    rule_out = _rule_name(ip, "OUT")
    ok1, _ = _netsh("delete", "rule", f"name={rule_in}")
    ok2, _ = _netsh("delete", "rule", f"name={rule_out}")
    _fw_log("UNBLOCK", f"UNBLOCKED {ip}")
    with _fw_lock:
        if ip in _ban_db:
            _ban_db[ip]["banned"] = False
    _save_ban_db()
    return ok1 or ok2


def get_banned_list() -> List[Dict]:
    """FAST in-memory list of currently-banned IPs from the ban DB (no netsh).
    Safe to call on the request path — never touches Windows Firewall."""
    with _fw_lock:
        return [
            {
                "ip":       rec.get("ip", ip),
                "reason":   rec.get("reason", "manual"),
                "ban_ts":   rec.get("ban_ts", "—"),
                "attempts": rec.get("attempts", 0),
                "banned":   True,
            }
            for ip, rec in _ban_db.items()
            if rec.get("banned")
        ]


def get_blocked_ips() -> List[Dict]:
    """List all IPs blocked by BERYL firewall rules (reads live from Windows Firewall)."""
    ok, out = _netsh("show", "rule", f"name={RULE_PREFIX}*", timeout=18)
    if not ok and not out:
        return list(_ban_db.values())

    blocked = {}
    current_name = None
    current_ip   = None

    for line in out.splitlines():
        line = line.strip()
        if line.startswith("Rule Name:"):
            current_name = line.split(":", 1)[1].strip()
            current_ip = None
        elif "RemoteIP:" in line:
            current_ip = line.split(":", 1)[1].strip().split("/")[0]
        elif line.startswith("Enabled:") and "Yes" in line and current_ip:
            if current_ip not in blocked:
                rec = _ban_db.get(current_ip, {})
                blocked[current_ip] = {
                    "ip":       current_ip,
                    "reason":   rec.get("reason", "manual"),
                    "ban_ts":   rec.get("ban_ts", "—"),
                    "attempts": rec.get("attempts", 0),
                    "banned":   True,
                }

    return list(blocked.values())


def get_allow_rules() -> List[Dict]:
    """List BERYL-managed inbound allow rules."""
    ok, out = _netsh("show", "rule", f"name=BERYL_ALLOW_*", timeout=15)
    rules = []
    current_name = None
    current_port = None
    current_proto = None
    for line in out.splitlines():
        line = line.strip()
        if line.startswith("Rule Name:"):
            current_name = line.split(":", 1)[1].strip()
        elif "LocalPort:" in line:
            current_port = line.split(":", 1)[1].strip()
        elif "Protocol:" in line:
            current_proto = line.split(":", 1)[1].strip()
            if current_name and current_port:
                rules.append({"name": current_name, "port": current_port, "protocol": current_proto})
    return rules


def allow_port_inbound(port: int, protocol: str = "TCP") -> bool:
    name = f"BERYL_ALLOW_IN_{protocol}_{port}"
    ok, _ = _netsh("add", "rule", f"name={name}",
                   "dir=in", "action=allow",
                   f"protocol={protocol}", f"localport={port}",
                   "enable=yes", "profile=any")
    if ok:
        _fw_log("ALLOW", f"Inbound allow rule added: {protocol}:{port}")
    return ok


def enable_default_block_inbound() -> bool:
    """Set Windows Firewall default-inbound policy to block on all profiles."""
    global _default_block
    try:
        r = subprocess.run(
            ["netsh", "advfirewall", "set", "allprofiles",
             "firewallpolicy", "blockinbound,allowoutbound"],
            capture_output=True, text=True, timeout=12,
            creationflags=CREATE_NO_WINDOW,
        )
        if r.returncode == 0:
            _default_block = True
            _fw_log("POLICY", "Default inbound: BLOCK ALL — safe ports whitelisted")
            for port in SAFE_INBOUND_PORTS:
                allow_port_inbound(port)
            return True
        return False
    except Exception:
        return False


def disable_default_block_inbound() -> bool:
    global _default_block
    try:
        r = subprocess.run(
            ["netsh", "advfirewall", "set", "allprofiles",
             "firewallpolicy", "allowinbound,allowoutbound"],
            capture_output=True, text=True, timeout=12,
            creationflags=CREATE_NO_WINDOW,
        )
        if r.returncode == 0:
            _default_block = False
            _fw_log("POLICY", "Default inbound: ALLOW (normal mode restored)")
            return True
        return False
    except Exception:
        return False


_profile_cache: Dict = {}
_profile_cache_ts: float = 0.0
_PROFILE_CACHE_TTL = 30  # seconds

def get_firewall_profiles() -> Dict:
    """Get current Windows Firewall on/off state per profile (cached 30s)."""
    global _profile_cache, _profile_cache_ts
    if _profile_cache and (time.time() - _profile_cache_ts) < _PROFILE_CACHE_TTL:
        return {**_profile_cache, "default_block": _default_block}
    try:
        # 'state' subcommand is far faster than the full 'show allprofiles'
        r = subprocess.run(
            ["netsh", "advfirewall", "show", "allprofiles", "state"],
            capture_output=True, text=True, timeout=12,
            creationflags=CREATE_NO_WINDOW,
        )
        txt = r.stdout
        policy_label = "block-all-inbound" if _default_block else "active (allow-out)"

        def _parse_state(name: str) -> Dict:
            try:
                seg = txt.split(name)[1]
                for line in seg.splitlines()[:8]:
                    if "State" in line and ("ON" in line or "OFF" in line):
                        return {"on": "ON" in line, "policy": policy_label}
                return {"on": False, "policy": policy_label}
            except Exception:
                return {"on": False, "policy": policy_label}

        result = {
            "domain":  _parse_state("Domain Profile"),
            "private": _parse_state("Private Profile"),
            "public":  _parse_state("Public Profile"),
        }
        _profile_cache    = result
        _profile_cache_ts = time.time()
        return {**result, "default_block": _default_block}
    except Exception as e:
        # On error, keep last good cache if we have one
        if _profile_cache:
            return {**_profile_cache, "default_block": _default_block}
        return {"domain": {"on": False, "policy": str(e)[:40]},
                "private": {"on": False, "policy": ""},
                "public":  {"on": False, "policy": ""},
                "default_block": _default_block}


def get_rule_count() -> int:
    ok, out = _netsh("show", "rule", f"name={RULE_PREFIX}*", timeout=15)
    return out.count("Rule Name:")


# ─────────────────────────────────────────────────────────────────────────────
# Brute-Force Detection — Windows Security Event Log (Event 4625)
# ─────────────────────────────────────────────────────────────────────────────

_PS_BRUTE_FORCE = r"""
$cutoff = (Get-Date).AddMinutes(-5)
try {
    Get-WinEvent -FilterHashtable @{
        LogName   = 'Security'
        Id        = 4625
        StartTime = $cutoff
    } -MaxEvents 1000 -ErrorAction SilentlyContinue |
    ForEach-Object {
        try {
            $xml  = [xml]$_.ToXml()
            $data = $xml.Event.EventData.Data
            $ip   = ($data | Where-Object { $_.Name -eq 'IpAddress' }).'#text'
            $type = ($data | Where-Object { $_.Name -eq 'LogonType' }).'#text'
            $user = ($data | Where-Object { $_.Name -eq 'TargetUserName' }).'#text'
            if ($ip -and $ip -ne '-' -and $ip -ne '127.0.0.1' -and $ip -ne '::1') {
                "$ip|$type|$user"
            }
        } catch {}
    }
} catch {}
"""

def check_brute_force_events() -> List[Dict]:
    """Scan Windows Security Event Log for failed logins. Returns list of {ip, count, type}."""
    try:
        r = subprocess.run(
            ["powershell", "-NoProfile", "-NonInteractive", "-Command", _PS_BRUTE_FORCE],
            capture_output=True, text=True, timeout=25,
            creationflags=CREATE_NO_WINDOW,
        )
        counts: Dict[str, Dict] = {}
        for line in r.stdout.splitlines():
            line = line.strip()
            if not line or "|" not in line:
                continue
            parts = line.split("|", 2)
            ip    = parts[0].strip()
            ltype = parts[1].strip() if len(parts) > 1 else ""
            user  = parts[2].strip() if len(parts) > 2 else ""
            if ip:
                if ip not in counts:
                    counts[ip] = {"ip": ip, "count": 0, "logon_type": ltype, "user": user}
                counts[ip]["count"] += 1
        return sorted(counts.values(), key=lambda x: x["count"], reverse=True)
    except Exception:
        return []


def process_brute_force(events: List[Dict]) -> List[str]:
    """Update ban state; return list of newly auto-banned IPs."""
    newly_banned: List[str] = []
    now = datetime.datetime.now().isoformat(timespec="seconds")

    for ev in events:
        ip    = ev["ip"]
        count = ev["count"]
        if ip in WHITELIST:
            continue
        with _fw_lock:
            rec = _ban_db.setdefault(ip, {
                "ip": ip, "attempts": 0, "first_seen": now,
                "banned": False, "reason": "brute_force",
            })
            rec["attempts"] = rec.get("attempts", 0) + count
            if not rec["banned"] and rec["attempts"] >= BF_FAIL_THRESHOLD:
                rec["banned"] = True
                rec["ban_ts"] = now
                rec["reason"] = f"brute_force ({rec['attempts']} failed logins)"
        if _ban_db[ip]["banned"] and ip not in [b["ip"] for b in get_blocked_ips()]:
            block_ip(ip, _ban_db[ip]["reason"])
            newly_banned.append(ip)
            _fw_log("AUTO-BAN", f"BANNED {ip} — {_ban_db[ip]['reason']}")

    _save_ban_db()
    return newly_banned


# ─────────────────────────────────────────────────────────────────────────────
# Connection-surge / port-scan detection (psutil)
# ─────────────────────────────────────────────────────────────────────────────

_prev_conn_ips: Dict[str, int] = {}

def check_connection_surge() -> List[str]:
    """Detect IPs opening an unusually high number of connections per minute."""
    import psutil
    current: Dict[str, int] = {}
    try:
        for c in psutil.net_connections(kind="inet"):
            if c.raddr and c.status in ("ESTABLISHED", "SYN_SENT", "SYN_RECV"):
                ip = c.raddr.ip
                if ip and not ip.startswith("127.") and ip != "::1":
                    current[ip] = current.get(ip, 0) + 1
    except Exception:
        return []

    surge_ips = []
    for ip, cnt in current.items():
        prev = _prev_conn_ips.get(ip, 0)
        if cnt - prev >= FLOOD_PPS_THRESHOLD:
            surge_ips.append(ip)
    _prev_conn_ips.update(current)
    return surge_ips


# ─────────────────────────────────────────────────────────────────────────────
# pydivert real-time packet watcher (optional — requires admin + WinDivert driver)
# ─────────────────────────────────────────────────────────────────────────────

_divert_thread: Optional[threading.Thread] = None
_divert_active = False

def start_pydivert_watcher() -> bool:
    """
    Start a WinDivert thread that watches for SYN floods.
    Gracefully skips if pydivert is unavailable or non-admin.
    GitHub: https://github.com/ffalcinelli/pydivert
    """
    global _divert_thread, _divert_active
    try:
        import pydivert  # noqa: F401
    except ImportError:
        _fw_log("INFO", "pydivert not available — packet-level watcher disabled (install as admin)")
        return False

    def _watcher():
        global _divert_active
        import pydivert
        _fw_log("INFO", "pydivert WinDivert watcher started — real-time SYN flood detection active")
        _divert_active = True
        syn_counts: Dict[str, int] = {}
        window_start = time.time()
        WINDOW = 10        # seconds
        SYN_THRESH = 50    # SYNs per IP per window before block

        try:
            # Only inspect inbound TCP SYN packets
            with pydivert.WinDivert("inbound and tcp.Syn") as w:
                for pkt in w:
                    if pkt.src_addr and pkt.src_addr not in WHITELIST:
                        ip = pkt.src_addr
                        syn_counts[ip] = syn_counts.get(ip, 0) + 1
                        if syn_counts[ip] >= SYN_THRESH:
                            block_ip(ip, f"SYN_flood ({syn_counts[ip]} SYNs/{WINDOW}s)")
                            _fw_log("SYN-FLOOD", f"BLOCKED {ip} — {syn_counts[ip]} SYN packets in {WINDOW}s")
                            syn_counts[ip] = 0
                    # Reset window
                    if time.time() - window_start > WINDOW:
                        syn_counts.clear()
                        window_start = time.time()
                    w.send(pkt)  # allow non-flood packets through
        except PermissionError:
            _fw_log("WARN", "pydivert: requires Administrator — run BERYL HF as Admin for SYN flood protection")
        except Exception as e:
            _fw_log("ERROR", f"pydivert watcher error: {e}")
        finally:
            _divert_active = False

    _divert_thread = threading.Thread(target=_watcher, daemon=True, name="fw-divert")
    _divert_thread.start()
    return True


# ─────────────────────────────────────────────────────────────────────────────
# Public status snapshot
# ─────────────────────────────────────────────────────────────────────────────

def get_status() -> Dict:
    return {
        "default_block_inbound": _default_block,
        "divert_active":         _divert_active,
        "blocked_ip_count":      len([v for v in _ban_db.values() if v.get("banned")]),
        "total_bans_ever":       len(_ban_db),
        "log_entries":           len(_fw_log_mem),
        "safe_ports":            sorted(SAFE_INBOUND_PORTS),
    }


def get_log(limit: int = 100) -> List[Dict]:
    return _fw_log_mem[:limit]


# ─────────────────────────────────────────────────────────────────────────────
# Init
# ─────────────────────────────────────────────────────────────────────────────

def _reapply_persistent_bans() -> None:
    """Re-apply persisted bans in the background (netsh is slow — must not
    block backend startup)."""
    reapplied = 0
    for ip, rec in list(_ban_db.items()):
        if rec.get("banned"):
            block_ip(ip, rec.get("reason", "persistent ban"))
            reapplied += 1
    if reapplied:
        _fw_log("INFO", f"Re-applied {reapplied} persistent ban(s) from ban_db")


def init() -> None:
    """Call once at backend startup. Returns immediately — all slow netsh
    work is deferred to background threads so the app serves instantly."""
    _load_ban_db()
    start_pydivert_watcher()
    _fw_log("INFO", "Firewall engine initialised (netsh advfirewall + pydivert layer)")
    # Re-apply persisted bans OFF the startup path
    threading.Thread(target=_reapply_persistent_bans, daemon=True, name="fw-reapply").start()
