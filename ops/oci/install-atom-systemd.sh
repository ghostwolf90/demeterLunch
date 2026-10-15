#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
repo_dir="$(cd "${script_dir}/../.." && pwd)"
run_user="${SUDO_USER:-$(id -un)}"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --repo-dir)
      repo_dir="$2"
      shift 2
      ;;
    --run-user)
      run_user="$2"
      shift 2
      ;;
    *)
      echo "Unknown argument: $1" >&2
      exit 64
      ;;
  esac
done

if [[ "${EUID}" -ne 0 ]]; then
  echo "Run this installer with sudo." >&2
  exit 77
fi

repo_dir="$(realpath "${repo_dir}")"
run_group="$(id -gn "${run_user}")"
python_bin="$(command -v python3 || true)"
flock_bin="$(command -v flock || true)"

[[ -f "${repo_dir}/scripts/fetch_latest.py" ]] || {
  echo "Not a Demeter checkout: ${repo_dir}" >&2
  exit 66
}
[[ -n "${python_bin}" && -n "${flock_bin}" ]] || {
  echo "python3 and flock are required." >&2
  exit 69
}

"${python_bin}" - <<'PY'
import sys
if sys.version_info < (3, 10):
    raise SystemExit("Python 3.10 or newer is required")
PY

runtime_path="$(dirname "${python_bin}"):/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"
temporary_unit="$(mktemp)"
trap 'rm -f "${temporary_unit}"' EXIT

escape_sed() {
  printf '%s' "$1" | sed 's/[&|]/\\&/g'
}

sed \
  -e "s|@REPO_DIR@|$(escape_sed "${repo_dir}")|g" \
  -e "s|@RUN_USER@|$(escape_sed "${run_user}")|g" \
  -e "s|@RUN_GROUP@|$(escape_sed "${run_group}")|g" \
  -e "s|@PYTHON@|$(escape_sed "${python_bin}")|g" \
  -e "s|@FLOCK@|$(escape_sed "${flock_bin}")|g" \
  -e "s|@RUNTIME_PATH@|$(escape_sed "${runtime_path}")|g" \
  "${script_dir}/demeter-menu-atom.service.in" >"${temporary_unit}"

install -m 0644 "${temporary_unit}" /etc/systemd/system/demeter-menu-atom.service
install -m 0644 "${script_dir}/demeter-menu-atom.timer" /etc/systemd/system/

systemctl daemon-reload
systemd-analyze verify \
  /etc/systemd/system/demeter-menu-atom.service \
  /etc/systemd/system/demeter-menu-atom.timer
systemctl enable --now demeter-menu-atom.timer
systemctl is-active --quiet demeter-menu-atom.timer
systemctl list-timers 'demeter-menu-atom.timer' --no-pager

echo
echo "Atom timer installed. It does not publish the Site."
echo "Manual run:"
echo "  sudo systemctl start demeter-menu-atom.service"
echo "Logs:"
echo "  sudo journalctl -u demeter-menu-atom.service -n 100 --no-pager"

