import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'src/core/services/service_locator.dart';
import 'src/core/theme/app_theme.dart';
import 'src/core/theme/app_semantic_colors.dart';
import 'src/core/widgets/app_feedback.dart';
import 'src/core/widgets/fleet_shell.dart';
import 'src/core/widgets/sezar_brand_mark.dart';
import 'src/core/network/dio_client.dart';
import 'src/core/storage/secure_storage.dart';
import 'src/core/services/offline_sync_service.dart';
import 'src/core/services/websocket_service.dart';
import 'src/core/services/idle_timer_service.dart';
import 'src/core/services/connectivity_service.dart';
import 'src/core/services/tab_badge_service.dart';
import 'src/core/services/driver_tracking_service.dart';
import 'src/core/services/session_revoked_notifier.dart';
import 'src/features/auth/cubit/auth_cubit.dart';
import 'src/features/auth/presentation/login_screen.dart';
import 'src/features/auth/presentation/device_verification_screen.dart';
import 'src/features/auth/presentation/must_change_password_screen.dart';
import 'src/features/shift/cubit/shift_cubit.dart';
import 'src/features/shift/presentation/shift_screen.dart';
import 'src/features/trip/cubit/trip_cubit.dart';
import 'src/features/trip/presentation/trips_screen.dart';
import 'src/features/inspection/cubit/inspection_cubit.dart';
import 'src/features/inspection/presentation/inspection_screen.dart';
import 'src/features/expenses/cubit/expense_cubit.dart';
import 'src/features/expenses/presentation/expenses_screen.dart';
import 'src/features/damage/cubit/damage_cubit.dart';
import 'src/features/damage/presentation/damage_screen.dart';
import 'src/features/violations/cubit/violation_cubit.dart';
import 'src/features/violations/presentation/violations_screen.dart';
import 'src/features/notifications/cubit/notification_cubit.dart';
import 'src/features/notifications/presentation/notifications_screen.dart';
import 'src/features/home/cubit/home_cubit.dart';
import 'src/features/home/presentation/home_screen.dart';
import 'src/features/offline_queue/cubit/offline_queue_cubit.dart';
import 'src/features/offline_queue/presentation/offline_queue_screen.dart';
import 'src/features/badges/cubit/badge_cubit.dart';
import 'src/core/cubit/settings_cubit.dart';
import 'src/core/l10n/app_localizations.dart';
import 'package:flutter_localizations/flutter_localizations.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await setupLocator();
  runApp(const SezarDriverApp());
}

class SezarDriverApp extends StatefulWidget {
  const SezarDriverApp({super.key});

  @override
  State<SezarDriverApp> createState() => _SezarDriverAppState();
}

class _SezarDriverAppState extends State<SezarDriverApp> {
  @override
  void initState() {
    super.initState();
    _initServices();
  }

  Future<void> _initServices() async {
    getIt<ConnectivityService>().start();
  }

  @override
  void dispose() {
    getIt<IdleTimerService>().dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final dioClient = getIt<DioClient>();
    final secureStorage = getIt<SecureStorage>();
    final offlineQueue = getIt<OfflineQueueService>();
    final wsService = getIt<WebSocketService>();
    final idleTimer = getIt<IdleTimerService>();
    final tabBadgeService = getIt<TabBadgeService>();

    return MultiBlocProvider(
      providers: [
        BlocProvider<AuthCubit>(
          create: (_) => AuthCubit(
            dioClient,
            secureStorage,
            getIt<SessionRevokedNotifier>(),
          )..checkAuthStatus(),
        ),
        BlocProvider<ShiftCubit>(
          create: (_) => ShiftCubit(dioClient),
        ),
        BlocProvider<TripCubit>(
          create: (_) => TripCubit(dioClient),
        ),
        BlocProvider<InspectionCubit>(
          create: (_) => InspectionCubit(dioClient, offlineQueue),
        ),
        BlocProvider<ExpenseCubit>(
          create: (_) => ExpenseCubit(dioClient, offlineQueue),
        ),
        BlocProvider<DamageCubit>(
          create: (_) => DamageCubit(dioClient, offlineQueue),
        ),
        BlocProvider<ViolationCubit>(
          create: (_) => ViolationCubit(dioClient),
        ),
        BlocProvider<NotificationCubit>(
          create: (_) => NotificationCubit(dioClient),
        ),
        BlocProvider<HomeCubit>(
          create: (_) => HomeCubit(dioClient),
        ),
        BlocProvider<OfflineQueueCubit>(
          create: (_) => OfflineQueueCubit(offlineQueue),
        ),
        BlocProvider<BadgeCubit>(
          create: (_) => BadgeCubit(tabBadgeService)..startPolling(),
        ),
        BlocProvider<SettingsCubit>(
          create: (_) => SettingsCubit(),
        ),
      ],
      child: BlocBuilder<SettingsCubit, SettingsState>(
        builder: (context, settings) {
          return _AppWithIdle(
            idleTimer: idleTimer,
            wsService: wsService,
            child: MaterialApp(
              title: 'Sezar Driver',
              theme: AppTheme.lightTheme,
              darkTheme: AppTheme.darkTheme,
              themeMode: settings.themeMode,
              locale: settings.locale,
              supportedLocales: const [Locale('en'), Locale('ar')],
              localizationsDelegates: const [
                AppLocalizations.delegate,
                GlobalMaterialLocalizations.delegate,
                GlobalWidgetsLocalizations.delegate,
                GlobalCupertinoLocalizations.delegate,
              ],
              debugShowCheckedModeBanner: false,
              home: const AppAuthGate(),
            ),
          );
        },
      ),
    );
  }
}

