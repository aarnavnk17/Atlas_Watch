import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:atlaswatch/services/tracking_service.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  setUp(() {
    SharedPreferences.setMockInitialValues({});
    TrackingService.instance.stopAll();
  });

  tearDown(() => TrackingService.instance.stopAll());

  test('tracking runs only while something is subscribed', () {
    final service = TrackingService.instance;
    expect(service.isTracking, isFalse);

    service.subscribe(TrackingService.ambientKey);
    expect(service.isTracking, isTrue);

    // Releasing the subscription stops the timer. The journey screen used to
    // leave its timer running for the lifetime of the process.
    service.unsubscribe(TrackingService.ambientKey);
    expect(service.isTracking, isFalse);
  });

  test('a journey subscription does not cancel ambient tracking', () {
    final service = TrackingService.instance;
    final journeyKey = Object();

    service.subscribe(TrackingService.ambientKey);
    service.subscribe(journeyKey, interval: TrackingService.journeyInterval);
    expect(service.isTracking, isTrue);

    service.unsubscribe(journeyKey);
    expect(service.isTracking, isTrue, reason: 'ambient tracking should survive');

    service.unsubscribe(TrackingService.ambientKey);
    expect(service.isTracking, isFalse);
  });

  test('repeated subscribes for the same key do not stack timers', () {
    final service = TrackingService.instance;
    final key = Object();

    service.subscribe(key);
    service.subscribe(key);
    service.subscribe(key);

    service.unsubscribe(key);
    expect(service.isTracking, isFalse);
  });

  test('sign-out stops everything', () {
    final service = TrackingService.instance;
    service.subscribe(TrackingService.ambientKey);
    service.subscribe(Object(), interval: TrackingService.journeyInterval);

    service.stopAll();
    expect(service.isTracking, isFalse);
  });
}
