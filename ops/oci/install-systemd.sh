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
node_bin="$(command -v node || true)"
flock_bin="$(command -v flock || true)"

[[ -f "${repo_dir}/scripts/run_cloud_school_meals.py" ]] || {
  echo "Not a Demeter checkout: ${repo_dir}" >&2
  exit 66
}
[[ -n "${python_bin}" && -n "${node_bin}" && -n "${flock_bin}" ]] || {
  echo "python3, node and flock are required." >&2
  exit 69
}

"${python_bin}" - <<'PY'
import sys
if sys.version_info < (3, 10):
    raise SystemExit("Python 3.10 or newer is required")
PY
"${node_bin}" -e '
const [major, minor] = process.versions.node.split(".").map(Number);
if (major < 22 || (major === 22 && minor < 13)) {
  throw new Error("Node.js 22.13 or newer is required");
}'

token_file="${repo_dir}/.secrets/site_publish_token"
[[ -f "${token_file}" ]] || {
  echo "Missing publish token: ${token_file}" >&2
  exit 78
}
token_mode="$(stat -c '%a' "${token_file}")"
[[ "${token_mode}" == "600" ]] || {
  echo "Publish token must have mode 600: ${token_file}" >&2
  exit 78
}
chown -R "${run_user}:${run_group}" "${repo_dir}/.secrets"

runtime_path="$(dirname "${node_bin}"):$(dirname "${python_bin}"):/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"
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
  "${script_dir}/demeter-school-meals@.service.in" >"${temporary_unit}"

install -m 0644 "${temporary_unit}" /etc/systemd/system/demeter-school-meals@.service
install -m 0644 "${script_dir}/demeter-school-meals-main.timer" /etc/systemd/system/
install -m 0644 "${script_dir}/demeter-school-meals-retry.timer" /etc/systemd/system/

systemctl daemon-reload
systemctl enable --now demeter-school-meals-main.timer demeter-school-meals-retry.timer
systemctl list-timers 'demeter-school-meals-*' --no-pager

echo
echo "OCI timers installed. No collection was started by this installer."
echo "Connectivity probe:"
echo "  cd ${repo_dir} && ${python_bin} scripts/fetch_school_meals.py --school 忠信國小"
echo "Manual full run:"
echo "  sudo systemctl start demeter-school-meals@main.service"

