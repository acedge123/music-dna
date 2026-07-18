import 'package:supabase_flutter/supabase_flutter.dart';

import '../../app/router/auth_router_notifier.dart';
import '../../features/auth/data/datasources/auth_remote_data_source.dart';
import '../../features/auth/data/repositories/auth_repository_impl.dart';
import '../../features/auth/domain/repositories/auth_repository.dart';
import '../../features/auth/presentation/cubit/auth_cubit.dart';
import '../../features/onboarding/domain/entities/started_music_session.dart';
import '../../features/onboarding/data/datasources/onboarding_remote_data_source.dart';
import '../../features/onboarding/data/repositories/onboarding_repository_impl.dart';
import '../../features/onboarding/domain/repositories/onboarding_repository.dart';
import '../../features/onboarding/presentation/cubit/onboarding_cubit.dart';
import '../../features/session/data/datasources/session_remote_data_source.dart';
import '../../features/session/data/repositories/session_repository_impl.dart';
import '../../features/session/data/session_resume_store.dart';
import '../../features/session/domain/repositories/session_repository.dart';
import '../../features/session/presentation/cubit/session_cubit.dart';
import '../config/app_config.dart';
import '../logging/app_logger.dart';
import '../network/music_dna_api_client.dart';

class AppDependencies {
  AppDependencies({required this.config, required this.supabase}) {
    apiClient = MusicDnaApiClient(
      baseUrl: config.apiBaseUrl,
      accessTokenProvider: () async =>
          supabase.auth.currentSession?.accessToken,
    );
    authRemoteDataSource = SupabaseAuthRemoteDataSource(supabase, apiClient);
    authRepository = AuthRepositoryImpl(authRemoteDataSource);
  }

  final AppConfig config;
  final SupabaseClient supabase;

  late final AppLogger logger = const AppLogger();
  late final AuthRemoteDataSource authRemoteDataSource;
  late final AuthRepository authRepository;
  late final AuthRouterNotifier authRouterNotifier = AuthRouterNotifier(
    authRepository,
  );
  late final MusicDnaApiClient apiClient;
  late final OnboardingRemoteDataSource onboardingRemoteDataSource =
      OnboardingRemoteDataSource(apiClient);
  late final OnboardingRepository onboardingRepository =
      OnboardingRepositoryImpl(onboardingRemoteDataSource);
  late final SessionRemoteDataSource sessionRemoteDataSource =
      SessionRemoteDataSource(apiClient);
  late final SessionRepository sessionRepository = SessionRepositoryImpl(
    sessionRemoteDataSource,
  );
  late final SessionResumeStore sessionResumeStore = SessionResumeStore();

  AuthCubit createAuthCubit() {
    return AuthCubit(authRepository, logger: logger)..initialize();
  }

  OnboardingCubit createOnboardingCubit() {
    return OnboardingCubit(
      onboardingRepository,
      resumeStore: sessionResumeStore,
      logger: logger,
    );
  }

  SessionCubit createSessionCubit({StartedMusicSession? startedSession}) {
    return SessionCubit(
      sessionRepository,
      startedSession: startedSession,
      resumeStore: sessionResumeStore,
      logger: logger,
    );
  }
}
