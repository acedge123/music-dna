import 'package:equatable/equatable.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../../../core/logging/app_logger.dart';
import '../../../../core/network/app_api_exception.dart';
import '../../../onboarding/domain/entities/started_music_session.dart';
import '../../data/session_resume_store.dart';
import '../../domain/entities/session_pairing.dart';
import '../../domain/entities/session_reveal.dart';
import '../../domain/repositories/session_repository.dart';

enum SessionStatus {
  initial,
  loading,
  ready,
  submitting,
  completed,
  revealing,
  revealed,
  failure,
  missingSession,
}

class SessionState extends Equatable {
  const SessionState({
    this.status = SessionStatus.initial,
    this.startedSession,
    this.currentRound,
    this.lastFeedback,
    this.reveal,
    this.sharedReveal,
    this.errorMessage,
    this.requiresReauthentication = false,
  });

  final SessionStatus status;
  final StartedMusicSession? startedSession;
  final SessionRoundState? currentRound;
  final SessionChoiceFeedback? lastFeedback;
  final SessionReveal? reveal;
  final SharedReveal? sharedReveal;
  final String? errorMessage;
  final bool requiresReauthentication;

  String? get sessionId => startedSession?.sessionId ?? currentRound?.sessionId;

  SessionState copyWith({
    SessionStatus? status,
    StartedMusicSession? startedSession,
    bool clearStartedSession = false,
    SessionRoundState? currentRound,
    bool clearCurrentRound = false,
    SessionChoiceFeedback? lastFeedback,
    bool clearLastFeedback = false,
    SessionReveal? reveal,
    bool clearReveal = false,
    SharedReveal? sharedReveal,
    bool clearSharedReveal = false,
    String? errorMessage,
    bool clearErrorMessage = false,
    bool? requiresReauthentication,
  }) {
    return SessionState(
      status: status ?? this.status,
      startedSession: clearStartedSession
          ? null
          : startedSession ?? this.startedSession,
      currentRound: clearCurrentRound
          ? null
          : currentRound ?? this.currentRound,
      lastFeedback: clearLastFeedback
          ? null
          : lastFeedback ?? this.lastFeedback,
      reveal: clearReveal ? null : reveal ?? this.reveal,
      sharedReveal: clearSharedReveal
          ? null
          : sharedReveal ?? this.sharedReveal,
      errorMessage: clearErrorMessage
          ? null
          : errorMessage ?? this.errorMessage,
      requiresReauthentication:
          requiresReauthentication ?? this.requiresReauthentication,
    );
  }

  @override
  List<Object?> get props => <Object?>[
    status,
    startedSession,
    currentRound,
    lastFeedback,
    reveal,
    sharedReveal,
    errorMessage,
    requiresReauthentication,
  ];
}

class SessionCubit extends Cubit<SessionState> {
  SessionCubit(
    this._repository, {
    StartedMusicSession? startedSession,
    SessionResumeStore? resumeStore,
    AppLogger? logger,
  }) : _logger = logger ?? const AppLogger(),
       _resumeStore = resumeStore,
       super(SessionState(startedSession: startedSession));

  final SessionRepository _repository;
  final AppLogger _logger;
  final SessionResumeStore? _resumeStore;

  Future<void> initialize() async {
    var sessionId = state.sessionId;
    if ((sessionId == null || sessionId.isEmpty) && _resumeStore != null) {
      final resumedSession = await _resumeStore.load();
      if (resumedSession != null) {
        emit(state.copyWith(startedSession: resumedSession));
        sessionId = resumedSession.sessionId;
      }
    }

    _logger.event('session.initialize', <String, Object?>{
      'hasSessionId': sessionId?.isNotEmpty == true,
    });
    if (sessionId == null || sessionId.isEmpty) {
      emit(
        state.copyWith(
          status: SessionStatus.missingSession,
          clearCurrentRound: true,
          clearReveal: true,
          clearSharedReveal: true,
          clearErrorMessage: true,
          requiresReauthentication: false,
        ),
      );
      return;
    }

    emit(
      state.copyWith(
        status: SessionStatus.loading,
        clearReveal: true,
        clearSharedReveal: true,
        clearErrorMessage: true,
        requiresReauthentication: false,
      ),
    );

    await _loadNextPairing(
      sessionId: sessionId,
      keepFeedback: state.lastFeedback != null,
    );
  }

