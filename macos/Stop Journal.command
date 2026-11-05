#!/bin/bash
/bin/bash "$HOME/Library/Application Support/Trading Journal Launcher/launch.sh" stop
result=$?
echo 'Press Return to close.'
read -r _
exit "$result"
