# Renders demo/demo.gif with VHS (https://github.com/charmbracelet/vhs).
# Run from the repo root after `npm ci && npm run build`:  vhs demo/demo.tape

Output demo/demo.gif
Set Shell "bash"
Set FontSize 18
Set Width 1280
Set Height 720
Set Padding 24
Set TypingSpeed 35ms
Set Theme "Catppuccin Mocha"

Hide
Type "export KB=$(pwd) DEMO=$(mktemp -d) && alias kb-hub='node $KB/dist/cli.js' && alias agent='node $KB/demo/call.mjs $DEMO/vault'" Enter
Type "mkdir $DEMO/storefront && cd $DEMO/storefront && git init -q -b feature/4821-checkout && git commit -q --allow-empty -m init && git remote add origin git@github.com:mate-and-co/storefront.git" Enter
Type "clear" Enter
Show

Type "# 1. Create a vault" Enter
Type "kb-hub init $DEMO/vault" Enter
Sleep 1.5s

Type "# 2. The agent captures a finding while working on feature/4821-checkout" Enter
Type `agent capture '{"title":"Expired coupon breaks checkout","text":"Coupons past their end date throw instead of being ignored."}'` Enter
Sleep 2.5s

Type "# 3. status shows what still needs compiling into the wiki" Enter
Type "agent status" Enter
Sleep 3s

Type "# 4. Any session, in any repo, can find it" Enter
Type `agent search '{"query":"coupon"}'` Enter
Sleep 3.5s
