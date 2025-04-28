#!/bin/bash
# Simple wrapper that just runs the CalendarHelper binary directly

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
HELPER="$DIR/CalendarHelper"

# Just run the helper and pass through all arguments
"$HELPER" "$@" 