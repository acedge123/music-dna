import 'package:flutter_test/flutter_test.dart';
import 'package:music_dna/src/core/network/app_api_exception.dart';
import 'package:music_dna/src/features/onboarding/domain/entities/onboarding_reaction.dart';
import 'package:music_dna/src/features/onboarding/domain/entities/started_music_session.dart';
import 'package:music_dna/src/features/onboarding/domain/repositories/onboarding_repository.dart';
import 'package:music_dna/src/features/onboarding/presentation/cubit/onboarding_cubit.dart';

void main() {
  group('OnboardingCubit', () {
    test(
      'reacts to early songs and advances the conversational step',
      () async {
        final cubit = OnboardingCubit(
          FakeOnboardingRepository(
            reactions: const <OnboardingReaction>[
              OnboardingReaction(
                reaction: 'The Cure at the top. Okay, mood established.',
                nextLabel: "who's on deck after Robert Smith?",
              ),
            ],
          ),
        );

        addTearDown(cubit.close);

        await cubit.submitSong(song: 'A Forest — The Cure');

        expect(cubit.state.stage, OnboardingStage.collecting);
        expect(cubit.state.currentSongIndex, 1);
        expect(cubit.state.songs, const <String>['A Forest — The Cure']);
        expect(
          cubit.state.latestReaction,
          'The Cure at the top. Okay, mood established.',
        );
        expect(cubit.state.nextLabel, "who's on deck after Robert Smith?");
      },
    );

    test('emits success with started session on the third song', () async {
      final expected = StartedMusicSession(
        sessionId: 'session-1',
        sessionLane: 'alternative',
        sessionLaneConfidence: 0.87,
        analysisLane: 'alternative',
        analysisConfidence: 0.65,
        hypothesis: 'You trust songs that build pressure.',
        reaction: 'Three songs in. Already a shape.',
        reasoning: const <String>['You keep rewarding propulsion.'],
        secondaryLanes: const <String>['electronic'],
        songs: const <String>['A', 'B', 'C'],
      );
      final cubit = OnboardingCubit(
        FakeOnboardingRepository(
          reactions: const <OnboardingReaction>[
            OnboardingReaction(reaction: 'First reaction', nextLabel: 'Now #2'),
            OnboardingReaction(
              reaction: 'Second reaction',
              nextLabel: 'And the third',
            ),
          ],
          result: expected,
        ),
      );

      addTearDown(cubit.close);

      await cubit.submitSong(song: 'A');
      await cubit.submitSong(song: 'B');
      await cubit.submitSong(song: 'C');

      expect(cubit.state.stage, OnboardingStage.success);
      expect(cubit.state.startedSession, expected);
      expect(cubit.state.songs, expected.songs);
      expect(cubit.state.currentSongIndex, 3);
    });

    test('emits failure when repository throws', () async {
      final cubit = OnboardingCubit(
        FakeOnboardingRepository(error: Exception('network down')),
      );

      addTearDown(cubit.close);

      await cubit.submitSong(song: 'A');

      expect(cubit.state.stage, OnboardingStage.failure);
      expect(cubit.state.errorMessage, contains('network down'));
    });

    test(
      'marks reauthentication required when the API returns unauthorized',
      () async {
        final cubit = OnboardingCubit(
          FakeOnboardingRepository(
            error: const AppApiException(
              kind: AppApiErrorKind.unauthorized,
              message: 'Token expired',
            ),
          ),
        );

        addTearDown(cubit.close);

        await cubit.submitSong(song: 'A');

        expect(cubit.state.stage, OnboardingStage.failure);
        expect(cubit.state.requiresReauthentication, isTrue);
        expect(cubit.state.errorMessage, contains('Sign in again'));
      },
    );
  });
}

class FakeOnboardingRepository implements OnboardingRepository {
  FakeOnboardingRepository({
    this.reactions = const <OnboardingReaction>[],
    this.result,
    this.error,
  });

  final List<OnboardingReaction> reactions;
  final StartedMusicSession? result;
  final Object? error;
  int _reactionIndex = 0;

  @override
  Future<OnboardingReaction> reactToSong({
    required String song,
    required int index,
    required List<String> priorSongs,
  }) async {
    if (error != null) {
      throw error!;
    }
    return reactions[_reactionIndex++];
  }

  @override
  Future<StartedMusicSession> submitOpeningThree({
    required List<String> songs,
  }) async {
    if (error != null) {
      throw error!;
    }
    return result!;
  }
}
