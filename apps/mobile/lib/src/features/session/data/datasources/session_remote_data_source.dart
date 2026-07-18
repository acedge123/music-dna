import 'dart:convert';

import 'package:http/http.dart' as http;

import '../../../../core/network/app_api_exception.dart';
import '../../../../core/network/music_dna_api_client.dart';

class SessionRemoteDataSource {
  SessionRemoteDataSource(this._apiClient);

  final MusicDnaApiClient _apiClient;

  Future<Map<String, dynamic>> fetchNextPairing({
    required String sessionId,
  }) async {
    final response = await _apiClient.get('/api/v1/session/$sessionId/next');
    return _decodeJson(response);
  }

  Future<Map<String, dynamic>> submitChoice({
    required String sessionId,
    required String pairingId,
    required String chosenSongId,
    required int msToDecide,
  }) async {
    final response = await _apiClient.post(
      '/api/v1/session/$sessionId/choice',
      body: <String, dynamic>{
        'pairing_id': pairingId,
        'chosen_song_id': chosenSongId,
        'ms_to_decide': msToDecide,
      },
    );
    return _decodeJson(response);
  }

  Future<void> skipPairing({
    required String sessionId,
    required String pairingId,
    required int msToDecide,
  }) async {
    final response = await _apiClient.post(
      '/api/v1/session/$sessionId/skip',
      body: <String, dynamic>{
        'pairing_id': pairingId,
        'ms_to_decide': msToDecide,
      },
    );
    _decodeJson(response);
  }

  Future<Map<String, dynamic>> revealSession({
    required String sessionId,
  }) async {
    final response = await _apiClient.post('/api/v1/session/$sessionId/reveal');
    return _decodeJson(response);
  }

  Future<Map<String, dynamic>> fetchSharedReveal({
    required String token,
  }) async {
    final response = await _apiClient.get('/api/v1/share/$token');
    return _decodeJson(response);
  }

  Map<String, dynamic> _decodeJson(http.Response response) {
    final body = _readBody(response);

    if (response.statusCode >= 400) {
      final error = body['error'];
      if (error is Map<String, dynamic>) {
        final message = error['message'] as String?;
        final code = error['code'] as String?;
        throw AppApiException(
          kind: _mapErrorKind(code),
          statusCode: response.statusCode,
          message: message?.isNotEmpty == true
              ? message!
              : 'Something went wrong.',
        );
      }
      throw AppApiException(
        kind: AppApiErrorKind.unknown,
        statusCode: response.statusCode,
        message: 'Something went wrong.',
      );
    }

    return body;
  }

  Map<String, dynamic> _readBody(http.Response response) {
    if (response.body.isEmpty) {
      return const <String, dynamic>{};
    }

    try {
      final decoded = jsonDecode(response.body);
      if (decoded is Map<String, dynamic>) {
        return decoded;
      }
    } catch (_) {
      // Normalized below.
    }

    throw AppApiException(
      kind: AppApiErrorKind.unknown,
      statusCode: response.statusCode,
      message: 'The server returned an unexpected response.',
    );
  }

  AppApiErrorKind _mapErrorKind(String? code) {
    switch (code) {
      case 'UNAUTHORIZED':
        return AppApiErrorKind.unauthorized;
      case 'FORBIDDEN':
        return AppApiErrorKind.forbidden;
      case 'INVALID_INPUT':
        return AppApiErrorKind.invalidInput;
      case 'UPSTREAM':
        return AppApiErrorKind.upstream;
      case 'INTERNAL':
        return AppApiErrorKind.internal;
      default:
        return AppApiErrorKind.unknown;
    }
  }
}
