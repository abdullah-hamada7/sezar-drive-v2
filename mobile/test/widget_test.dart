import 'package:flutter_test/flutter_test.dart';
import 'package:sezar_driver/main.dart';

import 'helpers/test_bootstrap.dart';

void main() {
  setUpAll(() async {
    await bootstrapWidgetTests();
  });

  testWidgets('shows driver login screen on startup', (WidgetTester tester) async {
    await tester.pumpWidget(const SezarDriverApp());
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 500));

    expect(find.text('Sezar Driver'), findsOneWidget);
    expect(find.text('Sign in'), findsOneWidget);
    expect(find.text('0'), findsNothing);
  });
}
