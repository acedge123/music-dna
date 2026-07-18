import 'package:equatable/equatable.dart';

class StartedMusicSession extends Equatable {
  const StartedMusicSession({
    required this.sessionId,
    required this.sessionLane,
    required this.sessionLaneConfidence,
    required this.analysisLane,
    required this.analysisConfidence,
    required this.hypothesis,
    required this.reaction,
    required this.reasoning,
    required this.secondaryLanes,
    required this.songs,
  });

  final String sessionId;
  final String sessionLane;
  final double sessionLaneConfidence;
  final String analysisLane;
  final double analysisConfidence;
  final String hypothesis;
  final String reaction;
  final List<String> reasoning;
  final List<String> secondaryLanes;
  final List<String> songs;

  Map<String, dynamic> toJson() {
    return <String, dynamic>{
      'sessionId': sessionId,
      'sessionLane': sessionLane,
      'sessionLaneConfidence': sessionLaneConfidence,
      'analysisLane': analysisLane,
      'analysisConfidence': analysisConfidence,
      'hypothesis': hypothesis,
      'reaction': reaction,
      'reasoning': reasoning,
      'secondaryLanes': secondaryLanes,
      'songs': songs,
    };
  }

  static StartedMusicSession? fromJson(Map<String, dynamic> json) {
    final sessionId = json['sessionId'];
    if (sessionId is! String || sessionId.isEmpty) {
      return null;
    }

    return StartedMusicSession(
      sessionId: sessionId,
      sessionLane: json['sessionLane'] as String? ?? '',
      sessionLaneConfidence: _readDouble(json['sessionLaneConfidence']),
      analysisLane: json['analysisLane'] as String? ?? '',
      analysisConfidence: _readDouble(json['analysisConfidence']),
      hypothesis: json['hypothesis'] as String? ?? '',
      reaction: json['reaction'] as String? ?? '',
      reasoning: _readStringList(json['reasoning']),
      secondaryLanes: _readStringList(json['secondaryLanes']),
      songs: _readStringList(json['songs']),
    );
  }

  @override
  List<Object?> get props => <Object?>[
    sessionId,
    sessionLane,
    sessionLaneConfidence,
    analysisLane,
    analysisConfidence,
    hypothesis,
    reaction,
    reasoning,
    secondaryLanes,
    songs,
  ];

  static double _readDouble(Object? value) {
    if (value is num) {
      return value.toDouble();
    }
    return 0;
  }

  static List<String> _readStringList(Object? value) {
    if (value is List) {
      return value.whereType<String>().toList(growable: false);
    }
    return const <String>[];
  }
}
