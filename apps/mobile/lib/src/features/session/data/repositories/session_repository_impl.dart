import '../../domain/entities/session_pairing.dart';
import '../../domain/entities/session_reveal.dart';
import '../../domain/repositories/session_repository.dart';
import '../datasources/session_remote_data_source.dart';

class SessionRepositoryImpl implements SessionRepository {
  SessionRepositoryImpl(this._remoteDataSource);

  final SessionRemoteDataSource _remoteDataSource;

  @override
  Future<SessionRoundState> fetchNextPairing({
    required String sessionId,
  }) async {
    final response = await _remoteDataSource.fetchNextPairing(
      sessionId: sessionId,
    );
    return _mapNextResponse(sessionId: sessionId, response: response);
  }

  @override
  Future<SessionChoiceFeedback> submitChoice({
    required String sessionId,
    required String pairingId,
    required String chosenSongId,
    required int msToDecide,
  }) async {
    final response = await _remoteDataSource.submitChoice(
      sessionId: sessionId,
      pairingId: pairingId,
      chosenSongId: chosenSongId,
      msToDecide: msToDecide,
    );

    return SessionChoiceFeedback(
      verdict: response['verdict'] as String? ?? '',
      why: response['why'] as String? ?? '',
      hesitation: response['hesitation'] as String?,
      dimension: response['dim'] as String?,
      delta: _readDouble(response['delta']),
    );
  }

  @override
  Future<void> skipPairing({
    required String sessionId,
    required String pairingId,
    required int msToDecide,
  }) {
    return _remoteDataSource.skipPairing(
      sessionId: sessionId,
      pairingId: pairingId,
      msToDecide: msToDecide,
    );
  }

  @override
  Future<SessionReveal> revealSession({required String sessionId}) async {
    final response = await _remoteDataSource.revealSession(
      sessionId: sessionId,
    );
    return SessionReveal(
      archetypeId: response['archetypeId'] as String?,
      archetypeName: response['archetypeName'] as String?,
      interpretation: response['interpretation'] as String? ?? '',
      vector: _readVector(response['vector']),
      allowedClaims: _readAllowedClaims(response['allowed_claims']),
      counterarguments: _readCounterarguments(response['counterarguments']),
      shareToken: response['share_token'] as String?,
    );
  }

  @override
  Future<SharedReveal> fetchSharedReveal({required String token}) async {
    final response = await _remoteDataSource.fetchSharedReveal(token: token);
    final archetypeData = response['archetype'];
    return SharedReveal(
      sessionId: response['session_id'] as String,
      shareToken: response['share_token'] as String,
      completedAt: DateTime.parse(response['completed_at'] as String),
      lane: response['lane'] as String?,
      interpretation: response['interpretation'] as String? ?? '',
      archetype: archetypeData is Map<String, dynamic>
          ? SharedRevealArchetype(
              id: archetypeData['id'] as String?,
              name: archetypeData['name'] as String? ?? '',
              tagline: archetypeData['tagline'] as String?,
              description: archetypeData['description'] as String?,
            )
          : null,
      definingChoices: _readDefiningChoices(response['defining_choices']),
    );
  }

  SessionRoundState _mapNextResponse({
    required String sessionId,
    required Map<String, dynamic> response,
  }) {
    final pairing = response['pairing'];
    return SessionRoundState(
      sessionId: sessionId,
      round: _readInt(response['round']),
      confidence: _readDouble(response['confidence']),
      done: response['done'] == true,
      pairing: pairing is Map<String, dynamic> ? _mapPairing(pairing) : null,
    );
  }

  SessionPairing _mapPairing(Map<String, dynamic> pairing) {
    return SessionPairing(
      id: (pairing['pairing_id'] ?? pairing['id']) as String,
      songA: _mapSong(pairing['song_a'] as Map<String, dynamic>),
      songB: _mapSong(pairing['song_b'] as Map<String, dynamic>),
      tests: _readStringList(pairing['tests']),
      hypothesis: pairing['hypothesis'] as String?,
      whyGood: pairing['why_good'] as String?,
      diagnosticWeight: _readIntOrNull(pairing['diagnostic_weight']),
      lane: pairing['lane'] as String?,
    );
  }

  SessionPairingSong _mapSong(Map<String, dynamic> song) {
    return SessionPairingSong(
      id: song['id'] as String,
      title: song['title'] as String,
      artist: song['artist'] as String,
      year: _readIntOrNull(song['year']),
      primaryLane: song['primary_lane'] as String?,
      catalogLane: song['lane'] as String?,
    );
  }

  List<String> _readStringList(Object? value) {
    if (value is List) {
      return value.whereType<String>().toList(growable: false);
    }
    return const <String>[];
  }

  int _readInt(Object? value) {
    if (value is num) {
      return value.toInt();
    }
    return 0;
  }

  int? _readIntOrNull(Object? value) {
    if (value is num) {
      return value.toInt();
    }
    return null;
  }

  double _readDouble(Object? value) {
    if (value is num) {
      return value.toDouble();
    }
    return 0;
  }

  Map<String, double> _readVector(Object? value) {
    if (value is Map<String, dynamic>) {
      return value.map((key, rawValue) => MapEntry(key, _readDouble(rawValue)));
    }
    return const <String, double>{};
  }

  List<RevealClaim> _readAllowedClaims(Object? value) {
    if (value is! List) {
      return const <RevealClaim>[];
    }

    return value
        .whereType<Map<String, dynamic>>()
        .map((claim) {
          return RevealClaim(
            dimension: claim['dimension'] as String? ?? '',
            preferred: claim['preferred'] as String? ?? '',
            opposed: claim['opposed'] as String? ?? '',
            supportingChoices: _readInt(claim['supporting_choices']),
            testedTotal: _readInt(claim['tested_total']),
            confidence: _readDouble(claim['confidence']),
            examples: _readClaimExamples(claim['examples']),
            tradeoff: claim['tradeoff'] as String? ?? '',
          );
        })
        .toList(growable: false);
  }

  List<RevealClaimExample> _readClaimExamples(Object? value) {
    if (value is! List) {
      return const <RevealClaimExample>[];
    }

    return value
        .whereType<Map<String, dynamic>>()
        .map((example) {
          return RevealClaimExample(
            chosen: example['chosen'] as String? ?? '',
            rejected: example['rejected'] as String? ?? '',
            delta: _readDouble(example['delta']),
          );
        })
        .toList(growable: false);
  }

  List<RevealCounterargument> _readCounterarguments(Object? value) {
    if (value is! List) {
      return const <RevealCounterargument>[];
    }

    return value
        .whereType<Map<String, dynamic>>()
        .map((counter) {
          return RevealCounterargument(
            claim: counter['claim'] as String? ?? '',
            impact: counter['impact'] as String? ?? '',
            notes: counter['notes'] as String? ?? '',
          );
        })
        .toList(growable: false);
  }

  List<DefiningChoice> _readDefiningChoices(Object? value) {
    if (value is! List) {
      return const <DefiningChoice>[];
    }

    return value
        .whereType<Map<String, dynamic>>()
        .map((choice) {
          return DefiningChoice(
            chosen: choice['chosen'] as String? ?? '',
            chosenArtist: choice['chosenArtist'] as String? ?? '',
            rejected: choice['rejected'] as String? ?? '',
            rejectedArtist: choice['rejectedArtist'] as String? ?? '',
          );
        })
        .toList(growable: false);
  }
}
