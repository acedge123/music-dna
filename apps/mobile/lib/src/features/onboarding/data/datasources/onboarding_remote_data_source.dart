import 'dart:convert';

import 'package:http/http.dart' as http;

import '../../../../core/network/app_api_exception.dart';
import '../../../../core/network/music_dna_api_client.dart';

class OnboardingRemoteDataSource {
  OnboardingRemoteDataSource(this._apiClient);

  final MusicDnaApiClient _apiClient;

  Future<Map<String, dynamic>> reactToSong({
    required String song,
    required int index,
    required List<String> priorSongs,
  }) async {
    final response = await _apiClient.post(
      '/api/v1/onboarding/react',
      body: <String, dynamic>{
        'song': song,
        'index': index,
        'priorSongs': priorSongs,
      },
    );
    return _decodeJson(response);
  }

  Future<Map<String, dynamic>> commitOpeningThree({
    required List<String> songs,
  }) async {
    final response = await _apiClient.post(
      '/api/v1/onboarding/opener',
      body: <String, dynamic>{'songs': songs},
    );
    return _decodeJson(response);
  }

  Future<Map<String, dynamic>> startSession() async {
    final response = await _apiClient.post('/api/v1/session');
    return _decodeJson(response);
  }

  Map<String, dynamic> _decodeJson(http.Response response) {
    final body = response.body.isEmpty
        ? const <String, dynamic>{}
        : jsonDecode(response.body) as Map<String, dynamic>;

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
