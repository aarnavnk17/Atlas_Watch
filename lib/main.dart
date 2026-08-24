import 'package:flutter/material.dart';
import 'services/auth_store.dart';
import 'services/session_service.dart';
import 'services/tracking_service.dart';
import 'screens/login_screen.dart';
import 'screens/dashboard_screen.dart';
import 'screens/profile_setup_screen.dart';
import 'theme/app_theme.dart';

// Global navigator key — lets background tracking push SOS from anywhere
final GlobalKey<NavigatorState> navigatorKey = GlobalKey<NavigatorState>();

void main() {
  WidgetsFlutterBinding.ensureInitialized();

  // When the backend rejects a stored token, drop the session and return to
  // the login screen rather than leaving the app in a half-signed-in state.
  AuthStore.onUnauthorized = () {
    TrackingService.instance.stopAll();
    navigatorKey.currentState?.pushAndRemoveUntil(
      MaterialPageRoute(builder: (_) => const LoginScreen()),
      (route) => false,
    );
  };

  runApp(const AtlasWatchApp());
}

class AtlasWatchApp extends StatelessWidget {
  const AtlasWatchApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      navigatorKey: navigatorKey,
      debugShowCheckedModeBanner: false,
      themeMode: ThemeMode.dark,
      theme: AppTheme.lightTheme,
      darkTheme: AppTheme.darkTheme,
      home: const EntryGate(),
    );
  }
}

class EntryGate extends StatelessWidget {
  const EntryGate({super.key});

  Future<Widget> _decideStartScreen() async {
    final session = SessionService();
    try {
      final loggedIn = await session.isLoggedIn();
      if (!loggedIn) return const LoginScreen();

      // Background tracking starts only once there is a session to attach the
      // readings to — and only after the user has granted location access.
      TrackingService.instance.subscribe(TrackingService.ambientKey);

      final profileComplete = await session.isProfileComplete();
      if (!profileComplete) return const ProfileSetupScreen(isEditMode: false);
      return const DashboardScreen();
    } catch (e) {
      debugPrint('EntryGate Error: $e');
      return const LoginScreen();
    }
  }

  @override
  Widget build(BuildContext context) {
    return FutureBuilder(
      future: _decideStartScreen(),
      builder: (context, snapshot) {
        if (snapshot.hasError) {
          return Scaffold(body: Center(child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              const Icon(Icons.error_outline, color: Colors.red, size: 60),
              const SizedBox(height: 16),
              const Text('An error occurred during startup'),
              const SizedBox(height: 8),
              ElevatedButton(
                onPressed: () => (context as Element).markNeedsBuild(),
                child: const Text('Retry'),
              ),
            ],
          )));
        }
        if (!snapshot.hasData) return const Scaffold(body: Center(child: CircularProgressIndicator()));
        return snapshot.data!;
      },
    );
  }
}
