const streamState = new Map();

function toSequenceNumber(value) {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function readSequence(event) {
  return (
    toSequenceNumber(event?.sequence)
    ?? toSequenceNumber(event?.seq)
    ?? toSequenceNumber(event?.eventSequence)
    ?? toSequenceNumber(event?.payload?.sequence)
    ?? toSequenceNumber(event?.payload?.seq)
    ?? toSequenceNumber(event?.payload?.eventSequence)
  );
}

export function evaluateRealtimeEvent(streamKey, eventType, event) {
  const sequence = readSequence(event);
  if (sequence === null) {
    return { gapDetected: false, sequence: null, expected: null };
  }

  const stateKey = `${streamKey}:${eventType || 'unknown'}`;
  const previous = streamState.get(stateKey);
  const expected = previous === undefined ? null : previous + 1;
  const gapDetected = expected !== null && sequence > expected;

  if (previous === undefined || sequence > previous) {
    streamState.set(stateKey, sequence);
  }

  return { gapDetected, sequence, expected };
}

export function resetRealtimeStream(streamKey) {
  for (const key of Array.from(streamState.keys())) {
    if (key.startsWith(`${streamKey}:`)) {
      streamState.delete(key);
    }
  }
}
