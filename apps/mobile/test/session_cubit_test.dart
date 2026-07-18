import 'package:flutter_test/flutter_test.dart';
import 'package:music_dna/src/core/network/app_api_exception.dart';
import 'package:music_dna/src/features/onboarding/domain/entities/started_music_session.dart';
import 'package:music_dna/src/features/session/domain/entities/session_pairing.dart';
import 'package:music_dna/src/features/session/domain/entities/session_reveal.dart';
import 'package:music_dna/src/features/session/domain/repositories/session_repository.dart';
import 'package:music_dna/src/features/session/presentation/cubit/session_cubit.dart';

void main() {
  group('SessionCubit', () {
    test('loads the first pairing from the started session', () async {
      final repository = FakeSessionRepository(
        nextPairings: <SessionRoundState>[
          SessionRoundState(
            sessionId: 'session-1',
            round: 1,
            confidence: 0.42,
            done: false,
            pairing: SessionPairing(
              id: 'pairing-1',
              songA: const SessionPairingSong(
                id: 'song-a',
                title: 'Song A',
                artist: 'Artist A',
              ),
              songB: const SessionPairingSong(
                id: 'song-b',
                title: 'Song B',
                artist: 'Artist B',
              ),
              tests: const <String>['drive'],
            ),
          ),
        ],
      );
      final cubit = SessionCubit(repository, startedSession: _startedSession());

      addTearDown(cubit.close);

      await cubit.initialize();

      expect(cubit.state.status, SessionStatus.ready);
      expect(cubit.state.currentRound?.pairing?.id, 'pairing-1');
      expect(cubit.state.currentRound?.round, 1);
    });

    test(
      'submits a choice, keeps feedback, and advances to completion',
      () async {
        final repository = FakeSessionRepository(
          nextPairings: <SessionRoundState>[
            SessionRoundState(
              sessionId: 'session-1',
              round: 1,
              confidence: 0.42,
              done: false,
              pairing: SessionPairing(
                id: 'pairing-1',
                songA: const SessionPairingSong(
                  id: 'song-a',
                  title: 'Song A',
                  artist: 'Artist A',
                ),
                songB: const SessionPairingSong(
                  id: 'song-b',
                  title: 'Song B',
                  artist: 'Artist B',
                ),
                tests: const <String>['drive'],
              ),
            ),
            const SessionRoundState(
              sessionId: 'session-1',
              round: 2,
              confidence: 0.77,
              done: true,
            ),
          ],
          feedback: const SessionChoiceFeedback(
            verdict: 'Decisive',
            why: 'You rewarded pressure over polish.',
            dimension: 'intensity',
            delta: 0.32,
          ),
        );
        final cubit = SessionCubit(
          repository,
          startedSession: _startedSession(),
        );

        addTearDown(cubit.close);

        await cubit.initialize();
        await cubit.chooseSong(chosenSongId: 'song-a', msToDecide: 1200);

        expect(repository.lastChoiceSongId, 'song-a');
        expect(repository.lastChoiceMsToDecide, 1200);
        expect(cubit.state.status, SessionStatus.completed);
        expect(cubit.state.lastFeedback?.verdict, 'Decisive');
      },
    );

    test('skips a pairing and advances without feedback', () async {
      final repository = FakeSessionRepository(
        nextPairings: <SessionRoundState>[
          SessionRoundState(
            sessionId: 'session-1',
            round: 1,
            confidence: 0.42,
            done: false,
            pairing: SessionPairing(
              id: 'pairing-1',
              songA: const SessionPairingSong(
                id: 'song-a',
                title: 'Song A',
                artist: 'Artist A',
              ),
              songB: const SessionPairingSong(
                id: 'song-b',
                title: 'Song B',
                artist: 'Artist B',
              ),
              tests: const <String>['drive'],
            ),
          ),
          SessionRoundState(
            sessionId: 'session-1',
            round: 2,
            confidence: 0.51,
            done: false,
            pairing: SessionPairing(
              id: 'pairing-2',
              songA: const SessionPairingSong(
                id: 'song-c',
                title: 'Song C',
                artist: 'Artist C',
              ),
              songB: const SessionPairingSong(
                id: 'song-d',
                title: 'Song D',
                artist: 'Artist D',
              ),
              tests: const <String>['texture'],
            ),
          ),
        ],
      );
      final cubit = SessionCubit(repository, startedSession: _startedSession());

      addTearDown(cubit.close);

      await cubit.initialize();
      await cubit.skipPairing(msToDecide: 900);

      expect(repository.lastSkippedPairingId, 'pairing-1');
      expect(repository.lastSkipMsToDecide, 900);
      expect(cubit.state.status, SessionStatus.ready);
      expect(cubit.state.currentRound?.pairing?.id, 'pairing-2');
      expect(cubit.state.lastFeedback, isNull);
    });

    test(
      'builds a reveal and shared reading once the session is complete',
      () async {
        final repository = FakeSessionRepository(
          nextPairings: <SessionRoundState>[
            const SessionRoundState(
              sessionId: 'session-1',
              round: 2,
              confidence: 0.77,
              done: true,
            ),
          ],
          reveal: const SessionReveal(
            archetypeId: 'arch-1',
            archetypeName: 'Architect',
            interpretation: 'You keep choosing pressure over polish.',
            vector: <String, double>{'intensity': 0.8},
            allowedClaims: <RevealClaim>[
              RevealClaim(
                dimension: 'intensity',
                preferred: 'pressure',
                opposed: 'polish',
                supportingChoices: 7,
                testedTotal: 10,
                confidence: 0.82,
                examples: <RevealClaimExample>[
                  RevealClaimExample(
                    chosen: 'Song A',
                    rejected: 'Song B',
                    delta: 0.2,
                  ),
                ],
                tradeoff: 'Pressure over polish',
              ),
            ],
            counterarguments: <RevealCounterargument>[
              RevealCounterargument(
                claim: 'Maybe you just knew the songs better.',
                impact: 'low',
                notes: 'The pattern held across unfamiliar pairings too.',
              ),
            ],
            shareToken: 'share-12345678',
          ),
          sharedReveal: SharedReveal(
            sessionId: 'session-1',
            shareToken: 'share-12345678',
            completedAt: DateTime.parse('2026-07-01T00:00:00Z'),
            lane: 'cinematic',
            interpretation: 'Public reveal copy',
            archetype: const SharedRevealArchetype(name: 'Architect'),
            definingChoices: const <DefiningChoice>[
              DefiningChoice(
                chosen: 'Song A',
                chosenArtist: 'Artist A',
                rejected: 'Song B',
                rejectedArtist: 'Artist B',
              ),
            ],
          ),
        );
        final cubit = SessionCubit(
          repository,
          startedSession: _startedSession(),
        );

        addTearDown(cubit.close);

        await cubit.initialize();
        await cubit.revealSession();

        expect(cubit.state.status, SessionStatus.revealed);
        expect(cubit.state.reveal?.archetypeName, 'Architect');
        expect(cubit.state.sharedReveal?.shareToken, 'share-12345678');
      },
    );

    test('keeps reveal when optional shared reveal fetch fails', () async {
      final repository = FakeSessionRepository(
        nextPairings: <SessionRoundState>[
          const SessionRoundState(
            sessionId: 'session-1',
            round: 2,
            confidence: 0.77,
            done: true,
          ),
        ],
        reveal: const SessionReveal(
          archetypeName: 'Architect',
          interpretation: 'You keep choosing pressure over polish.',
          vector: <String, double>{},
          allowedClaims: <RevealClaim>[],
          counterarguments: <RevealCounterargument>[],
          shareToken: 'share-12345678',
        ),
        sharedRevealError: Exception('share endpoint down'),
      );
      final cubit = SessionCubit(repository, startedSession: _startedSession());

      addTearDown(cubit.close);

      await cubit.initialize();
      await cubit.revealSession();

      expect(cubit.state.status, SessionStatus.revealed);
      expect(cubit.state.reveal?.archetypeName, 'Architect');
      expect(cubit.state.sharedReveal, isNull);
      expect(cubit.state.errorMessage, isNull);
    });

    test(
      'moves to missingSession when no started session is available',
      () async {
        final cubit = SessionCubit(FakeSessionRepository());

        addTearDown(cubit.close);

        await cubit.initialize();

        expect(cubit.state.status, SessionStatus.missingSession);
        expect(cubit.state.errorMessage, isNull);
      },
    );

    test(
      'requests reauthentication when the pairing API returns unauthorized',
      () async {
        final cubit = SessionCubit(
          FakeSessionRepository(
            nextPairingsError: const AppApiException(
              kind: AppApiErrorKind.unauthorized,
              message: 'expired token',
            ),
          ),
          startedSession: _startedSession(),
        );

        addTearDown(cubit.close);

        await cubit.initialize();

        expect(cubit.state.status, SessionStatus.failure);
        expect(cubit.state.requiresReauthentication, isTrue);
        expect(cubit.state.errorMessage, contains('Sign in again'));
      },
    );
  });
}

