import 'package:shared_preferences/shared_preferences.dart';

/// Persisted credentials for the signed-in user.
///
/// Kept separate from [SessionService] so the HTTP layer can read the token
/// without importing the service that performs HTTP calls.
class AuthStore {
  static const _tokenKey = 'auth_token';
  static const _emailKey = 'user_email';

  static String? _cachedToken;
  static String? _cachedEmail;

  /// Invoked when the backend rejects the stored token, so the UI can return
  /// the user to the login screen.
  static void Function()? onUnauthorized;

  static Future<void> save({required String token, required String email}) async {
    _cachedToken = token;
    _cachedEmail = email;
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_tokenKey, token);
    await prefs.setString(_emailKey, email);
  }

  static Future<String?> token() async {
    if (_cachedToken != null) return _cachedToken;
    final prefs = await SharedPreferences.getInstance();
    return _cachedToken = prefs.getString(_tokenKey);
  }

  static Future<String?> email() async {
    if (_cachedEmail != null) return _cachedEmail;
    final prefs = await SharedPreferences.getInstance();
    return _cachedEmail = prefs.getString(_emailKey);
  }

  static Future<bool> hasSession() async => (await token()) != null;

  static Future<void> clear() async {
    _cachedToken = null;
    _cachedEmail = null;
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_tokenKey);
    await prefs.remove(_emailKey);
    await prefs.remove('profile_complete');
  }
}
