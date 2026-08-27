#!/bin/sh

set -eu

env_file=${ENV_FILE:-.env}

read_env_file() {
  key=$1
  [ -f "$env_file" ] || return 0

  value=$(sed -n "s/^[[:space:]]*${key}[[:space:]]*=[[:space:]]*//p" "$env_file" | tail -n 1 | tr -d '\r')
  case "$value" in
    \"*\") value=${value#\"}; value=${value%\"} ;;
    \'*\') value=${value#\'}; value=${value%\'} ;;
  esac
  printf '%s' "$value"
}

token=${CLOUDFLARED_TUNNEL_TOKEN:-}
origin=${ORIGIN:-}

[ -n "$token" ] || token=$(read_env_file CLOUDFLARED_TUNNEL_TOKEN)
[ -n "$origin" ] || origin=$(read_env_file ORIGIN)

if [ -z "$token" ]; then
  printf '%s\n' "Cloudflare Tunnel token is missing." >&2
  printf '%s\n' "Add CLOUDFLARED_TUNNEL_TOKEN to $env_file or export it in your shell." >&2
  exit 1
fi

if [ -z "$origin" ]; then
  printf '%s\n' "ORIGIN is missing." >&2
  printf '%s\n' "Set ORIGIN to the exact public URL, for example https://atlore.example.com." >&2
  exit 1
fi

case "$origin" in
  https://*) ;;
  *)
    printf '%s\n' "ORIGIN must use HTTPS when Cloudflare Tunnel is enabled (received: $origin)." >&2
    exit 1
    ;;
esac

public_host=${origin#https://}
case "$public_host" in
  ''|*/*|*\?*|*\#*|*[[:space:]]*|localhost|localhost:*|127.*|\[::1\]*)
    printf '%s\n' "ORIGIN must be an exact public origin without a path or trailing slash (received: $origin)." >&2
    exit 1
    ;;
esac

if ! printf '%s\n' "$public_host" | grep -Eq '^([[:alnum:]]([[:alnum:]-]*[[:alnum:]])?\.)+[[:alnum:]]([[:alnum:]-]*[[:alnum:]])?(:[0-9]{1,5})?$'; then
  printf '%s\n' "ORIGIN does not contain a valid public hostname (received: $origin)." >&2
  exit 1
fi

case "$token" in
  replace-*|change-*|your-*|example-*)
    printf '%s\n' "CLOUDFLARED_TUNNEL_TOKEN still contains an example value." >&2
    exit 1
    ;;
esac

printf '%s\n' "Cloudflare Tunnel configuration is ready for $origin."
