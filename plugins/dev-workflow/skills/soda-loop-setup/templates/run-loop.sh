#!/usr/bin/env bash
set -euo pipefail

# === Configuration (env vars with defaults) ===
LOOP_DIR="${LOOP_DIR:-.}"
CLAUDE_MODEL="${CLAUDE_MODEL:-sonnet}"
MAX_SESSIONS="${MAX_SESSIONS:-10}"
MAX_BUDGET_USD="${MAX_BUDGET_USD:-10}"
COOLDOWN_SECS="${COOLDOWN_SECS:-5}"
IDLE_TIMEOUT="${IDLE_TIMEOUT:-1800}"
DRY_RUN="${DRY_RUN:-0}"
ALLOWED_TOOLS="${ALLOWED_TOOLS:-Read,Write,Edit,Bash,Glob,Grep}"

PROGRESS_FILE="${LOOP_DIR}/PROGRESS.md"
PROMPT_FILE="${LOOP_DIR}/AGENT_PROMPT.md"
STOP_FILE="${LOOP_DIR}/STOP"
LOG_DIR="${LOOP_DIR}/.loop-logs"

# === Helpers ===
log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*"; }

parse_progress() {
  PENDING=$(grep -c '^\- \[ \]' "$PROGRESS_FILE" || true)
  IN_PROGRESS=$(grep -c '^\- \[~\]' "$PROGRESS_FILE" || true)
  DONE=$(grep -c '^\- \[x\]' "$PROGRESS_FILE" || true)
  BLOCKED=$(grep -c '^\- \[!\]' "$PROGRESS_FILE" || true)
}

append_session_log() {
  local session_num="$1"
  local exit_reason="$2"
  local timestamp
  timestamp=$(date '+%Y-%m-%d %H:%M')

  local in_progress_items
  in_progress_items=$(grep '^\- \[~\]' "$PROGRESS_FILE" | sed 's/^\- \[~\] /  - /' || true)

  {
    echo ""
    echo "### Session ${session_num} (${timestamp}) [exit: ${exit_reason}]"
    if [ -n "$in_progress_items" ]; then
      echo "- Items in progress:"
      echo "$in_progress_items"
    fi
    echo "- Exit reason: ${exit_reason}"
  } >> "$PROGRESS_FILE"
}

run_session() {
  local session_num="$1"
  local session_log="${LOG_DIR}/session-${session_num}.log"
  EXIT_REASON="normal"

  log "Starting session ${session_num}..."

  claude -p "$(cat "$PROMPT_FILE")" \
    --model "$CLAUDE_MODEL" \
    --allowedTools "$ALLOWED_TOOLS" \
    --max-budget-usd "$MAX_BUDGET_USD" \
    --output-format text \
    > "$session_log" 2>&1 &
  local claude_pid=$!

  # Monitor for inactivity
  while kill -0 "$claude_pid" 2>/dev/null; do
    if [ -f "$session_log" ]; then
      local last_mod now idle
      last_mod=$(stat -f %m "$session_log" 2>/dev/null || stat -c %Y "$session_log" 2>/dev/null || echo 0)
      now=$(date +%s)
      idle=$((now - last_mod))
      if [ "$idle" -gt "$IDLE_TIMEOUT" ]; then
        log "WARNING: No activity for ${IDLE_TIMEOUT}s. Killing session."
        kill "$claude_pid" 2>/dev/null || true
        EXIT_REASON="timeout"
        break
      fi
    fi
    sleep 60
  done

  wait "$claude_pid" 2>/dev/null
  local exit_code=$?

  if [ "$EXIT_REASON" = "timeout" ]; then
    return 0
  fi

  if [ "$exit_code" -eq 0 ]; then
    EXIT_REASON="normal"
  elif grep -qi 'budget' "$session_log" 2>/dev/null; then
    EXIT_REASON="budget-exceeded"
  else
    EXIT_REASON="error"
  fi
}

# === Preflight ===
if ! command -v claude &>/dev/null; then
  log "ERROR: claude CLI not found in PATH"
  exit 1
fi
if [ ! -f "$PROGRESS_FILE" ]; then
  log "ERROR: Progress file not found: ${PROGRESS_FILE}"
  exit 1
fi
if [ ! -f "$PROMPT_FILE" ]; then
  log "ERROR: Prompt file not found: ${PROMPT_FILE}"
  exit 1
fi
mkdir -p "$LOG_DIR"

log "=== Loop Harness Starting ==="
log "Dir: ${LOOP_DIR} | Model: ${CLAUDE_MODEL} | Budget: \$${MAX_BUDGET_USD}/session"
log "Max sessions: ${MAX_SESSIONS} | Idle timeout: ${IDLE_TIMEOUT}s | Cooldown: ${COOLDOWN_SECS}s"

# === Main Loop ===
session_count=0
while true; do
  # STOP file check
  if [ -f "$STOP_FILE" ]; then
    log "STOP file detected. Halting loop."
    break
  fi

  # MAX_SESSIONS check
  if [ "$session_count" -ge "$MAX_SESSIONS" ]; then
    log "Reached max sessions (${MAX_SESSIONS}). Halting loop."
    break
  fi

  # Parse progress
  parse_progress
  log "Progress: pending=${PENDING} in-progress=${IN_PROGRESS} done=${DONE} blocked=${BLOCKED}"

  # Exit if nothing left to do
  if [ "$PENDING" -eq 0 ] && [ "$IN_PROGRESS" -eq 0 ]; then
    log "No pending or in-progress items. Loop complete."
    break
  fi

  # Dry run check
  if [ "$DRY_RUN" -eq 1 ]; then
    log "DRY_RUN=1. Would start session $((session_count + 1)). Exiting."
    break
  fi

  # Run session
  session_count=$((session_count + 1))
  run_session "$session_count"

  log "Session ${session_count} exited [${EXIT_REASON}]"

  # Show tail of session log
  local_log="${LOG_DIR}/session-${session_count}.log"
  if [ -f "$local_log" ]; then
    log "--- Last 5 lines of session log ---"
    tail -5 "$local_log" || true
    log "---"
  fi

  # Append session log to PROGRESS.md
  append_session_log "$session_count" "$EXIT_REASON"

  # Cooldown
  if [ "$COOLDOWN_SECS" -gt 0 ]; then
    log "Cooling down for ${COOLDOWN_SECS}s..."
    sleep "$COOLDOWN_SECS"
  fi
done

# === Summary ===
parse_progress
log "=== Loop Finished ==="
log "Sessions: ${session_count} | Done: ${DONE} | Blocked: ${BLOCKED} | Pending: ${PENDING}"
log "Logs: ${LOG_DIR}/"
