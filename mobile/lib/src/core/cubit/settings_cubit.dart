import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:hive_flutter/hive_flutter.dart';
import '../l10n/app_locale.dart';

class SettingsState {
  final ThemeMode themeMode;
  final Locale locale;
  const SettingsState({this.themeMode = ThemeMode.dark, this.locale = const Locale('en')});
}

class SettingsCubit extends Cubit<SettingsState> {
  static const _boxName = 'app_settings';

  SettingsCubit() : super(const SettingsState()) {
    AppLocale.languageCode = 'en';
    _load();
  }

  Future<void> _load() async {
    final box = await Hive.openBox<String>(_boxName);
    final theme = box.get('theme', defaultValue: 'dark');
    final lang = box.get('locale', defaultValue: 'en');
    emit(SettingsState(
      themeMode: theme == 'light' ? ThemeMode.light : ThemeMode.dark,
      locale: Locale(lang ?? 'en'),
    ));
    AppLocale.languageCode = lang ?? 'en';
  }

  Future<void> toggleTheme() async {
    final next = state.themeMode == ThemeMode.dark ? ThemeMode.light : ThemeMode.dark;
    final box = await Hive.openBox<String>(_boxName);
    await box.put('theme', next == ThemeMode.light ? 'light' : 'dark');
    emit(SettingsState(themeMode: next, locale: state.locale));
    AppLocale.languageCode = state.locale.languageCode;
  }

  Future<void> toggleLocale() async {
    final next = state.locale.languageCode == 'ar' ? const Locale('en') : const Locale('ar');
    final box = await Hive.openBox<String>(_boxName);
    await box.put('locale', next.languageCode);
    AppLocale.languageCode = next.languageCode;
    emit(SettingsState(themeMode: state.themeMode, locale: next));
  }
}
