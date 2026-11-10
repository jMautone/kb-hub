# kb-hub in 30 seconds: create a vault, capture a note from a repo, check status, search.
# Render from the repo root, after `npm ci && npm run build`, with VHS (https://github.com/charmbracelet/vhs):
#   vhs demo/demo.tape
# Needs node, git and jq on PATH.

Output demo/demo.gif

Require node
Require git
Require jq

Set Shell "bash"
Set FontSize 16
Set Width 1280
Set Height 560
Set Padding 24
Set TypingSpeed 25ms
Set Theme "Catppuccin Mocha"

Hide
Type "source demo/setup.sh" Enter
Sleep 8s
Type "clear" Enter
Show

Type "# 1. Create a vault" Enter
Type "kb-hub init ~/demo-vault" Enter
Sleep 2s

Type "clear" Enter
Type "# 2. From a repo, the agent captures what it learned (kb = an MCP call to kb-hub)" Enter
Type "cd ~/storefront && git branch --show-current" Enter
Sleep 1s
Type `kb capture title="Checkout fails with expired coupon" text="The cart checks coupon expiry, checkout does not. Validate again on POST /checkout."` Enter
Sleep 5s
Type "cat ~/demo-vault/raw/inbox/*.md" Enter
Sleep 4s

Type "clear" Enter
Type "# 3. Status: what still needs compiling into the wiki" Enter
Type "kb status" Enter
Sleep 5s

Type "clear" Enter
Type "# 4. Search finds the note from any repo" Enter
Type "kb search query=coupon" Enter
Sleep 5s
