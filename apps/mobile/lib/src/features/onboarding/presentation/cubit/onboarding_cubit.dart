import 'package:equatable/equatable.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../../../core/logging/app_logger.dart';
import '../../../../core/network/app_api_exception.dart';
import '../../domain/entities/onboarding_reaction.dart';
import '../../domain/entities/started_music_session.dart';
import '../../domain/repositories/onboarding_repository.dart';

enum OnboardingStage { collecting, reacting, submitting, success, failure }

class OnboardingState extends Equatable {
  const OnboardingState({
    this.stage = OnboardingStage.collecting,
    this.currentSongIndex = 0,
    this.songs = const <String>[],
    this.reactions = const <OnboardingReaction>[],
    this.startedSession,
    this.errorMessage,
    this.requiresReauthentication = false,
  });

  final OnboardingStage stage;
  final int currentSongIndex;
  final List<String> songs;
  final List<OnboardingReaction> reactions;
  final StartedMusicSession? startedSession;
  final String? errorMessage;
  final bool requiresReauthentication;

  bool get isComplete => currentSongIndex >= 3;
  bool get isSubmitting =>
      stage == OnboardingStage.submitting || stage == OnboardingStage.reacting;
  String? get nextLabel => reactions.isEmpty ? null : reactions.last.nextLabel;
  String? get latestReaction =>
      reactions.isEmpty ? null : reactions.last.reaction;

  OnboardingState copyWith({
    OnboardingStage? stage,
    int? currentSongIndex,
    List<String>? songs,
    List<OnboardingReaction>? reactions,
    StartedMusicSession? startedSession,
    bool clearStartedSession = false,
    String? errorMessage,
    bool clearErrorMessage = false,
    bool? requiresReauthentication,
  }) {
    return OnboardingState(
      stage: stage ?? this.stage,
      currentSongIndex: currentSongIndex ?? this.currentSongIndex,
      songs: songs ?? this.songs,
      reactions: reactions ?? this.reactions,
      startedSession: clearStartedSession
          ? null
          : startedSession ?? this.startedSession,
      errorMessage: clearErrorMessage
          ? null
          : errorMessage ?? this.errorMessage,
      requiresReauthentication:
          requiresReauthentication ?? this.requiresReauthentication,
    );
  }

  @override
  List<Object?> get props => <Object?>[
    stage,
    currentSongIndex,
    songs,
    reactions,
    startedSession,
    errorMessage,
    requiresReauthentication,
  ];
}

class OnboardingCubit extends Cubit<OnboardingState> {
  OnboardingCubit(this._repository, {AppLogger? logger})
    : _logger = logger ?? const AppLogger(),
      super(const OnboardingState());

  final OnboardingRepository _repository;
  final AppLogger _logger;

  Future<void> submitSong({required String song}) async {
    final trimmedSong = song.trim();
    if (trimmedSong.isEmpty || state.isSubmitting || state.isComplete) {
      return;
    }

    final priorSongs = state.songs;
    final nextSongs = <String>[...priorSongs, trimmedSong];
    final currentIndex = state.currentSongIndex;

    _logger.event('onboarding.song_submit_requested', <String, Object?>{
      'index': currentIndex,
      'songCount': nextSongs.length,
    });

    emit(
      state.copyWith(
        stage: currentIndex < 2
            ? OnboardingStage.reacting
            : OnboardingStage.submitting,
        clearErrorMessage: true,
        requiresReauthentication: false,
      ),
    );

    try {
      if (currentIndex < 2) {
        final reaction = await _repository.reactToSong(
          song: trimmedSong,
          index: currentIndex,
          priorSongs: priorSongs,
        );
        _logger.event('onboarding.song_reacted', <String, Object?>{
          'index': currentIndex,
          'hasNextLabel': reaction.nextLabel?.isNotEmpty == true,
        });
        emit(
          state.copyWith(
            stage: OnboardingStage.collecting,
            currentSongIndex: currentIndex + 1,
            songs: nextSongs,
            reactions: <OnboardingReaction>[...state.reactions, reaction],
            clearErrorMessage: true,
            requiresReauthentication: false,
          ),
        );
        return;
      }

      final startedSession = await _repository.submitOpeningThree(
        songs: nextSongs,
      );
      _logger.event('onboarding.submit_succeeded', <String, Object?>{
        'sessionId': startedSession.sessionId,
        'analysisLane': startedSession.analysisLane,
      });
      emit(
        state.copyWith(
          stage: OnboardingStage.success,
          currentSongIndex: 3,
          songs: nextSongs,
          startedSession: startedSession,
          clearErrorMessage: true,
          requiresReauthentication: false,
        ),
      );
    } catch (error) {
      _logger.error('onboarding.submit_failed', error, <String, Object?>{
        'songCount': nextSongs.length,
        'index': currentIndex,
      });
      final apiError = error is AppApiException ? error : null;
      emit(
        state.copyWith(
          stage: OnboardingStage.failure,
          clearStartedSession: true,
          errorMessage: _readableError(apiError ?? error),
          requiresReauthentication: apiError?.isAuthRelated == true,
        ),
      );
    }
  }

  void clearFeedback() {
    emit(
      state.copyWith(
        stage: OnboardingStage.collecting,
        clearErrorMessage: true,
        requiresReauthentication: false,
      ),
    );
  }

  String _readableError(Object error) {
    if (error is AppApiException) {
      switch (error.kind) {
        case AppApiErrorKind.unauthorized:
        case AppApiErrorKind.forbidden:
          return 'Your session expired. Sign in again to continue onboarding.';
        case AppApiErrorKind.network:
          return 'You appear to be offline. Reconnect and try your opener again.';
        case AppApiErrorKind.invalidInput:
          return error.message;
        case AppApiErrorKind.upstream:
        case AppApiErrorKind.internal:
        case AppApiErrorKind.unknown:
          return error.message.isEmpty
              ? 'We could not build your opener right now.'
              : error.message;
      }
    }

    final message = error.toString().trim();
    return message.isEmpty ? 'Something went wrong.' : message;
  }
}
