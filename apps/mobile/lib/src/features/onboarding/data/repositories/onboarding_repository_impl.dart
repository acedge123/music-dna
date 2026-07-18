import '../../domain/entities/onboarding_reaction.dart';
import '../../domain/entities/started_music_session.dart';
import '../../domain/repositories/onboarding_repository.dart';
import '../datasources/onboarding_remote_data_source.dart';

class OnboardingRepositoryImpl implements OnboardingRepository {
  OnboardingRepositoryImpl(this._remoteDataSource);

  final OnboardingRemoteDataSource _remoteDataSource;

  @override
  Future<OnboardingReaction> reactToSong({
    required String song,
    required int index,
    required List<String> priorSongs,
  }) async {
    final response = await _remoteDataSource.reactToSong(
      song: song,
      index: index,
      priorSongs: priorSongs,
    );

    return OnboardingReaction(
      reaction: response['reaction'] as String? ?? '',
      nextLabel: response['next_label'] as String?,
    );
  }

  @override
  Future<StartedMusicSession> submitOpeningThree({
    required List<String> songs,
  }) async {
    final opener = await _remoteDataSource.commitOpeningThree(songs: songs);
    final session = await _remoteDataSource.startSession();

    return StartedMusicSession(
      sessionId: session['session_id'] as String,
      sessionLane: session['lane'] as String,
      sessionLaneConfidence: _readDouble(session['lane_confidence']),
      analysisLane: opener['lane'] as String,
      analysisConfidence: _readDouble(
        opener['confidence'] ?? opener['lane_confidence'],
      ),
      hypothesis: opener['hypothesis'] as String? ?? '',
      reaction: opener['reaction'] as String? ?? '',
      reasoning: _readStringList(opener['reasoning']),
      secondaryLanes: _readStringList(opener['secondary_lanes']),
      songs: songs,
    );
  }

  double _readDouble(Object? value) {
    if (value is num) {
      return value.toDouble();
    }
    return 0;
  }

  List<String> _readStringList(Object? value) {
    if (value is List) {
      return value.whereType<String>().toList(growable: false);
    }
    return const <String>[];
  }
}
