import 'dart:convert';

import 'package:shared_preferences/shared_preferences.dart';

import '../../onboarding/domain/entities/started_music_session.dart';

class SessionResumeStore {
  static const String _key = 'musicdna.started_session.v1';

  Future<void> save(StartedMusicSession session) async {
    final preferences = await SharedPreferences.getInstance();
    await preferences.setString(_key, jsonEncode(session.toJson()));
  }

  Future<StartedMusicSession?> load() async {
    final preferences = await SharedPreferences.getInstance();
    final raw = preferences.getString(_key);
    if (raw == null || raw.isEmpty) {
      return null;
    }

    try {
      final decoded = jsonDecode(raw);
      if (decoded is Map<String, dynamic>) {
        return StartedMusicSession.fromJson(decoded);
      }
    } catch (_) {
      await clear();
    }

    return null;
  }

  Future<void> clear() async {
    final preferences = await SharedPreferences.getInstance();
    await preferences.remove(_key);
  }
}