class _AppWithIdle extends StatefulWidget {
  final IdleTimerService idleTimer;
  final WebSocketService wsService;
  final Widget child;
  const _AppWithIdle(
      {required this.idleTimer, required this.wsService, required this.child});

  @override
  State<_AppWithIdle> createState() => _AppWithIdleState();
}

class _AppWithIdleState extends State<_AppWithIdle>
    with WidgetsBindingObserver {
  bool _isBackgrounded = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) {
      widget.idleTimer.reset();
      widget.wsService.connect();
      if (mounted) {
        setState(() {
          _isBackgrounded = false;
        });
      }
    } else if (state == AppLifecycleState.paused ||
        state == AppLifecycleState.inactive) {
      if (mounted) {
        setState(() {
          _isBackgrounded = true;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final theme = Theme.of(context);

    return GestureDetector(
      onTap: () => widget.idleTimer.reset(),
      onPanDown: (_) => widget.idleTimer.reset(),
      onScaleStart: (_) => widget.idleTimer.reset(),
      child: Stack(
        children: [
          widget.child,
          if (_isBackgrounded)
            Positioned.fill(
              child: Material(
                color: AppTheme.backgroundColor,
                child: Center(
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      SezarBrandMark(
                        size: 88,
                        semanticLabel: l10n.t('brand_name'),
                      ),
                      const SizedBox(height: 24),
                      Text(
                        l10n.t('brand_name'),
                        style: theme.textTheme.headlineLarge,
                      ),
                      const SizedBox(height: 8),
                      Text(
                        l10n.t('secure_connection_active'),
                        style: theme.textTheme.bodyMedium?.copyWith(
                          fontWeight: FontWeight.w500,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
        ],
      ),
    );
  }
}

class AppAuthGate extends StatelessWidget {
  const AppAuthGate({super.key});

  @override
  Widget build(BuildContext context) {
    return BlocBuilder<AuthCubit, AuthState>(
      builder: (context, state) {
        if (state is AuthAuthenticated) {
          return const MainNavigationLayout();
        }
        if (state is AuthDeviceUnverified) {
          return DeviceVerificationScreen(
            userId: state.userId,
            verificationToken: state.verificationToken,
            bannerMessage: state.bannerMessage,
          );
        }
        if (state is AuthVerifyingDevice) {
          return DeviceVerificationScreen(
            userId: state.userId,
            verificationToken: state.verificationToken,
            isVerifying: true,
          );
        }
        if (state is AuthMustChangePassword) {
          return MustChangePasswordScreen(
              key: ValueKey(state.tempToken),
              bannerMessage: state.bannerMessage);
        }
        if (state is AuthLoading) {
          return const Scaffold(
            body: Center(child: CircularProgressIndicator()),
          );
        }
        if (state is AuthUnauthenticated || state is AuthError) {
          return const LoginScreen();
        }
        return const Scaffold(
          body: Center(child: CircularProgressIndicator()),
        );
      },
    );
  }
}

class MainNavigationLayout extends StatefulWidget {
  const MainNavigationLayout({super.key});

  @override
  State<MainNavigationLayout> createState() => _MainNavigationLayoutState();
}

class _MainNavigationLayoutState extends State<MainNavigationLayout> {
  final _scaffoldKey = GlobalKey<ScaffoldState>();
  int _selectedIndex = 0;
  int _pendingOffline = 0;
  bool _isOnline = true;
  bool _isSyncing = false;
  StreamSubscription? _wsSub;
  StreamSubscription? _connSub;
  StreamSubscription? _queueSub;

  late final List<Widget> _screens;

  @override
  void initState() {
    super.initState();
    _screens = [
      HomeScreen(onNavigateToTrips: () => setState(() => _selectedIndex = 1)),
      TripsScreen(onNavigateToShift: () => setState(() => _selectedIndex = 2)),
      ShiftScreen(
        onNavigateToInspection: () => setState(() => _selectedIndex = 4),
        onNavigateToTrips: () {
          setState(() => _selectedIndex = 1);
          context.read<TripCubit>().fetchMyTrips();
        },
      ),
      const ExpensesScreen(),
      const InspectionScreen(),
      const DamageScreen(),
      const ViolationsScreen(),
      const NotificationsScreen(),
      const OfflineQueueScreen(),
    ];

    _listenToWebSocket();
    _startDriverServices();
    context.read<NotificationCubit>().fetchNotifications();
    _pendingOffline = getIt<OfflineQueueService>().pendingCount;
    _isOnline = getIt<ConnectivityService>().isOnline;
    _queueSub =
        getIt<OfflineQueueService>().onPendingCountChanged.listen((count) {
      if (mounted) setState(() => _pendingOffline = count);
    });
    _connSub =
        getIt<ConnectivityService>().onConnectivityChanged.listen((online) {
      if (mounted) setState(() => _isOnline = online);
      if (online) _autoSyncOffline();
    });
    if (getIt<ConnectivityService>().isOnline) {
      _autoSyncOffline();
    }
  }

  void _startDriverServices() {
    getIt<WebSocketService>().connect();
    getIt<DriverTrackingService>().start();
    getIt<IdleTimerService>().start(() {
      getIt<DriverTrackingService>().stop();
      getIt<WebSocketService>().disconnect();
      if (mounted) {
        context.read<AuthCubit>().logout();
      }
    });
  }

  Future<void> _autoSyncOffline() async {
    if (_isSyncing) return;
    setState(() => _isSyncing = true);
    final result = await getIt<OfflineQueueService>().syncAll();
    if (!mounted) return;
    setState(() {
      _isSyncing = false;
      _pendingOffline = result.pending;
    });
    if (result.synced > 0 && mounted) {
      final l10n = AppLocalizations.of(context);
      AppFeedback.show(
        context,
        message: l10n
            .t('sync_complete', {'synced': '${result.synced}', 'failed': '0'}),
        type: AppFeedbackType.success,
      );
      context.read<OfflineQueueCubit>().fetchQueue();
    }
  }

  void _listenToWebSocket() {
    final wsService = getIt<WebSocketService>();
    _wsSub = wsService.events.listen((event) {
      if (!mounted) return;
      WebSocketService.notifyRelevantCubits(
        event,
        context.read<TripCubit>(),
        context.read<ShiftCubit>(),
        context.read<HomeCubit>(),
        context.read<NotificationCubit>(),
        context.read<ViolationCubit>(),
        context.read<BadgeCubit>(),
      );

      final message = WebSocketService.eventMessage(event.rawType);
      if (message != null) {
        AppFeedback.show(context, message: message);
      }
    });
  }

  @override
  void dispose() {
    _wsSub?.cancel();
    _connSub?.cancel();
    _queueSub?.cancel();
    getIt<DriverTrackingService>().stop();
    getIt<WebSocketService>().disconnect();
    getIt<IdleTimerService>().stop();
    super.dispose();
  }

  Widget _badgedIcon(IconData icon, int count) {
    if (count <= 0) return Icon(icon);
    return Badge(
      label: Text(count > 99 ? '99+' : '$count'),
      child: Icon(icon),
    );
  }

  int _badgeForTab(String tab) {
    final state = context.watch<BadgeCubit>().state;
    if (state is BadgeLoaded) return state.counts.forTab(tab);
    return 0;
  }

  int _unseenNotifications() {
    final state = context.watch<NotificationCubit>().state;
    if (state is NotificationLoaded) return state.unseenCount;
    return 0;
  }

  Widget _offlineBanner(AppLocalizations l10n) {
    if (_isOnline && _pendingOffline == 0 && !_isSyncing) {
      return const SizedBox.shrink();
    }
    final semantic = context.semanticColors;
    final color = _isOnline ? semantic.warning : semantic.danger;
    String message;
    if (_isSyncing) {
      message = l10n.t('syncing');
    } else if (!_isOnline) {
      message = _pendingOffline > 0
          ? '${l10n.t('offline_mode')} · $_pendingOffline ${l10n.t('pending_sync')}'
          : l10n.t('offline_mode');
    } else {
      message = '$_pendingOffline ${l10n.t('pending_sync')}';
    }
    return MaterialBanner(
      backgroundColor: color,
      content: Text(message,
          style: const TextStyle(
              color: Colors.white, fontWeight: FontWeight.w600)),
      actions: [
        if (_pendingOffline > 0 && _isOnline && !_isSyncing)
          TextButton(
            onPressed: _autoSyncOffline,
            child: Text(l10n.t('sync_now'),
                style: const TextStyle(color: Colors.white)),
          ),
      ],
    );
  }

  Future<void> _confirmLogout() async {
    final l10n = AppLocalizations.of(context);
    final danger = context.semanticColors.danger;
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text(l10n.t('logout')),
        content: Text(l10n.t('logout_confirm')),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(ctx, false),
              child: Text(l10n.t('cancel'))),
          ElevatedButton(
            style: ElevatedButton.styleFrom(
              backgroundColor: danger,
              foregroundColor: Colors.white,
            ),
            onPressed: () => Navigator.pop(ctx, true),
            child: Text(l10n.t('logout')),
          ),
        ],
      ),
    );
    if (confirmed == true && mounted) {
      getIt<DriverTrackingService>().stop();
      getIt<WebSocketService>().disconnect();
      await context.read<AuthCubit>().logout();
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final settings = context.watch<SettingsCubit>().state;
    final isArabic = settings.locale.languageCode == 'ar';
    final danger = context.semanticColors.danger;

    return Scaffold(
      key: _scaffoldKey,
      drawerEnableOpenDragGesture: true,
      body: Column(
        children: [
          _offlineBanner(l10n),
          Expanded(
            child: FleetShellScope(
              openDrawer: () => _scaffoldKey.currentState?.openDrawer(),
              child: GestureDetector(
                onTap: () => getIt<IdleTimerService>().reset(),
                child: _screens[_selectedIndex],
              ),
            ),
          ),
        ],
      ),
      bottomNavigationBar: NavigationBar(
        selectedIndex: _selectedIndex >= 5 ? 0 : _selectedIndex,
        onDestinationSelected: (index) {
          getIt<IdleTimerService>().reset();
          setState(() => _selectedIndex = index);
          if (index == 2) context.read<ShiftCubit>().fetchActiveShift();
        },
        destinations: [
          NavigationDestination(
              icon: const Icon(Icons.home), label: l10n.t('nav_home')),
          NavigationDestination(
            icon: _badgedIcon(Icons.route, _badgeForTab('trips')),
            label: l10n.t('nav_trips'),
          ),
          NavigationDestination(
            icon: _badgedIcon(Icons.timer, _badgeForTab('shift')),
            label: l10n.t('nav_shift'),
          ),
          NavigationDestination(
            icon: _badgedIcon(Icons.attach_money, _badgeForTab('expenses')),
            label: l10n.t('nav_expenses'),
          ),
          NavigationDestination(
            icon: _badgedIcon(Icons.fact_check, _badgeForTab('inspection')),
            label: l10n.t('nav_inspect'),
          ),
        ],
      ),
      drawer: Drawer(
        child: ListView(
          padding: EdgeInsets.zero,
          children: [
            FleetDrawerHeader(title: l10n.t('menu')),
            ListTile(
              leading: _badgedIcon(Icons.car_crash, _badgeForTab('damage')),
              title: Text(l10n.t('report_damage')),
              onTap: () {
                Navigator.pop(context);
                setState(() => _selectedIndex = 5);
              },
            ),
            ListTile(
              leading: _badgedIcon(Icons.gavel, _badgeForTab('violations')),
              title: Text(l10n.t('traffic_violations')),
              onTap: () {
                Navigator.pop(context);
                setState(() => _selectedIndex = 6);
              },
            ),
            ListTile(
              leading: _badgedIcon(Icons.notifications, _unseenNotifications()),
              title: Text(l10n.t('notifications')),
              onTap: () {
                Navigator.pop(context);
                setState(() => _selectedIndex = 7);
                context.read<NotificationCubit>().fetchNotifications();
              },
            ),
            ListTile(
              leading: Badge(
                label: _pendingOffline > 0 ? Text('$_pendingOffline') : null,
                child: const Icon(Icons.cloud_queue),
              ),
              title: Text(l10n.t('offline_queue')),
              onTap: () {
                Navigator.pop(context);
                setState(() => _selectedIndex = 8);
              },
            ),
            const Divider(),
            ListTile(
              leading: Icon(settings.themeMode == ThemeMode.dark
                  ? Icons.dark_mode
                  : Icons.light_mode),
              title: Text(settings.themeMode == ThemeMode.dark
                  ? l10n.t('theme_dark')
                  : l10n.t('theme_light')),
              onTap: () => context.read<SettingsCubit>().toggleTheme(),
            ),
            ListTile(
              leading: const Icon(Icons.language),
              title: Text(
                  '${l10n.t('language')}: ${isArabic ? 'العربية' : 'English'}'),
              onTap: () => context.read<SettingsCubit>().toggleLocale(),
            ),
            const Divider(),
            ListTile(
              leading: Icon(Icons.logout, color: danger),
              title: Text(l10n.t('logout'), style: TextStyle(color: danger)),
              onTap: () {
                Navigator.pop(context);
                _confirmLogout();
              },
            ),
          ],
        ),
      ),
    );
  }
}