class FakeSessionRepository implements SessionRepository {
  FakeSessionRepository({
    List<SessionRoundState>? nextPairings,
    this.feedback = const SessionChoiceFeedback(
      verdict: 'Decisive',
      why: 'Default feedback',
    ),
    this.reveal = const SessionReveal(
      interpretation: 'Default reveal',
      vector: <String, double>{},
      allowedClaims: <RevealClaim>[],
      counterarguments: <RevealCounterargument>[],
    ),
    SharedReveal? sharedReveal,
    this.sharedRevealError,
    this.nextPairingsError,
  }) : _nextPairings = List<SessionRoundState>.from(
         nextPairings ?? const <SessionRoundState>[],
       ),
       _sharedReveal = sharedReveal;

  final List<SessionRoundState> _nextPairings;
  final SessionChoiceFeedback feedback;
  final SessionReveal reveal;
  final SharedReveal? _sharedReveal;
  final Object? sharedRevealError;
  final Object? nextPairingsError;
  String? lastChoiceSongId;
  int? lastChoiceMsToDecide;
  String? lastSkippedPairingId;
  int? lastSkipMsToDecide;

  @override
  Future<SessionRoundState> fetchNextPairing({
    required String sessionId,
  }) async {
    if (nextPairingsError != null) {
      throw nextPairingsError!;
    }
    if (_nextPairings.isEmpty) {
      throw StateError('No more pairings queued');
    }
    return _nextPairings.removeAt(0);
  }

