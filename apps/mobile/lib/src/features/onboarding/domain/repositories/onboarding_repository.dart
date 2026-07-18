import '../entities/onboarding_reaction.dart';
import '../entities/started_music_session.dart';

abstract class OnboardingRepository {
  Future<OnboardingReaction> reactToSong({
    required String song,
    required int index,
    required List<String> priorSongs,
  });

  Future<StartedMusicSession> submitOpeningThree({required List<String> songs});
}
