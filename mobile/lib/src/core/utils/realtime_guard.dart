class RealtimeGuardResult {
  final bool gapDetected;
  final int? sequence;
  final int? expected;
  const RealtimeGuardResult({
    required this.gapDetected,
    this.sequence,
    this.expected,
  });
}

class RealtimeGuard {
  static final Map<String, int> _streamState = {};

  static int? _toSequence(dynamic value) {
    if (value == null) return null;
    if (value is int) return value;
    if (value is String && value.trim().isNotEmpty) {
      return int.tryParse(value);
    }
    return null;
  }

  static int? _readSequence(Map<String, dynamic> event) {
    return _toSequence(event['sequence']) ??
        _toSequence(event['seq']) ??
        _toSequence(event['eventSequence']) ??
        _toSequence((event['payload'] as Map?)?['sequence']) ??
        _toSequence((event['payload'] as Map?)?['seq']);
  }

  static RealtimeGuardResult evaluate(String streamKey, String? eventType, Map<String, dynamic> event) {
    final sequence = _readSequence(event);
    if (sequence == null) {
      return const RealtimeGuardResult(gapDetected: false);
    }

    final stateKey = '$streamKey:${eventType ?? 'unknown'}';
    final previous = _streamState[stateKey];
    final expected = previous == null ? null : previous + 1;
    final gapDetected = expected != null && sequence > expected;

    if (previous == null || sequence > previous) {
      _streamState[stateKey] = sequence;
    }

    return RealtimeGuardResult(gapDetected: gapDetected, sequence: sequence, expected: expected);
  }

  static void resetStream(String streamKey) {
    _streamState.removeWhere((key, _) => key.startsWith('$streamKey:'));
  }
}
