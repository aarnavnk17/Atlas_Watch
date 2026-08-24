import 'package:flutter_test/flutter_test.dart';
import 'package:atlaswatch/data/crime_dataset.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  setUpAll(() async {
    await CrimeDataset.ensureLoaded();
  });

  test('loads the dataset shared with the backend', () {
    expect(CrimeDataset.isLoaded, isTrue);
    expect(CrimeDataset.maxRawScore, greaterThan(0));
  });

  test('resolves cities from full addresses', () {
    final entry = CrimeDataset.lookup('New Delhi Railway Station, Delhi, India');
    expect(entry, isNotNull);
    expect(entry!.city, 'New Delhi');
    expect(entry.score, greaterThan(0));
  });

  test('resolves alternate city names', () {
    expect(CrimeDataset.lookup('bangalore')?.city, 'Bengaluru');
    expect(CrimeDataset.lookup('BOMBAY')?.city, 'Mumbai');
    expect(CrimeDataset.lookup('vizag')?.city, 'Visakhapatnam');
  });

  test('returns null for places with no data instead of inventing one', () {
    expect(CrimeDataset.lookup('Atlantis'), isNull);
    expect(CrimeDataset.coordinatesFor('Atlantis'), isNull);
  });

  test('every city carries coordinates for map and route scoring', () {
    final delhi = CrimeDataset.coordinatesFor('New Delhi');
    expect(delhi, isNotNull);
    expect(delhi!.latitude, closeTo(28.61, 0.1));
    expect(delhi.longitude, closeTo(77.21, 0.1));
  });

  test('finds the nearest city to a coordinate, and nothing when far away', () {
    final nearPune = CrimeDataset.nearest(18.52, 73.86);
    expect(nearPune?.city, 'Pune');

    // Middle of the Pacific — no city should be claimed as "nearby".
    expect(CrimeDataset.nearest(0.0, -160.0), isNull);
  });
}
