#!/bin/bash
/bin/bash "$HOME/Library/Application Support/Trading Journal Launcher/launch.sh" start
result=$?
if [ "$result" -ne 0 ]; then echo 'Press Return to close.'; read -r _; fi
exit "$result"
