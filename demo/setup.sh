# Hidden setup for demo.tape. Sourced from the repo root after `npm ci && npm run build`.
# It uses a throwaway HOME, so the recording never touches your real vault or repos.

KB_HUB_CLI="$PWD/dist/cli.js"
INSPECTOR="@modelcontextprotocol/inspector@2.12.0"
export npm_config_cache="${npm_config_cache:-$HOME/.npm}"
export HOME="$(mktemp -d)"
export TZ="America/Montevideo"
export PS1='\[\e[1;36m\]\W\[\e[0m\] $ '

# Until v0.1.0 is on npm, `kb-hub` runs this checkout.
kb-hub() { node "$KB_HUB_CLI" "$@"; }

# kb <tool> [key=value ...]: calls one kb-hub tool through the MCP Inspector CLI, the same
# way an agent would over MCP, and prints the tool's text result.
kb() {
  local tool="$1"; shift
  local args=()
  for arg in "$@"; do args+=(--tool-arg "$arg"); done
  npx -y "$INSPECTOR" --cli -e "TZ=$TZ" node "$KB_HUB_CLI" mcp --vault "$HOME/demo-vault" \
    --method tools/call --tool-name "$tool" "${args[@]}" 2>/dev/null | jq -r '.content[0].text'
}

# A sample repo of the fictional store, on a branch that carries work item 4821.
git init -q "$HOME/storefront"
git -C "$HOME/storefront" symbolic-ref HEAD refs/heads/feature/4821-checkout
git -C "$HOME/storefront" remote add origin git@github.com:mate-and-co/storefront.git
echo "# Storefront" > "$HOME/storefront/README.md"
git -C "$HOME/storefront" add README.md
git -C "$HOME/storefront" -c user.name="Mate & Co." -c user.email=dev@example.com -c commit.gpgsign=false commit -q -m "First commit"

# Download the Inspector before recording starts.
npx -y "$INSPECTOR" --help >/dev/null 2>&1 || true
cd "$HOME"
