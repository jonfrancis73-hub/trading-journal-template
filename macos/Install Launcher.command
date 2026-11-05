#!/bin/bash
set -e
trap 'echo; echo "Installation did not finish. Read the message above. Press Return to close."; read -r _' ERR
if [ "$(uname -s)" != Darwin ]; then echo 'This installer requires macOS.' >&2; exit 1; fi
source_dir="$(cd "$(dirname "$0")" && pwd)"
support="$HOME/Library/Application Support/Trading Journal Launcher"
default_project="$HOME/Documents/trading-journal-template"
echo 'This installs launch shortcuts only. It does not replace your journal or change Chrome data.'
if [ -f "$default_project/package.json" ] && [ -f "$default_project/scripts/dev.mjs" ]; then
  project="$default_project"
else
  project="$(/usr/bin/osascript -e 'POSIX path of (choose folder with prompt "Select your EXISTING trading-journal-template folder (the one containing package.json).")')"
fi
# Validate before saving the configuration. The runtime performs a full validation too.
if [ ! -f "$project/package.json" ] || [ ! -f "$project/scripts/dev.mjs" ] || [ ! -f "$project/src/main.jsx" ]; then
  echo 'That is not the journal folder. Run this installer again and select your existing journal.' >&2; exit 1
fi
mkdir -p "$support" "$HOME/Applications"
chmod 700 "$support"
cp "$source_dir/launch.sh" "$source_dir/launcher.mjs" "$support/"
printf '%s\n' "$project" > "$support/project.txt"
for action in start stop; do
  if [ "$action" = start ]; then name='Trading Journal'; else name='Stop Trading Journal'; fi
  app_source="$(mktemp -t trading-journal-app)"
  /bin/cat > "$app_source" <<APPLESCRIPT
on run
  try
    set helperPath to (POSIX path of (path to home folder)) & "Library/Application Support/Trading Journal Launcher/launch.sh"
    set resultText to do shell script "/bin/bash " & quoted form of helperPath & " $action"
    if resultText is not "" then display dialog resultText with title "Trading Journal" buttons {"OK"} default button 1
  on error messageText
    display dialog messageText with title "Trading Journal needs attention" buttons {"OK"} default button 1 with icon caution
  end try
end run
APPLESCRIPT
  /usr/bin/osacompile -o "$HOME/Applications/$name.app" "$app_source"
  rm -f "$app_source"
done
/usr/bin/open "$HOME/Applications"
echo 'Installed Trading Journal.app and Stop Trading Journal.app in your Applications folder.'
echo 'Drag Trading Journal.app to the Dock. Double-click it to open the journal.'
echo 'Press Return to close.'
read -r _
