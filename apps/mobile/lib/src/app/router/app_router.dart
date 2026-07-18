import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';

import '../../core/di/app_dependencies.dart';
import '../../features/auth/presentation/pages/auth_stub_page.dart';
import '../../features/foundation/presentation/pages/foundation_home_page.dart';
import '../../features/onboarding/domain/entities/started_music_session.dart';
import '../../features/onboarding/presentation/cubit/onboarding_cubit.dart';
import '../../features/onboarding/presentation/pages/onboarding_stub_page.dart';
import '../../features/session/presentation/cubit/session_cubit.dart';
import '../../features/session/presentation/pages/session_stub_page.dart';

GoRouter buildAppRouter(AppDependencies dependencies) {
  return GoRouter(
    refreshListenable: dependencies.authRouterNotifier,
    redirect: (context, state) {
      final hasSession = dependencies.authRouterNotifier.isAuthenticated;
      final isProtectedRoute = state.matchedLocation == '/session';

      if (!hasSession && isProtectedRoute) {
        return '/auth';
      }

      return null;
    },
    routes: <RouteBase>[
      GoRoute(
        path: '/',
        builder: (context, state) =>
            FoundationHomePage(config: dependencies.config),
      ),
      GoRoute(path: '/auth', builder: (context, state) => const AuthStubPage()),
      GoRoute(
        path: '/onboarding',
        builder: (context, state) => BlocProvider<OnboardingCubit>(
          create: (_) => dependencies.createOnboardingCubit(),
          child: const OnboardingStubPage(),
        ),
      ),
      GoRoute(
        path: '/session',
        builder: (context, state) => BlocProvider<SessionCubit>(
          create: (_) => dependencies.createSessionCubit(
            startedSession: state.extra is StartedMusicSession
                ? state.extra as StartedMusicSession
                : null,
          )..initialize(),
          child: SessionStubPage(
            shareBaseUrl: dependencies.config.shareBaseUrl,
            startedSession: state.extra is StartedMusicSession
                ? state.extra as StartedMusicSession
                : null,
          ),
        ),
      ),
    ],
  );
}
