/// Notifies the auth layer when the HTTP client clears credentials (e.g. 401 refresh failure).
class SessionRevokedNotifier {
  void Function()? onSessionRevoked;

  void revoke() {
    onSessionRevoked?.call();
  }
}
