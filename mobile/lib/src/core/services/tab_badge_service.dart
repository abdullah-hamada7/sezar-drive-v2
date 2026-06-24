import '../network/dio_client.dart';
import '../network/api_endpoints.dart';
import '../utils/parsers.dart';

class DriverBadgeCounts {
  final int trips;
  final int shift;
  final int inspection;
  final int expenses;
  final int damage;
  final int violations;

  const DriverBadgeCounts({
    this.trips = 0,
    this.shift = 0,
    this.inspection = 0,
    this.expenses = 0,
    this.damage = 0,
    this.violations = 0,
  });

  factory DriverBadgeCounts.fromJson(Map<String, dynamic> json) {
    return DriverBadgeCounts(
      trips: parseIntWithDefault(json['trips'], 0),
      shift: parseIntWithDefault(json['shift'], 0),
      inspection: parseIntWithDefault(json['inspection'], 0),
      expenses: parseIntWithDefault(json['expenses'], 0),
      damage: parseIntWithDefault(json['damage'], 0),
      violations: parseIntWithDefault(json['violations'], 0),
    );
  }

  int forTab(String tab) {
    switch (tab) {
      case 'trips':
        return trips;
      case 'shift':
        return shift;
      case 'inspection':
        return inspection;
      case 'expenses':
        return expenses;
      case 'damage':
        return damage;
      case 'violations':
        return violations;
      default:
        return 0;
    }
  }
}

class TabBadgeService {
  final DioClient _client;

  TabBadgeService(this._client);

  Future<DriverBadgeCounts> fetchCounts() async {
    final response = await _client.dio.get(ApiEndpoints.badgeCounts);
    final raw = response.data;
    if (raw is Map<String, dynamic>) {
      return DriverBadgeCounts.fromJson(raw);
    }
    return const DriverBadgeCounts();
  }

  Future<void> markTabViewed(String tab) async {
    await _client.dio.patch(ApiEndpoints.markTabViewed(tab));
  }
}