  Future<void> chooseSong({
    required String chosenSongId,
    required int msToDecide,
  }) async {
    final sessionId = state.sessionId;
    final pairingId = state.currentRound?.pairing?.id;
    _logger.event('session.choice_requested', <String, Object?>{
      'sessionId': sessionId,
      'pairingId': pairingId,
      'chosenSongId': chosenSongId,
      'msToDecide': msToDecide,
    });
    if (sessionId == null || pairingId == null) {
      emit(
        state.copyWith(
          status: SessionStatus.failure,
          errorMessage: 'No active pairing is available yet.',
          requiresReauthentication: false,
        ),
      );
      return;
    }

    emit(
      state.copyWith(status: SessionStatus.submitting, clearErrorMessage: true),
    );

    try {
      final feedback = await _repository.submitChoice(
        sessionId: sessionId,
        pairingId: pairingId,
        chosenSongId: chosenSongId,
        msToDecide: msToDecide,
      );
      _logger.event('session.choice_succeeded', <String, Object?>{
        'sessionId': sessionId,
        'pairingId': pairingId,
      });
      emit(state.copyWith(lastFeedback: feedback, clearErrorMessage: true));
      await _loadNextPairing(sessionId: sessionId, keepFeedback: true);
    } catch (error) {
      _logger.error('session.choice_failed', error, <String, Object?>{
        'sessionId': sessionId,
        'pairingId': pairingId,
      });
      final apiError = error is AppApiException ? error : null;
      emit(
        state.copyWith(
          status: SessionStatus.failure,
          errorMessage: _readableError(apiError ?? error),
          requiresReauthentication: apiError?.isAuthRelated == true,
        ),
      );
    }
  }

  void clearFeedback() {
    emit(
      state.copyWith(
        clearLastFeedback: true,
        clearErrorMessage: true,
        status: state.currentRound?.pairing != null
            ? SessionStatus.ready
            : state.status,
        requiresReauthentication: false,
      ),
    );
  }

  Future<void> revealSession() async {
    final sessionId = state.sessionId;
    _logger.event('session.reveal_requested', <String, Object?>{
      'sessionId': sessionId,
    });
    if (sessionId == null || sessionId.isEmpty) {
      emit(
        state.copyWith(
          status: SessionStatus.failure,
          errorMessage: 'No active session is available yet.',
          requiresReauthentication: false,
        ),
      );
      return;
    }

    emit(
      state.copyWith(
        status: SessionStatus.revealing,
        clearErrorMessage: true,
        requiresReauthentication: false,
      ),
    );

    try {
      final reveal = await _repository.revealSession(sessionId: sessionId);
      SharedReveal? sharedReveal;
      if (reveal.shareToken != null && reveal.shareToken!.isNotEmpty) {
        try {
          sharedReveal = await _repository.fetchSharedReveal(
            token: reveal.shareToken!,
          );
        } catch (error) {
          _logger.error('session.share_fetch_failed', error, <String, Object?>{
            'sessionId': sessionId,
            'shareToken': reveal.shareToken,
          });
        }
      }
      _logger.event('session.reveal_succeeded', <String, Object?>{
        'sessionId': sessionId,
        'shareToken': reveal.shareToken,
      });

      emit(
        state.copyWith(
          status: SessionStatus.revealed,
          reveal: reveal,
          sharedReveal: sharedReveal,
          clearErrorMessage: true,
          requiresReauthentication: false,
        ),
      );
    } catch (error) {
      _logger.error('session.reveal_failed', error, <String, Object?>{
        'sessionId': sessionId,
      });
      final apiError = error is AppApiException ? error : null;
      emit(
        state.copyWith(
          status: SessionStatus.failure,
          errorMessage: _readableError(apiError ?? error),
          requiresReauthentication: apiError?.isAuthRelated == true,
        ),
      );
    }
  }

  Future<void> _loadNextPairing({
    required String sessionId,
    required bool keepFeedback,
  }) async {
    try {
      final nextRound = await _repository.fetchNextPairing(
        sessionId: sessionId,
      );
      _logger.event('session.next_pairing_loaded', <String, Object?>{
        'sessionId': sessionId,
        'round': nextRound.round,
        'done': nextRound.done,
        'hasPairing': nextRound.pairing != null,
      });
      emit(
        state.copyWith(
          status: nextRound.done || nextRound.pairing == null
              ? SessionStatus.completed
              : SessionStatus.ready,
          currentRound: nextRound,
          clearLastFeedback: !keepFeedback,
          clearReveal: true,
          clearSharedReveal: true,
          clearErrorMessage: true,
          requiresReauthentication: false,
        ),
      );
    } catch (error) {
      _logger.error('session.next_pairing_failed', error, <String, Object?>{
        'sessionId': sessionId,
      });
      final apiError = error is AppApiException ? error : null;
      emit(
        state.copyWith(
          status: SessionStatus.failure,
          errorMessage: _readableError(apiError ?? error),
          requiresReauthentication: apiError?.isAuthRelated == true,
        ),
      );
    }
  }

  String _readableError(Object error) {
    if (error is AppApiException) {
      switch (error.kind) {
        case AppApiErrorKind.unauthorized:
        case AppApiErrorKind.forbidden:
          return 'Your session expired. Sign in again to keep going.';
        case AppApiErrorKind.network:
          return 'You appear to be offline. Reconnect and retry this step.';
        case AppApiErrorKind.invalidInput:
          return error.message;
        case AppApiErrorKind.upstream:
        case AppApiErrorKind.internal:
        case AppApiErrorKind.unknown:
          return error.message.isEmpty
              ? 'We could not continue your session right now.'
              : error.message;
      }
    }

    final message = error.toString().trim();
    return message.isEmpty ? 'Something went wrong.' : message;
  }
}
