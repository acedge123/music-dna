import '../entities/session_pairing.dart';
import '../entities/session_reveal.dart';

abstract class SessionRepository {
  Future<SessionRoundState> fetchNextPairing({required String sessionId});

  Future<SessionChoiceFeedback> submitChoice({
    required String sessionId,
    required String pairingId,
    required String chosenSongId,
    required int msToDecide,
  });

  Future<void> skipPairing({
    required String sessionId,
    required String pairingId,
    required int msToDecide,
  });

  Future<SessionReveal> revealSession({required String sessionId});

  Future<SharedReveal> fetchSharedReveal({required String token});
}