  @override
  Future<SessionChoiceFeedback> submitChoice({
    required String sessionId,
    required String pairingId,
    required String chosenSongId,
    required int msToDecide,
  }) async {
    lastChoiceSongId = chosenSongId;
    lastChoiceMsToDecide = msToDecide;
    return feedback;
  }

  @override
  Future<void> skipPairing({
    required String sessionId,
    required String pairingId,
    required int msToDecide,
  }) async {
    lastSkippedPairingId = pairingId;
    lastSkipMsToDecide = msToDecide;
  }

  @override
  Future<SessionReveal> revealSession({required String sessionId}) async {
    return reveal;
  }

  @override
  Future<SharedReveal> fetchSharedReveal({required String token}) async {
    if (sharedRevealError != null) {
      throw sharedRevealError!;
    }
    return _sharedReveal ??
        SharedReveal(
          sessionId: 'session-1',
          shareToken: token,
          completedAt: DateTime.parse('2026-07-01T00:00:00Z'),
          interpretation: 'Fallback public reveal',
          definingChoices: const <DefiningChoice>[],
        );
  }
}

StartedMusicSession _startedSession() {
  return const StartedMusicSession(
    sessionId: 'session-1',
    sessionLane: 'cinematic',
    sessionLaneConfidence: 0.64,
    analysisLane: 'cinematic',
    analysisConfidence: 0.58,
    hypothesis: 'You lean toward tension and release.',
    reaction: 'Promising start.',
    reasoning: <String>['You reward atmosphere.'],
    secondaryLanes: <String>['electronic'],
    songs: <String>['Song A', 'Song B', 'Song C'],
  );
}
